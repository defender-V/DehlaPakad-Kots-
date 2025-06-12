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

function getPlayerTeam(playerIndex) {
  return playerIndex % 2 === 0 ? 'Team 1' : 'Team 2';
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
    currentPlayer: starter.id  // Send player ID, not index
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
  teamHandsWon: { 'Team 1': 0, 'Team 2': 0 },
  teamRoundsWon: { 'Team 1': 0, 'Team 2': 0 }, // Add this line
  teamTensWon: { 'Team 1': 0, 'Team 2': 0 }
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
      room.teamHandsWon = { 'Team 1': 0, 'Team 2': 0 };
      room.teamRoundsWon= { 'Team 1': 0, 'Team 2': 0 };
      room.teamTensWon= { 'Team 1': 0, 'Team 2': 0 }

      io.to(roomId).emit('startGame', {});
      setTimeout(() => askForTrump(roomId), 2000);
    }
  });

  socket.on('trumpChosen', ({ roomId, trump }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.trump = trump;
    room.trumpHistory.push(trump);
    room.handStarter = room.trumpChooser;

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
          isSelf: p.id === player.id,
          team: getPlayerTeam(idx)
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
    
    if (!canPlayCard(card, playerHand, room.currentHand.leadSuit)) {
      socket.emit('invalidCard', { message: 'You must follow suit if possible' });
      return;
    }

    room.hands[socket.id].splice(cardIndex, 1);
    
    if (!room.currentHand.leadSuit) {
      room.currentHand.leadSuit = card.suit;
    }

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

    if (room.currentHand.playedCards.length === room.maxPlayers) {
  const winnerIdx = determineHandWinner(
    room.currentHand.playedCards, 
    room.currentHand.leadSuit, 
    room.trump
  );
  const winner = room.currentHand.playedCards[winnerIdx];
  const winnerPlayerIdx = room.players.findIndex(p => p.id === winner.playerId);
  const winnerTeam = getPlayerTeam(winnerPlayerIdx);
  
  room.teamHandsWon[winnerTeam]++;
  
  // Count ALL tens in the pile and award them to the winning team
  const tensInPile = room.currentHand.playedCards.filter(pc => pc.card.value === '10').length;
  room.teamTensWon[winnerTeam] += tensInPile;
  
  room.handStarter = winnerPlayerIdx;

  io.to(roomId).emit('handWon', {
    winner: winner.playerName,
    winningCard: winner.card,
    playedCards: room.currentHand.playedCards,
    teamHandsWon: room.teamHandsWon,
    teamRoundsWon: room.teamRoundsWon,
    teamTensWon: room.teamTensWon,
    tensInPile: tensInPile, // Add this to show how many tens were won
    winnerTeam: winnerTeam
  });

  // Send updated hands to ALL players
  room.players.forEach(player => {
    io.to(player.id).emit('updateHand', room.hands[player.id]);
  });

      const anyCardsLeft = Object.values(room.hands).some(hand => hand.length > 0);
if (!anyCardsLeft) {
  // Round is over - determine round winner based on tens first, then hands
  const team1Tens = room.teamTensWon['Team 1'];
  const team2Tens = room.teamTensWon['Team 2'];
  const team1Hands = room.teamHandsWon['Team 1'];
  const team2Hands = room.teamHandsWon['Team 2'];
  
  let roundWinner = null;
  let winReason = '';
  
  if (team1Tens > team2Tens) {
    roundWinner = 'Team 1';
    room.teamRoundsWon['Team 1']++;
    winReason = `more tens (${team1Tens} vs ${team2Tens})`;
  } else if (team2Tens > team1Tens) {
    roundWinner = 'Team 2';
    room.teamRoundsWon['Team 2']++;
    winReason = `more tens (${team2Tens} vs ${team1Tens})`;
  } else {
    // Tens are tied, check hands
    if (team1Hands > team2Hands) {
      roundWinner = 'Team 1';
      room.teamRoundsWon['Team 1']++;
      winReason = `tied tens (${team1Tens} each), more hands (${team1Hands} vs ${team2Hands})`;
    } else if (team2Hands > team1Hands) {
      roundWinner = 'Team 2';
      room.teamRoundsWon['Team 2']++;
      winReason = `tied tens (${team1Tens} each), more hands (${team2Hands} vs ${team1Hands})`;
    } else {
      // Complete tie - no points awarded
      winReason = `complete tie (${team1Tens} tens, ${team1Hands} hands each)`;
    }
  }

  // Emit round end with winner and reason
  io.to(roomId).emit('roundEnded', {
    roundWinner: roundWinner,
    winReason: winReason,
    teamHandsWon: room.teamHandsWon,
    teamRoundsWon: room.teamRoundsWon,
    teamTensWon: room.teamTensWon
  });

  // Reset hands and tens won for next round
  room.teamHandsWon = { 'Team 1': 0, 'Team 2': 0 };
  room.teamTensWon = { 'Team 1': 0, 'Team 2': 0 };


  if (room.trumpHistory.length < room.maxPlayers) {
    room.trumpChooser = (room.trumpChooser + 1) % room.maxPlayers;
    room.deck = createShuffledDeck(room.maxPlayers);
    setTimeout(() => askForTrump(roomId), 3000);
  } else {
    io.to(roomId).emit('gameEnded', { 
      trumpHistory: room.trumpHistory,
      finalScores: room.teamRoundsWon
    });
    delete rooms[roomId];
  }
}

 else {
        setTimeout(() => startNewHand(roomId), 2000);
      }
    } else {
      room.currentHand.currentPlayer = (room.currentHand.currentPlayer + 1) % room.maxPlayers;
      const nextPlayer = room.players[room.currentHand.currentPlayer];
      io.to(nextPlayer.id).emit('yourTurn', {});
      io.to(roomId).emit('turnChanged', {
        currentTurn: nextPlayer.id,
        pile: room.currentHand.playedCards
      });
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
