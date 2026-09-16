export type HokmSuit = "♠" | "♥" | "♦" | "♣";

export type HokmRank =
  | "2" | "3" | "4" | "5" | "6" | "7"
  | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export type HokmCard = {
  id: string;
  suit: HokmSuit;
  rank: HokmRank;
  value: number;
};

export type PlayedCard = {
  playerId: string;
  seat: number;
  card: HokmCard;
};

export type Team = 0 | 1;

export const HOKM_SUITS: HokmSuit[] = ["♠", "♥", "♦", "♣"];

export const HOKM_RANKS: HokmRank[] = [
  "2", "3", "4", "5", "6", "7",
  "8", "9", "10", "J", "Q", "K", "A",
];

export const TRICKS_TO_WIN_ROUND = 7;
export const ROUNDS_TO_WIN_MATCH = 7;
export const KOT_HAKEM_POINTS = 3;
export const KOT_NON_HAKEM_POINTS = 2;

export function createHokmDeck(): HokmCard[] {
  return HOKM_SUITS.flatMap((suit) =>
    HOKM_RANKS.map((rank, value) => ({
      id: `${suit}-${rank}`,
      suit,
      rank,
      value,
    }))
  );
}

export function shuffleDeck<T>(
  cards: T[],
  random = Math.random
): T[] {
  const result = [...cards];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

export function getTeamBySeat(seat: number): Team {
  return seat % 2 === 0 ? 0 : 1;
}

export function getLegalCards(
  hand: HokmCard[],
  leadSuit: HokmSuit | null
): HokmCard[] {
  if (!leadSuit) return [...hand];

  const sameSuit = hand.filter((card) => card.suit === leadSuit);
  return sameSuit.length > 0 ? sameSuit : [...hand];
}

export function canPlayCard(
  hand: HokmCard[],
  card: HokmCard,
  leadSuit: HokmSuit | null
): boolean {
  return getLegalCards(hand, leadSuit).some(
    (legalCard) => legalCard.id === card.id
  );
}

export function cardBeats(
  challenger: HokmCard,
  currentWinner: HokmCard,
  leadSuit: HokmSuit,
  trump: HokmSuit
): boolean {
  if (challenger.suit === trump) {
    if (currentWinner.suit !== trump) return true;
    return challenger.value > currentWinner.value;
  }

  if (currentWinner.suit === trump) return false;
  if (challenger.suit !== leadSuit) return false;
  if (currentWinner.suit !== leadSuit) return true;

  return challenger.value > currentWinner.value;
}

export function getTrickWinner(
  played: PlayedCard[],
  trump: HokmSuit
): PlayedCard {
  if (played.length === 0) {
    throw new Error("Cannot determine winner of empty trick.");
  }

  const leadSuit = played[0].card.suit;
  let winner = played[0];

  for (const current of played.slice(1)) {
    if (cardBeats(current.card, winner.card, leadSuit, trump)) {
      winner = current;
    }
  }

  return winner;
}

export function sortHand(hand: HokmCard[]): HokmCard[] {
  const suitOrder: Record<HokmSuit, number> = {
    "♠": 0, "♥": 1, "♦": 2, "♣": 3,
  };

  return [...hand].sort((a, b) => {
    if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
    return b.value - a.value;
  });
}

export function validateDeck(cards: HokmCard[]): boolean {
  if (cards.length !== 52) return false;
  const ids = new Set(cards.map((card) => card.id));
  return ids.size === 52;
}

export function validateHands(hands: HokmCard[][]): boolean {
  if (hands.length !== 4) return false;
  if (hands.some((hand) => hand.length !== 13)) return false;

  const cards = hands.flat();
  const ids = new Set(cards.map((card) => card.id));
  return cards.length === 52 && ids.size === 52;
}

export function removeCard(
  hand: HokmCard[],
  cardId: string
): HokmCard[] {
  return hand.filter((card) => card.id !== cardId);
}

export function findCard(
  hand: HokmCard[],
  cardId: string
): HokmCard | undefined {
  return hand.find((card) => card.id === cardId);
}

export type RoundResult = {
  winnerTeam: Team;
  roundPoints: number;
  wasKot: boolean;
  kotTeam: Team | null;
  hakemStays: boolean;
};

export function evaluateRound(
  scores: [number, number],
  hakemTeam: Team
): RoundResult {
  const [score0, score1] = scores;

  const kotTeam: Team | null =
    score0 === 0 ? 0 : score1 === 0 ? 1 : null;

  if (kotTeam !== null) {
    const winnerTeam: Team = kotTeam === 0 ? 1 : 0;
    const kotHakem = kotTeam === hakemTeam;
    const roundPoints = kotHakem ? KOT_HAKEM_POINTS : KOT_NON_HAKEM_POINTS;

    return {
      winnerTeam,
      roundPoints,
      wasKot: true,
      kotTeam,
      hakemStays: winnerTeam === hakemTeam,
    };
  }

  const winnerTeam: Team = score0 > score1 ? 0 : 1;

  return {
    winnerTeam,
    roundPoints: 1,
    wasKot: false,
    kotTeam: null,
    hakemStays: winnerTeam === hakemTeam,
  };
}

export function nextHakemSeat(
  currentHakemSeat: number,
  hakemStays: boolean
): number {
  if (hakemStays) return currentHakemSeat;
  return (currentHakemSeat + 1) % 4;
}

export function isMatchComplete(roundWins: [number, number]): boolean {
  return (
    roundWins[0] >= ROUNDS_TO_WIN_MATCH ||
    roundWins[1] >= ROUNDS_TO_WIN_MATCH
  );
}

export function getMatchWinner(roundWins: [number, number]): Team | null {
  if (roundWins[0] >= ROUNDS_TO_WIN_MATCH) return 0;
  if (roundWins[1] >= ROUNDS_TO_WIN_MATCH) return 1;
  return null;
}

export function calculateRatingDelta(won: boolean): number {
  return won ? 25 : -15;
}