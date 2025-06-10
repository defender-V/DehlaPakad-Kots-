const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));

let rooms = {};

function createShuffledDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  let deck = [];
  for (let suit of suits) for (let value of values) deck.push({ suit, value });
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

io.on('connection', (socket) => {
  let currentRoomId = null;
  let currentPlayerName = null;

  socket.on('createRoom', ({ playerName, numPlayers }) => {
    const roomId = uuidv4().slice(0, 6);
    rooms[roomId] = {
      players: [{ id: socket.id, name: playerName }],
      maxPlayers: parseInt(numPlayers, 10),
      started: false,
      deck: [],
      hands: {}
    };
    currentRoomId = roomId;
    currentPlayerName = playerName;
    socket.join(roomId);
    io.to(roomId).emit('roomCreated', { roomId, players: rooms[roomId].players });
  });

  socket.on('joinRoom', ({ playerName, roomId }) => {
    if (!rooms[roomId]) {
      socket.emit('roomError', 'Room does not exist!');
      return;
    }
    if (rooms[roomId].players.length >= rooms[roomId].maxPlayers) {
      socket.emit('roomError', 'Room is full!');
      return;
    }
    rooms[roomId].players.push({ id: socket.id, name: playerName });
    currentRoomId = roomId;
    currentPlayerName = playerName;
    socket.join(roomId);
    io.to(roomId).emit('roomJoined', { roomId, players: rooms[roomId].players });
    io.to(roomId).emit('updatePlayers', rooms[roomId].players);

    // If room is now full, start the game
    if (rooms[roomId].players.length === rooms[roomId].maxPlayers && !rooms[roomId].started) {
      rooms[roomId].started = true;
      // Shuffle and deal
      const deck = createShuffledDeck();
      rooms[roomId].deck = deck;
      const handSize = Math.floor(deck.length / rooms[roomId].maxPlayers);
      rooms[roomId].hands = {};
      rooms[roomId].players.forEach((player, idx) => {
        rooms[roomId].hands[player.id] = deck.slice(idx * handSize, (idx + 1) * handSize);
      });
      io.to(roomId).emit('startGame', { handSize }); // Notify clients to animate shuffling
      setTimeout(() => {
        // After animation, send hands (and seat info)
        rooms[roomId].players.forEach((player, idx) => {
          io.to(player.id).emit('dealHand', {
            hand: rooms[roomId].hands[player.id],
            seat: idx,
            players: rooms[roomId].players.map((p, i) => ({
              name: p.name,
              seat: i,
              isSelf: p.id === player.id
            })),
            roomId
          });
        });
      }, 2000); // 2s shuffle animation
    }
  });

  socket.on('playCard', ({ roomId, card }) => {
    if (rooms[roomId]) {
      const player = rooms[roomId].players.find(p => p.id === socket.id);
      io.to(roomId).emit('cardPlayed', { player, card });
    }
  });

  socket.on('disconnect', () => {
    if (currentRoomId && rooms[currentRoomId]) {
      rooms[currentRoomId].players = rooms[currentRoomId].players.filter(p => p.id !== socket.id);
      io.to(currentRoomId).emit('updatePlayers', rooms[currentRoomId].players);
      if (rooms[currentRoomId].players.length === 0) {
        delete rooms[currentRoomId];
      }
    }
  });
});

server.listen(3000, () => console.log('Server running on port 3000'));
