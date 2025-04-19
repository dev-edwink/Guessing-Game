const mongoose = require('mongoose');

const gameSessionSchema = new mongoose.Schema({
  gameMaster: String,
  players: [
    {
      socketId: String,
      name: String,
      score: { type: Number, default: 0 },
      attempts: { type: Number, default: 3 },
    },
  ],
  question: String,
  answer: String,
  status: { type: String, default: 'waiting' },
  winner: String,
  startTime: Date,
});

module.exports = mongoose.model('GameSession', gameSessionSchema);