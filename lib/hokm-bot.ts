import type { HokmCard, HokmSuit, PlayedCard } from "./hokm-engine";
import { getLegalCards, getTrickWinner, getTeamBySeat } from "./hokm-engine";

export type BotMemory = {
  played: HokmCard[];
  knownTrump: HokmCard[];
  teamScore: number;
  opponentScore: number;
  botSeat: number;
};

function getSuitCards(hand: HokmCard[], suit: HokmSuit): HokmCard[] {
  return hand.filter((card) => card.suit === suit);
}

function sortWeakToStrong(cards: HokmCard[]): HokmCard[] {
  return [...cards].sort((a, b) => a.value - b.value);
}

function trumpSuitScore(hand: HokmCard[], suit: HokmSuit): number {
  const cards = getSuitCards(hand, suit);
  const lengthScore = cards.length * 25;

  const highCardsScore = cards.reduce((total, card) => {
    if (card.rank === "A") return total + 45;
    if (card.rank === "K") return total + 30;
    if (card.rank === "Q") return total + 20;
    if (card.rank === "J") return total + 12;
    if (card.value >= 8) return total + 5;
    return total + 1;
  }, 0);

  const aceBonus = cards.some((c) => c.rank === "A") ? 20 : 0;
  const kingBonus = cards.some((c) => c.rank === "K") ? 8 : 0;

  return lengthScore + highCardsScore + aceBonus + kingBonus;
}

export function chooseTrumpForBot(hand: HokmCard[]): HokmSuit {
  if (hand.length === 0) {
    throw new Error("Bot cannot choose trump with an empty hand.");
  }

  const suits: HokmSuit[] = ["♠", "♥", "♦", "♣"];
  const scores = suits.map((suit) => ({
    suit,
    score: trumpSuitScore(hand, suit),
  }));

  scores.sort((a, b) => b.score - a.score);
  return scores[0].suit;
}

function canWinTrick(
  card: HokmCard,
  trick: PlayedCard[],
  trump: HokmSuit,
  botSeat: number
): boolean {
  const simulated: PlayedCard[] = [
    ...trick,
    { playerId: `bot-${botSeat}`, seat: botSeat, card },
  ];
  const winner = getTrickWinner(simulated, trump);
  return winner.seat === botSeat;
}

function teammateIsWinning(
  trick: PlayedCard[],
  trump: HokmSuit,
  botSeat: number
): boolean {
  if (trick.length === 0) return false;
  const winner = getTrickWinner(trick, trump);
  return getTeamBySeat(winner.seat) === getTeamBySeat(botSeat);
}

function isLastToPlay(trick: PlayedCard[]): boolean {
  return trick.length === 3;
}

function chooseLeadCard(legal: HokmCard[], trump: HokmSuit): HokmCard {
  const nonTrump = legal.filter((c) => c.suit !== trump);
  const source = nonTrump.length > 0 ? nonTrump : legal;

  const suitGroups = new Map<HokmSuit, HokmCard[]>();
  for (const card of source) {
    const group = suitGroups.get(card.suit) ?? [];
    group.push(card);
    suitGroups.set(card.suit, group);
  }

  let bestSuit: HokmCard[] | null = null;
  let bestScore = -1;

  for (const [, cards] of suitGroups.entries()) {
    const hasAce = cards.some((c) => c.rank === "A");
    const hasKing = cards.some((c) => c.rank === "K");
    const score = cards.length * 10 + (hasAce ? 30 : 0) + (hasKing ? 15 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestSuit = cards;
    }
  }

  if (bestSuit) {
    const ace = bestSuit.find((c) => c.rank === "A");
    if (ace) return ace;
    return sortWeakToStrong(bestSuit)[0];
  }

  return sortWeakToStrong(source)[0];
}

function chooseLosingCard(
  legal: HokmCard[],
  trump: HokmSuit,
  leadSuit: HokmSuit | null
): HokmCard {
  if (leadSuit) {
    const same = legal.filter((c) => c.suit === leadSuit);
    if (same.length > 0) return sortWeakToStrong(same)[0];
  }

  const nonTrump = legal.filter((c) => c.suit !== trump);
  const pool = nonTrump.length > 0 ? nonTrump : legal;

  return sortWeakToStrong(pool)[0];
}

export function chooseBotCard(
  hand: HokmCard[],
  trick: PlayedCard[],
  trump: HokmSuit,
  memory: BotMemory
): HokmCard {
  const leadSuit = trick[0]?.card.suit ?? null;
  const legal = getLegalCards(hand, leadSuit);

  if (legal.length === 0) {
    throw new Error("Bot has no legal card.");
  }

  if (trick.length === 0) {
    return chooseLeadCard(legal, trump);
  }

  const isLast = isLastToPlay(trick);
  const teammateWins = teammateIsWinning(trick, trump, memory.botSeat);

  if (teammateWins) {
    if (isLast) return chooseLosingCard(legal, trump, leadSuit);

    const winningCards = legal.filter((c) =>
      canWinTrick(c, trick, trump, memory.botSeat)
    );

    if (winningCards.length > 0) {
      const weakestWinner = sortWeakToStrong(winningCards)[0];
      if (
        leadSuit &&
        weakestWinner.suit === leadSuit &&
        weakestWinner.value < 10
      ) {
        return weakestWinner;
      }
    }

    return chooseLosingCard(legal, trump, leadSuit);
  }

  const winningCards = legal.filter((c) =>
    canWinTrick(c, trick, trump, memory.botSeat)
  );

  if (winningCards.length > 0) {
    if (isLast) return sortWeakToStrong(winningCards)[0];

    const leadWinners = leadSuit
      ? winningCards.filter((c) => c.suit === leadSuit)
      : [];

    if (leadWinners.length > 0) return sortWeakToStrong(leadWinners)[0];

    return sortWeakToStrong(winningCards)[0];
  }

  return chooseLosingCard(legal, trump, leadSuit);
}