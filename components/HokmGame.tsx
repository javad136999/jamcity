"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { canPlayCard, getLegalCards, getTrickWinner, dealHokmHands, shuffleDeck, createHokmDeck } from "@/lib/hokm-engine";
import type { HokmCard, HokmSuit } from "@/lib/hokm-engine";
import { chooseBotCard } from "@/lib/hokm-bot";
import type { BotMemory } from "@/lib/hokm-bot";

type Suit = HokmSuit;
type Card = HokmCard;
type Player = { id: string; name: string; seat: number; isBot?: boolean };
type Room = { id: string; status: "waiting" | "playing"; host_id: string | null };
type Reaction = { id: string; playerId: string; sticker: string };
type Message = { id: string; name: string; text: string };

type Props = { userId: string; displayName?: string | null };
const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const STICKERS = ["👏", "😂", "🔥", "😮", "😎", "❤️"];
const WAIT_SECONDS = 20;

function makeDeck(): Card[] { return SUITS.flatMap((suit) => RANKS.map((rank, value) => ({ suit, rank, value }))); }
function shuffle<T>(items: T[]) { const copy = [...items]; for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }

export default function HokmGame({ userId, displayName }: Props) {
  const supabase = useMemo(() => createClient() as any, []);
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [seconds, setSeconds] = useState(WAIT_SECONDS);
  const [offline, setOffline] = useState(false);
  const [started, setStarted] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchPhase, setMatchPhase] = useState<"choosing_hakem" | "choosing_trump" | "playing" | "finished">("choosing_hakem");
  const [hakemSeat, setHakemSeat] = useState<number | null>(null);
  const [hakemCard, setHakemCard] = useState<Card | null>(null);
  const [hakemDraws, setHakemDraws] = useState<{ seat: number; card: Card }[]>([]);
  const [trumpSeconds, setTrumpSeconds] = useState(10);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [hand, setHand] = useState<Card[]>([]);
  const [trump, setTrump] = useState<Suit | null>(null);
  const [leadSuit, setLeadSuit] = useState<Suit | null>(null);
  const [turnSeat, setTurnSeat] = useState(0);
  const [ruleMessage, setRuleMessage] = useState("");
  const [currentTrick, setCurrentTrick] = useState<any[]>([]);
  const [teamScores, setTeamScores] = useState({ "0": 0, "1": 0 });
  const [botHands, setBotHands] = useState<Card[][]>([[], [], [], []]);
  const botMemory = useRef<BotMemory>({ played: [], knownTrump: [], teamScore: 0, opponentScore: 0 });
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const musicTimer = useRef<number | null>(null);
  const [musicOn, setMusicOn] = useState(false);

  useEffect(() => {
    return () => {
      void audioContext.current?.close();
      audioContext.current = null;
      if (musicTimer.current) window.clearInterval(musicTimer.current);
    };
  }, []);

  function tone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.035) {
    if (typeof window === "undefined") return;
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtor) return;
    const context = audioContext.current ?? new AudioCtor();
    audioContext.current = context;
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  function playCardSound() { tone(210, 0.06, "triangle", 0.045); window.setTimeout(() => tone(155, 0.05, "triangle", 0.025), 30); }
  function playDealSound() { [0, 1, 2, 3].forEach((step) => window.setTimeout(() => tone(260 + step * 35, 0.07, "triangle", 0.03), step * 75)); }
  function playVictorySound() { [523, 659, 784, 1046].forEach((frequency, index) => window.setTimeout(() => tone(frequency, 0.25, "sine", 0.055), index * 120)); }

  function toggleMusic() {
    if (musicOn) {
      if (musicTimer.current) window.clearInterval(musicTimer.current);
      musicTimer.current = null;
      setMusicOn(false);
      return;
    }
    const notes = [196, 247, 294, 247, 220, 262, 330, 262];
    let index = 0;
    tone(notes[index], 0.35, "sine", 0.018);
    musicTimer.current = window.setInterval(() => {
      index = (index + 1) % notes.length;
      tone(notes[index], 0.35, "sine", 0.018);
    }, 650);
    setMusicOn(true);
  }

  useEffect(() => {
    if (!room || offline) return;
    const channel = supabase.channel(`hokm-room:${room.id}`, { config: { presence: { key: userId } } });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const online = Object.values(state).flat() as any[];
        setPlayers((old) => old.map((player) => ({ ...player, online: online.some((item) => item.user_id === player.id) })) as Player[]);
      })
      .on("broadcast", { event: "game" }, ({ payload }: any) => {
        if (payload.type === "start") { setMatchId(payload.matchId ?? null); setStarted(true); playDealSound(); }
        if (payload.type === "message") setMessages((old) => [...old, payload.message]);
        if (payload.type === "reaction") showReaction(payload.reaction);
        if (payload.type === "victory") showVictory(payload.name);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "hokm_matches" }, ({ new: nextMatch }: any) => {
        if (!matchId || nextMatch.id !== matchId) return;
        setTrump(nextMatch.trump ?? null);
        setMatchPhase(nextMatch.phase ?? "choosing_trump");
        setHakemSeat(nextMatch.hakem_seat ?? null);
        setLeadSuit(nextMatch.lead_suit ?? null);
        setTurnSeat(nextMatch.turn_seat ?? 0);
        setCurrentTrick(nextMatch.current_trick ?? []);
        setTeamScores(nextMatch.team_scores ?? { "0": 0, "1": 0 });
        if (nextMatch.status === "finished") setWinner("تیم برنده");
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hokm_players", filter: `room_id=eq.${room.id}` }, async () => {
        if (room.host_id !== userId || started || matchId) return;
        const { count } = await supabase
          .from("hokm_players")
          .select("user_id", { count: "exact", head: true })
          .eq("room_id", room.id);
        if (count === 4) await startOnlineGame(room.id);
      })
      .subscribe(async (status: string) => { if (status === "SUBSCRIBED") await channel.track({ user_id: userId, name: displayName || "همشهری" }); });
    return () => { supabase.removeChannel(channel); };
  }, [room, offline, supabase, userId, displayName, matchId]);

  useEffect(() => {
    if (!matchId || offline) return;
    async function loadPrivateHand() {
      const { data: match } = await supabase
        .from("hokm_matches")
        .select("phase,hakem_seat,trump,lead_suit,turn_seat,current_trick,team_scores")
        .eq("id", matchId)
        .maybeSingle();
      if (match) {
        setMatchPhase(match.phase ?? "choosing_trump");
        setHakemSeat(match.hakem_seat ?? null);
        setTrump(match.trump ?? null);
        setLeadSuit(match.lead_suit ?? null);
        setTurnSeat(match.turn_seat ?? 0);
        setCurrentTrick(match.current_trick ?? []);
        setTeamScores(match.team_scores ?? { "0": 0, "1": 0 });
      }
      const { data, error } = await supabase
        .from("hokm_hands")
        .select("cards")
        .eq("match_id", matchId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!error && data?.cards) setHand(data.cards as Card[]);
      const { data: draw } = await supabase
        .from("hokm_hakem_draws")
        .select("card")
        .eq("match_id", matchId)
        .eq("user_id", userId)
        .maybeSingle();
      if (draw?.card) setHakemCard(draw.card as Card);
      const { data: allDraws } = await supabase
        .from("hokm_hakem_draws")
        .select("seat,card")
        .eq("match_id", matchId)
        .order("seat");
      if (allDraws) setHakemDraws(allDraws as { seat: number; card: Card }[]);
    }
    void loadPrivateHand();
  }, [matchId, matchPhase, offline, supabase, userId]);

  useEffect(() => {
    if (matchPhase !== "choosing_trump") return;
    setTrumpSeconds(10);
    const timer = window.setInterval(() => setTrumpSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [matchPhase]);

  useEffect(() => {
    const currentSeat = players.find((player) => player.id === userId)?.seat ?? 0;
    if (matchPhase !== "choosing_trump" || hakemSeat !== currentSeat || trumpSeconds !== 0 || trump) return;
    void chooseTrump("♠");
  }, [matchPhase, hakemSeat, players, userId, trumpSeconds, trump]);

  async function chooseTrump(suit: Suit) {
    if (!matchId) return;
    const { error } = await supabase.rpc("choose_hokm_trump", { p_match_id: matchId, p_trump: suit });
    if (error) {
      setRuleMessage(error.message);
      window.setTimeout(() => setRuleMessage(""), 2600);
      return;
    }
    setTrump(suit);
    setMatchPhase("playing");
    setTurnSeat(hakemSeat ?? 0);
  }

  useEffect(() => {
    if (!waiting || offline || started) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [waiting, offline, started]);

  useEffect(() => {
    if (!waiting || started || seconds > 0) return;
    setOffline(true);
    setPlayers((old) => [...old, { id: "bot-1", name: "ربات جم", seat: 1, isBot: true }, { id: "bot-2", name: "ربات جم ۲", seat: 2, isBot: true }, { id: "bot-3", name: "ربات جم ۳", seat: 3, isBot: true }]);
    startOfflineGame();
  }, [seconds, waiting, started]);

  function dealCards() { setHand(shuffleDeck(createHokmDeck()).slice(0, 13)); playDealSound(); }
  function startOfflineGame() {
    const hands = dealHokmHands(shuffleDeck(createHokmDeck()));
    setBotHands(hands);
    setHand(hands[0]);
    setWaiting(false); setStarted(true); setMatchPhase("playing"); setTrump("♠"); setTurnSeat(0); setLeadSuit(null); setCurrentTrick([]); playDealSound();
  }

  useEffect(() => {
    if (!offline || !started || winner || turnSeat === 0 || matchPhase !== "playing") return;
    const timer = window.setTimeout(() => {
      setBotHands((hands) => {
        const botHand = hands[turnSeat] ?? [];
        const trick = currentTrick.map((item) => ({ playerId: String(item.seat), card: item.card }));
        const card = chooseBotCard(botHand, trick, trump || "♠", botMemory.current);
        if (!card) return hands;
        botMemory.current.played.push(card);
        const nextHands = hands.map((items, seat) => seat === turnSeat ? items.filter((item) => item !== card) : items);
        setCurrentTrick((trick) => {
          const nextTrick = [...trick, { seat: turnSeat, card }];
          if (nextTrick.length === 4) {
            const winnerCard = getTrickWinner(nextTrick.map((item) => ({ playerId: String(item.seat), card: item.card })), trump || "♠");
            const winningSeat = Number(winnerCard.playerId);
            setTurnSeat(winningSeat);
            setLeadSuit(null);
            setCurrentTrick([]);
          } else {
            if (!leadSuit) setLeadSuit(card.suit);
            setTurnSeat((turnSeat + 1) % 4);
          }
          return nextTrick.length === 4 ? [] : nextTrick;
        });
        return nextHands;
      });
      playCardSound();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [offline, started, winner, turnSeat, matchPhase, leadSuit, trump, currentTrick]);

  async function joinRoom() {
    setWaiting(true); setSeconds(WAIT_SECONDS); setOffline(false);
    const { data } = await supabase.from("hokm_rooms").select("id,status,host_id").eq("status", "waiting").limit(1).maybeSingle();
    let selected = data as Room | null;
    if (!selected) {
      const created = await supabase.from("hokm_rooms").insert({ status: "waiting", host_id: userId }).select("id,status,host_id").single();
      if (created.error) { setOffline(true); startOfflineGame(); return; }
      selected = created.data as Room;
    }
    setRoom(selected);
    const current = await supabase.from("hokm_players").select("user_id,name,seat").eq("room_id", selected.id).order("seat");
    const rows = (current.data ?? []) as any[];
    const nextSeat = rows.length;
    await supabase.from("hokm_players").upsert({ room_id: selected.id, user_id: userId, name: displayName || "همشهری", seat: nextSeat });
    setPlayers([...rows.map((item) => ({ id: item.user_id, name: item.name, seat: item.seat })), { id: userId, name: displayName || "همشهری", seat: nextSeat }]);
    if (rows.length + 1 >= 4 && selected.host_id === userId) await startOnlineGame(selected.id);
  }

  async function startOnlineGame(roomId: string) {
    await supabase.from("hokm_rooms").update({ status: "playing" }).eq("id", roomId);
    const { data: createdMatch, error } = await supabase.rpc("start_hokm_match", { p_room_id: roomId });
    if (error || !createdMatch) {
      setRuleMessage(error?.message || "شروع مسابقه انجام نشد.");
      return;
    }
    setMatchId(createdMatch as string);
    setMatchPhase("choosing_trump");
    const { data: drawMatch } = await supabase
      .from("hokm_matches")
      .select("phase,hakem_seat,trump,turn_seat")
      .eq("id", createdMatch)
      .maybeSingle();
    if (drawMatch) {
      setMatchPhase(drawMatch.phase ?? "choosing_trump");
      setHakemSeat(drawMatch.hakem_seat ?? null);
      setTrump(drawMatch.trump ?? null);
      setTurnSeat(drawMatch.turn_seat ?? 0);
    }
    // کارت‌ها فقط از دست خصوصی Supabase خوانده می‌شوند:
    // قبل از انتخاب حکم، حاکم ۵ کارت دارد و بعد از انتخاب حکم همه ۱۳ کارت می‌گیرند.
    setStarted(true);
    await supabase.channel(`hokm-room:${roomId}`).send({ type: "broadcast", event: "game", payload: { type: "start", matchId: createdMatch } });
  }

  function showReaction(reaction: Reaction) {
    setReactions((old) => [...old.filter((item) => item.playerId !== reaction.playerId), reaction]);
    window.setTimeout(() => setReactions((old) => old.filter((item) => item.id !== reaction.id)), 3200);
  }
  function showVictory(name: string) { setWinner(name); playVictorySound(); }

  async function sendReaction(sticker: string) {
    const reaction = { id: crypto.randomUUID(), playerId: userId, sticker };
    showReaction(reaction);
    if (room && !offline) await supabase.channel(`hokm-room:${room.id}`).send({ type: "broadcast", event: "game", payload: { type: "reaction", reaction } });
  }

  async function playCard(index: number) {
    if (!started || winner || turnSeat !== 0) return;
    const selected = hand[index];
    if (!selected) return;
    if (!canPlayCard(hand, selected, leadSuit)) {
      setRuleMessage(`باید خال ${leadSuit} را بازی کنی.`);
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
    }
    playCardSound();
    const next = hand.filter((_, cardIndex) => cardIndex !== index);
    setHand(next);
    if (offline) {
      setCurrentTrick((trick) => [...trick, { seat: 0, card: selected }]);
    }
    if (!leadSuit) setLeadSuit(selected.suit);
    setTurnSeat(1);
    if (next.length === 0) {
      const name = displayName || "همشهری";
      showVictory(name);
      if (room && !offline) await supabase.channel(`hokm-room:${room.id}`).send({ type: "broadcast", event: "game", payload: { type: "victory", name } });
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault(); const text = message.trim(); if (!text) return;
    const item = { id: crypto.randomUUID(), name: displayName || "همشهری", text };
    setMessages((old) => [...old, item]); setMessage("");
    if (room && !offline) await supabase.channel(`hokm-room:${room.id}`).send({ type: "broadcast", event: "game", payload: { type: "message", message: item } });
  }

  if (!waiting && !started) return <LobbyCard onJoin={joinRoom} />;
  const mySeat = players.find((p) => p.id === userId)?.seat ?? 0;
  return <main dir="rtl" className="hokm-shell min-h-[680px] rounded-[30px] bg-[#164B32] p-3 text-white sm:p-6">
      <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-[#B8E9C7]">بازی حکم چهارنفره</p><h1 className="text-2xl font-black">میز جم {offline && <span className="text-sm text-[#FFD98A]">· آفلاین</span>}</h1></div><div className="flex items-center gap-2"><button type="button" onClick={toggleMusic} className="rounded-full bg-white/10 px-3 py-2 text-xs transition hover:bg-white/20" aria-label="موسیقی پس‌زمینه">{musicOn ? "🔊 موسیقی روشن" : "🔇 موسیقی خاموش"}</button><span className="rounded-full bg-white/10 px-3 py-2 text-xs">{players.filter((p) => !p.isBot).length}/۴ بازیکن</span></div></header>
      {waiting ? <WaitingRoom players={players} seconds={seconds} onOffline={startOfflineGame} /> : <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <section className="hokm-table relative min-h-[540px] overflow-hidden rounded-[28px] border border-[#B8E9C7]/20 p-4 shadow-2xl sm:p-8"><div className="absolute inset-5 rounded-[24px] border border-[#B8E9C7]/20" /><div className="hokm-glow absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full" /><Seat name={players.find((p) => p.seat === 0)?.name || "شما"} reaction={reactions.find((r) => r.playerId === players.find((p) => p.seat === 0)?.id)?.sticker} className="bottom-4 left-1/2 -translate-x-1/2" /><Seat name={players.find((p) => p.seat === 1)?.name || "در انتظار"} reaction={reactions.find((r) => r.playerId === players.find((p) => p.seat === 1)?.id)?.sticker} className="right-3 top-1/2 -translate-y-1/2" /><Seat name={players.find((p) => p.seat === 2)?.name || "در انتظار"} reaction={reactions.find((r) => r.playerId === players.find((p) => p.seat === 2)?.id)?.sticker} className="left-1/2 top-4 -translate-x-1/2" /><Seat name={players.find((p) => p.seat === 3)?.name || "در انتظار"} reaction={reactions.find((r) => r.playerId === players.find((p) => p.seat === 3)?.id)?.sticker} className="left-3 top-1/2 -translate-y-1/2" /><div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"><div className="mb-2 flex gap-2 text-[9px] font-black"><span className="rounded-full bg-white/15 px-2 py-1">تیم شما: {teamScores["0"]}</span><span className="rounded-full bg-white/15 px-2 py-1">تیم رقیب: {teamScores["1"]}</span></div><div className="mb-2 flex min-h-12 items-center justify-center gap-1">{currentTrick.map((played, index) => <span key={`${played.seat}-${index}`} className="rounded-lg bg-white px-2 py-1 text-xs font-black text-[#183B2A]">{played.card?.rank}{played.card?.suit}</span>)}</div><span className="text-5xl drop-shadow-xl">🂠</span>{matchPhase === "choosing_hakem" && <div className="my-1 grid grid-cols-4 gap-1">{hakemDraws.map((draw) => <div key={draw.seat} className={`hakem-draw-card rounded-xl border-2 bg-white px-2 py-2 text-center text-xs font-black ${draw.card.suit === "♥" || draw.card.suit === "♦" ? "text-[#D9574A]" : "text-[#183B2A]"}`}><span className="block text-[9px] text-black/40">بازیکن {draw.seat + 1}</span>{draw.card.rank}{draw.card.suit}</div>)}</div>}{matchPhase === "choosing_hakem" ? <><span className="rounded-full bg-[#FFD98A] px-3 py-1 text-[10px] font-black text-[#503517]">قرعه حاکم · کارت شما: {hakemCard ? `${hakemCard.rank}${hakemCard.suit}` : "در حال دریافت"}</span><span className="rounded-full bg-black/25 px-3 py-1 text-[10px]">در حال تعیین کمترین کارت...</span></> : matchPhase === "choosing_trump" ? <><span className="rounded-full bg-[#FFD98A] px-3 py-1 text-[10px] font-black text-[#503517]">حاکم: {hakemSeat === mySeat ? "شما" : players.find((p) => p.seat === hakemSeat)?.name || "در حال تعیین"} · {trumpSeconds} ثانیه</span>{hakemSeat === mySeat ? <div className="grid grid-cols-4 gap-1 rounded-2xl bg-black/25 p-2">{SUITS.map((suit) => <button key={suit} type="button" onClick={() => void chooseTrump(suit)} className={`rounded-xl bg-white px-3 py-2 text-xl ${suit === "♥" || suit === "♦" ? "text-[#D9574A]" : "text-[#183B2A]"}`}>{suit}</button>)}</div> : <span className="rounded-full bg-black/25 px-3 py-1 text-[10px]">منتظر انتخاب حکم حاکم</span>}</> : <><span className="rounded-full bg-black/25 px-3 py-1 text-[10px]">حکم: {trump || "در حال انتخاب"}</span><span className="rounded-full bg-[#FFD98A] px-3 py-1 text-[9px] font-black text-[#503517]">{turnSeat === mySeat ? "نوبت شماست" : "نوبت بازیکن بعدی"}</span></>}</div><div className="hokm-hand absolute bottom-5 left-1/2 z-20 flex w-[94%] -translate-x-1/2 justify-center overflow-x-auto pb-2 sm:bottom-7">{hand.map((card, index) => <button key={`${card.suit}-${card.rank}-${index}`} type="button" onClick={() => { setSelectedCardIndex(index); window.setTimeout(() => { setSelectedCardIndex(null); void playCard(index); }, 1000); }} className={`hokm-card group -ml-3 ${selectedCardIndex === index ? "hokm-card-selected" : ""} min-w-[48px] rounded-2xl border-2 border-[#E7EFE8] bg-gradient-to-br from-white to-[#F1F6F1] px-2 py-3 text-center text-sm font-black shadow-[0_12px_20px_rgba(0,0,0,.22)] first:ml-0 sm:min-w-[58px] ${getLegalCards(hand, leadSuit).some((item) => item.suit === card.suit && item.rank === card.rank) ? "" : "opacity-45"} ${card.suit === "♥" || card.suit === "♦" ? "text-[#D9574A]" : "text-[#183B2A]"}`}><span className="block text-[10px] text-black/30">{card.suit}</span>{card.rank}<br /><span className="text-lg">{card.suit}</span></button>)}</div>{ruleMessage && <div className="absolute bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[#E96757] px-4 py-2 text-[10px] font-black text-white shadow-lg">{ruleMessage}</div>}<div className="absolute bottom-1 left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-full border border-white/10 bg-black/30 p-1">{STICKERS.map((sticker) => <button key={sticker} type="button" onClick={() => void sendReaction(sticker)} className="rounded-full px-2 py-1 text-base transition hover:scale-125" aria-label={`ارسال واکنش ${sticker}`}>{sticker}</button>)}</div></section>
        <aside className="flex min-h-[360px] flex-col rounded-[26px] bg-white p-4 text-[#183B2A]"><h2 className="font-black">💬 گفت‌وگوی میز</h2><p className="mt-1 text-[10px] text-[#7A8D7D]">پیام‌ها با نام نمایشی شما ارسال می‌شوند.</p><div className="mt-3 min-h-[220px] flex-1 space-y-2 overflow-y-auto rounded-2xl bg-[#F3F8F2] p-3">{messages.length === 0 ? <p className="text-center text-xs text-[#7A8D7D]">هنوز پیامی نیست؛ به هم‌تیمی‌ها سلام کن.</p> : messages.map((item) => <p key={item.id} className="text-xs"><b>{item.name}:</b> {item.text}</p>)}</div><form onSubmit={sendMessage} className="mt-3 flex gap-2"><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="پیام بنویس..." className="min-w-0 flex-1 rounded-xl border border-[#D7EBDD] px-3 py-2 text-xs outline-none focus:border-[#1E8151]" /><button className="rounded-xl bg-[#1E8151] px-3 text-xs font-bold text-white">ارسال</button></form></aside>
      </div>}
    </div>
    {winner && <VictoryOverlay name={winner} onClose={() => setWinner(null)} />}
    <style jsx>{`\n      .pasour-entry, .pasour-lobby { background: radial-gradient(circle at 50% 10%, #244d3e 0%, #102d25 48%, #081b18 100%); box-shadow: inset 0 0 120px rgba(0,0,0,.45), 0 24px 70px rgba(0,0,0,.3); }
      .pasour-logo { background: linear-gradient(145deg, #f4dc99, #9e6b2a); box-shadow: 0 0 0 6px rgba(232,200,120,.08), 0 20px 45px rgba(0,0,0,.35); }
      .pasour-primary { background: linear-gradient(135deg, #f1d487, #b8792d); color: #2d1e11; box-shadow: 0 12px 30px rgba(207,153,64,.25); transition: transform .25s, box-shadow .25s; }
      .pasour-primary:hover { transform: translateY(-3px); box-shadow: 0 18px 36px rgba(207,153,64,.4); }
      .floating-card { position:absolute; border:1px solid rgba(255,255,255,.2); border-radius:16px; padding:18px 14px; background:rgba(255,255,255,.08); font-size:22px; box-shadow:0 15px 35px rgba(0,0,0,.2); animation: floatCard 5s ease-in-out infinite; }
      .floating-card-one { top:16%; right:12%; transform:rotate(14deg); color:#f1d487; } .floating-card-two { bottom:18%; left:12%; transform:rotate(-14deg); color:#f3a29b; animation-delay:1.2s; }
      .match-seat { border-color: rgba(232,200,120,.35); background: linear-gradient(145deg, rgba(232,200,120,.15), rgba(255,255,255,.04)); }
      .match-seat-ready { animation: seatReady .7s ease both; }
      @keyframes floatCard { 0%,100% { margin-top:0; } 50% { margin-top:-12px; } }
      @keyframes seatReady { from { opacity:0; transform:scale(.8) translateY(15px); } to { opacity:1; transform:scale(1) translateY(0); } }
      .hokm-table { background: radial-gradient(ellipse at center, #3d9565 0%, #17603f 42%, #0a3525 100%); box-shadow: inset 0 0 90px rgba(0,0,0,.25), 0 20px 60px rgba(0,0,0,.25); }\n      .hokm-glow { background: radial-gradient(circle, rgba(255,218,125,.22), transparent 70%); animation: tableGlow 3s ease-in-out infinite; }\n      .hokm-card { transform: translateY(12px) rotate(var(--card-rotation, 0deg)); transition: transform .25s ease, box-shadow .25s ease; }\n      .hokm-card:hover { transform: translateY(-18px) rotate(0deg) scale(1.05); z-index: 40; }
      .hokm-card-selected { transform: translateY(-34px) rotate(0deg) scale(1.08); z-index: 50; box-shadow: 0 0 0 3px rgba(255,217,138,.8), 0 18px 30px rgba(0,0,0,.35); }
      .hakem-draw-card { animation: drawReveal .45s ease both; }
      .hakem-draw-card:nth-child(2) { animation-delay: .12s; } .hakem-draw-card:nth-child(3) { animation-delay: .24s; } .hakem-draw-card:nth-child(4) { animation-delay: .36s; }
      @keyframes drawReveal { from { opacity:0; transform: translateY(-18px) rotateY(90deg); } to { opacity:1; transform: translateY(0) rotateY(0); } }
      @keyframes cardThrow { 0% { transform: translateY(-34px) scale(1.08); } 55% { transform: translate(0,-90px) scale(.92) rotate(8deg); } 100% { transform: translate(0,-12px) scale(.86) rotate(0); } }\n      .hokm-card:nth-child(odd) { --card-rotation: -2deg; }\n      .hokm-card:nth-child(even) { --card-rotation: 2deg; }\n      @keyframes tableGlow { 0%,100% { opacity:.55; transform: scale(.9); } 50% { opacity:1; transform: scale(1.15); } }
      @media (max-width: 640px) {
        .hokm-shell { padding: 10px !important; border-radius: 22px !important; }
        .hokm-table { min-height: 590px !important; }
        .hokm-card { min-width: 45px !important; padding: 9px 6px !important; font-size: 12px !important; }
        .hokm-hand { width: 98% !important; bottom: 34px !important; }
        .hakem-draw-card { padding: 6px 3px !important; font-size: 10px !important; }
      }
      @media (min-width: 641px) and (max-width: 1024px) {
        .hokm-table { min-height: 610px !important; }
        .hokm-card { min-width: 54px !important; }
      }\n      @media (prefers-reduced-motion: reduce) { .hokm-glow { animation: none; } .hokm-card { transition: none; } }\n    `}</style>
  </main>;
}

function VictoryOverlay({ name, onClose }: { name: string; onClose: () => void }) { return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#082719]/80 p-4 backdrop-blur-sm"><div className="victory-card relative w-full max-w-sm overflow-hidden rounded-[32px] border border-[#FFE19A] bg-gradient-to-br from-[#FFF8D8] via-white to-[#FFE9B6] p-8 text-center text-[#503517] shadow-[0_0_70px_rgba(255,211,105,.5)]"><div className="confetti" /><div className="relative z-10 text-7xl">🏆</div><p className="relative z-10 mt-3 text-xs font-bold text-[#B27720]">یک برد شیرین در جم</p><h2 className="relative z-10 mt-1 text-3xl font-black">آفرین {name}!</h2><p className="relative z-10 mt-3 text-sm leading-7">این دست را بردی؛ واکنش هم‌تیمی‌ها را ببین و برای بازی بعدی آماده شو.</p><button type="button" onClick={onClose} className="relative z-10 mt-6 rounded-2xl bg-[#E28D2E] px-7 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-1">ادامه بازی</button></div><style jsx>{`\n      .victory-card::before,.victory-card::after { content:"✨"; position:absolute; font-size:32px; animation: sparkle 1.6s ease-in-out infinite; }\n      .victory-card::before { left:24px; top:28px; } .victory-card::after { right:24px; top:80px; animation-delay:.5s; }\n      .confetti { position:absolute; inset:0; opacity:.7; background-image: radial-gradient(#E28D2E 1.5px,transparent 1.5px),radial-gradient(#D9574A 1.5px,transparent 1.5px),radial-gradient(#1E8151 1.5px,transparent 1.5px); background-size:32px 32px,42px 42px,28px 28px; animation: confettiMove 8s linear infinite; }\n      @keyframes sparkle { 0%,100% { transform:scale(.8) rotate(-10deg); opacity:.4; } 50% { transform:scale(1.2) rotate(10deg); opacity:1; } }\n      @keyframes confettiMove { from { background-position:0 0,10px 0,20px 0; } to { background-position:0 180px,10px 220px,20px 160px; } }\n    `}</style></div>; }

function LobbyCard({ onJoin }: { onJoin: () => void }) { return <main dir="rtl" className="pasour-entry min-h-[680px] overflow-hidden rounded-[32px] p-5 text-white sm:p-10"><div className="floating-card floating-card-one">A♠</div><div className="floating-card floating-card-two">K♥</div><div className="mx-auto flex min-h-[640px] max-w-md flex-col items-center justify-center text-center"><div className="pasour-logo mb-5 flex h-24 w-24 items-center justify-center rounded-[30px] text-5xl">🃏</div><p className="text-xs font-bold tracking-[.28em] text-[#D7B36A]">PASOUR JAM</p><h1 className="mt-3 text-4xl font-black tracking-tight">پاسور جم</h1><p className="mt-3 text-sm text-white/60">حکم ایرانی، این بار آنلاین</p><button type="button" onClick={onJoin} className="pasour-primary mt-9 w-full rounded-2xl px-6 py-4 text-base font-black">🎮 شروع بازی</button><div className="mt-5 grid w-full grid-cols-2 gap-2"><div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/75">👥 بازی با دوستان</div><div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/75">🤖 بازی با ربات</div><Link href="/games/hokm/leaderboard" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/75 transition hover:border-[#E8C878]/50 hover:bg-[#E8C878]/10">🏆 رتبه‌بندی</Link><Link href="/profile" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/75 transition hover:border-[#E8C878]/50 hover:bg-[#E8C878]/10">📊 پروفایل من</Link></div></div></main>; }
function WaitingRoom({ players, seconds, onOffline }: { players: Player[]; seconds: number; onOffline: () => void }) { return <section dir="rtl" className="pasour-lobby mx-auto min-h-[600px] max-w-2xl rounded-[32px] p-5 text-center text-white sm:p-8"><div className="mb-7 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right"><div><p className="text-[10px] text-white/45">بازیکن آماده</p><p className="mt-1 font-black">همشهری جم</p></div><div className="text-right"><p className="text-[10px] text-white/45">امتیاز</p><p className="mt-1 font-black text-[#E8C878]">⭐ ۱۰۰۰</p></div><div className="rounded-xl bg-[#D7B36A]/15 px-3 py-2 text-xs font-black text-[#E8C878]">Lv. ۱</div></div><div className="text-5xl">🃏</div><h2 className="mt-4 text-2xl font-black">در حال پیدا کردن بازیکنان...</h2><p className="mt-2 text-xs text-white/50">هر چهار جایگاه که پر شود، بازی شروع می‌شود</p><div className="relative mx-auto mt-8 grid max-w-md grid-cols-2 gap-3">{[0,1,2,3].map((seat) => { const player = players.find((item) => item.seat === seat); return <div key={seat} className={`match-seat rounded-2xl border p-5 ${player ? "match-seat-ready" : "border-white/10 bg-white/5"}`}><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl">{player ? "👤" : "❔"}</div><p className="mt-2 text-xs font-black">{player ? player.name : "در انتظار"}</p><p className="mt-1 text-[9px] text-white/45">{player ? "آماده بازی" : "جایگاه خالی"}</p></div>; })}</div><div className="mx-auto mt-7 h-2 max-w-md overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-l from-[#E8C878] to-[#9C6B2F] transition-all" style={{ width: `${Math.min(100, (players.length / 4) * 100)}%` }} /></div><p className="mt-3 text-xs text-white/55">{players.length}/۴ بازیکن · {seconds} ثانیه</p>{seconds <= 15 && <button type="button" onClick={onOffline} className="mt-5 rounded-xl bg-[#E8C878] px-5 py-3 text-xs font-black text-[#352415]">🤖 ادامه با ربات</button>}</section>; }
function Seat({ name, reaction, className }: { name: string; reaction?: string; className: string }) { return <div className={`absolute z-10 rounded-2xl border border-white/15 bg-[#0B3524]/90 px-3 py-2 text-center text-[10px] shadow-lg ${className}`}><span className="relative block text-lg">👤{reaction && <span className="absolute -left-5 -top-5 animate-bounce text-2xl">{reaction}</span>}</span>{name}</div>; }
