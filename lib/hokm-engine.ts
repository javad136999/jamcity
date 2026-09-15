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

export const HOKM_SUITS: HokmSuit[] = [
  "♠",
  "♥",
  "♦",
  "♣",
];

export const HOKM_RANKS: HokmRank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];


// ==========================================
// ساخت دسته استاندارد ۵۲ کارت
// ==========================================

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


// ==========================================
// Shuffle
// ==========================================

export function shuffleDeck<T>(
  cards: T[],
  random = Math.random
): T[] {
  const result = [...cards];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));

    [result[i], result[j]] = [
      result[j],
      result[i],
    ];
  }

  return result;
}


// ==========================================
// تعیین تیم
//
// نفرات:
// 0 و 2 = تیم اول
// 1 و 3 = تیم دوم
// ==========================================

export function getTeamBySeat(
  seat: number
): Team {
  return seat % 2 === 0 ? 0 : 1;
}


// ==========================================
// کارت‌های مجاز برای بازی
//
// اگر خال زمینه داشته باشیم:
// فقط همان خال مجاز است.
//
// اگر نداشته باشیم:
// هر کارت مجاز است.
// ==========================================

export function getLegalCards(
  hand: HokmCard[],
  leadSuit: HokmSuit | null
): HokmCard[] {

  if (!leadSuit) {
    return [...hand];
  }

  const sameSuit = hand.filter(
    (card) => card.suit === leadSuit
  );

  return sameSuit.length > 0
    ? sameSuit
    : [...hand];
}


// ==========================================
// بررسی قانونی بودن کارت
// ==========================================

export function canPlayCard(
  hand: HokmCard[],
  card: HokmCard,
  leadSuit: HokmSuit | null
): boolean {

  return getLegalCards(
    hand,
    leadSuit
  ).some(
    (legalCard) =>
      legalCard.id === card.id
  );
}


// ==========================================
// آیا کارت اول از کارت دوم قوی‌تر است؟
// ==========================================

export function cardBeats(
  challenger: HokmCard,
  currentWinner: HokmCard,
  leadSuit: HokmSuit,
  trump: HokmSuit
): boolean {

  // حکم در مقابل غیرحکم
  if (challenger.suit === trump) {
    if (currentWinner.suit !== trump) {
      return true;
    }

    // هر دو حکم هستند
    return (
      challenger.value >
      currentWinner.value
    );
  }

  // کارت فعلی حکم است
  if (currentWinner.suit === trump) {
    return false;
  }

  // challenger حکم نیست و خال زمینه هم نیست
  if (challenger.suit !== leadSuit) {
    return false;
  }

  // challenger خال زمینه است
  // ولی کارت فعلی خال زمینه نیست
  if (currentWinner.suit !== leadSuit) {
    return true;
  }

  // هر دو خال زمینه هستند
  return (
    challenger.value >
    currentWinner.value
  );
}


// ==========================================
// تعیین برنده دست
// ==========================================

export function getTrickWinner(
  played: PlayedCard[],
  trump: HokmSuit
): PlayedCard {

  if (played.length === 0) {
    throw new Error(
      "Cannot determine winner of empty trick."
    );
  }

  const leadSuit =
    played[0].card.suit;

  let winner = played[0];

  for (const current of played.slice(1)) {

    if (
      cardBeats(
        current.card,
        winner.card,
        leadSuit,
        trump
      )
    ) {
      winner = current;
    }
  }

  return winner;
}


// ==========================================
// اضافه کردن امتیاز به تیم
// ==========================================

export function addTeamTrickPoint(
  scores: [number, number],
  winnerSeat: number
): [number, number] {

  const winnerTeam =
    getTeamBySeat(winnerSeat);

  const next: [number, number] = [
    scores[0],
    scores[1],
  ];

  next[winnerTeam] += 1;

  return next;
}


// ==========================================
// پایان ۱۳ دست
// ==========================================

export function isRoundComplete(
  tricksPlayed: number
): boolean {
  return tricksPlayed >= 13;
}


// ==========================================
// تعیین برنده راند
// ==========================================

export function getRoundWinner(
  scores: [number, number]
): Team | null {

  if (scores[0] > scores[1]) {
    return 0;
  }

  if (scores[1] > scores[0]) {
    return 1;
  }

  return null;
}


// ==========================================
// مرتب‌سازی کارت‌ها
// ==========================================

export function sortHand(
  hand: HokmCard[]
): HokmCard[] {

  const suitOrder: Record<
    HokmSuit,
    number
  > = {
    "♠": 0,
    "♥": 1,
    "♦": 2,
    "♣": 3,
  };

  return [...hand].sort((a, b) => {

    if (a.suit !== b.suit) {
      return (
        suitOrder[a.suit] -
        suitOrder[b.suit]
      );
    }

    return b.value - a.value;
  });
}


// ==========================================
// بررسی صحت دسته
// ==========================================

export function validateDeck(
  cards: HokmCard[]
): boolean {

  if (cards.length !== 52) {
    return false;
  }

  const ids = new Set(
    cards.map((card) => card.id)
  );

  return ids.size === 52;
}


// ==========================================
// بررسی صحت چهار دست
// ==========================================

export function validateHands(
  hands: HokmCard[][]
): boolean {

  if (hands.length !== 4) {
    return false;
  }

  if (
    hands.some(
      (hand) => hand.length !== 13
    )
  ) {
    return false;
  }

  const cards = hands.flat();

  const ids = new Set(
    cards.map((card) => card.id)
  );

  return (
    cards.length === 52 &&
    ids.size === 52
  );
}


// ==========================================
// توزیع کامل ۱۳ کارت
//
// این تابع برای زمانی است که می‌خواهیم
// کل دسته بین ۴ نفر پخش شود.
// ==========================================

export function dealHokmHands(
  cards = shuffleDeck(
    createHokmDeck()
  )
): HokmCard[][] {

  if (!validateDeck(cards)) {
    throw new Error(
      "Invalid Hokm deck."
    );
  }

  const hands: HokmCard[][] = [
    [],
    [],
    [],
    [],
  ];

  cards.forEach((card, index) => {
    hands[index % 4].push(card);
  });

  return hands.map(sortHand);
}


// ==========================================
// حذف کارت
// ==========================================

export function removeCard(
  hand: HokmCard[],
  cardId: string
): HokmCard[] {

  const exists = hand.some(
    (card) => card.id === cardId
  );

  if (!exists) {
    throw new Error(
      "Card does not exist in hand."
    );
  }

  return hand.filter(
    (card) => card.id !== cardId
  );
}


// ==========================================
// پیدا کردن کارت
// ==========================================

export function findCard(
  hand: HokmCard[],
  cardId: string
): HokmCard | undefined {

  return hand.find(
    (card) => card.id === cardId
  );
}


// ==========================================
// Rating
// ==========================================

export function calculateRatingDelta(
  won: boolean
): number {
  return won ? 25 : -15;
}