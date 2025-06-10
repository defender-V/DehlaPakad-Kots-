const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { createShuffledDeck, sortHand } = require("./gameLogic");

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

  // Deal only previewCount cards to chooser for preview, and sort them
  let hand = room.deck.slice(
    chooserIdx * previewCount,
    chooserIdx * previewCount + previewCount
  );
  hand = sortHand(hand); // <-- Sort the preview hand

  room.hands[chooser.id] = hand;

  // Tell chooser to pick trump, show only preview cards
  io.to(chooser.id).emit("chooseTrump", {
    previewHand: hand,
    suits: ["♠", "♥", "♦", "♣"],
  });

  // Tell others to wait
  room.players.forEach((p, idx) => {
    if (idx !== chooserIdx) {
      io.to(p.id).emit("waitingForTrump", { chooser: chooser.name });
    }
  });
}

io.on("connection", (socket) => {
  let currentRoomId = null;
  let currentPlayerName = null;

  socket.on("createRoom", ({ playerName, numPlayers }) => {
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
    };
    currentRoomId = roomId;
    currentPlayerName = playerName;
    socket.join(roomId);
    io.to(roomId).emit("roomCreated", {
      roomId,
      players: rooms[roomId].players,
    });
  });

  socket.on("joinRoom", ({ playerName, roomId }) => {
    if (!rooms[roomId]) {
      socket.emit("roomError", "Room does not exist!");
      return;
    }
    if (rooms[roomId].players.length >= rooms[roomId].maxPlayers) {
      socket.emit("roomError", "Room is full!");
      return;
    }
    rooms[roomId].players.push({ id: socket.id, name: playerName });
    currentRoomId = roomId;
    currentPlayerName = playerName;
    socket.join(roomId);
    io.to(roomId).emit("roomJoined", {
      roomId,
      players: rooms[roomId].players,
    });
    io.to(roomId).emit("updatePlayers", rooms[roomId].players);

    // If room is now full, start the game
    const room = rooms[roomId];
    if (room.players.length === room.maxPlayers && !room.started) {
      room.started = true;
      room.deck = createShuffledDeck(room.maxPlayers);
      room.hands = {};
      room.round = 0;
      room.trumpChooser = 0;
      room.trumpHistory = [];
      room.trump = null;

      io.to(roomId).emit("startGame", {});
      setTimeout(() => askForTrump(roomId), 2000); // 2s shuffle animation
    }
  });

  socket.on("trumpChosen", ({ roomId, trump }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.trump = trump;
    room.trumpHistory.push(trump);

    // Now deal all cards and sort for each player
    const numPlayers = room.maxPlayers;
    const totalCards = 52;
    const handSize = Math.floor(totalCards / numPlayers);

    for (let i = 0; i < numPlayers; i++) {
      const player = room.players[i];
      let start = i * handSize;
      let end = (i + 1) * handSize;
      let playerHand = room.deck.slice(start, end);
      playerHand = sortHand(playerHand);
      room.hands[player.id] = playerHand;
      io.to(player.id).emit("dealHand", {
        hand: playerHand,
        seat: i,
        players: room.players.map((p, idx) => ({
          name: p.name,
          seat: idx,
          isSelf: p.id === player.id,
        })),
        roomId,
        trump,
      });
    }

    // Notify all players of the chosen trump
    io.to(roomId).emit("trumpSet", { trump });

    // Next round: if all have chosen trump, end game; else, ask next
    if (room.trumpHistory.length < room.maxPlayers) {
      room.trumpChooser = (room.trumpChooser + 1) % room.maxPlayers;
      // Re-shuffle for next round
      room.deck = createShuffledDeck(room.maxPlayers);
      setTimeout(() => askForTrump(roomId), 3000); // wait 3s before next round
    } else {
      io.to(roomId).emit("gameEnded", { trumpHistory: room.trumpHistory });
      delete rooms[roomId];
    }
  });

  socket.on("playCard", ({ roomId, card }) => {
    const room = rooms[roomId];
    if (room) {
      const player = room.players.find((p) => p.id === socket.id);
      io.to(roomId).emit("cardPlayed", { player, card });
    }
  });

  socket.on("disconnect", () => {
    if (currentRoomId && rooms[currentRoomId]) {
      rooms[currentRoomId].players = rooms[currentRoomId].players.filter(
        (p) => p.id !== socket.id
      );
      io.to(currentRoomId).emit("updatePlayers", rooms[currentRoomId].players);
      if (rooms[currentRoomId].players.length === 0) {
        delete rooms[currentRoomId];
      }
    }
  });
});

server.listen(3000, () => console.log("Server running on port 3000"));
