const socket = io();
let playerName = "";
let currentRoomId = "";
let mySeat = 0;
let players = [];
let hand = [];
let currentTrump = null;

// Add these variables after your existing declarations
let teamHandsWon = { 'Team 1': 0, 'Team 2': 0 };
let teamRoundsWon = { 'Team 1': 0, 'Team 2': 0 }; // Add this line
let teamTensWon = { 'Team 1': 0, 'Team 2': 0 };

function showWinnerNotification(roundWinner, winReason) {
  // Create a centered overlay for winner notification
  let tableDiv = document.getElementById("table");
  let winnerOverlay = document.getElementById("winnerOverlay");
  if (!winnerOverlay) {
    winnerOverlay = document.createElement("div");
    winnerOverlay.id = "winnerOverlay";
    winnerOverlay.className = "winner-overlay";
    tableDiv.appendChild(winnerOverlay);
  }
  winnerOverlay.innerHTML = "";
  winnerOverlay.style.display = "flex";

  // Create the winner notification content
  const winnerContent = document.createElement("div");
  winnerContent.className = "winner-content";
  
  if (roundWinner) {
    winnerContent.innerHTML = `<b style="font-size: 1.5em;">${roundWinner} wins the round!</b><br><small>${winReason}</small>`;
  } else {
    winnerContent.innerHTML = `<b style="font-size: 1.5em;">Round tied!</b><br><small>${winReason}</small>`;
  }
  
  winnerOverlay.appendChild(winnerContent);

  // Auto-hide after 4 seconds
  setTimeout(() => {
    winnerOverlay.style.display = "none";
  }, 4000);
}

// Team functions
function getTeams(players) {
  const team1 = [];
  const team2 = [];
  players.forEach((p, i) => {
    if (i % 2 === 0) team1.push(p.name);
    else team2.push(p.name);
  });
  return { team1, team2 };
}

function updateTeamDisplay() {
  const { team1, team2 } = getTeams(players);
  document.getElementById('teamInfo').innerHTML =
    `<div style="margin-bottom: 10px;">
       <b>Team 1</b> (${team1.join(', ')}): 
       <span style="color: #1976d2;">${teamRoundsWon['Team 1']} rounds</span> | 
       <span style="color: #d2691e;">${teamTensWon['Team 1']} tens</span> | 
       <span style="color: #666;">${teamHandsWon['Team 1']} hands</span>
     </div>
     <div>
       <b>Team 2</b> (${team2.join(', ')}): 
       <span style="color: #1976d2;">${teamRoundsWon['Team 2']} rounds</span> | 
       <span style="color: #d2691e;">${teamTensWon['Team 2']} tens</span> | 
       <span style="color: #666;">${teamHandsWon['Team 2']} hands</span>
     </div>`;
}




function updateTurnUI(currentTurnId) {
  const turnDiv = document.getElementById('currentTurn');
  if (!turnDiv) return;
  
  const currentPlayer = players.find(p => p.id === currentTurnId);
  if (currentPlayer) {
    if (currentTurnId === socket.id) {
      turnDiv.innerHTML = `<b>Your turn!</b>`;
    } else {
      turnDiv.innerHTML = `<b>${currentPlayer.name}'s turn</b>`;
    }
  } else {
    turnDiv.innerHTML = "";
  }
}

function showRoomOptions() {
  playerName = document.getElementById("playerName").value.trim();
  if (!playerName) {
    alert("Please enter your name!");
    return;
  }
  document.getElementById("main-menu").style.display = "none";
  document.getElementById("room-options").style.display = "block";
}

function showCreateRoom() {
  document.getElementById("room-options").style.display = "none";
  document.getElementById("create-room").style.display = "block";
}

function showJoinRoom() {
  document.getElementById("room-options").style.display = "none";
  document.getElementById("join-room").style.display = "block";
}

function createRoom() {
  const numPlayers = document.getElementById("numPlayers").value;
  socket.emit("createRoom", { playerName, numPlayers });
}

function joinRoom() {
  const roomId = document.getElementById("roomIdInput").value.trim();
  if (!roomId) {
    alert("Please enter a room ID!");
    return;
  }
  socket.emit("joinRoom", { playerName, roomId });
}

socket.on("roomCreated", ({ roomId, players: pList }) => {
  currentRoomId = roomId;
  showGameRoom(roomId, pList);
});

socket.on("roomJoined", ({ roomId, players: pList }) => {
  currentRoomId = roomId;
  showGameRoom(roomId, pList);
});

socket.on("roomError", (msg) => {
  alert(msg);
  location.reload();
});

socket.on("updatePlayers", (pList) => {
  players = pList;
  teamHandsWon = { 'Team 1': 0, 'Team 2': 0 };
  teamRoundsWon = { 'Team 1': 0, 'Team 2': 0 };
  teamTensWon = { 'Team 1': 0, 'Team 2': 0 }; // Add this line
  renderTable();
  updateTeamDisplay();
});

function showGameRoom(roomId, pList) {
  document.getElementById("create-room").style.display = "none";
  document.getElementById("join-room").style.display = "none";
  document.getElementById("room-options").style.display = "none";
  document.getElementById("main-menu").style.display = "none";
  document.getElementById("game-room").style.display = "block";
  document.getElementById("roomHeader").innerText = `Room ID: ${roomId}`;
  players = pList;
  renderTable();
  hand = [];
  renderHand();
}

// --- Game Start and Dealing ---
socket.on("startGame", () => {
  showShuffleAnimation();
});

socket.on("chooseTrump", ({ previewHand, suits }) => {
  hideShuffleAnimation();
  showTrumpChooser(previewHand, suits);
  // Store preview hand temporarily
  hand = previewHand;
  renderHand();
});

socket.on("waitingForTrump", ({ chooser }) => {
  hideShuffleAnimation();
  const handDiv = document.getElementById("hand");
  handDiv.innerHTML = `<div>Waiting for <b>${chooser}</b> to choose the trump suit...</div>`;
});

socket.on('trumpSet', ({ trump }) => {
  currentTrump = trump;
  document.getElementById('trumpDisplay').innerHTML = `Trump Suit: <b style="font-size:1.4em">${trump}</b>`;
});


socket.on("dealHand", ({ hand: dealtHand, seat, players: playerList, roomId, trump }) => {
  mySeat = seat;
  players = playerList;
  currentRoomId = roomId;
  currentTrump = trump;
  renderTable();
  updateTeamDisplay();
  
  // Update hand with full cards (includes the preview cards)
  hand = dealtHand;
  renderHand();
  
  // Show message about receiving full hand
  const handDiv = document.getElementById("hand");
  const messageDiv = document.createElement("div");
  messageDiv.style.textAlign = "center";
  messageDiv.style.marginBottom = "10px";
  messageDiv.style.color = "#1976d2";
  messageDiv.innerHTML = "<b>Full hand received!</b>";
  handDiv.insertBefore(messageDiv, handDiv.firstChild);
  
  // Remove message after 2 seconds
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
  }, 2000);
});


socket.on("gameEnded", ({ trumpHistory }) => {
  const handDiv = document.getElementById("hand");
  handDiv.innerHTML = `<div>Game Over! Trump suits chosen: ${trumpHistory.join(
    ", "
  )}</div>`;
});

function renderTable() {
  const tableDiv = document.getElementById("table");
  tableDiv.innerHTML = "";

  // Clockwise seat positions for each player count
  const seatPositionsMap = {
    2: [
      { top: "85%", left: "50%" }, // 0: bottom (self)
      { top: "15%", left: "50%" }  // 1: top
    ],
    4: [
      { top: "85%", left: "50%" }, // 0: bottom (self)
      { top: "50%", left: "10%" }, // 1: left
      { top: "15%", left: "50%" }, // 2: top
      { top: "50%", left: "90%" }  // 3: right
    ],
    6: [
      { top: "85%", left: "50%" }, // 0: bottom (self)
      { top: "70%", left: "20%" }, // 1: bottom-left
      { top: "30%", left: "20%" }, // 2: top-left
      { top: "15%", left: "50%" }, // 3: top
      { top: "30%", left: "80%" }, // 4: top-right
      { top: "70%", left: "80%" }  // 5: bottom-right
    ],
    8: [
      { top: "85%", left: "50%" }, // 0: bottom (self)
      { top: "75%", left: "25%" }, // 1: bottom-left
      { top: "50%", left: "10%" }, // 2: left
      { top: "25%", left: "25%" }, // 3: top-left
      { top: "15%", left: "50%" }, // 4: top
      { top: "25%", left: "75%" }, // 5: top-right
      { top: "50%", left: "90%" }, // 6: right
      { top: "75%", left: "75%" }  // 7: bottom-right
    ]
  };

  const numPlayers = players.length;

  // Find the next highest supported seat count
  let seatCount = [2, 4, 6, 8].find(n => n >= numPlayers);
  if (!seatCount) seatCount = 8; // fallback for >8

  const seatPositions = seatPositionsMap[seatCount];

  players.forEach((p, i) => {
    // Rotate so current player is always at the bottom (index 0)
    const relSeat = (i - mySeat + numPlayers) % numPlayers;
    // For extra players, wrap around seatPositions
    const pos = seatPositions[relSeat % seatPositions.length];
    const playerDiv = document.createElement("div");
    playerDiv.className = "player-seat";
    playerDiv.style.top = pos.top;
    playerDiv.style.left = pos.left;
    playerDiv.style.transform = "translate(-50%, -50%)";
    playerDiv.innerText = p.name + (p.isSelf ? " (You)" : "");
    tableDiv.appendChild(playerDiv);
  });
}



// --- Shuffle Animation ---
function showShuffleAnimation() {
  const tableDiv = document.getElementById("table");
  let shuffleDiv = document.getElementById("shuffleArea");
  if (!shuffleDiv) {
    shuffleDiv = document.createElement("div");
    shuffleDiv.id = "shuffleArea";
    shuffleDiv.style.position = "absolute";
    shuffleDiv.style.top = "50%";
    shuffleDiv.style.left = "50%";
    shuffleDiv.style.transform = "translate(-50%, -50%)";
    shuffleDiv.style.zIndex = "10";
    tableDiv.appendChild(shuffleDiv);
  }
  shuffleDiv.style.display = "block";
  shuffleDiv.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const card = document.createElement("div");
    card.className = "card-back shuffle-move";
    card.innerHTML = "🂠";
    shuffleDiv.appendChild(card);
  }
  let shuffleInterval = setInterval(() => {
    const cards = shuffleDiv.querySelectorAll(".card-back");
    cards.forEach((card) => {
      card.style.transform = `translateX(${
        Math.random() * 40 - 20
      }px) translateY(${Math.random() * 20 - 10}px) rotate(${
        Math.random() * 20 - 10
      }deg)`;
    });
  }, 200);
  setTimeout(() => {
    clearInterval(shuffleInterval);
    shuffleDiv.style.display = "none";
  }, 3000);
}

function hideShuffleAnimation() {
  const shuffleDiv = document.getElementById("shuffleArea");
  if (shuffleDiv) shuffleDiv.style.display = "none";
}

// --- Hand Rendering (only show own cards) ---

function getCardSVG(card, isMyTurn, forceFullOpacity = false) {
  const suitSymbols = { '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣' };
  const isRed = card.suit === '♥' || card.suit === '♦';
  const color = isRed ? '#d00' : '#222';
  const opacity = forceFullOpacity ? '1' : (isMyTurn ? '1' : '0.5');
  return `
    <svg width="70" height="100" viewBox="0 0 70 100" style="margin:5px;opacity:${opacity};">
      <rect x="2" y="2" rx="10" ry="10" width="66" height="96" fill="#fff" stroke="#222" stroke-width="2"/>
      <text x="10" y="20" font-size="16" font-family="Georgia" fill="${color}" font-weight="bold">${card.value}</text>
      <text x="10" y="35" font-size="18" font-family="Georgia" fill="${color}">${suitSymbols[card.suit]}</text>
      <text x="60" y="95" font-size="16" font-family="Georgia" fill="${color}" font-weight="bold" transform="rotate(180 60,95)">${card.value}</text>
      <text x="60" y="80" font-size="18" font-family="Georgia" fill="${color}" transform="rotate(180 60,80)">${suitSymbols[card.suit]}</text>
      <text x="35" y="60" font-size="36" font-family="Georgia" fill="${color}" text-anchor="middle" alignment-baseline="middle">${suitSymbols[card.suit]}</text>
    </svg>
  `;
}

let cardSelectionLocked = false;


function renderHand() {
  const handDiv = document.getElementById("hand");
  handDiv.innerHTML = "";
  if (hand && hand.length) {
    hand.forEach((card, idx) => {
      const cardContainer = document.createElement("div");
      cardContainer.className = "card-svg-container";
      cardContainer.innerHTML = getCardSVG(card, isMyTurn && !cardSelectionLocked);
      if (isMyTurn && !cardSelectionLocked) {
        cardContainer.onclick = () => playCard(idx);
        cardContainer.style.cursor = "pointer";
      } else {
        cardContainer.onclick = null;
        cardContainer.style.cursor = "not-allowed";
      }
      handDiv.appendChild(cardContainer);
    });
  }
}




function playCard(idx) {
  if (cardSelectionLocked) return; // Prevent double selection
  cardSelectionLocked = true;
  renderHand(); // Immediately disable further clicks
  socket.emit('playCard', { roomId: currentRoomId, cardIndex: idx });
}



// socket.on("cardPlayed", ({ player, card }) => {
//   alert(`Player ${player.name} played ${card.value}${card.suit}`);
// });

// --- Trump Chooser UI ---
function showTrumpChooser(previewHand, suits) {
  const handDiv = document.getElementById("hand");
  handDiv.innerHTML = "<div><b>Your preview cards - Select the trump suit for this round:</b></div>";

  // Create a centered overlay for suit selection
  let tableDiv = document.getElementById("table");
  let suitOverlay = document.getElementById("suitOverlay");
  if (!suitOverlay) {
    suitOverlay = document.createElement("div");
    suitOverlay.id = "suitOverlay";
    suitOverlay.className = "suit-overlay";
    tableDiv.appendChild(suitOverlay);
  }
  suitOverlay.innerHTML = "";
  suitOverlay.style.display = "flex";

  suits.forEach((suit) => {
    const btn = document.createElement("button");
    btn.className = "suit-btn";
    btn.innerText = suit;
    btn.onclick = () => {
      socket.emit("trumpChosen", { roomId: currentRoomId, trump: suit });
      // Hide overlay and show waiting message
      suitOverlay.style.display = "none";
      const handDiv = document.getElementById("hand");
      handDiv.innerHTML = "<div>Trump chosen! Waiting for full hand...</div>";
    };
    suitOverlay.appendChild(btn);
  });
}


// Add these new event handlers and functions to your existing client.js


let isMyTurn = false;

socket.on('yourTurn', () => {
  isMyTurn = true;
  cardSelectionLocked = false;
  renderHand();
});

socket.on('handStarted', ({ starter, currentPlayer }) => {
  isMyTurn = (currentPlayer === socket.id); // Fixed: compare with socket.id directly
  cardSelectionLocked = false;
  updateTurnUI(currentPlayer);
  renderHand();
});

socket.on('turnChanged', ({ currentTurn, pile }) => {
  isMyTurn = (currentTurn === socket.id); // Fixed: compare with socket.id directly
  cardSelectionLocked = false;
  updateTurnUI(currentTurn);
  updatePlayedCards(pile);
  renderHand();
});



socket.on('notYourTurn', () => {
  alert('It\'s not your turn!');
});

socket.on('invalidCard', ({ message }) => {
  alert(message);
  cardSelectionLocked = false;
  renderHand();
});

socket.on('roundEnded', ({ roundWinner, winReason, teamHandsWon: teamHandsWonFromServer, teamRoundsWon: teamRoundsWonFromServer, teamTensWon: teamTensWonFromServer }) => {
  teamHandsWon = teamHandsWonFromServer || teamHandsWon;
  teamRoundsWon = teamRoundsWonFromServer || teamRoundsWon;
  teamTensWon = teamTensWonFromServer || teamTensWon;
  updateTeamDisplay();

  showWinnerNotification(roundWinner, winReason)
});


socket.on('cardPlayed', ({ player, card, playedCards }) => {
  // Update UI to show played cards in center
  updatePlayedCards(playedCards);
});

socket.on('handWon', ({ winner, winningCard, playedCards, teamHandsWon: teamHandsWonFromServer, teamRoundsWon: teamRoundsWonFromServer, teamTensWon: teamTensWonFromServer, tensInPile, winnerTeam }) => {
  teamHandsWon = teamHandsWonFromServer || teamHandsWon;
  teamRoundsWon = teamRoundsWonFromServer || teamRoundsWon;
  teamTensWon = teamTensWonFromServer || teamTensWon;
  updateTeamDisplay();

  // Create a centered overlay for hand winner notification
  let tableDiv = document.getElementById("table");
  let handWinnerOverlay = document.getElementById("handWinnerOverlay");
  if (!handWinnerOverlay) {
    handWinnerOverlay = document.createElement("div");
    handWinnerOverlay.id = "handWinnerOverlay";
    handWinnerOverlay.className = "hand-winner-overlay";
    tableDiv.appendChild(handWinnerOverlay);
  }
  handWinnerOverlay.innerHTML = "";
  handWinnerOverlay.style.display = "flex";

  // Create the hand winner notification content
  const handWinnerContent = document.createElement("div");
  handWinnerContent.className = "hand-winner-content";
  
  // Show if tens were won
  let tenMessage = '';
  if (tensInPile > 0) {
    tenMessage = ` <span style="color: #d2691e;">🔟 Won ${tensInPile} TEN${tensInPile > 1 ? 'S' : ''}!</span>`;
  }
  
  handWinnerContent.innerHTML = `${winner} (${winnerTeam}) wins the hand with <b>${winningCard.value}${winningCard.suit}</b>!${tenMessage}`;
  
  handWinnerOverlay.appendChild(handWinnerContent);

  // Auto-hide after 2 seconds and clear played cards
  setTimeout(() => {
    document.getElementById('playedCards').innerHTML = '';
    handWinnerOverlay.style.display = "none";
  }, 2000);
});



socket.on('gameEnded', ({ trumpHistory, finalScores }) => {
  // Determine the team with most rounds won or if tied
  const team1Rounds = finalScores['Team 1'] || 0;
  const team2Rounds = finalScores['Team 2'] || 0;
  let finalResultMessage = '';
  let resultColor = '';

  if (team1Rounds > team2Rounds) {
    finalResultMessage = `🏆 Team 1 wins the game with ${team1Rounds} rounds!`;
    resultColor = '#1976d2';
  } else if (team2Rounds > team1Rounds) {
    finalResultMessage = `🏆 Team 2 wins the game with ${team2Rounds} rounds!`;
    resultColor = '#f44336';
  } else {
    finalResultMessage = `🤝 The game is a tie with both teams having ${team1Rounds} rounds!`;
    resultColor = '#ff9800';
  }

  // Create a centered overlay for final game result
  let tableDiv = document.getElementById("table");
  let gameEndOverlay = document.getElementById("gameEndOverlay");
  if (!gameEndOverlay) {
    gameEndOverlay = document.createElement("div");
    gameEndOverlay.id = "gameEndOverlay";
    gameEndOverlay.className = "game-end-overlay";
    tableDiv.appendChild(gameEndOverlay);
  }
  gameEndOverlay.innerHTML = "";
  gameEndOverlay.style.display = "flex";

  // Create the game end notification content
  const gameEndContent = document.createElement("div");
  gameEndContent.className = "game-end-content";
  gameEndContent.style.background = `linear-gradient(45deg, ${resultColor}, ${resultColor}aa)`;
  
  gameEndContent.innerHTML = `
    <div style="font-size: 2em; margin-bottom: 15px;">🎮 Game Over!</div>
    <div style="font-size: 1.5em; margin-bottom: 10px;">${finalResultMessage}</div>
    <div style="font-size: 1em; opacity: 0.9;">Trump suits played: ${trumpHistory.join(', ')}</div>
    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; font-size: 1.1em; background: white; color: ${resultColor}; border: none; border-radius: 8px; cursor: pointer;">Play Again</button>
  `;
  
  gameEndOverlay.appendChild(gameEndContent);

  // Update hand area with simple message
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML = `<div style="text-align: center; font-size: 1.2em; color: #666;">Game completed! Check the table for final results.</div>`;
});


function updatePlayedCards(playedCards) {
  let playedDiv = document.getElementById('playedCards');
  if (!playedDiv) {
    playedDiv = document.createElement('div');
    playedDiv.id = 'playedCards';
    playedDiv.style.position = 'absolute';
    playedDiv.style.top = '40%';
    playedDiv.style.left = '50%';
    playedDiv.style.transform = 'translate(-50%, -50%)';
    playedDiv.style.zIndex = '15';
    document.getElementById('table').appendChild(playedDiv);
  }
  playedDiv.innerHTML = '';
  playedCards.forEach(pc => {
  const cardContainer = document.createElement('div');
  cardContainer.className = "card-svg-container";
  cardContainer.innerHTML = getCardSVG(pc.card, true, true); // Always full opacity for table
  cardContainer.title = pc.playerName;
  playedDiv.appendChild(cardContainer);
});
}


socket.on('updateHand', (newHand) => {
  hand = newHand;
  renderHand();
});



