"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  canPlayCard,
  getLegalCards,
  getTrickWinner,
  shuffleDeck,
  createHokmDeck,
} from "@/lib/hokm-engine";
import type {
  HokmCard,
  HokmSuit,
  PlayedCard,
} from "@/lib/hokm-engine";
import { chooseBotCard, chooseTrumpForBot } from "@/lib/hokm-bot";
import type { BotMemory } from "@/lib/hokm-bot";

type Suit = HokmSuit;
type Card = HokmCard;

type Player = {
  id: string;
  name: string;
  seat: number;
  isBot?: boolean;
  online?: boolean;
};

type Room = {
  id: string;
  status: "waiting" | "playing" | "finished";
  host_id: string | null;
};

type Reaction = {
  id: string;
  playerId: string;
  sticker: string;
};

type Message = {
  id: string;
  name: string;
  text: string;
};

type Props = {
  userId: string;
  displayName?: string | null;
};

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

const RANKS: Card["rank"][] = [
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

const STICKERS = ["👏", "😂", "🔥", "😮", "😎", "❤️"];

const WAIT_SECONDS = 20;

/**
 * ساخت دسته کارت با ساختار جدید HokmCard
 * شامل id یکتا برای هر کارت
 */

/**
 * تبدیل یک کارت خام/دریافتی از Supabase به HokmCard
 * برای سازگاری با داده‌های قدیمی.
 */
function normalizeCard(card: any): Card {
  return {
    id: card.id ?? `${card.suit}-${card.rank}`,
    suit: card.suit as Suit,
    rank: card.rank as Card["rank"],
    value:
      typeof card.value === "number"
        ? card.value
        : RANKS.indexOf(card.rank as Card["rank"]),
  };
}

function normalizeCards(cards: any[]): Card[] {
return (cards ?? []).map(normalizeCard);
}

export default function HokmGame({
  userId,
  displayName,
}: Props) {
  const supabase = useMemo(() => createClient() as any, []);

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [seconds, setSeconds] = useState(WAIT_SECONDS);

  const [offline, setOffline] = useState(false);
  const [started, setStarted] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);

  const [matchPhase, setMatchPhase] = useState<
    "choosing_hakem" | "choosing_trump" | "playing" | "finished"
  >("choosing_hakem");

  const [hakemSeat, setHakemSeat] = useState<number | null>(null);
  const [hakemCard, setHakemCard] = useState<Card | null>(null);
  const [hakemReveal, setHakemReveal] = useState(false);
  const hakemRevealTimer = useRef<number | null>(null);

  const [hakemDraws, setHakemDraws] = useState<
    { seat: number; card: Card }[]
  >([]);

  const [trumpSeconds, setTrumpSeconds] = useState(15);
  const [dealingFinalCards, setDealingFinalCards] = useState(false);
  const [showFirstTrickBanner, setShowFirstTrickBanner] = useState(false);
  const previousPhaseRef = useRef<string | null>(null);
  const [trumpReveal, setTrumpReveal] = useState(false);
  const trumpRevealTimer = useRef<number | null>(null);

  const [selectedCardIndex, setSelectedCardIndex] =
    useState<number | null>(null);

  const [hand, setHand] = useState<Card[]>([]);
  const [dealAnimation, setDealAnimation] = useState(false);
  const dealAnimationTimer = useRef<number | null>(null);
  const [trump, setTrump] = useState<Suit | null>(null);
  const [leadSuit, setLeadSuit] = useState<Suit | null>(null);
  const [turnSeat, setTurnSeat] = useState(0);
  const [ruleMessage, setRuleMessage] = useState("");

  const [currentTrick, setCurrentTrick] = useState<
    {
      seat: number;
      card: Card;
    }[]
  >([]);

  const [teamScores, setTeamScores] = useState({
    "0": 0,
    "1": 0,
  });

  const teamScoresRef = useRef({ "0": 0, "1": 0 });
  const tricksPlayedRef = useRef(0);

  // صندلی واقعی کاربر؛ باید قبل از useEffectها تعریف شود.
  const mySeat =
    players.find(
      (player) => player.id === userId
    )?.seat ?? 0;

  useEffect(() => {
    if (
      matchPhase === "playing" &&
      previousPhaseRef.current === "choosing_trump"
    ) {
      setDealingFinalCards(true);
      const timer = window.setTimeout(() => setDealingFinalCards(false), 2600);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [matchPhase]);

  useEffect(() => {
    previousPhaseRef.current = matchPhase;
  }, [matchPhase]);


  useEffect(() => {
    teamScoresRef.current = teamScores;
  }, [teamScores]);

  // اعلام حاکم فقط یک‌بار هنگام ورود به مرحله انتخاب حکم نمایش داده می‌شود.
  useEffect(() => {
    if (hakemSeat === null || matchPhase !== "choosing_trump") return;

    setHakemReveal(true);

    if (hakemRevealTimer.current) {
      window.clearTimeout(hakemRevealTimer.current);
    }

    hakemRevealTimer.current = window.setTimeout(() => {
      setHakemReveal(false);
      hakemRevealTimer.current = null;
    }, 2200);

    return () => {
      if (hakemRevealTimer.current) {
        window.clearTimeout(hakemRevealTimer.current);
        hakemRevealTimer.current = null;
      }
    };
  }, [hakemSeat, matchPhase]);

  // انیمیشن پخش کارت فقط هنگام ورود کارت‌های جدید به دست انجام می‌شود.
  useEffect(() => {
    if (!trump || matchPhase !== "playing") return;

    setTrumpReveal(true);

    if (trumpRevealTimer.current) {
      window.clearTimeout(trumpRevealTimer.current);
    }

    trumpRevealTimer.current = window.setTimeout(() => {
      setTrumpReveal(false);
      trumpRevealTimer.current = null;
    }, 1800);

    return () => {
      if (trumpRevealTimer.current) {
        window.clearTimeout(trumpRevealTimer.current);
        trumpRevealTimer.current = null;
      }

      if (hakemRevealTimer.current) {
        window.clearTimeout(hakemRevealTimer.current);
        hakemRevealTimer.current = null;
      }
    };
  }, [trump, matchPhase]);

  useEffect(() => {
    if (hand.length !== 5 && hand.length !== 13) return;

    setDealAnimation(true);

    if (dealAnimationTimer.current) {
      window.clearTimeout(dealAnimationTimer.current);
    }

    dealAnimationTimer.current = window.setTimeout(() => {
      setDealAnimation(false);
      dealAnimationTimer.current = null;
    }, hand.length === 5 ? 1050 : 1450);

    return () => {
      if (dealAnimationTimer.current) {
        window.clearTimeout(dealAnimationTimer.current);
        dealAnimationTimer.current = null;
      }

      if (trumpRevealTimer.current) {
        window.clearTimeout(trumpRevealTimer.current);
        trumpRevealTimer.current = null;
      }
    };
  }, [hand.length]);

  const [botHands, setBotHands] = useState<Card[][]>([
    [],
    [],
    [],
    [],
  ]);

  const botMemory = useRef<BotMemory>({
  played: [],
  knownTrump: [],
  teamScore: 0,
  opponentScore: 0,
  botSeat: 1,
});

  // دست کامل هر بازیکن که تا انتخاب حکم مخفی می‌ماند.
  const pendingOfflineHands = useRef<Card[][]>([[], [], [], []]);
  const trickResolutionTimer = useRef<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [winner, setWinner] = useState<string | null>(null);

  const audioContext = useRef<AudioContext | null>(null);
  const musicTimer = useRef<number | null>(null);

  const [musicOn, setMusicOn] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const previousTrickLengthRef = useRef(currentTrick.length);
  const previousScoresRef = useRef(`${teamScores["0"]}-${teamScores["1"]}`);

  const playHokmTone = useCallback(
    (type: "card" | "win" | "finish") => {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }).webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = audioContextRef.current ?? new AudioCtx();
        audioContextRef.current = ctx;
        if (ctx.state === "suspended") void ctx.resume();

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const settings =
          type === "card"
            ? {
                start: 240,
                end: 150,
                duration: 0.07,
                volume: 0.045,
                wave: "triangle" as OscillatorType,
              }
            : type === "win"
              ? {
                  start: 420,
                  end: 720,
                  duration: 0.22,
                  volume: 0.06,
                  wave: "sine" as OscillatorType,
                }
              : {
                  start: 360,
                  end: 880,
                  duration: 0.42,
                  volume: 0.07,
                  wave: "sine" as OscillatorType,
                };

        osc.type = settings.wave;
        osc.frequency.setValueAtTime(settings.start, now);
        osc.frequency.exponentialRampToValueAtTime(
          settings.end,
          now + settings.duration
        );

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(
          settings.volume,
          now + 0.012
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + settings.duration
        );

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + settings.duration + 0.02);
      } catch {}
    },
    []
  );

  useEffect(() => {
    return () => {
      void audioContext.current?.close();
      audioContext.current = null;

      if (musicTimer.current) {
        window.clearInterval(musicTimer.current);
        musicTimer.current = null;
      }

      if (dealAnimationTimer.current) {
        window.clearTimeout(dealAnimationTimer.current);
        dealAnimationTimer.current = null;
      }
    };
  }, []);

  function tone(
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    volume = 0.035
  ) {
    if (typeof window === "undefined") return;

    const AudioCtor =
      window.AudioContext ||
      (window as any).webkitAudioContext;

    if (!AudioCtor) return;

    const context =
      audioContext.current ?? new AudioCtor();

    audioContext.current = context;

    if (context.state === "suspended") {
      void context.resume();
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(
      frequency,
      context.currentTime
    );

    gain.gain.setValueAtTime(
      volume,
      context.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + duration
    );

    oscillator.connect(gain).connect(context.destination);

    oscillator.start();
    oscillator.stop(
      context.currentTime + duration
    );
  }

  function playCardSound() {
    tone(210, 0.06, "triangle", 0.045);

    window.setTimeout(() => {
      tone(155, 0.05, "triangle", 0.025);
    }, 30);
  }

  function playDealSound() {
    [0, 1, 2, 3].forEach((step) => {
      window.setTimeout(
        () =>
          tone(
            260 + step * 35,
            0.07,
            "triangle",
            0.03
          ),
        step * 75
      );
    });
  }

  function playVictorySound() {
    [523, 659, 784, 1046].forEach(
      (frequency, index) => {
        window.setTimeout(
          () =>
            tone(
              frequency,
              0.25,
              "sine",
              0.055
            ),
          index * 120
        );
      }
    );
  }

  function toggleMusic() {
    if (musicOn) {
      if (musicTimer.current) {
        window.clearInterval(
          musicTimer.current
        );
      }

      musicTimer.current = null;
      setMusicOn(false);
      return;
    }

    const notes = [
      196,
      247,
      294,
      247,
      220,
      262,
      330,
      262,
    ];

    let index = 0;

    tone(
      notes[index],
      0.35,
      "sine",
      0.018
    );

    musicTimer.current =
      window.setInterval(() => {
        index =
          (index + 1) % notes.length;

        tone(
          notes[index],
          0.35,
          "sine",
          0.018
        );
      }, 650);

    setMusicOn(true);
  }

  /*
   * Online realtime channel
   */
  useEffect(() => {
    if (!room || offline) return;

    const channel = supabase.channel(
      `hokm-room:${room.id}`,
      {
        config: {
          presence: {
            key: userId,
          },
        },
      }
    );

    channel
      .on(
        "presence",
        {
          event: "sync",
        },
        () => {
          const state =
            channel.presenceState();

          const online = Object.values(
            state
          ).flat() as any[];

          setPlayers((old) =>
            old.map((player) => ({
              ...player,
              online: online.some(
                (item) =>
                  item.user_id === player.id
              ),
            }))
          );
        }
      )
      .on(
        "broadcast",
        {
          event: "game",
        },
        ({ payload }: any) => {
          if (payload.type === "start") {
            setMatchId(
              payload.matchId ?? null
            );

            setStarted(true);
            playDealSound();
          }

          if (payload.type === "message") {
            setMessages((old) => [
              ...old,
              payload.message,
            ]);
          }

          if (payload.type === "reaction") {
            showReaction(
              payload.reaction
            );
          }

          if (payload.type === "victory") {
            showVictory(payload.name);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "hokm_matches",
        },
        ({ new: nextMatch }: any) => {
          if (
            !matchId ||
            nextMatch.id !== matchId
          ) {
            return;
          }

          setTrump(
            nextMatch.trump ?? null
          );

          setMatchPhase(
            nextMatch.phase ??
              "choosing_trump"
          );

          setHakemSeat(
            nextMatch.hakem_seat ??
              null
          );

          setLeadSuit(
            nextMatch.lead_suit ??
              null
          );

          setTurnSeat(
            nextMatch.turn_seat ?? 0
          );

          setCurrentTrick(
            nextMatch.current_trick ??
              []
          );

          setTeamScores(
            nextMatch.team_scores ?? {
              "0": 0,
              "1": 0,
            }
          );

          if (
            nextMatch.status ===
            "finished"
          ) {
            setWinner("تیم برنده");
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "hokm_players",
          filter: `room_id=eq.${room.id}`,
        },
        async () => {
          if (
            room.host_id !== userId ||
            started ||
            matchId
          ) {
            return;
          }

          const { count } =
            await supabase
              .from("hokm_players")
              .select("user_id", {
                count: "exact",
                head: true,
              })
              .eq(
                "room_id",
                room.id
              );

          if (count === 4) {
            await startOnlineGame(
              room.id
            );
          }
        }
      )
      .subscribe(
        async (status: string) => {
          if (
            status === "SUBSCRIBED"
          ) {
            await channel.track({
              user_id: userId,
              name:
                displayName ||
                "همشهری",
            });
          }
        }
      );

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    room,
    offline,
    supabase,
    userId,
    displayName,
    matchId,
    started,
  ]);

  /*
   * Load private online hand
   */
  useEffect(() => {
    if (!matchId || offline) return;

    async function loadPrivateHand() {
      const { data: match } =
        await supabase
          .from("hokm_matches")
          .select(
            "phase,hakem_seat,trump,lead_suit,turn_seat,current_trick,team_scores"
          )
          .eq("id", matchId)
          .maybeSingle();

      if (match) {
        setMatchPhase(
          match.phase ??
            "choosing_trump"
        );

        setHakemSeat(
          match.hakem_seat ?? null
        );

        setTrump(
          match.trump ?? null
        );

        setLeadSuit(
          match.lead_suit ?? null
        );

        setTurnSeat(
          match.turn_seat ?? 0
        );

        setCurrentTrick(
          match.current_trick ?? []
        );

        setTeamScores(
          match.team_scores ?? {
            "0": 0,
            "1": 0,
          }
        );
      }

      const { data, error } =
        await supabase
          .from("hokm_hands")
          .select("cards")
          .eq(
            "match_id",
            matchId
          )
          .eq(
            "user_id",
            userId
          )
          .maybeSingle();

      if (!error && data?.cards) {
        setHand(
          normalizeCards(
            data.cards
          )
        );
      }

      const { data: draw } =
        await supabase
          .from("hokm_hakem_draws")
          .select("card")
          .eq(
            "match_id",
            matchId
          )
          .eq(
            "user_id",
            userId
          )
          .maybeSingle();

      if (draw?.card) {
        setHakemCard(
          normalizeCard(draw.card)
        );
      }

      const { data: allDraws } =
        await supabase
          .from(
            "hokm_hakem_draws"
          )
          .select("seat,card")
          .eq(
            "match_id",
            matchId
          )
          .order("seat");

      if (allDraws) {
        setHakemDraws(
          allDraws.map(
            (item: any) => ({
              seat: item.seat,
              card: normalizeCard(
                item.card
              ),
            })
          )
        );
      }
    }

    void loadPrivateHand();
  }, [
    matchId,
    matchPhase,
    offline,
    supabase,
    userId,
  ]);

  /*
   * Trump timer
   */
  useEffect(() => {
    if (
      matchPhase !==
      "choosing_trump"
    ) {
      return;
    }

    setTrumpSeconds(15);

    const timer =
      window.setInterval(() => {
        setTrumpSeconds(
          (value) =>
            Math.max(0, value - 1)
        );
      }, 1000);

    return () =>
      window.clearInterval(timer);
  }, [matchPhase]);

  /*
   * Auto choose trump if hakem time expires
   */
  useEffect(() => {
    const currentSeat =
      players.find(
        (player) =>
          player.id === userId
      )?.seat ?? 0;

    if (
      matchPhase !==
        "choosing_trump" ||
      hakemSeat !== currentSeat ||
      trumpSeconds !== 0 ||
      trump
    ) {
      return;
    }

    const autoSuit = SUITS[Math.floor(Math.random() * SUITS.length)];
    void chooseTrump(autoSuit);
  }, [
    matchPhase,
    hakemSeat,
    players,
    userId,
    trumpSeconds,
    trump,
  ]);

  // اگر حاکم ربات باشد، بعد از دریافت ۵ کارت خودش حکم را انتخاب می‌کند.
  useEffect(() => {
    if (!offline || !started || matchPhase !== "choosing_trump" || hakemSeat === null || hakemSeat === 0) return;

    const timer = window.setTimeout(() => {
      const hakemHand = botHands[hakemSeat] ?? [];
      if (hakemHand.length !== 5 || trump) return;

      const selectedTrump = chooseTrumpForBot(hakemHand);
      void chooseTrump(selectedTrump);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [offline, started, matchPhase, hakemSeat, botHands, trump]);

  async function chooseTrump(suit: Suit) {
    if (offline) {
      if (hakemSeat === null) return;

      const currentSeat =
        players.find((player) => player.id === userId)?.seat ?? 0;

      // در حالت آفلاین، اگر حاکم ربات باشد، خود ربات مجاز به انتخاب حکم است.
      const isBotHakem =
        currentSeat !== hakemSeat &&
        hakemSeat !== null &&
        hakemSeat !== 0;

      if (currentSeat !== hakemSeat && !isBotHakem) return;

      const completeHands = pendingOfflineHands.current;
      if (!completeHands[0]?.length) return;

      setBotHands(completeHands);
      setHand(completeHands[0] ?? []);
      setTrump(suit);
      setMatchPhase("playing");
      setTurnSeat(hakemSeat);
      setLeadSuit(null);
      setCurrentTrick([]);
      botMemory.current.knownTrump = completeHands.flat().filter((card) => card.suit === suit);
      playDealSound();
      return;
    }

    if (!matchId) return;

    const { error } = await supabase.rpc("choose_hokm_trump", {
      p_match_id: matchId,
      p_trump: suit,
    });

    if (error) {
      setRuleMessage(error.message);
      window.setTimeout(() => setRuleMessage(""), 2600);
      return;
    }

    setTrump(suit);
    setMatchPhase("playing");
    setTurnSeat(hakemSeat ?? 0);
  }

  /*
   * Waiting timer
   */
  useEffect(() => {
    if (
      !waiting ||
      offline ||
      started
    ) {
      return;
    }

    const timer =
      window.setInterval(() => {
        setSeconds(
          (value) =>
            Math.max(value - 1, 0)
        );
      }, 1000);

    return () =>
      window.clearInterval(timer);
  }, [
    waiting,
    offline,
    started,
  ]);

  /*
   * Fallback to bots
   */
  useEffect(() => {
    if (
      !waiting ||
      started ||
      seconds > 0
    ) {
      return;
    }

    setOffline(true);

    setPlayers((old) => {
      const existingSeats =
        new Set(
          old.map(
            (player) =>
              player.seat
          )
        );

      const bots: Player[] = [];

      for (
        let seat = 0;
        seat < 4;
        seat++
      ) {
        if (
          existingSeats.has(seat)
        ) {
          continue;
        }

        bots.push({
          id: `bot-${seat}`,
          name:
            seat === 0
              ? "شما"
              : `ربات جم${
                  seat > 1
                    ? ` ${seat}`
                    : ""
                }`,
          seat,
          isBot: true,
        });
      }

      return [...old, ...bots];
    });

    startOfflineGame();
  }, [
    seconds,
    waiting,
    started,
  ]);

  /*
   * ساخت یک دست برای حالت آفلاین
   */

  /**
   * شروع بازی آفلاین با جریان واقعی حکم ایرانی:
   * 1) تعیین حاکم با قرعه
   * 2) ۵ کارت برای هر نفر
   * 3) انتخاب خال حکم توسط حاکم
   * 4) تکمیل دست تا ۱۳ کارت
   * 5) شروع بازی از حاکم
   */
  function startOfflineGame() {
    const drawDeck = shuffleDeck(createHokmDeck());
    let cursor = 0;
    const draws: { seat: number; card: Card }[] = [];
    let contenders = [0, 1, 2, 3];

    // در صورت تساوی، فقط بازیکنان مساوی دوباره قرعه می‌کشند.
    while (contenders.length > 1) {
      const round = contenders.map((seat) => ({
        seat,
        card: drawDeck[cursor++],
      }));
      const highest = Math.max(...round.map((item) => item.card.value));
      const highestRound = round.filter((item) => item.card.value === highest);
      draws.push(...round);
      contenders = highestRound.map((item) => item.seat);
    }

    const hakemSeatValue = contenders[0] ?? 0;
    const hakemDraw = [...draws].reverse().find((item) => item.seat === hakemSeatValue);

    // قرعه‌ها فقط برای تعیین حاکم هستند؛ برای دست بازی یک دسته تازه و کامل می‌سازیم.
    const dealDeck = shuffleDeck(createHokmDeck());
    const fiveCardHands: Card[][] = [[], [], [], []];
    let dealIndex = 0;

    for (let round = 0; round < 5; round += 1) {
      for (let seat = 0; seat < 4; seat += 1) {
        fiveCardHands[seat].push(dealDeck[dealIndex++]);
      }
    }

    const completeHands: Card[][] = fiveCardHands.map((cards) => [...cards]);
    for (let round = 0; round < 8; round += 1) {
      for (let seat = 0; seat < 4; seat += 1) {
        completeHands[seat].push(dealDeck[dealIndex++]);
      }
    }

    setHakemSeat(hakemSeatValue);
    setHakemCard(hakemDraw?.card ?? null);
    setHakemDraws(draws);
    setBotHands(fiveCardHands);
    setHand(fiveCardHands[0] ?? []);

    setWaiting(false);
    setStarted(true);
    setMatchPhase("choosing_trump");
    setTrump(null);
    setTurnSeat(hakemSeatValue);
    setLeadSuit(null);
    setCurrentTrick([]);
    setTeamScores({ "0": 0, "1": 0 });
    teamScoresRef.current = { "0": 0, "1": 0 };
    tricksPlayedRef.current = 0;
    if (trickResolutionTimer.current !== null) {
      window.clearTimeout(trickResolutionTimer.current);
      trickResolutionTimer.current = null;
    }
    setWinner(null);

    botMemory.current = {
      played: [],
      knownTrump: [],
      teamScore: 0,
      opponentScore: 0,
      botSeat: hakemSeatValue === 0 ? 1 : hakemSeatValue,
    };

    // ذخیره ۸ کارت باقیمانده برای تکمیل دست بعد از انتخاب حکم.
    pendingOfflineHands.current = completeHands;

    playDealSound();
  }

  /*
   * Bot turn
   *
   * آفلاین: ربات همان قوانین بازی انسان را رعایت می‌کند:
   * پیروی اجباری از خال، محاسبه برنده تریک، امتیازدهی و شروع تریک بعدی.
   */
  useEffect(() => {
    if (
      !offline ||
      !started ||
      winner ||
      matchPhase !== "playing" ||
      turnSeat === mySeat ||
      currentTrick.length >= 4 ||
      trickResolutionTimer.current !== null
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      const botHand = botHands[turnSeat] ?? [];
      if (botHand.length === 0) return;

      const trick: PlayedCard[] = currentTrick.map((item) => ({
        playerId: String(item.seat),
        seat: item.seat,
        card: item.card,
      }));

      botMemory.current.botSeat = turnSeat;

      let card: Card;
      try {
        card = chooseBotCard(
          botHand,
          trick,
          trump || "♠",
          botMemory.current
        );
      } catch {
        return;
      }

      if (!card) return;

      botMemory.current.played.push(card);

      const nextHands = botHands.map((items, seat) =>
        seat === turnSeat
          ? items.filter((item) => item.id !== card.id)
          : items
      );

      setBotHands(nextHands);
      playCardSound();

      const nextTrick = [
        ...currentTrick,
        {
          seat: turnSeat,
          card,
        },
      ];

      setCurrentTrick(nextTrick);

      if (nextTrick.length < 4) {
        if (currentTrick.length === 0) {
          setLeadSuit(card.suit);
        }
        setTurnSeat((turnSeat + 1) % 4);
        return;
      }

      const played: PlayedCard[] = nextTrick.map((item) => ({
        playerId: String(item.seat),
        seat: item.seat,
        card: item.card,
      }));

      const winnerCard = getTrickWinner(
        played,
        trump || "♠"
      );
      const winningSeat = winnerCard.seat;

      const winningTeam =
        winningSeat % 2 === 0 ? "0" : "1";

      const nextScores = {
        ...teamScoresRef.current,
        [winningTeam]:
          teamScoresRef.current[winningTeam] + 1,
      };

      teamScoresRef.current = nextScores;
      setTeamScores(nextScores);

      tricksPlayedRef.current += 1;
      const nextTricksPlayed = tricksPlayedRef.current;

      trickResolutionTimer.current = window.setTimeout(() => {
        trickResolutionTimer.current = null;
        setCurrentTrick([]);
        setLeadSuit(null);

        if (nextTricksPlayed >= 13) {
          setTurnSeat(winningSeat);
          setMatchPhase("finished");

          showVictory(
            nextScores["0"] > nextScores["1"]
              ? "تیم شما برنده شد"
              : "تیم رقیب برنده شد"
          );
          return;
        }

        setTurnSeat(winningSeat);
      }, 650);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    offline,
    started,
    winner,
    matchPhase,
    turnSeat,
    trump,
    currentTrick,
    botHands,
    mySeat,
  ]);

  /*
   * Join online room
   */
  async function joinRoom() {
    setWaiting(true);
    setSeconds(WAIT_SECONDS);
    setOffline(false);

    const { data } =
      await supabase
        .from("hokm_rooms")
        .select(
          "id,status,host_id"
        )
        .eq(
          "status",
          "waiting"
        )
        .limit(1)
        .maybeSingle();

    let selected =
      data as Room | null;

    if (!selected) {
      const created =
        await supabase
          .from("hokm_rooms")
          .insert({
            status: "waiting",
            host_id: userId,
          })
          .select(
            "id,status,host_id"
          )
          .single();

      if (created.error) {
        setOffline(true);
        startOfflineGame();
        return;
      }

      selected =
        created.data as Room;
    }

    setRoom(selected);

    const current =
      await supabase
        .from("hokm_players")
        .select(
          "user_id,name,seat"
        )
        .eq(
          "room_id",
          selected.id
        )
        .order("seat");

    const rows =
      (current.data ??
        []) as any[];

    const nextSeat =
      rows.length;

    await supabase
      .from("hokm_players")
      .upsert({
        room_id:
          selected.id,
        user_id: userId,
        name:
          displayName ||
          "همشهری",
        seat: nextSeat,
      });

    setPlayers([
      ...rows.map(
        (item) => ({
          id: item.user_id,
          name: item.name,
          seat: item.seat,
        })
      ),
      {
        id: userId,
        name:
          displayName ||
          "همشهری",
        seat: nextSeat,
      },
    ]);

    if (
      rows.length + 1 >= 4 &&
      selected.host_id === userId
    ) {
      await startOnlineGame(
        selected.id
      );
    }
  }

  /*
   * Start online game
   */
  async function startOnlineGame(
    roomId: string
  ) {
    await supabase
      .from("hokm_rooms")
      .update({
        status: "playing",
      })
      .eq(
        "id",
        roomId
      );

    const {
      data: createdMatch,
      error,
    } = await supabase.rpc(
      "start_hokm_match",
      {
        p_room_id: roomId,
      }
    );

    if (
      error ||
      !createdMatch
    ) {
      setRuleMessage(
        error?.message ||
          "شروع مسابقه انجام نشد."
      );

      return;
    }

    setMatchId(
      createdMatch as string
    );

    setMatchPhase(
      "choosing_trump"
    );

    const {
      data: drawMatch,
    } = await supabase
      .from("hokm_matches")
      .select(
        "phase,hakem_seat,trump,turn_seat"
      )
      .eq(
        "id",
        createdMatch
      )
      .maybeSingle();

    if (drawMatch) {
      setMatchPhase(
        drawMatch.phase ??
          "choosing_trump"
      );

      setHakemSeat(
        drawMatch.hakem_seat ??
          null
      );

      setTrump(
        drawMatch.trump ??
          null
      );

      setTurnSeat(
        drawMatch.turn_seat ??
          0
      );
    }

    setStarted(true);

    await supabase
      .channel(
        `hokm-room:${roomId}`
      )
      .send({
        type: "broadcast",
        event: "game",
        payload: {
          type: "start",
          matchId:
            createdMatch,
        },
      });
  }

  function showReaction(
    reaction: Reaction
  ) {
    setReactions((old) => [
      ...old.filter(
        (item) =>
          item.playerId !==
          reaction.playerId
      ),
      reaction,
    ]);

    window.setTimeout(
      () =>
        setReactions((old) =>
          old.filter(
            (item) =>
              item.id !==
              reaction.id
          )
        ),
      3200
    );
  }

  function showVictory(
    name: string
  ) {
    setWinner(name);
    playVictorySound();
  }

  async function sendReaction(
    sticker: string
  ) {
    const reaction = {
      id: crypto.randomUUID(),
      playerId: userId,
      sticker,
    };

    showReaction(reaction);

    if (
      room &&
      !offline
    ) {
      await supabase
        .channel(
          `hokm-room:${room.id}`
        )
        .send({
          type: "broadcast",
          event: "game",
          payload: {
            type: "reaction",
            reaction,
          },
        });
    }
  }

  /*
   * Play human card
   *
   * این تابع هم برای کارت انسان و هم برای پایان تریک مسئول state آفلاین است.
   * در حالت آنلاین فقط حرکت را به Supabase می‌فرستد و state از سرور می‌آید.
   */
  async function playCard(index: number) {
    if (
      !started ||
      winner ||
      matchPhase !== "playing" ||
      turnSeat !== mySeat ||
      currentTrick.length >= 4
    ) {
      return;
    }

    const selected = hand[index];
    if (!selected) return;

    if (!canPlayCard(hand, selected, leadSuit)) {
      setRuleMessage(
        leadSuit
          ? `باید خال ${leadSuit} را بازی کنی.`
          : "این کارت قابل بازی نیست."
      );

      window.setTimeout(() => setRuleMessage(""), 2200);
      return;
    }

    if (room && !offline && matchId) {
      const { error } = await supabase.rpc("submit_hokm_move", {
        p_match_id: matchId,
        p_card: selected,
      });

      if (error) {
        setRuleMessage(error.message);
        window.setTimeout(() => setRuleMessage(""), 2600);
        return;
      }

      playCardSound();
      setHand((old) => old.filter((card) => card.id !== selected.id));
      return;
    }

    // حالت آفلاین
    playCardSound();

    setHand((old) =>
      old.filter((card) => card.id !== selected.id)
    );

    const nextTrick = [
      ...currentTrick,
      {
        seat: 0,
        card: selected,
      },
    ];

    setCurrentTrick(nextTrick);

    if (currentTrick.length === 0) {
      setLeadSuit(selected.suit);
    }

    if (nextTrick.length < 4) {
      setTurnSeat(1);
      return;
    }

    const played: PlayedCard[] = nextTrick.map((item) => ({
      playerId: String(item.seat),
      seat: item.seat,
      card: item.card,
    }));

    const winnerCard = getTrickWinner(
      played,
      trump || "♠"
    );
    const winningSeat = winnerCard.seat;

    const winningTeam = winningSeat % 2 === 0 ? "0" : "1";
    const nextScores = {
      ...teamScoresRef.current,
      [winningTeam]:
        teamScoresRef.current[winningTeam] + 1,
    };

    teamScoresRef.current = nextScores;
    setTeamScores(nextScores);

    tricksPlayedRef.current += 1;
    const nextTricksPlayed = tricksPlayedRef.current;

    if (trickResolutionTimer.current !== null) {
      window.clearTimeout(trickResolutionTimer.current);
    }

    trickResolutionTimer.current = window.setTimeout(() => {
      trickResolutionTimer.current = null;
      setCurrentTrick([]);
      setLeadSuit(null);

      if (nextTricksPlayed >= 13) {
        setTurnSeat(winningSeat);
        setMatchPhase("finished");

        showVictory(
          nextScores["0"] > nextScores["1"]
            ? "تیم شما برنده شد"
            : "تیم رقیب برنده شد"
        );
        return;
      }

      setTurnSeat(winningSeat);
    }, 650);
  }

  async function sendMessage(
    event: FormEvent
  ) {
    event.preventDefault();

    const text =
      message.trim();

    if (!text) return;

    const item = {
      id: crypto.randomUUID(),
      name:
        displayName ||
        "همشهری",
      text,
    };

    setMessages((old) => [
      ...old,
      item,
    ]);

    setMessage("");

    if (
      room &&
      !offline
    ) {
      await supabase
        .channel(
          `hokm-room:${room.id}`
        )
        .send({
          type: "broadcast",
          event: "game",
          payload: {
            type: "message",
            message: item,
          },
        });
    }
  }

  if (
    !waiting &&
    !started
  ) {
    return (
      <LobbyCard
        onJoin={joinRoom}
      />
    );
  }

  // First-trick announcement: runs inside HokmGame only.
  useEffect(() => {
    if (
      matchPhase === "playing" &&
      currentTrick.length === 0 &&
      previousPhaseRef.current === "choosing_trump"
    ) {
      const timer = window.setTimeout(() => setShowFirstTrickBanner(true), 2650);
      const hide = window.setTimeout(() => setShowFirstTrickBanner(false), 4650);
      return () => {
        window.clearTimeout(timer);
        window.clearTimeout(hide);
      };
    }
    return undefined;
  }, [matchPhase, currentTrick.length]);


  return (
    <main>
      {showFirstTrickBanner && (
        <div className="hokm-first-trick-banner" aria-live="polite">
          <span className="crown">👑</span>
          <div className="title">دست ۱ از ۱۳</div>
          <div className="subtitle">
            حاکم شروع می‌کند • نوبت اولین کارت
          </div>
          <div className="hokm-seven-rule">🏆 اولین تیم با ۷ دست، برنده راند</div>
        </div>
      )}

      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-[#B8E9C7]">
              بازی حکم چهارنفره
            </p>

            <h1 className="text-2xl font-black">
              میز جم{" "}
              {offline && (
                <span className="text-sm text-[#FFD98A]">
                  · آفلاین
                </span>
              )}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMusic}
              className="rounded-full bg-white/10 px-3 py-2 text-xs transition hover:bg-white/20"
              aria-label="موسیقی پس‌زمینه"
            >
              {musicOn
                ? "🔊 موسیقی روشن"
                : "🔇 موسیقی خاموش"}
            </button>

            <span className="rounded-full bg-white/10 px-3 py-2 text-xs">
              {
                players.filter(
                  (p) =>
                    !p.isBot
                ).length
              }
              /۴ بازیکن
            </span>
          </div>
        </header>

        {waiting ? (
          <WaitingRoom
            players={players}
            seconds={seconds}
            onOffline={
              startOfflineGame
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <section className="hokm-table relative min-h-[560px] overflow-hidden rounded-[30px] border border-[#E8C878]/25 p-4 shadow-[0_30px_90px_rgba(0,0,0,.45)] sm:min-h-[620px] sm:p-8">
              {hakemReveal && hakemSeat !== null && (
                <div className="pointer-events-none absolute inset-0 z-[65] flex items-center justify-center">
                  <div className="hokm-hakem-reveal absolute inset-0" />
                  <div className="hokm-hakem-card relative flex flex-col items-center">
                    <div className="text-[10px] font-black tracking-[.38em] text-[#F7D98A] sm:text-xs">
                      حاکم این دست
                    </div>

                    <div className="mt-3 flex h-28 w-28 items-center justify-center rounded-full border-2 border-[#F2CF7A]/70 bg-[#071E14]/95 text-5xl shadow-[0_0_60px_rgba(232,200,120,.38)] sm:h-32 sm:w-32 sm:text-6xl">
                      👑
                    </div>

                    <div className="mt-3 rounded-2xl border border-[#F2CF7A]/30 bg-black/45 px-6 py-3 text-center backdrop-blur-md">
                      <div className="text-lg font-black text-white">
                        {hakemSeat === mySeat
                          ? "شما حاکم شدید!"
                          : players.find((p) => p.seat === hakemSeat)?.name || `بازیکن ${hakemSeat + 1}`}
                      </div>
                      <div className="mt-1 text-[10px] font-bold text-white/60">
                        حاکم اکنون خال حکم را انتخاب می‌کند
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {trumpReveal && (
                <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center">
                  <div className="hokm-trump-reveal absolute inset-0" />
                  <div className="hokm-trump-announcement relative flex flex-col items-center">
                    <div className="text-[10px] font-black tracking-[.35em] text-[#F7D98A] sm:text-xs">
                      حکم بازی
                    </div>
                    <div className="mt-2 flex h-24 w-24 items-center justify-center rounded-full border-2 border-[#F2CF7A]/70 bg-[#071E14]/90 text-6xl shadow-[0_0_50px_rgba(232,200,120,.35)] sm:h-28 sm:w-28 sm:text-7xl">
                      {trump}
                    </div>
                    <div className="mt-3 rounded-full border border-white/10 bg-black/35 px-5 py-2 text-sm font-black text-white backdrop-blur-sm">
                      خال حکم مشخص شد
                    </div>
                  </div>
                </div>
              )}
              <button
                type="button"
                aria-label="فعال کردن صدای بازی"
                title="صدای بازی"
                onClick={() => playHokmTone("card")}
                className="hokm-sound-button absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-[#E8C878]/25 bg-[#082719]/75 text-base shadow-lg backdrop-blur-md transition hover:scale-105"
              >
                🔊
              </button>
              <div className="pointer-events-none absolute inset-4 rounded-[26px] border border-[#E8C878]/20 sm:inset-5" />
              <div className="pointer-events-none absolute inset-7 rounded-[22px] border border-white/[0.06] sm:inset-8" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#E8C878]/10 shadow-[0_0_80px_rgba(232,200,120,.08)]" />

              <div className="hokm-glow absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full" />

              <Seat
                name={
                  players.find(
                    (p) =>
                      p.seat === 0
                  )?.name ||
                  "شما"
                }
                reaction={
                  reactions.find(
                    (r) =>
                      r.playerId ===
                      players.find(
                        (p) =>
                          p.seat ===
                          0
                      )?.id
                  )?.sticker
                }
                className="bottom-4 left-1/2 -translate-x-1/2"
              />

              <Seat
                name={
                  players.find(
                    (p) =>
                      p.seat === 1
                  )?.name ||
                  "در انتظار"
                }
                reaction={
                  reactions.find(
                    (r) =>
                      r.playerId ===
                      players.find(
                        (p) =>
                          p.seat ===
                          1
                      )?.id
                  )?.sticker
                }
                className="right-3 top-1/2 -translate-y-1/2"
              />

              <Seat
                name={
                  players.find(
                    (p) =>
                      p.seat === 2
                  )?.name ||
                  "در انتظار"
                }
                reaction={
                  reactions.find(
                    (r) =>
                      r.playerId ===
                      players.find(
                        (p) =>
                          p.seat ===
                          2
                      )?.id
                  )?.sticker
                }
                className="left-1/2 top-4 -translate-x-1/2"
              />

              <Seat
                name={
                  players.find(
                    (p) =>
                      p.seat === 3
                  )?.name ||
                  "در انتظار"
                }
                reaction={
                  reactions.find(
                    (r) =>
                      r.playerId ===
                      players.find(
                        (p) =>
                          p.seat ===
                          3
                      )?.id
                  )?.sticker
                }
                className="left-3 top-1/2 -translate-y-1/2"
              />

              <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
                <div className="hokm-scoreboard mb-2 flex items-center gap-1 rounded-2xl border border-white/10 bg-black/20 p-1 text-[9px] font-black shadow-lg backdrop-blur-md">
                  <span className="rounded-xl bg-white/10 px-3 py-1.5">
                    تیم شما <b className="ml-1 text-[#FFD98A]">{teamScores["0"]}</b>
                  </span>
                  <span className="h-4 w-px bg-white/10" />
                  <span className="rounded-xl bg-white/10 px-3 py-1.5">
                    تیم رقیب <b className="ml-1 text-[#FFD98A]">{teamScores["1"]}</b>
                  </span>
                </div>

                <div
                  className={`hokm-trick-zone relative mb-2 h-36 w-64 sm:h-44 sm:w-80 ${
                    currentTrick.length === 4
                      ? "hokm-trick-resolving"
                      : ""
                  }`}
                >
                  <div className="pointer-events-none absolute inset-1 rounded-full border border-white/[0.06]" />
                  {currentTrick.map(
                    (
                      played,
                      index
                    ) => (
                      <span
                        key={`${played.seat}-${index}`}
                        className={`hokm-trick-card hokm-trick-seat-${played.seat} rounded-xl border border-[#D8C28A]/60 bg-gradient-to-br from-white via-[#FBFAF3] to-[#E9E7DB] px-3 py-2 text-sm font-black shadow-[0_8px_18px_rgba(0,0,0,.3)] ${
                          played.card.suit ===
                            "♥" ||
                          played.card.suit ===
                            "♦"
                            ? "text-[#D9574A]"
                            : "text-[#183B2A]"
                        }`}
                      >
                        {
                          played.card
                            .rank
                        }
                        {
                          played.card
                            .suit
                        }
                      </span>
                    )
                  )}
                </div>

                <div className="hokm-center-badge flex h-20 w-20 items-center justify-center rounded-full border border-[#E8C878]/45 shadow-[0_0_45px_rgba(232,200,120,.18)]">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#082719]/75 text-4xl shadow-inner">
                    🃏
                  </div>
                </div>

                {matchPhase ===
                  "choosing_hakem" && (
                  <>
                    <div className="my-1 grid grid-cols-4 gap-1">
                      {hakemDraws.map(
                        (draw) => (
                          <div
                            key={
                              draw.seat
                            }
                            className={`hakem-draw-card rounded-xl border-2 bg-white px-2 py-2 text-center text-xs font-black ${
                              draw.card.suit ===
                                "♥" ||
                              draw.card.suit ===
                                "♦"
                                ? "text-[#D9574A]"
                                : "text-[#183B2A]"
                            }`}
                          >
                            <span className="block text-[9px] text-black/40">
                              بازیکن{" "}
                              {draw.seat +
                                1}
                            </span>

                            {
                              draw.card
                                .rank
                            }
                            {
                              draw.card
                                .suit
                            }
                          </div>
                        )
                      )}
                    </div>

                    <span className="rounded-full bg-[#FFD98A] px-3 py-1 text-[10px] font-black text-[#503517]">
                      قرعه حاکم · کارت شما:{" "}
                      {hakemCard
                        ? `${hakemCard.rank}${hakemCard.suit}`
                        : "در حال دریافت"}
                    </span>

                    <span className="rounded-full bg-black/25 px-3 py-1 text-[10px]">
                      در حال تعیین حاکم...
                    </span>
                  </>
                )}

                {matchPhase ===
                  "choosing_trump" && (
                  <>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black transition-all ${
                        trumpSeconds <= 5
                          ? "animate-pulse bg-[#E5484D] text-white shadow-[0_0_18px_rgba(229,72,77,0.65)]"
                          : "bg-[#FFD98A] text-[#503517]"
                      }`}
                    >
                      حاکم:{" "}
                      {hakemSeat ===
                      mySeat
                        ? "شما"
                        : players.find(
                            (p) =>
                              p.seat ===
                              hakemSeat
                          )?.name ||
                          "در حال تعیین"}{" "}
                      · ⏱️{" "}
                      {trumpSeconds} ثانیه
                    </span>

                    {hakemSeat ===
                    mySeat ? (
                      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-black/25 p-2">
                        {SUITS.map(
                          (suit) => (
                            <button
                              key={
                                suit
                              }
                              type="button"
                              onClick={() =>
                                void chooseTrump(
                                  suit
                                )
                              }
                              className={`rounded-xl bg-white px-3 py-2 text-xl ${
                                suit ===
                                  "♥" ||
                                suit ===
                                  "♦"
                                  ? "text-[#D9574A]"
                                  : "text-[#183B2A]"
                              }`}
                            >
                              {suit}
                            </button>
                          )
                        )}
                      </div>
                    ) : (
                      <span className="rounded-full bg-black/25 px-3 py-1 text-[10px]">
                        منتظر انتخاب حکم حاکم
                      </span>
                    )}
                  </>
                )}

                {matchPhase ===
                  "playing" && (
                  <>
                    <span className="hokm-trump-badge rounded-full border border-[#FFD98A]/30 bg-[#082719]/75 px-4 py-1.5 text-[11px] font-black shadow-[0_0_25px_rgba(255,217,138,.12)]">
                      حکم <span className="mx-1 text-[#FFD98A]">◆</span>{" "}
                      {trump ||
                        "در حال انتخاب"}
                    </span>

                    <span className={`rounded-full bg-[#FFD98A] px-3 py-1 text-[9px] font-black text-[#503517] ${
                      turnSeat === mySeat ? "hokm-turn-pulse" : ""
                    }`}>
                      {turnSeat ===
                      mySeat
                        ? "نوبت شماست"
                        : "نوبت بازیکن بعدی"}
                    </span>
                  </>
                )}

                {matchPhase ===
                  "finished" && (
                  <span className="rounded-full bg-[#FFD98A] px-3 py-1 text-[10px] font-black text-[#503517]">
                    بازی تمام شد
                  </span>
                )}
              </div>

              <div className={`hokm-hand absolute bottom-5 left-1/2 z-20 flex w-[96%] -translate-x-1/2 items-end justify-start gap-1 overflow-x-auto overflow-y-visible px-2 pb-3 sm:bottom-7 sm:justify-center sm:gap-2 ${
                    dealAnimation ? "hokm-dealing" : ""
                  }`}>
                {hand.map(
                  (
                    card,
                    index
                  ) => {
                    const legal =
                      getLegalCards(
                        hand,
                        leadSuit
                      ).some(
                        (item) =>
                          item.id ===
                          card.id
                      );

                    return (
                      <button
                        key={
                          card.id
                        }
                        type="button"
                        disabled={
                          turnSeat !==
                            mySeat ||
                          matchPhase !==
                            "playing"
                        }
                        onClick={() => {
                          if (
                            turnSeat !==
                              mySeat ||
                            matchPhase !==
                              "playing"
                          ) {
                            return;
                          }

                          setSelectedCardIndex(
                            index
                          );

                          window.setTimeout(
                            () => {
                              setSelectedCardIndex(
                                null
                              );

                              void playCard(
                                index
                              );
                            },
                            250
                          );
                        }}
                        className={`hokm-card group shrink-0 ${
                          selectedCardIndex ===
                          index
                            ? "hokm-card-selected"
                            : ""
                        } w-[56px] min-w-[56px] rounded-2xl border-2 border-[#E7EFE8] bg-gradient-to-br from-white to-[#F1F6F1] px-2 py-3 text-center text-sm font-black shadow-[0_12px_20px_rgba(0,0,0,.22)] first:ml-0 sm:w-[64px] sm:min-w-[64px] ${
                          legal
                            ? ""
                            : "opacity-45"
                        } ${
                          card.suit ===
                            "♥" ||
                          card.suit ===
                            "♦"
                            ? "text-[#D9574A]"
                            : "text-[#183B2A]"
                        }`}
                      >
                        <span className="block text-[10px] text-black/30">
                          {
                            card.suit
                          }
                        </span>

                        {
                          card.rank
                        }

                        <br />

                        <span className="text-lg">
                          {
                            card.suit
                          }
                        </span>
                      </button>
                    );
                  }
                )}
              </div>

              {ruleMessage && (
                <div className="absolute bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[#E96757] px-4 py-2 text-[10px] font-black text-white shadow-lg">
                  {ruleMessage}
                </div>
              )}

              <div className="absolute bottom-1 left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-full border border-white/10 bg-black/30 p-1">
                {STICKERS.map(
                  (sticker) => (
                    <button
                      key={sticker}
                      type="button"
                      onClick={() =>
                        void sendReaction(
                          sticker
                        )
                      }
                      className="rounded-full px-2 py-1 text-base transition hover:scale-125"
                      aria-label={`ارسال واکنش ${sticker}`}
                    >
                      {sticker}
                    </button>
                  )
                )}
              </div>
            </section>

            <aside className="flex min-h-[360px] flex-col rounded-[26px] bg-white p-4 text-[#183B2A]">
              <h2 className="font-black">
                💬 گفت‌وگوی میز
              </h2>

              <p className="mt-1 text-[10px] text-[#7A8D7D]">
                پیام‌ها با نام نمایشی شما ارسال می‌شوند.
              </p>

              <div className="mt-3 min-h-[220px] flex-1 space-y-2 overflow-y-auto rounded-2xl bg-[#F3F8F2] p-3">
                {messages.length ===
                0 ? (
                  <p className="text-center text-xs text-[#7A8D7D]">
                    هنوز پیامی نیست؛ به هم‌تیمی‌ها سلام کن.
                  </p>
                ) : (
                  messages.map(
                    (item) => (
                      <p
                        key={
                          item.id
                        }
                        className="text-xs"
                      >
                        <b>
                          {
                            item.name
                          }
                          :
                        </b>{" "}
                        {item.text}
                      </p>
                    )
                  )
                )}
              </div>

              <form
                onSubmit={
                  sendMessage
                }
                className="mt-3 flex gap-2"
              >
                <input
                  value={message}
                  onChange={(
                    e
                  ) =>
                    setMessage(
                      e.target
                        .value
                    )
                  }
                  placeholder="پیام بنویس..."
                  className="min-w-0 flex-1 rounded-xl border border-[#D7EBDD] px-3 py-2 text-xs outline-none focus:border-[#1E8151]"
                />

                <button className="rounded-xl bg-[#1E8151] px-3 text-xs font-bold text-white">
                  ارسال
                </button>
              </form>
            </aside>
          </div>
        )}
      </div>

      {winner && (
        <VictoryOverlay
          name={winner}
          onClose={() =>
            setWinner(null)
          }
        />
      )}

      <style jsx>{`
        .hokm-seven-rule {
          margin-top: 8px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,226,155,.34);
          background: rgba(0,0,0,.16);
          color: rgba(255,255,255,.86);
          font-size: 10px;
          font-weight: 900;
        }

        .hokm-first-trick-banner {
          position: fixed;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 100;
          pointer-events: none;
          border: 1px solid rgba(255, 226, 155, .72);
          background: linear-gradient(135deg, rgba(17, 51, 37, .97), rgba(28, 67, 48, .96));
          color: #ffe5a3;
          border-radius: 22px;
          padding: 18px 28px;
          text-align: center;
          box-shadow: 0 18px 70px rgba(0,0,0,.45), 0 0 35px rgba(255,215,130,.16);
          animation: hokmFirstTrickBanner 2s ease both;
        }
        .hokm-first-trick-banner .title {
          font-size: 25px;
          line-height: 1.15;
          font-weight: 1000;
          letter-spacing: -.02em;
        }
        .hokm-first-trick-banner .subtitle {
          margin-top: 7px;
          color: rgba(255,255,255,.82);
          font-size: 11px;
          font-weight: 800;
        }
        .hokm-first-trick-banner .crown {
          display: block;
          margin-bottom: 5px;
          font-size: 25px;
          animation: hokmCrownPulse 900ms ease-in-out infinite alternate;
        }
        @keyframes hokmFirstTrickBanner {
          0% { opacity: 0; transform: translate(-50%,-50%) scale(.82); }
          15% { opacity: 1; transform: translate(-50%,-50%) scale(1.03); }
          25%,78% { opacity: 1; transform: translate(-50%,-50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(.96); }
        }
        @keyframes hokmCrownPulse {
          from { transform: translateY(0) scale(1); }
          to { transform: translateY(-3px) scale(1.08); }
        }

        .hokm-final-dealing { position: relative; overflow: visible; }
        .hokm-final-dealing::after {
          content: "۸ کارت نهایی در حال پخش...";
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 40;
          white-space: nowrap;
          border: 1px solid rgba(255, 217, 138, .45);
          background: rgba(20, 49, 37, .94);
          color: #ffe6a8;
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 11px;
          font-weight: 900;
          box-shadow: 0 10px 35px rgba(0,0,0,.35);
          animation: hokmDealBadge 2.6s ease-in-out both;
        }
        .hokm-final-card {
          animation: hokmFinalCardDeal 2.35s cubic-bezier(.2,.8,.2,1) both;
          animation-delay: calc(var(--deal-index) * 85ms);
        }
        @keyframes hokmFinalCardDeal {
          0% { opacity: 0; transform: translateY(-16px) scale(.82) rotate(-3deg); }
          35% { opacity: 1; transform: translateY(0) scale(1.04) rotate(0); }
          65% { transform: translateY(0) scale(.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes hokmDealBadge {
          0%,12% { opacity: 0; transform: translate(-50%,-50%) scale(.9); }
          25%,78% { opacity: 1; transform: translate(-50%,-50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(.96); }
        }

        .pasour-entry,
        .pasour-lobby {
          background: radial-gradient(
            circle at 50% 10%,
            #244d3e 0%,
            #102d25 48%,
            #081b18 100%
          );
          box-shadow:
            inset 0 0 120px rgba(0, 0, 0, 0.45),
            0 24px 70px rgba(0, 0, 0, 0.3);
        }

        .pasour-logo {
          background: linear-gradient(
            145deg,
            #f4dc99,
            #9e6b2a
          );
          box-shadow:
            0 0 0 6px
              rgba(232, 200, 120, 0.08),
            0 20px 45px
              rgba(0, 0, 0, 0.35);
        }

        .pasour-primary {
          background: linear-gradient(
            135deg,
            #f1d487,
            #b8792d
          );
          color: #2d1e11;
          box-shadow: 0 12px 30px
            rgba(207, 153, 64, 0.25);
          transition:
            transform 0.25s,
            box-shadow 0.25s;
        }

        .pasour-primary:hover {
          transform: translateY(-3px);
          box-shadow: 0 18px 36px
            rgba(207, 153, 64, 0.4);
        }

        .floating-card {
          position: absolute;
          border: 1px solid
            rgba(255, 255, 255, 0.2);
          border-radius: 16px;
          padding: 18px 14px;
          background: rgba(
            255,
            255,
            255,
            0.08
          );
          font-size: 22px;
          box-shadow: 0 15px 35px
            rgba(0, 0, 0, 0.2);
          animation: floatCard 5s
            ease-in-out infinite;
        }

        .floating-card-one {
          top: 16%;
          right: 12%;
          transform: rotate(14deg);
          color: #f1d487;
        }

        .floating-card-two {
          bottom: 18%;
          left: 12%;
          transform: rotate(-14deg);
          color: #f3a29b;
          animation-delay: 1.2s;
        }

        .match-seat {
          border-color: rgba(
            232,
            200,
            120,
            0.35
          );
          background: linear-gradient(
            145deg,
            rgba(232, 200, 120, 0.15),
            rgba(255, 255, 255, 0.04)
          );
        }

        .match-seat-ready {
          animation: seatReady
            0.7s ease both;
        }

        @keyframes floatCard {
          0%,
          100% {
            margin-top: 0;
          }

          50% {
            margin-top: -12px;
          }
        }

        @keyframes seatReady {
          from {
            opacity: 0;
            transform: scale(0.8)
              translateY(15px);
          }

          to {
            opacity: 1;
            transform: scale(1)
              translateY(0);
          }
        }

        .hokm-table {
          isolation: isolate;
          background:
            radial-gradient(circle at 50% 45%, rgba(86, 160, 108, .34), transparent 34%),
            radial-gradient(circle at 50% 50%, #276d49 0%, #155438 45%, #092d20 100%);
          box-shadow:
            inset 0 0 100px rgba(0, 0, 0, .42),
            inset 0 1px 0 rgba(255,255,255,.08),
            0 30px 90px rgba(0, 0, 0, .42);
        }

        .hokm-table::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          opacity: .22;
          background-image:
            radial-gradient(rgba(255,255,255,.20) .6px, transparent .7px),
            radial-gradient(rgba(0,0,0,.18) .7px, transparent .8px);
          background-size: 7px 7px, 11px 11px;
          background-position: 0 0, 3px 4px;
          mix-blend-mode: soft-light;
        }

        .hokm-table::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background: radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,.36) 100%);
        }

        .hokm-center-badge {
          background: radial-gradient(circle, rgba(232,200,120,.18), rgba(8,39,25,.78));
          animation: centerPulse 3s ease-in-out infinite;
        }

        .hokm-trick-card {
          animation: trickCardIn .35s cubic-bezier(.2,.8,.2,1) both;
          transform: translateY(0) rotate(var(--trick-rotation, 0deg));
        }

        .hokm-trick-card:nth-child(odd) {
          --trick-rotation: -3deg;
        }

        .hokm-trick-card:nth-child(even) {
          --trick-rotation: 3deg;
        }

        .hokm-trick-zone .hokm-trick-card {
          position: absolute;
          left: 50%;
          top: 50%;
          min-width: 58px;
          text-align: center;
          transform-origin: center;
        }

        .hokm-trick-zone .hokm-trick-seat-0 {
          transform: translate(-50%, 22px) rotate(-3deg);
        }

        .hokm-trick-zone .hokm-trick-seat-1 {
          transform: translate(24px, -50%) rotate(4deg);
        }

        .hokm-trick-zone .hokm-trick-seat-2 {
          transform: translate(-50%, -82px) rotate(2deg);
        }

        .hokm-trick-zone .hokm-trick-seat-3 {
          transform: translate(-82px, -50%) rotate(-4deg);
        }

        .hokm-hakem-reveal {
          background:
            radial-gradient(circle at center, rgba(232,200,120,.18), transparent 24%),
            radial-gradient(circle at center, rgba(0,0,0,.02), rgba(0,0,0,.45));
          animation: hakemGlow 2.2s ease both;
        }

        .hokm-hakem-card {
          animation: hakemPop 2.2s cubic-bezier(.18,.8,.2,1) both;
        }

        @keyframes hakemGlow {
          0% { opacity: 0; transform: scale(.7); }
          15% { opacity: 1; transform: scale(1); }
          72% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes hakemPop {
          0% { opacity: 0; transform: scale(.55) translateY(20px); }
          16% { opacity: 1; transform: scale(1.08) translateY(0); }
          30% { transform: scale(1); }
          72% { opacity: 1; }
          100% { opacity: 0; transform: scale(.97) translateY(-10px); }
        }

        .hokm-trump-reveal {
          background:
            radial-gradient(circle at center, rgba(232,200,120,.16), transparent 25%),
            radial-gradient(circle at center, rgba(0,0,0,.05), rgba(0,0,0,.38));
          animation: trumpGlow 1.8s ease both;
        }

        .hokm-trump-announcement {
          animation: trumpPop 1.8s cubic-bezier(.18,.8,.2,1) both;
        }

        @keyframes trumpGlow {
          0% { opacity: 0; transform: scale(.7); }
          18% { opacity: 1; transform: scale(1); }
          72% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes trumpPop {
          0% { opacity: 0; transform: scale(.55) translateY(16px); }
          18% { opacity: 1; transform: scale(1.08) translateY(0); }
          32% { transform: scale(1); }
          72% { opacity: 1; }
          100% { opacity: 0; transform: scale(.96) translateY(-8px); }
        }

        .hokm-dealing > * {
          animation: hokmCardDeal .55s cubic-bezier(.18,.82,.22,1) both;
        }

        .hokm-dealing > *:nth-child(1) { animation-delay: .02s; }
        .hokm-dealing > *:nth-child(2) { animation-delay: .06s; }
        .hokm-dealing > *:nth-child(3) { animation-delay: .10s; }
        .hokm-dealing > *:nth-child(4) { animation-delay: .14s; }
        .hokm-dealing > *:nth-child(5) { animation-delay: .18s; }
        .hokm-dealing > *:nth-child(6) { animation-delay: .22s; }
        .hokm-dealing > *:nth-child(7) { animation-delay: .26s; }
        .hokm-dealing > *:nth-child(8) { animation-delay: .30s; }
        .hokm-dealing > *:nth-child(9) { animation-delay: .34s; }
        .hokm-dealing > *:nth-child(10) { animation-delay: .38s; }
        .hokm-dealing > *:nth-child(11) { animation-delay: .42s; }
        .hokm-dealing > *:nth-child(12) { animation-delay: .46s; }
        .hokm-dealing > *:nth-child(13) { animation-delay: .50s; }

        @keyframes hokmCardDeal {
          0% {
            opacity: 0;
            transform: translateY(-90px) translateX(18px) rotate(8deg) scale(.82);
            filter: brightness(1.35);
          }
          55% {
            opacity: 1;
            transform: translateY(8px) translateX(0) rotate(0deg) scale(1.04);
            filter: brightness(1.12);
          }
          100% {
            opacity: 1;
            transform: translateY(0) translateX(0) rotate(0deg) scale(1);
            filter: brightness(1);
          }
        }

        .hokm-trick-resolving .hokm-trick-card {
          animation: trickResolve .7s cubic-bezier(.2,.75,.2,1) both;
          animation-delay: .05s;
        }

        .hokm-trick-resolving .hokm-trick-seat-0 {
          --resolve-x: 0px;
          --resolve-y: 0px;
        }

        .hokm-trick-resolving .hokm-trick-seat-1 {
          --resolve-x: 0px;
          --resolve-y: 0px;
        }

        .hokm-trick-resolving .hokm-trick-seat-2 {
          --resolve-x: 0px;
          --resolve-y: 0px;
        }

        .hokm-trick-resolving .hokm-trick-seat-3 {
          --resolve-x: 0px;
          --resolve-y: 0px;
        }

        .hokm-trick-count {
          animation: scoreboardIn .45s ease both;
        }

        .hokm-seat {


          transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease;
        }

        .hokm-seat:hover {
          border-color: rgba(232,200,120,.55);
          box-shadow: 0 14px 35px rgba(0,0,0,.42);
        }

        .hokm-turn-pulse {
          animation: turnPulse 1.6s ease-in-out infinite;
        }

        .hokm-scoreboard {
          animation: scoreboardIn .45s ease both;
        }

        .hokm-sound-button { opacity: .78; }
        .hokm-sound-button:hover {
          opacity: 1;
          border-color: rgba(232,200,120,.55);
          box-shadow: 0 0 22px rgba(232,200,120,.18);
        }

        .hokm-trick-zone {
          animation: trickZoneBreath 3s ease-in-out infinite;
        }

        .hokm-trump-badge {
          animation: trumpBadgePulse 2.4s ease-in-out infinite;
        }

        .hokm-trick-zone::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 70px;
          height: 70px;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          border: 1px solid rgba(232,200,120,.08);
          box-shadow: inset 0 0 24px rgba(0,0,0,.16);
          pointer-events: none;
        }

        .hokm-glow {
          background: radial-gradient(
            circle,
            rgba(
                255,
                218,
                125,
                0.22
              ),
            transparent 70%
          );
          animation: tableGlow
            3s ease-in-out infinite;
        }

        .hokm-card {
          transform: translateY(12px)
            rotate(
              var(--card-rotation, 0deg)
            );
          transition:
            transform 0.25s ease,
            box-shadow 0.25s ease;
        }

        .hokm-card:hover:not(
            :disabled
          ) {
          transform: translateY(-18px)
            rotate(0deg) scale(1.05);
          z-index: 40;
        }

        .hokm-card-selected {
          transform: translateY(-34px)
            rotate(0deg) scale(1.08);
          z-index: 50;
          box-shadow:
            0 0 0 3px
              rgba(255, 217, 138, 0.8),
            0 18px 30px
              rgba(0, 0, 0, 0.35);
        }

        .hakem-draw-card {
          animation: drawReveal
            0.45s ease both;
        }

        .hakem-draw-card:nth-child(
            2
          ) {
          animation-delay: 0.12s;
        }

        .hakem-draw-card:nth-child(
            3
          ) {
          animation-delay: 0.24s;
        }

        .hakem-draw-card:nth-child(
            4
          ) {
          animation-delay: 0.36s;
        }

        @keyframes drawReveal {
          from {
            opacity: 0;
            transform:
              translateY(-18px)
              rotateY(90deg);
          }

          to {
            opacity: 1;
            transform:
              translateY(0)
              rotateY(0);
          }
        }

        .hokm-card:nth-child(
            odd
          ) {
          --card-rotation: -2deg;
        }

        .hokm-card:nth-child(
            even
          ) {
          --card-rotation: 2deg;
        }

        @keyframes trickResolve {
          0% {
            filter: brightness(1);
          }
          45% {
            filter: brightness(1.18);
          }
          100% {
            opacity: .05;
            transform: translate(-50%, -50%) scale(.72) rotate(0deg);
            filter: brightness(1.35);
          }
        }

        @keyframes trickZoneBreath {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(232,200,120,0)); }
          50% { filter: drop-shadow(0 0 12px rgba(232,200,120,.08)); }
        }

        @keyframes scoreboardIn {
          from { opacity: 0; transform: translateY(-8px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes trumpBadgePulse {
          0%, 100% { box-shadow: 0 0 0 rgba(255,217,138,0); }
          50% { box-shadow: 0 0 22px rgba(255,217,138,.16); }
        }

        @keyframes turnPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(255, 217, 138, .15);
          }
          50% {
            box-shadow: 0 0 0 7px rgba(255, 217, 138, .08), 0 0 24px rgba(255, 217, 138, .25);
          }
        }

        @keyframes centerPulse {
          0%, 100% {
            box-shadow: 0 0 25px rgba(232,200,120,.10);
          }
          50% {
            box-shadow: 0 0 45px rgba(232,200,120,.24);
          }
        }

        @keyframes trickCardIn {
          from {
            opacity: 0;
            transform: translateY(18px) scale(.78) rotate(0deg);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1) rotate(var(--trick-rotation, 0deg));
          }
        }

        @keyframes tableGlow {
          0%,
          100% {
            opacity: 0.55;
            transform: scale(0.9);
          }

          50% {
            opacity: 1;
            transform: scale(1.15);
          }
        }

        @media (max-width: 640px) {
          .hokm-shell {
            padding: 10px !important;
            border-radius: 22px !important;
          }

          .hokm-table {
            min-height: 590px !important;
          }

          .hokm-card {
            width: 52px !important;
            min-width: 52px !important;
            flex-shrink: 0 !important;
            padding: 9px 6px !important;
            font-size: 12px !important;
          }

          .hokm-hand {
            width: 98% !important;
            bottom: 34px !important;
          }

          .hokm-trick-zone {
            height: 128px !important;
            width: 224px !important;
          }

          .hokm-trick-zone .hokm-trick-card {
            min-width: 48px !important;
            padding: 7px 8px !important;
            font-size: 12px !important;
          }

          .hokm-trick-zone .hokm-trick-seat-0 {
            transform: translate(-50%, 18px) rotate(-3deg);
          }

          .hokm-trick-zone .hokm-trick-seat-1 {
            transform: translate(12px, -50%) rotate(4deg);
          }

          .hokm-trick-zone .hokm-trick-seat-2 {
            transform: translate(-50%, -62px) rotate(2deg);
          }

          .hokm-trick-zone .hokm-trick-seat-3 {
            transform: translate(-60px, -50%) rotate(-4deg);
          }

          .hakem-draw-card {
            padding: 6px 3px !important;
            font-size: 10px !important;
          }
        }

        @media (min-width: 641px) and (max-width: 1024px) {
          .hokm-table {
            min-height: 610px !important;
          }

          .hokm-card {
            width: 60px !important;
            min-width: 60px !important;
            flex-shrink: 0 !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hokm-glow,
          .hokm-center-badge,
          .hokm-trump-badge,
          .hokm-scoreboard,
          .hokm-turn-pulse,
          .hokm-trick-zone,
          .hokm-trick-card,
          .hokm-trick-count,
          .hokm-dealing > *,
          .hokm-trump-reveal,
          .hokm-trump-announcement,
          .hokm-hakem-reveal,
          .hokm-hakem-card {
            animation: none !important;
          }

          .hokm-card {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}

function VictoryOverlay({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#082719]/80 p-4 backdrop-blur-sm">
      <div className="victory-card relative w-full max-w-sm overflow-hidden rounded-[32px] border border-[#FFE19A] bg-gradient-to-br from-[#FFF8D8] via-white to-[#FFE9B6] p-8 text-center text-[#503517] shadow-[0_0_70px_rgba(255,211,105,.5)]">
        <div className="confetti" />

        <div className="relative z-10 text-7xl">
          🏆
        </div>

        <p className="relative z-10 mt-3 text-xs font-bold text-[#B27720]">
          یک برد شیرین در جم
        </p>

        <h2 className="relative z-10 mt-1 text-3xl font-black">
          آفرین {name}!
        </h2>

        <p className="relative z-10 mt-3 text-sm leading-7">
          این دست را بردی؛ واکنش هم‌تیمی‌ها را ببین و برای بازی بعدی آماده شو.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="relative z-10 mt-6 rounded-2xl bg-[#E28D2E] px-7 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-1"
        >
          ادامه بازی
        </button>
      </div>

      <style jsx>{`
        .victory-card::before,
        .victory-card::after {
          content: "✨";
          position: absolute;
          font-size: 32px;
          animation: sparkle
            1.6s ease-in-out infinite;
        }

        .victory-card::before {
          left: 24px;
          top: 28px;
        }

        .victory-card::after {
          right: 24px;
          top: 80px;
          animation-delay: 0.5s;
        }

        .confetti {
          position: absolute;
          inset: 0;
          opacity: 0.7;
          background-image:
            radial-gradient(
              #e28d2e 1.5px,
              transparent 1.5px
            ),
            radial-gradient(
              #d9574a 1.5px,
              transparent 1.5px
            ),
            radial-gradient(
              #1e8151 1.5px,
              transparent 1.5px
            );
          background-size:
            32px 32px,
            42px 42px,
            28px 28px;
          animation: confettiMove
            8s linear infinite;
        }

        @keyframes sparkle {
          0%,
          100% {
            transform:
              scale(0.8)
              rotate(-10deg);
            opacity: 0.4;
          }

          50% {
            transform:
              scale(1.2)
              rotate(10deg);
            opacity: 1;
          }
        }

        @keyframes confettiMove {
          from {
            background-position:
              0 0,
              10px 0,
              20px 0;
          }

          to {
            background-position:
              0 180px,
              10px 220px,
              20px 160px;
          }
        }
      `}</style>
    </div>
  );
}

function LobbyCard({
  onJoin,
}: {
  onJoin: () => void;
}) {
  return (
    <main
      dir="rtl"
      className="pasour-entry min-h-[680px] overflow-hidden rounded-[32px] p-5 text-white sm:p-10"
    >
      <div className="floating-card floating-card-one">
        A♠
      </div>

      <div className="floating-card floating-card-two">
        K♥
      </div>

      <div className="mx-auto flex min-h-[640px] max-w-md flex-col items-center justify-center text-center">
        <div className="pasour-logo mb-5 flex h-24 w-24 items-center justify-center rounded-[30px] text-5xl">
          🃏
        </div>

        <p className="text-xs font-bold tracking-[.28em] text-[#D7B36A]">
          PASOUR JAM
        </p>

        <h1 className="mt-3 text-4xl font-black tracking-tight">
          پاسور جم
        </h1>

        <p className="mt-3 text-sm text-white/60">
          حکم ایرانی، این بار آنلاین
        </p>

        <button
          type="button"
          onClick={onJoin}
          className="pasour-primary mt-9 w-full rounded-2xl px-6 py-4 text-base font-black"
        >
          🎮 شروع بازی
        </button>

        <div className="mt-5 grid w-full grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/75">
            👥 بازی با دوستان
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/75">
            🤖 بازی با ربات
          </div>

          <Link
            href="/games/hokm/leaderboard"
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/75 transition hover:border-[#E8C878]/50 hover:bg-[#E8C878]/10"
          >
            🏆 رتبه‌بندی
          </Link>

          <Link
            href="/profile"
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/75 transition hover:border-[#E8C878]/50 hover:bg-[#E8C878]/10"
          >
            📊 پروفایل من
          </Link>
        </div>
      </div>

      <style jsx>{`
        .pasour-entry {
          position: relative;
          background: radial-gradient(
            circle at 50% 10%,
            #244d3e 0%,
            #102d25 48%,
            #081b18 100%
          );
          color: #ffffff;
          box-shadow:
            inset 0 0 120px rgba(0, 0, 0, 0.45),
            0 24px 70px rgba(0, 0, 0, 0.3);
        }

        .pasour-logo {
          background: linear-gradient(
            145deg,
            #f4dc99,
            #9e6b2a
          );
          box-shadow:
            0 0 0 6px rgba(232, 200, 120, 0.08),
            0 20px 45px rgba(0, 0, 0, 0.35);
        }

        .pasour-primary {
          background: linear-gradient(
            135deg,
            #f1d487,
            #b8792d
          );
          color: #2d1e11;
          box-shadow: 0 12px 30px rgba(207, 153, 64, 0.25);
          transition: transform 0.25s, box-shadow 0.25s;
        }

        .pasour-primary:hover {
          transform: translateY(-3px);
          box-shadow: 0 18px 36px rgba(207, 153, 64, 0.4);
        }

        .floating-card {
          position: absolute;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 16px;
          padding: 18px 14px;
          background: rgba(255, 255, 255, 0.08);
          font-size: 22px;
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
          animation: floatCard 5s ease-in-out infinite;
        }

        .floating-card-one {
          top: 16%;
          right: 12%;
          transform: rotate(14deg);
          color: #f1d487;
        }

        .floating-card-two {
          bottom: 18%;
          left: 12%;
          transform: rotate(-14deg);
          color: #f3a29b;
          animation-delay: 1.2s;
        }

        @keyframes floatCard {
          0%, 100% {
            margin-top: 0;
          }
          50% {
            margin-top: -12px;
          }
        }
      `}</style>
    </main>
  );
}

function WaitingRoom({
  players,
  seconds,
  onOffline,
}: {
  players: Player[];
  seconds: number;
  onOffline: () => void;
}) {
  return (
    <section
      dir="rtl"
      className="pasour-lobby mx-auto min-h-[600px] max-w-2xl rounded-[32px] p-5 text-center text-white sm:p-8"
    >
      <div className="mb-7 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
        <div>
          <p className="text-[10px] text-white/45">
            بازیکن آماده
          </p>

          <p className="mt-1 font-black">
            همشهری جم
          </p>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-white/45">
            امتیاز
          </p>

          <p className="mt-1 font-black text-[#E8C878]">
            ⭐ ۱۰۰۰
          </p>
        </div>

        <div className="rounded-xl bg-[#D7B36A]/15 px-3 py-2 text-xs font-black text-[#E8C878]">
          Lv. ۱
        </div>
      </div>

      <div className="text-5xl">
        🃏
      </div>

      <h2 className="mt-4 text-2xl font-black">
        در حال پیدا کردن بازیکنان...
      </h2>

      <p className="mt-2 text-xs text-white/50">
        هر چهار جایگاه که پر شود، بازی شروع می‌شود
      </p>

      <div className="relative mx-auto mt-8 grid max-w-md grid-cols-2 gap-3">
        {[0, 1, 2, 3].map(
          (seat) => {
            const player =
              players.find(
                (item) =>
                  item.seat ===
                  seat
              );

            return (
              <div
                key={seat}
                className={`match-seat rounded-2xl border p-5 ${
                  player
                    ? "match-seat-ready"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl">
                  {player
                    ? "👤"
                    : "❔"}
                </div>

                <p className="mt-2 text-xs font-black">
                  {player
                    ? player.name
                    : "در انتظار"}
                </p>

                <p className="mt-1 text-[9px] text-white/45">
                  {player
                    ? "آماده بازی"
                    : "جایگاه خالی"}
                </p>
              </div>
            );
          }
        )}
      </div>

      <div className="mx-auto mt-7 h-2 max-w-md overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-l from-[#E8C878] to-[#9C6B2F] transition-all"
          style={{
            width: `${Math.min(
              100,
              (players.length /
                4) *
                100
            )}%`,
          }}
        />
      </div>

      <p className="mt-3 text-xs text-white/55">
        {players.length}/۴ بازیکن ·{" "}
        {seconds} ثانیه
      </p>

      {seconds <= 15 && (
        <button
          type="button"
          onClick={onOffline}
          className="mt-5 rounded-xl bg-[#E8C878] px-5 py-3 text-xs font-black text-[#352415]"
        >
          🤖 ادامه با ربات
        </button>
      )}
    </section>
  );
}

function Seat({
  name,
  reaction,
  className,
}: {
  name: string;
  reaction?: string;
  className: string;
}) {
  return (
    <div
      className={`absolute z-10 rounded-2xl border border-white/15 bg-[#0B3524]/90 px-3 py-2 text-center text-[10px] shadow-lg ${className}`}
    >
      <span className="relative block text-lg">
        👤

        {reaction && (
          <span className="absolute -left-5 -top-5 animate-bounce text-2xl">
            {reaction}
          </span>
        )}
      </span>

      {name}
    </div>
  );
}