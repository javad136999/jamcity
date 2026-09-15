
import type {
  HokmCard,
  HokmSuit,
  PlayedCard,
} from "./hokm-engine";

import {
  getLegalCards,
  getTrickWinner,
  getTeamBySeat,
} from "./hokm-engine";

export type BotMemory = {
  played: HokmCard[];
  knownTrump: HokmCard[];
  teamScore: number;
  opponentScore: number;
  botSeat: number;
};

function cardKey(card: HokmCard): string {
  return card.id;
}

function sameCard(
  first: HokmCard,
  second: HokmCard
): boolean {
  return cardKey(first) === cardKey(second);
}

function getSuitCards(
  hand: HokmCard[],
  suit: HokmSuit
): HokmCard[] {
  return hand.filter(
    (card) => card.suit === suit
  );
}

function sortWeakToStrong(
  cards: HokmCard[]
): HokmCard[] {
  return [...cards].sort(
    (a, b) => a.value - b.value
  );
}

/**
 * قدرت یک خال برای انتخاب حکم
 */
function trumpSuitScore(
  hand: HokmCard[],
  suit: HokmSuit
): number {
  const cards = getSuitCards(
    hand,
    suit
  );

  const lengthScore =
    cards.length * 25;

  const highCardsScore =
    cards.reduce(
      (total, card) => {
        if (card.rank === "A") {
          return total + 45;
        }

        if (card.rank === "K") {
          return total + 30;
        }

        if (card.rank === "Q") {
          return total + 20;
        }

        if (card.rank === "J") {
          return total + 12;
        }

        if (card.value >= 8) {
          return total + 5;
        }

        return total + 1;
      },
      0
    );

  const aceBonus = cards.some(
    (card) => card.rank === "A"
  )
    ? 20
    : 0;

  const kingBonus = cards.some(
    (card) => card.rank === "K"
  )
    ? 8
    : 0;

  return (
    lengthScore +
    highCardsScore +
    aceBonus +
    kingBonus
  );
}

/**
 * انتخاب حکم توسط ربات
 */
export function chooseTrumpForBot(
  hand: HokmCard[]
): HokmSuit {
  if (hand.length === 0) {
    throw new Error(
      "Bot cannot choose trump with an empty hand."
    );
  }

  const suits: HokmSuit[] = [
    "♠",
    "♥",
    "♦",
    "♣",
  ];

  const scores = suits.map(
    (suit) => ({
      suit,
      score: trumpSuitScore(
        hand,
        suit
      ),
    })
  );

  scores.sort(
    (a, b) =>
      b.score - a.score
  );

  return scores[0].suit;
}

/**
 * بررسی اینکه اگر این کارت بازی شود
 * آیا ربات برنده دست می‌شود یا خیر
 */
function canWinTrick(
  card: HokmCard,
  trick: PlayedCard[],
  trump: HokmSuit,
  botSeat: number
): boolean {
  const simulatedCard: PlayedCard =
    {
      playerId: `bot-${botSeat}`,
      seat: botSeat,
      card,
    };

  const simulatedTrick: PlayedCard[] =
    [
      ...trick,
      simulatedCard,
    ];

  const winner =
    getTrickWinner(
      simulatedTrick,
      trump
    );

  return (
    winner.seat === botSeat
  );
}

/**
 * بررسی اینکه هم‌تیمی ربات در حال حاضر
 * برنده دست است یا خیر
 */
function teammateIsWinning(
  trick: PlayedCard[],
  trump: HokmSuit,
  botSeat: number
): boolean {
  if (trick.length === 0) {
    return false;
  }

  const winner =
    getTrickWinner(
      trick,
      trump
    );

  return (
    getTeamBySeat(
      winner.seat
    ) ===
    getTeamBySeat(botSeat)
  );
}

/**
 * انتخاب کارت مناسب برای شروع یک دست
 */
function chooseLeadCard(
  legal: HokmCard[],
  trump: HokmSuit
): HokmCard {
  const nonTrump =
    legal.filter(
      (card) =>
        card.suit !== trump
    );

  /*
   * اگر خال غیرحکم داریم،
   * ترجیح می‌دهیم از خال بلندتر بازی کنیم.
   */
  const source =
    nonTrump.length > 0
      ? nonTrump
      : legal;

  const suitGroups =
    new Map<
      HokmSuit,
      HokmCard[]
    >();

  for (const card of source) {
    const group =
      suitGroups.get(
        card.suit
      ) ?? [];

    group.push(card);

    suitGroups.set(
      card.suit,
      group
    );
  }

  const longestSuit =
    [...suitGroups.entries()]
      .sort(
        (a, b) =>
          b[1].length -
          a[1].length
      )[0];

  if (longestSuit) {
    return sortWeakToStrong(
      longestSuit[1]
    )[0];
  }

  return sortWeakToStrong(
    source
  )[0];
}

/**
 * وقتی ربات نمی‌تواند دست را ببرد،
 * ضعیف‌ترین کارت مناسب را دور می‌اندازد.
 */
function chooseLosingCard(
  legal: HokmCard[],
  trump: HokmSuit,
  memory: BotMemory
): HokmCard {
  const nonTrump =
    legal.filter(
      (card) =>
        card.suit !== trump
    );

  const candidates =
    nonTrump.length > 0
      ? nonTrump
      : legal;

  /*
   * ترجیح با کارت‌هایی است که قبلاً
   * در بازی دیده نشده‌اند.
   */
  const unseen =
    candidates.filter(
      (card) =>
        !memory.played.some(
          (played) =>
            sameCard(
              played,
              card
            )
        )
    );

  const pool =
    unseen.length > 0
      ? unseen
      : candidates;

  return sortWeakToStrong(
    pool
  )[0];
}

/**
 * انتخاب کارت توسط ربات
 */
export function chooseBotCard(
  hand: HokmCard[],
  trick: PlayedCard[],
  trump: HokmSuit,
  memory: BotMemory
): HokmCard {
  const leadSuit =
    trick[0]?.card.suit ??
    null;

  const legal =
    getLegalCards(
      hand,
      leadSuit
    );

  if (legal.length === 0) {
    throw new Error(
      "Bot has no legal card."
    );
  }

  /*
   * اگر ربات شروع‌کننده دست است،
   * یک کارت مناسب برای شروع انتخاب می‌کند.
   */
  if (trick.length === 0) {
    return chooseLeadCard(
      legal,
      trump
    );
  }

  /*
   * اگر هم‌تیمی ربات برنده است،
   * ربات بی‌دلیل کارت قوی خرج نمی‌کند.
   */
  if (
    teammateIsWinning(
      trick,
      trump,
      memory.botSeat
    )
  ) {
    return chooseLosingCard(
      legal,
      trump,
      memory
    );
  }

  /*
   * پیدا کردن تمام کارت‌هایی که
   * با بازی کردنشان ربات دست را می‌برد.
   */
  const winningCards =
    legal.filter(
      (card) =>
        canWinTrick(
          card,
          trick,
          trump,
          memory.botSeat
        )
    );

  /*
   * اگر چند کارت برنده داریم،
   * ضعیف‌ترین کارت برنده را بازی می‌کنیم
   * تا کارت‌های قوی‌تر حفظ شوند.
   */
  if (
    winningCards.length > 0
  ) {
    return sortWeakToStrong(
      winningCards
    )[0];
  }

  /*
   * اگر امکان بردن دست وجود ندارد،
   * ضعیف‌ترین کارت مناسب را بازی کن.
   */
  return chooseLosingCard(
    legal,
    trump,
    memory
  );
}

