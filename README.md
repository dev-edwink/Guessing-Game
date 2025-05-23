# Live Guessing Game

A fun, interactive Node.js game for you and your friends! Host and join live guessing sessions, compete for points, and see results in real time.

## Features

- **Chat-like Game Session Interface:** Play in a familiar chat-style environment.
- **Game Master & Players:** One user starts a session as the game master; others join as players.
- **Live Player Count:** See how many players are connected before the game starts.
- **Custom Questions:** Game master creates a question and answer for each session.
- **Session Rules:**
  - Game master starts the session (minimum 3 players required).
  - Players have 3 attempts to guess the answer.
  - No new players can join once the game starts.
  - Session ends if a player guesses correctly or after 60 seconds.
- **Scoring:**
  - First correct guess wins (10 points).
  - Scores are visible to all players.
  - No points if time expires.
- **Session Rotation:** After each round, a new player becomes the game master.
- **Session Cleanup:** Sessions are deleted when all players leave.

## How to Run

1. **Clone or download this repository.**
2. **Install dependencies:**
   ```
   npm install
   ```
3. **Start the server:**
   ```
   npm start
   ```
4. **Open your browser and connect to the game (see project code for the correct URL/port).**

## Requirements

- Node.js (latest LTS recommended)
- No additional global dependencies

## Gameplay

1. One user creates a session as the game master.
2. Other users join as players.
3. Game master sets a question and answer.
4. When enough players have joined, the game master starts the session.
5. Players guess the answer (max 3 attempts each).
6. The winner is announced and scores are updated.
7. The next round begins with a new game master.

Enjoy playing and competing with your friends!

## License

MIT License
