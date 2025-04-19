const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const GameSession = require('./models/GameSession');
const connectDB = require('./config/db');
const { connect } = require('http2');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

connectDB(); // Connect to MongoDB

const validateInput = (input, maxLength = 100) => {
  return typeof input === 'string' && input.trim().length > 0 && input.length <= maxLength;
};

// Handle player leaving (used by both disconnect and leaveSession)
const handlePlayerLeave = async (socket, sessionId) => {
  const session = await GameSession.findById(sessionId);
  if (!session) return;

  session.players = session.players.filter((p) => p.socketId !== socket.id);

  if (session.gameMaster === socket.id) {
    if (session.players.length > 0) {
      session.gameMaster = session.players[0].socketId;
    } else {
      await GameSession.deleteOne({ _id: sessionId });
      io.to(sessionId).emit('sessionDeleted');
      return;
    }
  }

  if (session.players.length === 0) {
    await GameSession.deleteOne({ _id: sessionId });
    io.to(sessionId).emit('sessionDeleted');
  } else {
    await session.save();
    io.to(sessionId).emit('updatePlayers', {
      players: session.players,
      playerCount: session.players.length,
    });
    if (session.gameMaster !== socket.id) {
      io.to(sessionId).emit('message', {
        content: `${session.players.find((p) => p.socketId === socket.id)?.name || 'A player'} has left the session.`,
      });
    }
  }
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createSession', async ({ playerName }) => {
    if (!validateInput(playerName, 20)) {
      socket.emit('error', 'Invalid player name.');
      return;
    }

    const session = await GameSession.create({
      gameMaster: socket.id,
      players: [{ socketId: socket.id, name: playerName, score: 0 }],
      status: 'waiting',
    });

    socket.join(session._id.toString());
    socket.emit('sessionCreated', { sessionId: session._id, playerName });
    io.to(session._id.toString()).emit('updatePlayers', {
      players: session.players,
      playerCount: session.players.length,
    });
  });

  socket.on('joinSession', async ({ sessionId, playerName }) => {
    if (!validateInput(playerName, 20) || !mongoose.Types.ObjectId.isValid(sessionId)) {
      socket.emit('error', 'Invalid session ID or player name.');
      return;
    }

    const session = await GameSession.findById(sessionId);
    if (!session || session.status !== 'waiting') {
      socket.emit('error', 'Session not found or already started.');
      return;
    }

    if (session.players.some((p) => p.name === playerName)) {
      socket.emit('error', 'Player name already taken.');
      return;
    }

    session.players.push({ socketId: socket.id, name: playerName, score: 0 });
    await session.save();

    socket.join(sessionId);
    socket.emit('sessionJoined', { sessionId, playerName });
    io.to(sessionId).emit('updatePlayers', {
      players: session.players,
      playerCount: session.players.length,
    });
    io.to(sessionId).emit('message', {
      content: `${playerName} has joined the session.`,
    });
  });

  socket.on('setQuestion', async ({ sessionId, question, answer }) => {
    if (!validateInput(question) || !validateInput(answer, 50)) {
      socket.emit('error', 'Invalid question or answer.');
      return;
    }

    const session = await GameSession.findById(sessionId);
    if (!session || session.gameMaster !== socket.id) {
      socket.emit('error', 'Not authorized or session not found.');
      return;
    }

    session.question = question;
    session.answer = answer.toLowerCase();
    await session.save();

    io.to(sessionId).emit('questionSet', { question });
    io.to(sessionId).emit('message', { content: 'Question set by the game master.' });
  });

  socket.on('startGame', async ({ sessionId }) => {
    const session = await GameSession.findById(sessionId);
    if (!session || session.gameMaster !== socket.id || session.players.length < 3) {
      socket.emit('error', 'Not authorized, session not found, or too few players.');
      return;
    }

    session.status = 'active';
    session.startTime = Date.now();
    session.players.forEach((p) => (p.attempts = 3));
    await session.save();

    io.to(sessionId).emit('gameStarted', { question: session.question });
    io.to(sessionId).emit('message', { content: 'Game started!' });
    setTimeout(() => endGameIfExpired(sessionId), 60000);
  });

  socket.on('guess', async ({ sessionId, guess }) => {
    if (!validateInput(guess, 50)) {
      socket.emit('error', 'Invalid guess.');
      return;
    }

    const session = await GameSession.findById(sessionId);
    if (!session || session.status !== 'active') {
      socket.emit('error', 'Game not active.');
      return;
    }

    const player = session.players.find((p) => p.socketId === socket.id);
    if (!player || player.attempts <= 0) {
      socket.emit('error', 'No attempts left.');
      return;
    }

    player.attempts -= 1;
    const isCorrect = guess.toLowerCase() === session.answer;

    if (isCorrect) {
      player.score += 10;
      session.status = 'ended';
      session.winner = player.name;
      await session.save();

      io.to(sessionId).emit('gameEnded', {
        winner: player.name,
        answer: session.answer,
        players: session.players,
      });
      io.to(sessionId).emit('message', {
        content: `${player.name} won with the correct answer: ${session.answer}!`,
      });

      setTimeout(() => switchGameMaster(sessionId), 5000);
    } else {
      await session.save();
      socket.emit('guessResult', {
        isCorrect: false,
        attemptsLeft: player.attempts,
      });
      socket.emit('message', {
        content: `Incorrect guess. ${player.attempts} attempts left.`,
      });
    }
  });

  socket.on('leaveSession', async ({ sessionId }) => {
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      socket.emit('error', 'Invalid session ID.');
      return;
    }
    await handlePlayerLeave(socket, sessionId);
    socket.leave(sessionId);
    socket.emit('sessionLeft');
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    const sessions = await GameSession.find({
      $or: [
        { gameMaster: socket.id },
        { 'players.socketId': socket.id },
      ],
    });

    for (const session of sessions) {
      await handlePlayerLeave(socket, session._id.toString());
    }
  });

  const endGameIfExpired = async (sessionId) => {
    const session = await GameSession.findById(sessionId);
    if (session && session.status === 'active') {
      session.status = 'ended';
      await session.save();

      io.to(sessionId).emit('gameEnded', {
        winner: null,
        answer: session.answer,
        players: session.players,
      });
      io.to(sessionId).emit('message', {
        content: `Time's up! No winner. Answer: ${session.answer}`,
      });

      setTimeout(() => switchGameMaster(sessionId), 5000);
    }
  };

  const switchGameMaster = async (sessionId) => {
    const session = await GameSession.findById(sessionId);
    if (!session) return;

    const currentMasterIndex = session.players.findIndex(
      (p) => p.socketId === session.gameMaster
    );
    const nextMasterIndex = (currentMasterIndex + 1) % session.players.length;
    session.gameMaster = session.players[nextMasterIndex].socketId;
    session.status = 'waiting';
    session.question = null;
    session.answer = null;
    session.winner = null;
    session.startTime = null;
    await session.save();

    io.to(sessionId).emit('newGameMaster', {
      gameMaster: session.players[nextMasterIndex].name,
      players: session.players,
    });
    io.to(sessionId).emit('message', {
      content: `New game master: ${session.players[nextMasterIndex].name}`,
    });
  };
});

server.listen(process.env.PORT || 5000, () => {
  console.log('Server running on port 5000');
});