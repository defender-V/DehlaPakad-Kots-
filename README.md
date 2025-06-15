# DehlaPakad - Multiplayer Card Game

A real-time multiplayer card game built with Node.js, Express, and Socket.IO where players can compete against each other in an engaging card game experience.

## 🎮 Features

- Real-time multiplayer gameplay
- Interactive user interface
- Live game state synchronization
- Multiple player support
- Responsive design

# Kots Game Rules

**Kots**, also known as **Dehla Pakad**, is a traditional trick-taking card game played in teams. The goal is to capture the most **10s** or win. The game requires strategic play and teamwork.

---

- **Players:** (2,4,6,8) (in teams of 2)
- **Deck:** Standard 52-card deck (no jokers)(48 cards(all 2's removed) for 6 and 8 players)

Players sit alternately so that teammates are opposite each other.

---

## 🎮 Gameplay

- The player to join first will start the round.
- Players must **follow suit** if they have cards of the same suit.
- If a player does not have a card in the lead suit, they may play any card, including a **trump**.
- The **highest card of the lead suit** or the **highest trump** wins the hand.
- The round will be won by that team that secures modt of the tens.
- The game will be played for that many rounds as the number of players.
- The game will end when all players have spoken trump.
- The game will be won by the team which won most of the rounds

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/defender-V/DehlaPakad-Kots-.git
cd DehlaPakad-Kots-
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## 🛠️ Built With

- [Node.js](https://nodejs.org/) - JavaScript runtime
- [Express](https://expressjs.com/) - Web framework
- [Socket.IO](https://socket.io/) - Real-time communication
- [UUID](https://www.npmjs.com/package/uuid) - Unique identifier generation

## 📁 Project Structure

- `server.js` - Main server file handling game logic and WebSocket connections
- `client.js` - Client-side game logic and UI interactions
- `gameLogic.js` - Core game rules and mechanics
- `index.html` - Main game interface
- `style.css` - Game styling and layout

## 🎯 How to Play

1. Open the game in your web browser
2. Create a new game room or join an existing one
3. Wait for other players to join
4. Follow the on-screen instructions to play your cards
5. The game will automatically handle turns and scoring

## 👥 Authors

- **defender-V** - *Initial work* - [GitHub Profile](https://github.com/defender-V)

## 🙏 Acknowledgments

- Inspired by traditional card games
- Built with modern web technologies for the best gaming experience
