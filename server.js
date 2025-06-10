const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createShuffledDeck, sortHand, determineHandWinner, canPlayCard } = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));

let rooms = {};

function getPreviewCount(numPlayers) {
  if (numPlayers === 2) return 8;
  if (numPlayers === 4) return 5;
  if (numPlayers === 6) return 4;
  if (numPlayers === 8) return 4;
  return 8;
}

function askForTrump(roomId) {
  const room = rooms[roomId];
  const chooserIdx = room.trumpChooser;
  const chooser = room.players[chooserIdx];
  const numPlayers = room.maxPlayers;
  const previewCount = getPreviewCount(numPlayers);

  let hand = room.deck.slice(chooserIdx * previewCount, chooserIdx * previewCount + previewCount);
  hand = sortHand(hand);
  room.hands[chooser.id] = hand;

  io.to(chooser.id).emit('chooseTrump', { previewHand: hand, suits: ['♠', '♥', '♦', '♣'] });

  room.players.forEach((p, idx) => {
    if (idx !== chooserIdx) {
      io.to(p.id).emit('waitingForTrump', { chooser: chooser.name });
    }
  });
}

function startNewHand(roomId) {
  const room = rooms[roomId];
  room.currentHand = {
    playedCards: [],
    leadSuit: null,
    currentPlayer: room.handStarter,
    cardsInPlay: []
  };
  
  const starter = room.players[room.handStarter];
  io.to(roomId).emit('handStarted', { 
    starter: starter.name,
    currentPlayer: room.handStarter 
  });
  io.to(starter.id).emit('yourTurn', {});
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
      hands: {},
      round: 0,
      trumpChooser: 0,
      trumpHistory: [],
      trump: null,
      handStarter: 0,
      currentHand: null,
      handsWon: {}
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

    const room = rooms[roomId];
    if (room.players.length === room.maxPlayers && !room.started) {
      room.started = true;
      room.deck = createShuffledDeck(room.maxPlayers);
      room.hands = {};
      room.round = 0;
      room.trumpChooser = 0;
      room.trumpHistory = [];
      room.trump = null;
      room.handStarter = 0;
      room.handsWon = {};
      room.players.forEach(p => room.handsWon[p.id] = 0);

      io.to(roomId).emit('startGame', {});
      setTimeout(() => askForTrump(roomId), 2000);
    }
  });

  socket.on('trumpChosen', ({ roomId, trump }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.trump = trump;
    room.trumpHistory.push(trump);
    room.handStarter = room.trumpChooser; // First hand started by trump chooser

    const numPlayers = room.maxPlayers;
    const totalCards = room.deck.length;
    const handSize = Math.floor(totalCards / numPlayers);

    for (let i = 0; i < numPlayers; i++) {
      const player = room.players[i];
      let start = i * handSize;
      let end = (i + 1) * handSize;
      let playerHand = room.deck.slice(start, end);
      playerHand = sortHand(playerHand);
      room.hands[player.id] = playerHand;
      io.to(player.id).emit('dealHand', {
        hand: playerHand,
        seat: i,
        players: room.players.map((p, idx) => ({
          name: p.name,
          seat: idx,
          isSelf: p.id === player.id
        })),
        roomId,
        trump
      });
    }

    io.to(roomId).emit('trumpSet', { trump });
    setTimeout(() => startNewHand(roomId), 2000);
  });

  socket.on('playCard', ({ roomId, cardIndex }) => {
    const room = rooms[roomId];
    if (!room || !room.currentHand) return;

    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    if (playerIdx !== room.currentHand.currentPlayer) {
      socket.emit('notYourTurn', {});
      return;
    }

    const playerHand = room.hands[socket.id];
    const card = playerHand[cardIndex];
    
    // Validate card play
    if (!canPlayCard(card, playerHand, room.currentHand.leadSuit)) {
      socket.emit('invalidCard', { message: 'You must follow suit if possible' });
      return;
    }

    // Remove card from player's hand
    room.hands[socket.id].splice(cardIndex, 1);
    // Send updated hand to the player who played
    io.to(socket.id).emit('updateHand', room.hands[socket.id]);

    
    // Set lead suit if first card
    if (!room.currentHand.leadSuit) {
      room.currentHand.leadSuit = card.suit;
    }

    // Add to played cards
    room.currentHand.playedCards.push({
      playerId: socket.id,
      playerName: room.players[playerIdx].name,
      card: card
    });

    io.to(roomId).emit('cardPlayed', {
      player: room.players[playerIdx],
      card: card,
      playedCards: room.currentHand.playedCards
    });

    // Check if hand is complete
    if (room.currentHand.playedCards.length === room.maxPlayers) {
      // Determine winner
      const winnerIdx = determineHandWinner(
        room.currentHand.playedCards, 
        room.currentHand.leadSuit, 
        room.trump
      );
      const winner = room.currentHand.playedCards[winnerIdx];
      const winnerPlayerIdx = room.players.findIndex(p => p.id === winner.playerId);
      
      room.handsWon[winner.playerId]++;
      room.handStarter = winnerPlayerIdx;

      io.to(roomId).emit('handWon', {
        winner: winner.playerName,
        winningCard: winner.card,
        playedCards: room.currentHand.playedCards
      });

      // Check if round is over (no more cards)
      if (room.hands[socket.id].length === 0) {
        // Round over, check if game should continue
        if (room.trumpHistory.length < room.maxPlayers) {
          room.trumpChooser = (room.trumpChooser + 1) % room.maxPlayers;
          room.deck = createShuffledDeck(room.maxPlayers);
          setTimeout(() => askForTrump(roomId), 3000);
        } else {
          io.to(roomId).emit('gameEnded', { 
            trumpHistory: room.trumpHistory,
            finalScores: room.handsWon
          });
          delete rooms[roomId];
        }
      } else {
        // Start next hand
        setTimeout(() => startNewHand(roomId), 2000);
      }
    } else {
      // Next player's turn
      room.currentHand.currentPlayer = (room.currentHand.currentPlayer + 1) % room.maxPlayers;
      const nextPlayer = room.players[room.currentHand.currentPlayer];
      io.to(nextPlayer.id).emit('yourTurn', {});
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
