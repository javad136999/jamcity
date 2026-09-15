export type HokmSuit = "♠" | "♥" | "♦" | "♣";
export type HokmCard = { suit: HokmSuit; rank: string; value: number };
export type PlayedCard = { playerId: string; card: HokmCard };

export const HOKM_SUITS: HokmSuit[] = ["♠", "♥", "♦", "♣"];
export const HOKM_RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export function createHokmDeck(): HokmCard[] {
  return HOKM_SUITS.flatMap((suit) =>
    HOKM_RANKS.map((rank, value) => ({ suit, rank, value }))
  );
}

export function shuffleDeck<T>(cards: T[], random = Math.random): T[] {
  const result = [...cards];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function dealHokmHands(cards = shuffleDeck(createHokmDeck())): HokmCard[][] {
  if (cards.length !== 52) throw new Error("Hokm deck must contain 52 cards");
  return [0, 1, 2, 3].map((seat) => cards.filter((_, index) => index % 4 === seat));
}

export function getLegalCards(hand: HokmCard[], leadSuit: HokmSuit | null): HokmCard[] {
  if (!leadSuit) return hand;
  const sameSuit = hand.filter((card) => card.suit === leadSuit);
  return sameSuit.length > 0 ? sameSuit : hand;
}

export function canPlayCard(hand: HokmCard[], card: HokmCard, leadSuit: HokmSuit | null): boolean {
  const legal = getLegalCards(hand, leadSuit);
  return legal.some((item) => item.suit === card.suit && item.rank === card.rank);
}

export function getTrickWinner(played: PlayedCard[], trump: HokmSuit): PlayedCard {
  if (played.length === 0) throw new Error("A trick must contain at least one card");
  const leadSuit = played[0].card.suit;
  return played.reduce((best, current) => {
    const bestIsTrump = best.card.suit === trump;
    const currentIsTrump = current.card.suit === trump;
    if (currentIsTrump && !bestIsTrump) return current;
    if (!currentIsTrump && bestIsTrump) return best;
    if (current.card.suit !== best.card.suit) {
      return current.card.suit === leadSuit ? current : best;
    }
    return current.card.value > best.card.value ? current : best;
  });
}

export function addTrickPoint(scores: Record<string, number>, winnerId: string): Record<string, number> {
  return { ...scores, [winnerId]: (scores[winnerId] ?? 0) + 1 };
}

export function isRoundOver(scores: Record<string, number>): boolean {
  return Object.values(scores).some((score) => score >= 7);
}

export function calculateRatingDelta(won: boolean): number {
  return won ? 25 : -15;
}
