import type { HokmCard, HokmSuit, PlayedCard } from "./hokm-engine";
import { getLegalCards, getTrickWinner } from "./hokm-engine";

export type BotMemory = {
  played: HokmCard[];
  knownTrump: HokmCard[];
  teamScore: number;
  opponentScore: number;
};

function cardKey(card: HokmCard) { return `${card.suit}:${card.rank}`; }
function sameCard(a: HokmCard, b: HokmCard) { return cardKey(a) === cardKey(b); }
function strength(card: HokmCard, trump: HokmSuit, leadSuit: HokmSuit | null) {
  const trumpBonus = card.suit === trump ? 1000 : 0;
  const leadBonus = card.suit === leadSuit ? 300 : 0;
  return trumpBonus + leadBonus + card.value;
}

export function chooseTrumpForBot(hand: HokmCard[]): HokmSuit {
  const counts = new Map<HokmSuit, number>();
  for (const card of hand) counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => {
    const aPower = a[1] * 20 + hand.filter((card) => card.suit === a[0] && card.value >= 10).length * 8;
    const bPower = b[1] * 20 + hand.filter((card) => card.suit === b[0] && card.value >= 10).length * 8;
    return bPower - aPower;
  })[0]?.[0] ?? "♠";
}

export function chooseBotCard(
  hand: HokmCard[],
  trick: PlayedCard[],
  trump: HokmSuit,
  memory: BotMemory,
): HokmCard {
  const leadSuit = trick[0]?.card.suit ?? null;
  const legal = getLegalCards(hand, leadSuit);
  if (legal.length === 0) throw new Error("Bot has no legal card");
  if (trick.length === 0) {
    // شروع‌کننده کارت‌های امتیازآور را بی‌دلیل خرج نمی‌کند؛ کمترین کارتِ غیرحکم را ترجیح می‌دهد.
    const nonTrump = legal.filter((card) => card.suit !== trump);
    return [...(nonTrump.length ? nonTrump : legal)].sort((a, b) => a.value - b.value)[0];
  }

  const winningCards = legal.filter((candidate) => {
    const result = getTrickWinner([...trick, { playerId: "bot", card: candidate }], trump);
    return result.playerId === "bot";
  });
  if (winningCards.length) {
    // با کمترین کارت ممکن دست را ببر تا آس/شاه برای دست‌های بعد حفظ شود.
    return [...winningCards].sort((a, b) => strength(a, trump, leadSuit) - strength(b, trump, leadSuit))[0];
  }

  // اگر بردن ممکن نیست، کم‌ارزش‌ترین کارت مجاز را بسوزان؛ حکم را تا جای ممکن نگه دار.
  const safe = legal.filter((card) => card.suit !== trump);
  const candidates = safe.length ? safe : legal;
  return [...candidates].sort((a, b) => {
    const aSeen = memory.played.some((item) => sameCard(item, a)) ? 1 : 0;
    const bSeen = memory.played.some((item) => sameCard(item, b)) ? 1 : 0;
    return (aSeen - bSeen) || (a.value - b.value);
  })[0];
}
