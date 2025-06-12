function createShuffledDeck(numPlayers) {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['2','3','4','5','6','7','8','9','10','J','Q','K', 'A'];
  // const values = ['10','Q'];
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
  const valueOrder = ['2','3','4','5','6','7','8','9','10','J','Q','K', 'A'];
  return hand.slice().sort((a, b) => {
    if (a.suit !== b.suit) return suitOrder[b.suit] - suitOrder[a.suit];
    return valueOrder.indexOf(b.value) - valueOrder.indexOf(a.value);
  });
}

function getCardValue(card) {
  const valueOrder = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  return valueOrder.indexOf(card.value);
}

function determineHandWinner(playedCards, leadSuit, trump) {
  let winnerIdx = 0;
  let highestValue = -1;
  let hasTrump = false;

  // First, check if any trump cards were played
  const trumpCards = playedCards.filter(pc => pc.card.suit === trump);
  
  if (trumpCards.length > 0) {
    // Trump cards present - highest trump wins
    trumpCards.forEach(tc => {
      const playerIdx = playedCards.findIndex(pc => pc.playerId === tc.playerId);
      const cardValue = getCardValue(tc.card);
      if (cardValue > highestValue) {
        highestValue = cardValue;
        winnerIdx = playerIdx;
        hasTrump = true;
      }
    });
  } else {
    // No trump cards - highest card of lead suit wins
    playedCards.forEach((pc, idx) => {
      if (pc.card.suit === leadSuit) {
        const cardValue = getCardValue(pc.card);
        if (cardValue > highestValue) {
          highestValue = cardValue;
          winnerIdx = idx;
        }
      }
    });
  }

  return winnerIdx;
}

function canPlayCard(card, playerHand, leadSuit) {
  // If no lead suit (first card), can play anything
  if (!leadSuit) return true;
  
  // Check if player has cards of lead suit
  const hasLeadSuit = playerHand.some(c => c.suit === leadSuit);
  
  // If player has lead suit, must play lead suit
  if (hasLeadSuit && card.suit !== leadSuit) return false;
  
  // Otherwise can play any card
  return true;
}

module.exports = { 
  createShuffledDeck, 
  sortHand, 
  determineHandWinner, 
  canPlayCard,
  getCardValue 
};
