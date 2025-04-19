const socket = io();
let sessionId = null;
let playerName = null;
let isGameMaster = false;

function createSession() {
  const name = document.getElementById('player-name').value.trim();
  if (!name) {
    alert('Please enter a name.');
    return;
  }
  socket.emit('createSession', { playerName: name });
}

function joinSession() {
  const name = document.getElementById('player-name').value.trim();
  const id = document.getElementById('session-id').value.trim();
  if (!name || !id) {
    alert('Please enter a name and session ID.');
    return;
  }
  socket.emit('joinSession', { sessionId: id, playerName: name });
}

function setQuestion() {
  const question = document.getElementById('question-input').value.trim();
  const answer = document.getElementById('answer-input').value.trim();
  if (!question || !answer) {
    alert('Please enter both a question and an answer.');
    return;
  }
  socket.emit('setQuestion', { sessionId, question, answer });
}

function startGame() {
  socket.emit('startGame', { sessionId });
}

function sendGuess() {
  const guess = document.getElementById('message-input').value.trim();
  if (!guess) {
    alert('Please enter a guess.');
    return;
  }
  socket.emit('guess', { sessionId, guess });
  document.getElementById('message-input').value = '';
}

function leaveSession() {
  if (!sessionId) {
    alert('Not in a session.');
    return;
  }
  socket.emit('leaveSession', { sessionId });
}

socket.on('sessionCreated', ({ sessionId: id, playerName: name }) => {
  sessionId = id;
  playerName = name;
  isGameMaster = true;
  showGameScreen();
  document.getElementById('session-id-display').textContent = id;
  document.getElementById('master-controls').style.display = 'block';
});

socket.on('sessionJoined', ({ sessionId: id, playerName: name }) => {
  sessionId = id;
  playerName = name;
  isGameMaster = false;
  showGameScreen();
  document.getElementById('session-id-display').textContent = id;
});

socket.on('sessionLeft', () => {
  sessionId = null;
  playerName = null;
  isGameMaster = false;
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('start-screen').style.display = 'block';
  document.getElementById('messages').innerHTML = '';
  document.getElementById('score-list').innerHTML = '';
  document.getElementById('player-count').textContent = '0';
  document.getElementById('game-master').textContent = '';
});

socket.on('updatePlayers', ({ players, playerCount }) => {
  document.getElementById('player-count').textContent = playerCount;
  const gameMaster = players.find((p) => p.socketId === socket.id && isGameMaster);
  document.getElementById('game-master').textContent = gameMaster ? playerName : players[0]?.name || 'Unknown';
  updateScores(players);
});

socket.on('questionSet', ({ question }) => {
  addMessage(`Question set: ${question}`);
});

socket.on('gameStarted', ({ question }) => {
  addMessage(`Game started! Question: ${question}`);
  document.getElementById('input-area').style.display = 'block';
});

socket.on('guessResult', ({ isCorrect, attemptsLeft }) => {
  addMessage(isCorrect ? 'Correct!' : `Incorrect. ${attemptsLeft} attempts left.`);
});

socket.on('gameEnded', ({ winner, answer, players }) => {
  if (winner) {
    addMessage(winner === playerName ? 'You won!' : `Game ended! Winner: ${winner}. Answer: ${answer}`);
  } else {
    addMessage(`Time's up! No winner. Answer: ${answer}`);
  }
  updateScores(players);
  document.getElementById('input-area').style.display = 'none';
});

socket.on('newGameMaster', ({ gameMaster, players }) => {
  isGameMaster = gameMaster === playerName;
  document.getElementById('master-controls').style.display = isGameMaster ? 'block' : 'none';
  addMessage(`New game master: ${gameMaster}`);
  updateScores(players);
});

socket.on('sessionDeleted', () => {
  addMessage('Session ended. All players have left.');
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('start-screen').style.display = 'block';
  document.getElementById('messages').innerHTML = '';
  document.getElementById('score-list').innerHTML = '';
  document.getElementById('player-count').textContent = '0';
  document.getElementById('game-master').textContent = '';
});

socket.on('message', ({ content }) => {
  addMessage(content);
});

socket.on('error', (message) => {
  alert(message);
});

function showGameScreen() {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
}

function addMessage(message) {
  const messages = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'message';
  div.textContent = message;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function updateScores(players) {
  const scoreList = document.getElementById('score-list');
  scoreList.innerHTML = '';
  players.forEach((player) => {
    const li = document.createElement('li');
    li.textContent = `${player.name}: ${player.score} points`;
    scoreList.appendChild(li);
  });
}