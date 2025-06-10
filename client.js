const socket = io();
let playerName = '';
let currentRoomId = '';
let mySeat = 0;
let players = [];
let hand = [];
let currentTrump = null;

function showRoomOptions() {
  playerName = document.getElementById('playerName').value.trim();
  if (!playerName) {
    alert('Please enter your name!');
    return;
  }
  document.getElementById('main-menu').style.display = 'none';
  document.getElementById('room-options').style.display = 'block';
}

function showCreateRoom() {
  document.getElementById('room-options').style.display = 'none';
  document.getElementById('create-room').style.display = 'block';
}

function showJoinRoom() {
  document.getElementById('room-options').style.display = 'none';
  document.getElementById('join-room').style.display = 'block';
}

function createRoom() {
  const numPlayers = document.getElementById('numPlayers').value;
  socket.emit('createRoom', { playerName, numPlayers });
}

function joinRoom() {
  const roomId = document.getElementById('roomIdInput').value.trim();
  if (!roomId) {
    alert('Please enter a room ID!');
    return;
  }
  socket.emit('joinRoom', { playerName, roomId });
}

socket.on('roomCreated', ({ roomId, players: pList }) => {
  currentRoomId = roomId;
  showGameRoom(roomId, pList);
});

socket.on('roomJoined', ({ roomId, players: pList }) => {
  currentRoomId = roomId;
  showGameRoom(roomId, pList);
});

socket.on('roomError', (msg) => {
  alert(msg);
  location.reload();
});

socket.on('updatePlayers', (pList) => {
  players = pList;
  renderTable();
});

function showGameRoom(roomId, pList) {
  document.getElementById('create-room').style.display = 'none';
  document.getElementById('join-room').style.display = 'none';
  document.getElementById('room-options').style.display = 'none';
  document.getElementById('main-menu').style.display = 'none';
  document.getElementById('game-room').style.display = 'block';
  document.getElementById('roomHeader').innerText = `Room ID: ${roomId}`;
  players = pList;
  renderTable();
  hand = [];
  renderHand();
}

// --- Game Start and Dealing ---
socket.on('startGame', () => {
  showShuffleAnimation();
});

socket.on('chooseTrump', ({ previewHand, suits }) => {
  hideShuffleAnimation();
  showTrumpChooser(previewHand, suits);
});

socket.on('waitingForTrump', ({ chooser }) => {
  hideShuffleAnimation();
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML = `<div>Waiting for <b>${chooser}</b> to choose the trump suit...</div>`;
});

socket.on('trumpSet', ({ trump }) => {
  currentTrump = trump;
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML += `<div>Trump suit for this round: <b>${trump}</b></div>`;
});

socket.on('dealHand', ({ hand: dealtHand, seat, players: playerList, roomId, trump }) => {
  mySeat = seat;
  players = playerList;
  currentRoomId = roomId;
  currentTrump = trump;
  renderTable();
  hand = dealtHand;
  renderHand();
});

socket.on('gameEnded', ({ trumpHistory }) => {
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML = `<div>Game Over! Trump suits chosen: ${trumpHistory.join(', ')}</div>`;
});

function renderTable() {
  const tableDiv = document.getElementById('table');
  tableDiv.innerHTML = '';
  const seatPositions = [
    { top: '85%', left: '50%' }, // 0: bottom (self)
    { top: '15%', left: '50%' }, // 1: top
    { top: '50%', left: '15%' }, // 2: left
    { top: '50%', left: '85%' }, // 3: right
    { top: '30%', left: '20%' }, // 4: top-left
    { top: '30%', left: '80%' }, // 5: top-right
    { top: '70%', left: '20%' }, // 6: bottom-left
    { top: '70%', left: '80%' }  // 7: bottom-right
  ];
  players.forEach((p, i) => {
    const relSeat = (i - mySeat + players.length) % players.length;
    const pos = seatPositions[relSeat];
    const playerDiv = document.createElement('div');
    playerDiv.className = 'player-seat';
    playerDiv.style.top = pos.top;
    playerDiv.style.left = pos.left;
    playerDiv.style.transform = 'translate(-50%, -50%)';
    playerDiv.innerText = p.name + (p.isSelf ? ' (You)' : '');
    tableDiv.appendChild(playerDiv);
  });
}

// --- Shuffle Animation ---
function showShuffleAnimation() {
  const tableDiv = document.getElementById('table');
  let shuffleDiv = document.getElementById('shuffleArea');
  if (!shuffleDiv) {
    shuffleDiv = document.createElement('div');
    shuffleDiv.id = 'shuffleArea';
    shuffleDiv.style.position = 'absolute';
    shuffleDiv.style.top = '50%';
    shuffleDiv.style.left = '50%';
    shuffleDiv.style.transform = 'translate(-50%, -50%)';
    shuffleDiv.style.zIndex = '10';
    tableDiv.appendChild(shuffleDiv);
  }
  shuffleDiv.style.display = 'block';
  shuffleDiv.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const card = document.createElement('div');
    card.className = 'card-back shuffle-move';
    card.innerHTML = '🂠';
    shuffleDiv.appendChild(card);
  }
  let shuffleInterval = setInterval(() => {
    const cards = shuffleDiv.querySelectorAll('.card-back');
    cards.forEach(card => {
      card.style.transform = `translateX(${Math.random() * 40 - 20}px) translateY(${Math.random() * 20 - 10}px) rotate(${Math.random() * 20 - 10}deg)`;
    });
  }, 200);
  setTimeout(() => {
    clearInterval(shuffleInterval);
    shuffleDiv.style.display = 'none';
  }, 2000);
}

function hideShuffleAnimation() {
  const shuffleDiv = document.getElementById('shuffleArea');
  if (shuffleDiv) shuffleDiv.style.display = 'none';
}

// --- Hand Rendering (only show own cards) ---
function renderHand() {
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML = '';
  if (hand && hand.length) {
    hand.forEach((card, idx) => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'card';
      cardDiv.innerText = card.value + card.suit;
      cardDiv.onclick = () => playCard(idx);
      handDiv.appendChild(cardDiv);
    });
  }
}

function playCard(idx) {
  const card = hand.splice(idx, 1)[0];
  socket.emit('playCard', { roomId: currentRoomId, card });
  renderHand();
}

socket.on('cardPlayed', ({ player, card }) => {
  alert(`Player ${player.name} played ${card.value}${card.suit}`);
});

// --- Trump Chooser UI ---
function showTrumpChooser(previewHand, suits) {
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML = '<div><b>Select the trump suit for this round:</b></div>';
  previewHand.forEach(card => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.innerText = card.value + card.suit;
    handDiv.appendChild(cardDiv);
  });
  const suitDiv = document.createElement('div');
  suits.forEach(suit => {
    const btn = document.createElement('button');
    btn.innerText = suit;
    btn.onclick = () => {
      socket.emit('trumpChosen', { roomId: currentRoomId, trump: suit });
      handDiv.innerHTML = '<div>Waiting for other players...</div>';
    };
    suitDiv.appendChild(btn);
  });
  handDiv.appendChild(suitDiv);
}
