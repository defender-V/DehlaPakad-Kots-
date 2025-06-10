function createShuffledDeck(numPlayers) {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  let deck = [];
  for (let suit of suits) {
    for (let value of values) {
      if ((numPlayers === 6 || numPlayers === 8) && value === '2') continue;
      deck.push({ suit, value });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function sortHand(hand) {
  const suitOrder = { '♠': 3, '♥': 2, '♦': 1, '♣': 0 };
  const valueOrder = ['A','K','Q','J','10','9','8','7','6','5','4','3'];
  return hand.slice().sort((a, b) => {
    if (a.suit !== b.suit) return suitOrder[b.suit] - suitOrder[a.suit];
    return valueOrder.indexOf(a.value) - valueOrder.indexOf(b.value);
  });
}

function startHand(room) {
  room.pile = [];
  room.handSuit = null;
  room.currentTurn = room.currentLeader;
  // Notify all players whose turn it is and the current pile
  io.to(room.roomId).emit('handStarted', {
    currentTurn: room.players[room.currentTurn].id,
    pile: room.pile
  });
}

function isValidMove(playerHand, playedCard, handSuit) {
  if (!handSuit) return true; // First card, any card allowed
  const hasSuit = playerHand.some(card => card.suit === handSuit);
  if (hasSuit && playedCard.suit !== handSuit) return false;
  return true;
}

function playCard(room, playerIdx, playedCard) {
  if (room.pile.length === 0) room.handSuit = playedCard.suit;
  room.pile.push({ card: playedCard, playerIdx });

  // Remove card from player's hand (assume room.hands[pid] is the hand array)
  const pid = room.players[playerIdx].id;
  room.hands[pid] = room.hands[pid].filter(
    c => !(c.suit === playedCard.suit && c.value === playedCard.value)
  );

  if (room.pile.length === room.maxPlayers) {
    // All players have played, determine winner
    const winnerIdx = determineHandWinner(room.pile, room.handSuit, room.trump);
    room.currentLeader = winnerIdx;
    // Optionally update handsWon[winnerIdx]++
    // Notify all of winner and update hands
    io.to(room.roomId).emit('handEnded', {
      winner: room.players[winnerIdx].name,
      pile: room.pile
    });

    // Start next hand or end game if hands are empty
    const anyCardsLeft = Object.values(room.hands).some(h => h.length > 0);
    if (anyCardsLeft) {
      setTimeout(() => startHand(room), 2000);
    } else {
      io.to(room.roomId).emit('roundEnded');
    }
  } else {
    // Advance turn
    room.currentTurn = (room.currentTurn + 1) % room.maxPlayers;
    io.to(room.roomId).emit('turnChanged', {
      currentTurn: room.players[room.currentTurn].id,
      pile: room.pile
    });
  }
}

function determineHandWinner(pile, handSuit, trumpSuit) {
  const valueOrder = ['A','K','Q','J','10','9','8','7','6','5','4','3']; // Decreasing
  // Filter trump cards in pile
  const trumpCards = pile.filter(entry => entry.card.suit === trumpSuit);
  if (trumpCards.length > 0) {
    // Highest trump wins
    trumpCards.sort((a, b) =>
      valueOrder.indexOf(a.card.value) - valueOrder.indexOf(b.card.value)
    );
    return trumpCards[0].playerIdx;
  }
  // Otherwise, highest card of handSuit wins
  const leadSuitCards = pile.filter(entry => entry.card.suit === handSuit);
  leadSuitCards.sort((a, b) =>
    valueOrder.indexOf(a.card.value) - valueOrder.indexOf(b.card.value)
  );
  return leadSuitCards[0].playerIdx;
}


module.exports = { createShuffledDeck, sortHand, isValidMove, determineHandWinner, startHand};
