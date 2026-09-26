"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { uploadSingleFile } from "@/lib/upload";
import { timeAgo } from "@/lib/constants";
import { Spinner, ErrorState } from "@/components/Feedback";
import Avatar from "@/components/Avatar";
import EmojiPicker from "@/components/EmojiPicker";
import WallGate from "@/components/WallGate";
import { getOrCreateConversation } from "@/lib/conversations";

type WallMessage = {
  id: string;
  user_id: string;
  content: string | null;
  reply_to: string | null;
  image_url: string | null;
  audio_url?: string | null;
  is_promo: boolean;
  is_auto_republish?: boolean;
  is_pinned: boolean;
  pinned_at: string | null;
  business_id: string | null;
  category: "car" | "realestate" | null;
  created_at: string;
  profiles?: { display_name: string; avatar_url: string | null } | null;
};

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  car: { label: "خودرو", icon: "🚗" },
  realestate: { label: "املاک", icon: "🏠" },
};

// --- کمکی‌های نمایشی (فقط ظاهر؛ روی هیچ منطق/دیتایی اثر نمی‌گذارند) ---
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateDividerLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(d, today)) return "امروز";
  if (isSameDay(d, yesterday)) return "دیروز";
  return d.toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
}

function formatSeconds(total: number) {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function WallPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, profile, loading: authLoading, wallUnreadCount, markWallRead } = useAuth();
  const [messages, setMessages] = useState<WallMessage[] | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<WallMessage | null>(null);
  const [pinMenuMessage, setPinMenuMessage] = useState<WallMessage | null>(null);
  const pinPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [replyingTo, setReplyingTo] = useState<WallMessage | null>(null);
  const [replyTargets, setReplyTargets] = useState<Record<string, WallMessage>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedByMe, setLikedByMe] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [browse, setBrowse] = useState<{ query: string; category: "car" | "realestate" | null } | null>(null);
  const [browseResultsData, setBrowseResultsData] = useState<WallMessage[] | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [browseIndex, setBrowseIndex] = useState(0);
  const [replyTo, setReplyTo] = useState<WallMessage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // فقط ظاهری: نمایش دکمهٔ «برو به آخرین پیام» وقتی کاربر اسکرول کرده بالا
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const oldestLoadedAtRef = useRef<string | null>(null);

  async function loadOlderMessages() {
    const el = scrollAreaRef.current;
    if (!user || !el || loadingOlder || !hasMoreOlder || !messages?.length) return;

    const oldest = messages.reduce((a, b) =>
      new Date(a.created_at).getTime() < new Date(b.created_at).getTime() ? a : b
    );
    const cursor = oldestLoadedAtRef.current ?? oldest.created_at;
    setLoadingOlder(true);
    const previousHeight = el.scrollHeight;

    try {
      const { data, error } = await supabase
        .from("wall_messages")
        .select("id,user_id,content,image_url,audio_url,is_promo,is_auto_republish,business_id,category,created_at,reply_to,is_pinned,pinned_at")
        .lt("created_at", cursor)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      const olderRows = [...((data as unknown as WallMessage[]) ?? [])].reverse();
      if (!olderRows.length) {
        setHasMoreOlder(false);
        return;
      }

      const userIds = Array.from(new Set(olderRows.map((r) => r.user_id)));
      const replyIds = Array.from(
        new Set(olderRows.map((r) => r.reply_to).filter((id): id is string => Boolean(id)))
      );
      const missingReplyIds = replyIds.filter((id) => !olderRows.some((r) => r.id === id));

      const [{ data: profiles }, likesResult, replyTargetsResult] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds)
          : Promise.resolve({ data: [] as { id: string; display_name: string; avatar_url: string | null }[] }),
        supabase
          .from("wall_message_likes")
          .select("message_id, user_id")
          .in("message_id", olderRows.map((r) => r.id)),
        missingReplyIds.length
          ? supabase
              .from("wall_messages")
              .select("id,user_id,content,image_url,audio_url,is_promo,is_auto_republish,business_id,category,created_at,reply_to,is_pinned,pinned_at")
              .in("id", missingReplyIds)
          : Promise.resolve({ data: [] as unknown as WallMessage[] }),
      ]);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }])
      );
      olderRows.forEach((r) => { r.profiles = profileMap.get(r.user_id) ?? null; });

      if (replyTargetsResult.data && replyTargetsResult.data.length > 0) {
        const targetRows = replyTargetsResult.data as unknown as WallMessage[];
        const targetUserIds = Array.from(new Set(targetRows.map((t) => t.user_id)));
        const { data: targetProfiles } = targetUserIds.length
          ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", targetUserIds)
          : { data: [] as { id: string; display_name: string; avatar_url: string | null }[] };
        const targetProfileMap = new Map(
          (targetProfiles ?? []).map((p) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }])
        );
        setReplyTargets((prev) => {
          const next = { ...prev };
          targetRows.forEach((t) => {
            next[t.id] = { ...t, profiles: targetProfileMap.get(t.user_id) ?? null };
          });
          return next;
        });
      }

      setLikeCounts((prev) => {
        const counts = { ...prev };
        (likesResult.data ?? []).forEach((l) => {
          counts[l.message_id] = (counts[l.message_id] ?? 0) + 1;
        });
        return counts;
      });
      setLikedByMe((prev) => {
        const mine = new Set(prev);
        (likesResult.data ?? []).forEach((l) => {
          if (l.user_id === user.id) mine.add(l.message_id);
        });
        return mine;
      });

      setMessages((prev) => {
        const current = prev ?? [];
        const existing = new Set(current.map((m) => m.id));
        return [...olderRows.filter((m) => !existing.has(m.id)), ...current];
      });

      oldestLoadedAtRef.current = olderRows[0].created_at;
      if (olderRows.length < 20) setHasMoreOlder(false);

      requestAnimationFrame(() => {
        el.scrollTop += el.scrollHeight - previousHeight;
      });
    } catch (error) {
      console.error("wall older messages load error", error);
    } finally {
      setLoadingOlder(false);
    }
  }

  function handleScrollArea() {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(distanceFromBottom > 240);
    if (el.scrollTop < 140 && messages?.length && !loadingOlder && hasMoreOlder) {
      void loadOlderMessages();
    }
  }

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }

  async function scrollToPinnedMessage(message: WallMessage) {
    const existing = document.getElementById("message-" + message.id);
    if (existing) {
      existing.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // اگر آگهی قدیمی‌تر از ۳۰ پیام اخیر باشد، خودِ همان رکورد را می‌گیریم
    // و در جای زمانی خودش به لیست اضافه می‌کنیم؛ آگهی جابه‌جا یا کپی نمی‌شود.
    const { data } = await supabase
      .from("wall_messages")
      .select("id,user_id,content,image_url,audio_url,is_promo,is_auto_republish,business_id,category,created_at,is_pinned,pinned_at")
      .eq("id", message.id)
      .maybeSingle();

    if (data) {
      const target = { ...(data as unknown as WallMessage) };
      const { data: p } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", target.user_id)
        .maybeSingle();
      target.profiles = p
        ? { display_name: p.display_name, avatar_url: p.avatar_url }
        : message.profiles ?? null;
      setReplyTargets((prev) => ({ ...prev, [target.id]: target }));

      setMessages((prev) => {
        const next = [...(prev ?? []).filter((m) => m.id !== target.id), target];
        return next.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() =>
          document
            .getElementById("message-" + target.id)
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
        );
      });
    }
  }

  function clearPinPressTimer() {
    if (pinPressTimerRef.current) {
      clearTimeout(pinPressTimerRef.current);
      pinPressTimerRef.current = null;
    }
  }

  function startPinPress(e: React.PointerEvent, message: WallMessage) {
    if (!profile?.is_admin) return;
    const target = e.target as Element | null;
    if (target?.closest("button,a,input,textarea")) return;
    clearPinPressTimer();
    pinPressTimerRef.current = setTimeout(() => {
      setPinMenuMessage(message);
      pinPressTimerRef.current = null;
    }, 550);
  }

  async function handlePinMessage(message: WallMessage) {
    if (!profile?.is_admin) return;
    clearPinPressTimer();

    try {
      if (message.is_pinned) {
        const { error } = await (supabase as any)
          .from("wall_messages")
          .update({ is_pinned: false, pinned_at: null })
          .eq("id", message.id);
        if (error) throw error;
        setPinnedMessage((current) => current?.id === message.id ? null : current);
      } else {
        const { error: clearError } = await (supabase as any)
          .from("wall_messages")
          .update({ is_pinned: false, pinned_at: null })
          .eq("is_pinned", true);
        if (clearError) throw clearError;

        const { error: pinError } = await (supabase as any)
          .from("wall_messages")
          .update({ is_pinned: true, pinned_at: new Date().toISOString() })
          .eq("id", message.id);
        if (pinError) throw pinError;

        setPinnedMessage({ ...message, is_pinned: true, pinned_at: new Date().toISOString() });
      }
    } catch (error) {
      console.error("wall pin error", error);
    } finally {
      setPinMenuMessage(null);
    }
  }

  // =====================================================
  // آنلاین‌های لحظه‌ای + نشانگر «در حال تایپ» — با Presence/Broadcast
  // سوپابیس، بدون نیاز به ستون یا جدول جدید (فقط برای مدت اتصال زنده‌ست)
  // =====================================================
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const myTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("wall-presence", {
      config: { presence: { key: user.id } },
    });

    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const { userId, name, typing } = payload.payload as {
          userId: string;
          name: string;
          typing: boolean;
        };
        if (userId === user.id) return;

        setTypingUsers((prev) => {
          const next = { ...prev };
          if (typing) next[userId] = name;
          else delete next[userId];
          return next;
        });

        if (typingTimeoutRef.current[userId]) {
          clearTimeout(typingTimeoutRef.current[userId]);
        }
        if (typing) {
          typingTimeoutRef.current[userId] = setTimeout(() => {
            setTypingUsers((prev) => {
              const next = { ...prev };
              delete next[userId];
              return next;
            });
          }, 4000);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function broadcastTyping(typing: boolean) {
    if (!user || !presenceChannelRef.current) return;
    presenceChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id, name: profile?.display_name || "کاربر", typing },
    });
  }

  function handleTextChange(value: string) {
    setText(value);
    broadcastTyping(true);
    if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
    myTypingTimeoutRef.current = setTimeout(() => broadcastTyping(false), 2000);

    // بزرگ‌شدن خودکار ارتفاع باکس پیام تا حداکثر ۵ خط
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }

  const typingNames = Object.values(typingUsers);

  // =====================================================
  // پیام صوتی — ضبط با MediaRecorder و آپلود مثل تصویر
  // نکته: نیازمند یک ستون audio_url (text, nullable) روی
  // جدول wall_messages و یک باکت Storage (مثلاً "wall-audio")
  // =====================================================
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  async function startRecording() {
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setVoiceError("دسترسی به میکروفون امکان‌پذیر نشد.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  }

  function cancelRecordedVoice() {
    setRecordedBlob(null);
    setRecordSeconds(0);
  }

  async function sendVoiceMessage() {
    if (!user || !recordedBlob || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const file = new File([recordedBlob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      const audio_url = await uploadSingleFile(file, "voice-messages", user.id, "webm");

      const messageData = {
        user_id: user.id,
        content: null,
        audio_url,
        reply_to: replyingTo?.id ?? null,
      };

      const { error } = await supabase.from("wall_messages").insert(messageData as never);
      if (error) throw error;

      setRecordedBlob(null);
      setRecordSeconds(0);
      setReplyingTo(null);
    } catch (e) {
      console.error("voice send error", e);
      setSendError("ارسال پیام صوتی با خطا مواجه شد. دوباره تلاش کنید.");
    } finally {
      setSending(false);
    }
  }

  // لایت‌باکس تصویر — نمایش تمام‌صفحه با کلیک روی عکس پیام
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("site_stats")
      .select("member_count")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setMemberCount(data.member_count);
      });

    const channel = supabase
      .channel("site-stats")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "site_stats" },
        (payload) => setMemberCount(payload.new.member_count as number)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;

    async function load() {
      setHasMoreOlder(true);
      oldestLoadedAtRef.current = null;
      // Fetch messages and profiles as two separate queries instead of
      // an embedded join — the embedded-resource join relies on
      // PostgREST's schema cache recognizing the foreign key, which can
      // momentarily fail right after a migration and made the wall
      // appear empty. Two plain queries are more robust.
      // فقط آخرین پیام‌ها را در لود اولیه بگیر؛ پیام‌های قدیمی باید با pagination لود شوند.
      // select محدود، حجم پاسخ و زمان parse/rerender موبایل را کم می‌کند.
      // دو کوئری مستقل را هم‌زمان می‌فرستیم تا لود اولیه پشت سر هم منتظر شبکه نماند.
      // فقط ۳۰ پیام آخر برای نمایش اولیه دریافت می‌شود؛ ظاهر و ترتیب دیوار حفظ می‌شود.
      const [messagesResult, pinnedResult] = await Promise.all([
        supabase
          .from("wall_messages")
          .select("id,user_id,content,image_url,audio_url,is_promo,is_auto_republish,business_id,category,created_at,reply_to,is_pinned,pinned_at")
          .order("created_at", { ascending: false })
          .limit(20),
        (supabase as any)
          .from("wall_messages")
          .select("id,user_id,content,image_url,audio_url,is_promo,is_auto_republish,business_id,category,created_at,reply_to,is_pinned,pinned_at")
          .eq("is_pinned", true)
          .order("pinned_at", { ascending: false })
          .limit(1),
      ]);

      const { data: rawMessages, error: msgError } = messagesResult;
      if (msgError) {
        console.error("wall load error", msgError);
        setMessages([]);
        return;
      }

      // کوئری برای رسیدن سریع‌تر به آخرین پیام‌ها نزولی است؛ نمایش همچنان قدیمی به جدید باشد.
      const rows = [...((rawMessages as unknown as WallMessage[]) ?? [])]
        .reverse() as WallMessage[];

      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const likesPromise = rows.length > 0
        ? supabase
            .from("wall_message_likes")
            .select("message_id, user_id")
            .in("message_id", rows.map((r) => r.id))
        : Promise.resolve({ data: [] as { message_id: string; user_id: string }[] });

      const profilesPromise = userIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string; avatar_url: string | null }[] });

      // پیام‌ها را همین حالا نمایش بده؛ اطلاعات جانبی نباید اولین نمایش دیوار را معطل کند.
      setMessages(rows);

      const [profilesResult, likesResult] = await Promise.all([profilesPromise, likesPromise]);

      // Keep reply previews even when the original message is older than the 30-message initial window.
      const replyIds = Array.from(new Set(rows.map((r) => r.reply_to).filter((id): id is string => Boolean(id))));
      const missingReplyIds = replyIds.filter((id) => !rows.some((r) => r.id === id));
      const replyTargetsResult = missingReplyIds.length
        ? await supabase
            .from("wall_messages")
            .select("id,user_id,content,image_url,audio_url,is_promo,is_auto_republish,business_id,category,created_at,reply_to,is_pinned,pinned_at")
            .in("id", missingReplyIds)
        : { data: [] };

      const profileMap = new Map(
        (profilesResult.data ?? []).map((p) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }])
      );
      rows.forEach((r) => {
        r.profiles = profileMap.get(r.user_id) ?? null;
      });

      const targetRows = (replyTargetsResult.data ?? []) as unknown as WallMessage[];
      const targetUserIds = Array.from(new Set(targetRows.map((r) => r.user_id)));
      const { data: targetProfiles } = targetUserIds.length
        ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", targetUserIds)
        : { data: [] };
      const targetProfileMap = new Map(
        (targetProfiles ?? []).map((p) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }])
      );
      const targetMap: Record<string, WallMessage> = {};
      targetRows.forEach((r) => {
        r.profiles = targetProfileMap.get(r.user_id) ?? null;
        targetMap[r.id] = r;
      });
      setReplyTargets(targetMap);

      const pinnedRows = (pinnedResult.data ?? []) as any[];
      const pinnedRow = pinnedRows[0] ?? null;

      if (pinnedRow) {
        const pinnedProfile = rows.find((r) => r.user_id === pinnedRow.user_id)?.profiles;
        setPinnedMessage({
          ...(pinnedRow as WallMessage),
          profiles: pinnedProfile ?? null,
        });
      } else {
        setPinnedMessage(null);
      }

      setMessages(rows);
      const replies: Record<string, number> = {};
      rows.forEach((r) => {
        if (r.reply_to) {
          replies[r.reply_to] = (replies[r.reply_to] ?? 0) + 1;
        }
      });

      if (rows.length > 0) {
        const counts: Record<string, number> = {};
        const mine = new Set<string>();
        (likesResult.data ?? []).forEach((l) => {
          counts[l.message_id] = (counts[l.message_id] ?? 0) + 1;
          if (l.user_id === user!.id) mine.add(l.message_id);
        });
        setLikeCounts(counts);
        setLikedByMe(mine);
      }
    }
    load();

    const channel = supabase
      .channel("wall-messages")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wall_messages" },
        (payload) => {
          const next = payload.new as WallMessage;
          setMessages((prev) => (prev ?? []).map((m) => m.id === next.id ? { ...m, ...next } : m));
          setPinnedMessage((current) => {
            if (next.is_pinned) return next;
            return current?.id === next.id ? null : current;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wall_messages" },
        async (payload) => {
          const { data } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("id", payload.new.user_id)
            .maybeSingle();
          setMessages((prev) => [
            ...(prev ?? []),
            { ...(payload.new as WallMessage), profiles: data },
          ]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "wall_messages" },
        (payload) => {
          const messageId = payload.old.id as string;
          setMessages((prev) => (prev ?? []).filter((message) => message.id !== messageId));
          setPinnedMessage((current) => current?.id === messageId ? null : current);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wall_message_likes" },
        (payload) => {
          const mid = payload.new.message_id as string;
          setLikeCounts((prev) => ({ ...prev, [mid]: (prev[mid] ?? 0) + 1 }));
          if (payload.new.user_id === user!.id) {
            setLikedByMe((prev) => new Set(prev).add(mid));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "wall_message_likes" },
        (payload) => {
          const mid = payload.old.message_id as string;
          setLikeCounts((prev) => ({ ...prev, [mid]: Math.max(0, (prev[mid] ?? 1) - 1) }));
          if (payload.old.user_id === user!.id) {
            setLikedByMe((prev) => {
              const next = new Set(prev);
              next.delete(mid);
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // =====================================================
  // اسکرول اولیه به آخرین پیام
  // نکته: فقط یک‌بار اسکرول کردن بلافاصله بعد از لود پیام‌ها کافی نیست،
  // چون عکس‌ها/آواتارها دیرتر لود می‌شن و ارتفاع صفحه رو عوض می‌کنن؛
  // اسکرول رو چند بار با فاصله تکرار می‌کنیم تا همیشه آخرین پیام معلوم باشه.
  // =====================================================
  const initialScrollDone = useRef(false);

  useEffect(() => {
    if (messages === null || initialScrollDone.current) return;
    initialScrollDone.current = true;

    // یک اسکرول اولیه کافی است؛ چند timeout متوالی روی موبایل باعث reflow و پرش می‌شد.
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
    });
  }, [messages]);

  useEffect(() => {
    if (!user || messages === null || showScrollDown) return;
    const latestSeenAt = messages.reduce<string | null>((latest, message) => {
      if (!latest || new Date(message.created_at).getTime() > new Date(latest).getTime()) {
        return message.created_at;
      }
      return latest;
    }, null);
    if (latestSeenAt) void markWallRead(latestSeenAt);
  }, [user, messages, showScrollDown, markWallRead]);

  // اگر کاربر همین الان پایین صفحه بود و پیام جدیدی از بقیه رسید،
  // خودکار روی همون آخرین پیام بمونه (اگر بالا رفته و داره پیام‌های
  // قدیمی رو می‌خونه، مزاحمش نمی‌شیم)
  const prevMessageCount = useRef(0);
  useEffect(() => {
    if (messages === null) return;
    const count = messages.length;
    if (count > prevMessageCount.current && !showScrollDown) {
      requestAnimationFrame(() => scrollToBottom("smooth"));
    }
    prevMessageCount.current = count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  async function handleSend() {
    if (!user || sending || (!text.trim() && !image)) return;
    setSending(true);
    setSendError(null);
    try {
      let image_url: string | null = null;
      if (image) {
        image_url = await uploadSingleFile(image, "wall-images", user.id, image.name.split(".").pop());
      }
      const messageData = {
  user_id: user.id,
  content: text.trim() || null,
  image_url,
  reply_to: replyingTo?.id ?? null,
};

const { error } = await supabase
  .from("wall_messages")
  .insert(messageData as never);
      if (error) throw error;
     setText("");
setImage(null);
setReplyingTo(null);
broadcastTyping(false);
if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (e) {
      console.error("wall send error", e);
      const msg =
        e instanceof Error
          ? e.message
          : e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : null;
      setSendError(
        msg ? `ارسال پیام با خطا مواجه شد: ${msg}` : "ارسال پیام با خطا مواجه شد. دوباره تلاش کنید."
      );
    } finally {
      setSending(false);
    }
  }

  async function toggleLike(messageId: string) {
    if (!user) return;
    if (likedByMe.has(messageId)) {
      setLikedByMe((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      setLikeCounts((prev) => ({ ...prev, [messageId]: Math.max(0, (prev[messageId] ?? 1) - 1) }));
      await supabase
        .from("wall_message_likes")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", user.id);
    } else {
      setLikedByMe((prev) => new Set(prev).add(messageId));
      setLikeCounts((prev) => ({ ...prev, [messageId]: (prev[messageId] ?? 0) + 1 }));
      await supabase.from("wall_message_likes").insert({ message_id: messageId, user_id: user.id });
    }
  }
  async function deleteMessage(messageId: string) {
    if (!user) return;

    const message = messages?.find((item) => item.id === messageId);
    const canDelete = Boolean(message && (message.user_id === user.id || profile?.is_admin));
    if (!canDelete) return;

    const confirmed = window.confirm(
      profile?.is_admin && message?.user_id !== user.id
        ? "آیا مطمئن هستید می‌خواهید پیام این کاربر را حذف کنید؟"
        : "آیا مطمئن هستید می‌خواهید این پیام را حذف کنید؟"
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("wall_messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      console.error("delete message error:", error);
      alert("حذف پیام انجام نشد. دوباره تلاش کنید.");
      return;
    }

    setMessages((prev) => prev?.filter((item) => item.id !== messageId) ?? prev);
    setPinnedMessage((current) => current?.id === messageId ? null : current);
  }
  async function openChatWith(otherId: string) {
    if (!user || otherId === user.id || navigating) return;
    setNavigating(true);
    const id = await getOrCreateConversation(supabase, user.id, otherId);
    setNavigating(false);
    if (id) router.push(`/chat/${id}`);
  }

  async function reportUser(reportedUserId: string, messageContent: string | null) {
    if (!user || reportedUserId === user.id) return;
    const reason = window.prompt("دلیل گزارش این کاربر را بنویسید (اختیاری):") ?? "";
    await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId,
      context: "wall",
      message_content: messageContent,
      reason: reason.trim() || null,
    });
    window.alert("گزارش شما برای بررسی به پنل مدیریت ارسال شد.");
  }

  function startBrowse(query: string, category: "car" | "realestate" | null) {
    setBrowse({ query: query.trim(), category });
    setBrowseResultsData(null);
    setBrowseIndex(0);
  }

function handleReply(message: WallMessage) {
  setReplyTo(message);
  setReplyingTo(message);

  requestAnimationFrame(() => {
    textareaRef.current?.focus();
  });
}
  const browseResults =
    browseResultsData ??
    (browse && messages
      ? messages
          .filter(
            (m) =>
              (!browse.category || m.category === browse.category) &&
              (!browse.query || (m.content ?? "").includes(browse.query))
          )
          .slice()
          .reverse()
      : []);

  if (authLoading) return <Spinner label="در حال بررسی ورود..." />;

  if (!user) return <WallGate />;

  return (
    <div className="fade-in -mx-4 -mt-6 -mb-24 flex h-[calc(100dvh-64px)] flex-col overflow-hidden rounded-b-[22px] bg-[#EAF1E7] sm:mx-0 sm:mt-0 sm:mb-0 sm:h-[78dvh] sm:rounded-[22px]">

      {/* =====================================================
          هدر دیوار — جمع‌وجور، سفید، تم روشن
      ====================================================== */}
      <div className="shrink-0 border-b border-[#E3EBDE] bg-white/95 px-2.5 pb-1 pt-1.5 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E3F3E9] text-sm">
              💬
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[13px] font-black text-[#1D2B1F]">دیوار شهر جم</h1>
              <p className="flex items-center gap-2 text-[10px] font-bold">
                {memberCount !== null && (
                  <span className="font-black text-[#E2574C]">· {memberCount.toLocaleString("fa-IR")} عضو</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Link
              href="/wall/car"
              aria-label="آگهی‌های خودرو"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EAF2FF] text-sm shadow-sm transition hover:bg-[#DCE9FF]"
            >
              🚗
            </Link>
            <Link
              href="/wall/realestate"
              aria-label="آگهی‌های املاک"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4EAFF] text-sm shadow-sm transition hover:bg-[#EBDCFF]"
            >
              🏠
            </Link>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchInput.trim()) startBrowse(searchInput, null);
          }}
          className="mx-auto mt-1.5 flex w-[88%] items-center gap-1.5"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[#E3EBDE] bg-[#F7F9F4] px-3 py-1.5 transition focus-within:border-[#147A4B] focus-within:bg-white">
            <span className="text-[12px] text-[#B0BAB1]">🔍</span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="جستجو در آگهی‌های دیوار..."
              className="w-full bg-transparent text-[11px] text-[#1D2B1F] outline-none placeholder:text-[#B0BAB1]"
            />
          </div>
          <button
            type="submit"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#147A4B] text-white shadow-[0_5px_14px_rgba(20,122,75,.25)] transition hover:brightness-110"
          >
            🔍
          </button>
        </form>
      </div>

      {/* =====================================================
          بدنه — لیست پیام‌ها یا نتایج جستجو
      ====================================================== */}
      {browse ? (
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#F4F7F2] p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-bold text-[#66766A]">
              {browseResults.length > 0
                ? `${browseIndex + 1} از ${browseResults.length} آگهی`
                : "نتیجه‌ای یافت نشد"}
            </p>
            <button
              onClick={() => setBrowse(null)}
              className="rounded-full border border-[#E3EBDE] bg-white px-3 py-1 text-[11px] font-bold text-[#66766A] shadow-sm"
            >
              ✕ بستن جستجو
            </button>
          </div>

          {browseResults.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-20 text-center">
              <span className="text-3xl">🔎</span>
              <p className="text-[12px] text-[#8A968C]">آگهی‌ای با این مشخصات پیدا نشد.</p>
            </div>
          ) : (
            (() => {
              const m = browseResults[browseIndex];
              const cat = m.category ? CATEGORY_META[m.category] : null;
              return (
                <div className="space-y-3 overflow-hidden rounded-[22px] border border-[#E3EBDE] bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBrowseIndex((i) => Math.min(browseResults.length - 1, i + 1))}
                        disabled={browseIndex >= browseResults.length - 1}
                        className="rounded-full bg-[#147A4B] px-4 py-2 text-[11px] font-bold text-white shadow-[0_6px_16px_rgba(20,122,75,.3)] disabled:opacity-40"
                      >
                        ▲ بعدی
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrowseIndex((i) => Math.max(0, i - 1))}
                        disabled={browseIndex <= 0}
                        className="rounded-full border border-[#E3EBDE] bg-white px-4 py-2 text-[11px] font-bold text-[#66766A] disabled:opacity-40"
                      >
                        ▼ قبلی
                      </button>
                    </div>
                  <button
                    onClick={() => openChatWith(m.user_id)}
                    className="flex items-center gap-2 text-[12px] font-bold text-[#147A4B]"
                  >
                    <Avatar url={m.profiles?.avatar_url} name={m.profiles?.display_name} size={26} />
                    {m.profiles?.display_name || "کاربر"}
                  </button>
                  {cat && (
                    <span className="inline-block rounded-full bg-[#F3F6F1] px-2 py-0.5 text-[10px] font-bold text-[#66766A]">
                      {cat.icon} {cat.label}
                    </span>
                  )}
                  {m.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image_url} alt="" className="aspect-[4/3] max-h-72 w-full rounded-2xl object-cover" loading="lazy" />
                  )}
                  {m.content && <p className="whitespace-pre-wrap text-sm leading-7 text-[#1D2B1F]">{m.content}</p>}
                  <p className="text-[10px] text-[#B0BAB1]">{timeAgo(m.created_at)}</p>

                  <div className="flex items-center justify-end border-t border-[#F0F3EE] pt-3">
                    <button
                      onClick={() => reportUser(m.user_id, m.content)}
                      className="text-[11px] font-bold text-[#B0BAB1]"
                    >
                      🚩 گزارش
                    </button>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      ) : (
        <div className="relative min-h-0 flex flex-1 flex-col overflow-hidden">
          {pinnedMessage && (
            <div className="shrink-0 border-b border-[#E3EBDE] bg-white/55 px-2.5 py-1.5 backdrop-blur">
              <button
                type="button"
                onClick={() => scrollToPinnedMessage(pinnedMessage)}
                className="flex w-full items-center gap-2 rounded-lg border-r-4 border-[#E2574C] bg-[#FFF7F6] px-2 py-1 text-right shadow-[0_2px_10px_rgba(226,87,76,.14)] transition hover:bg-[#FFF1EF]"
                aria-label="مشاهده آگهی سنجاق‌شده"
              >
                <span className="shrink-0 text-[11px] opacity-55">📌</span>
                <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-[#B43B32]">
                  {pinnedMessage.content?.split("\n")[0]?.replace(/^⭐\s*/, "") || "آگهی سنجاق‌شده"}
                </span>
                <span className="shrink-0 text-[8px] font-semibold text-[#B8C0B9]">مشاهده ←</span>
              </button>
            </div>
          )}

          {wallUnreadCount > 0 && showScrollDown && (
            <button
              type="button"
              onClick={() => scrollToBottom()}
              className="flex shrink-0 items-center justify-between border-b border-[#DCEBDD] bg-[#F7FBF5] px-3 py-2 text-right text-[11px] font-bold text-[#147A4B] transition hover:bg-[#EEF8EE]"
            >
              <span>{wallUnreadCount > 99 ? "۹۹+" : wallUnreadCount} پیام جدید</span>
              <span className="text-[10px] text-[#8A968C]">مشاهده ↓</span>
            </button>
          )}

          <div
            ref={scrollAreaRef}
            onScroll={handleScrollArea}
            className="min-h-0 flex-1 w-full space-y-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-[#EAF1E7] px-2.5 py-2"
            style={{
              backgroundImage:
                "radial-gradient(rgba(20,122,75,0.05) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          >
            {messages === null ? (
              <Spinner label="در حال بارگذاری پیام‌ها..." />
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <span className="text-3xl">💬</span>
                <p className="text-[12px] text-[#8A968C]">
                  هنوز پیامی ارسال نشده. اولین نفری باشید که پیام می‌گذارد!
                </p>
              </div>
            ) : (
              messages.map((m, index) => {
                const mine = m.user_id === user.id;
                const quoted = m.reply_to
                  ? messages?.find((msg) => msg.id === m.reply_to) ?? replyTargets[m.reply_to]
                  : null;
                const isPromoCard = m.is_promo && !!m.business_id;
                const isAdCard = !!m.image_url && !!m.content;
                const liked = likedByMe.has(m.id);
                const count = likeCounts[m.id] ?? 0;

                const prev = index > 0 ? messages[index - 1] : null;
                const showDateDivider =
                  !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
                const showMeta = !mine && (!prev || prev.user_id !== m.user_id || showDateDivider);

                const bubbleTail = mine ? "rounded-br-md" : "rounded-bl-md";

                return (
                  <div
                    key={m.id}
                    id={`message-${m.id}`}
                    className={`min-w-0 max-w-full rounded-xl transition-all ${m.is_pinned ? "border-r-4 border-[#E2574C] bg-[#FFF7F6] shadow-[0_0_18px_rgba(226,87,76,.18)]" : ""}`}
                    onPointerDown={(e) => startPinPress(e, m)}
                    onPointerUp={clearPinPressTimer}
                    onPointerCancel={clearPinPressTimer}
                    onPointerLeave={clearPinPressTimer}
                    onContextMenu={(e) => {
                      if (!profile?.is_admin) return;
                      const target = e.target as Element | null;
                      if (target?.closest("button,a,input,textarea")) return;
                      e.preventDefault();
                      clearPinPressTimer();
                      setPinMenuMessage(m);
                    }}
                  >
                    {showDateDivider && (
                      <div className="my-3 flex items-center justify-center">
                        <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold text-[#8A968C] shadow-sm">
                          {dateDividerLabel(m.created_at)}
                        </span>
                      </div>
                    )}

                    {isPromoCard ? (
                      <div className="flex min-w-0 max-w-full justify-end">
                        <div className="w-full max-w-[320px] rounded-2xl border border-[#E7C777] bg-gradient-to-l from-[#FFF9E8] to-white px-3 py-2.5 shadow-[0_4px_14px_rgba(184,114,30,.10)]">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-black text-[#8A5A16]">⭐ آگهی ویژه · {m.content?.split("\n")[0]?.replace(/^⭐\s*/, "")}</p>
                              <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[10px] leading-5 text-[#66766A]">{m.content?.split("\n").slice(1, -1).join("\n")}</p>
                            </div>
                            <Link href={`/business/${m.business_id}`} className="shrink-0 rounded-lg bg-[#C58A28] px-2.5 py-1.5 text-[10px] font-black text-white transition hover:bg-[#A8701D]">
                              بیشتر
                            </Link>
                          </div>
                          <p className="mt-1.5 text-[9px] text-[#B09A73]">{timeAgo(m.created_at)}</p>
                        </div>
                      </div>
                    ) : isAdCard ? (
                      <div className={`flex min-w-0 max-w-full ${mine ? "justify-start" : "justify-end"} ${showMeta ? "mt-2" : "mt-0.5"}`}>
                        <div
                          className={`min-w-0 max-w-[80%] overflow-hidden rounded-2xl border border-[#F0DCB4] bg-white shadow-[0_4px_16px_rgba(20,60,40,.06)] ${bubbleTail}`}
                        >
                          <button type="button" onClick={() => setLightboxUrl(m.image_url)} className="block w-full">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={m.image_url!}
                              alt=""
                              className="aspect-[4/3] max-h-72 w-full object-cover"
                              loading="lazy"
                              decoding="async"
                              onLoad={() => {
                                if (!initialScrollDone.current || showScrollDown) return;
                                bottomRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
                              }}
                            />
                          </button>
                          <div className="min-w-0 space-y-2 p-3">
                            {quoted && (
                              <button
                                type="button"
                                onClick={() => {
                                  document
                                    .getElementById(`message-${quoted.id}`)
                                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                                }}
                                className="min-w-0 w-full max-w-full overflow-hidden rounded-lg border-r-4 border-[#147A4B] bg-[#F7F9F4] px-3 py-2 text-right"
                              >
                                <p className="text-[10px] font-bold text-[#147A4B]">
                                  پاسخ به {quoted.profiles?.display_name || "کاربر"}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] text-[#8A968C]">
                                  {quoted.content || "📷 تصویر"}
                                </p>
                              </button>
                            )}
                            <button
                              onClick={() => openChatWith(m.user_id)}
                              className="flex items-center gap-2 text-[11px] font-bold text-[#D98F2B]"
                            >
                              <Avatar url={m.profiles?.avatar_url} name={m.profiles?.display_name} size={20} />
                              {m.profiles?.display_name || "کاربر"}
                            </button>
                            {m.category && (
                              <span className="inline-block rounded-full bg-[#F3F6F1] px-2 py-0.5 text-[10px] font-bold text-[#66766A]">
                                {CATEGORY_META[m.category].icon} {CATEGORY_META[m.category].label}
                              </span>
                            )}
                            <p className="whitespace-pre-wrap break-words text-sm font-bold leading-6 text-[#1D2B1F]">
                              {m.content}
                            </p>
                            <div className="flex items-center justify-between pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleReply(m)}
                                className="text-[10px] font-bold text-[#B0BAB1] transition hover:text-[#147A4B]"
                                title="پاسخ به این پیام"
                              >
                                ↩️ پاسخ
                              </button>
                              <p className="text-[10px] text-[#B0BAB1]">{timeAgo(m.created_at)}</p>
                              <div className="flex items-center gap-3">
                                {(mine || profile?.is_admin) && (
                                  <button
                                    type="button"
                                    onClick={() => deleteMessage(m.id)}
                                    className="text-[10px] text-[#B0BAB1]"
                                    title={mine ? "حذف پیام" : "حذف پیام کاربر"}
                                  >
                                    🗑️
                                  </button>
                                )}
                                {!mine && (
                                  <button
                                    onClick={() => reportUser(m.user_id, m.content)}
                                    className="text-[10px] text-[#D8DFD5]"
                                    title="گزارش"
                                  >
                                    🚩
                                  </button>
                                )}
                                <button
                                  onClick={() => toggleLike(m.id)}
                                  className={`flex items-center gap-1 text-xs font-bold transition ${
                                    liked ? "text-[#E2574C]" : "text-[#B0BAB1]"
                                  }`}
                                >
                                  {liked ? "❤️" : "🤍"} {count > 0 && count}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={`flex min-w-0 max-w-full ${mine ? "justify-start" : "justify-end"} ${showMeta ? "mt-2.5" : "mt-0.5"}`}>
                        <div className="flex min-w-0 max-w-[78%] items-end gap-1.5">
                          {!mine && (
                            <button
                              onClick={() => openChatWith(m.user_id)}
                              className={`mb-0.5 shrink-0 ${showMeta ? "" : "invisible"}`}
                            >
                              <Avatar url={m.profiles?.avatar_url} name={m.profiles?.display_name} size={26} />
                            </button>
                          )}
                          <div
                            className={`min-w-0 px-3.5 py-2 shadow-sm ${bubbleTail} ${
                              mine
                                ? "rounded-2xl bg-gradient-to-b from-[#1AA463] to-[#147A4B] text-white"
                                : "rounded-2xl border border-[#E3EBDE] bg-white text-[#1D2B1F]"
                            }`}
                          >
                            {quoted && (
                              <button
                                type="button"
                                onClick={() => {
                                  document
                                    .getElementById(`message-${quoted.id}`)
                                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                                }}
                                className={`mb-1.5 min-w-0 w-full max-w-full overflow-hidden rounded-lg border-r-4 px-2 py-1.5 text-right ${
                                  mine ? "border-white/60 bg-white/10" : "border-[#147A4B] bg-[#F7F9F4]"
                                }`}
                              >
                                <p className={`text-[10px] font-bold ${mine ? "text-white/90" : "text-[#147A4B]"}`}>
                                  پاسخ به {quoted.profiles?.display_name || "کاربر"}
                                </p>
                                <p className={`mt-0.5 truncate text-[10px] ${mine ? "text-white/70" : "text-[#8A968C]"}`}>
                                  {quoted.content || "📷 تصویر"}
                                </p>
                              </button>
                            )}

                            {showMeta && (
                              <button
                                onClick={() => openChatWith(m.user_id)}
                                className="mb-0.5 block text-[11px] font-black text-[#D98F2B]"
                              >
                                {m.profiles?.display_name || "کاربر"}
                              </button>
                            )}

                            {m.category && (
                              <span
                                className={`mb-1 mr-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  mine ? "bg-white/15 text-white" : "bg-[#F3F6F1] text-[#66766A]"
                                }`}
                              >
                                {CATEGORY_META[m.category].icon} {CATEGORY_META[m.category].label}
                              </span>
                            )}

                            {m.image_url && (
                              <button type="button" onClick={() => setLightboxUrl(m.image_url)} className="block w-full">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={m.image_url}
                                  alt=""
                                  className="mb-1 aspect-[4/3] max-h-64 w-full rounded-xl object-cover"
                                  loading="lazy"
                                  decoding="async"
                                  onLoad={() => {
                                    if (!initialScrollDone.current || showScrollDown) return;
                                    bottomRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
                                  }}
                                />
                              </button>
                            )}

                            {m.audio_url && (
                              <audio
                                controls
                                src={m.audio_url}
                                className="mb-1 h-9 w-full max-w-[224px]"
                                style={{ filter: mine ? "invert(1) hue-rotate(180deg)" : "none" }}
                              />
                            )}

                            {m.content && (
                              <p className="whitespace-pre-wrap break-words text-[13px] leading-6">{m.content}</p>
                            )}

                            <div className="mt-1 flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => handleReply(m)}
                                className={`text-[10px] font-bold ${mine ? "text-white/75" : "text-[#B0BAB1]"}`}
                                title="پاسخ به این پیام"
                              >
                                ↩️
                              </button>
                              <p className={`text-[9px] ${mine ? "text-white/70" : "text-[#B0BAB1]"}`}>
                                {timeAgo(m.created_at)}
                              </p>
                              <div className="flex items-center gap-2.5">
                                {!mine && (
                                  <button
                                    onClick={() => reportUser(m.user_id, m.content)}
                                    className="text-[10px] text-[#D8DFD5]"
                                    title="گزارش"
                                  >
                                    🚩
                                  </button>
                                )}
                                {(mine || profile?.is_admin) && (
                                  <button
                                    type="button"
                                    onClick={() => deleteMessage(m.id)}
                                    className="text-[10px] text-white/70"
                                    title={mine ? "حذف پیام" : "حذف پیام کاربر"}
                                  >
                                    🗑️
                                  </button>
                                )}
                                <button
                                  onClick={() => toggleLike(m.id)}
                                  className={`flex items-center gap-1 text-[11px] font-bold ${
                                    mine ? "text-white/90" : liked ? "text-[#E2574C]" : "text-[#B0BAB1]"
                                  }`}
                                >
                                  {liked ? "❤️" : "🤍"} {count > 0 && count}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {typingNames.length > 0 && (
              <div className="flex justify-end pt-1">
                <div className="flex items-center gap-1.5 rounded-full border border-[#E3EBDE] bg-white px-3 py-1.5 text-[10px] font-bold text-[#8A968C] shadow-sm">
                  <span className="flex gap-0.5">
                    <span className="jam-typing-dot h-1.5 w-1.5 rounded-full bg-[#147A4B]" />
                    <span className="jam-typing-dot h-1.5 w-1.5 rounded-full bg-[#147A4B]" style={{ animationDelay: "0.15s" }} />
                    <span className="jam-typing-dot h-1.5 w-1.5 rounded-full bg-[#147A4B]" style={{ animationDelay: "0.3s" }} />
                  </span>
                  {typingNames.length === 1
                    ? `${typingNames[0]} در حال نوشتن...`
                    : `${typingNames.length} نفر در حال نوشتن...`}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* دکمهٔ شناور «برو به آخرین پیام» — فقط وقتی اسکرول بالاست دیده می‌شود */}
          {showScrollDown && (
            <button
              type="button"
              onClick={() => scrollToBottom()}
              className="absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#147A4B] shadow-[0_8px_20px_rgba(20,60,40,.18)] ring-1 ring-[#E3EBDE] transition hover:bg-[#F3FAF5]"
              aria-label="برو به آخرین پیام"
            >
              ↓
            </button>
          )}
        </div>
      )}

      {profile?.is_admin && pinMenuMessage && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/20 p-3 backdrop-blur-[1px]"
          onClick={() => setPinMenuMessage(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#E3EBDE] bg-white p-3 shadow-[0_16px_40px_rgba(20,60,40,.18)]"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 px-2 text-[11px] font-black text-[#1D2B1F]">
              {pinMenuMessage.is_pinned ? "این آگهی پین شده است" : "مدیریت آگهی"}
            </p>
            <button
              type="button"
              onClick={() => handlePinMessage(pinMenuMessage)}
              className="w-full rounded-xl bg-[#147A4B] px-4 py-3 text-right text-[12px] font-black text-white"
            >
              {pinMenuMessage.is_pinned ? "📍 برداشتن پین" : "📌 پین کردن آگهی"}
            </button>
            <button
              type="button"
              onClick={() => {
                void deleteMessage(pinMenuMessage.id);
                setPinMenuMessage(null);
              }}
              className="mt-1.5 w-full rounded-xl bg-[#FFF1F0] px-4 py-3 text-right text-[12px] font-black text-[#C4473F]"
            >
              🗑️ حذف این پیام
            </button>
            <button
              type="button"
              onClick={() => setPinMenuMessage(null)}
              className="mt-1.5 w-full rounded-xl bg-[#F3F6F1] px-4 py-3 text-[12px] font-bold text-[#66766A]"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      {/* =====================================================
          نوار ارسال پیام
      ====================================================== */}
      <div className="shrink-0 space-y-1 border-t border-[#E3EBDE] bg-white px-2 pb-1.5 pt-1.5">
        {sendError && <ErrorState message={sendError} />}
        {voiceError && <ErrorState message={voiceError} />}
        {replyingTo && (
          <div className="flex items-center justify-between rounded-xl border-r-4 border-[#147A4B] bg-[#F7F9F4] px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[#147A4B]">
                در حال پاسخ به {replyingTo.profiles?.display_name || "کاربر"}
              </p>
              <p className="truncate text-[11px] text-[#8A968C]">
                {replyingTo.content || "📷 تصویر"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="mr-2 shrink-0 rounded-full bg-white px-2 py-1 text-xs text-[#66766A] shadow-sm"
              title="لغو پاسخ"
            >
              ✕
            </button>
          </div>
        )}

        {recordedBlob ? (
          // پیش‌نمایش پیام صوتی ضبط‌شده، قبل از ارسال
          <div className="flex items-center gap-2 rounded-[22px] border border-[#E3EBDE] bg-[#F7F9F4] p-2">
            <button
              type="button"
              onClick={cancelRecordedVoice}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#E2574C] shadow-sm"
              title="لغو"
            >
              ✕
            </button>
            <audio controls src={URL.createObjectURL(recordedBlob)} className="h-9 flex-1" />
            <button
              type="button"
              onClick={sendVoiceMessage}
              disabled={sending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#147A4B] text-white shadow-[0_6px_16px_rgba(20,122,75,.35)] disabled:opacity-50"
              title="ارسال پیام صوتی"
            >
              ➤
            </button>
          </div>
        ) : isRecording ? (
          // در حال ضبط
          <div className="flex items-center gap-2 rounded-[22px] border border-[#F7D4D0] bg-[#FFF5F4] p-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E2574C] text-white">
              <span className="jam-rec-dot h-2.5 w-2.5 rounded-full bg-white" />
            </span>
            <p className="flex-1 text-[12px] font-bold text-[#E2574C]">
              در حال ضبط صدا... {formatSeconds(recordSeconds)}
            </p>
            <button
              type="button"
              onClick={stopRecording}
              className="rounded-full bg-[#E2574C] px-4 py-1.5 text-[11px] font-bold text-white shadow-sm"
            >
              ⏹ پایان ضبط
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-1 rounded-[20px] border border-[#E3EBDE] bg-[#F7F9F4] p-1">
            <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-base shadow-sm transition hover:bg-[#F3FAF5]">
              📷
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              />
            </label>
            <div className="shrink-0">
              <EmojiPicker onPick={(emoji) => handleTextChange(text + emoji)} />
            </div>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="پیام خود را بنویسید..."
              rows={1}
              className="max-h-28 flex-1 resize-none rounded-xl bg-white px-3 py-2 text-sm text-[#1D2B1F] outline-none placeholder:text-[#B0BAB1]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {text.trim() || image ? (
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#147A4B] text-white shadow-[0_6px_16px_rgba(20,122,75,.35)] transition hover:brightness-110 disabled:opacity-50"
              >
                ➤
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-base text-[#147A4B] shadow-sm ring-1 ring-[#E3EBDE] transition hover:bg-[#F3FAF5]"
                title="ضبط پیام صوتی"
              >
                🎙️
              </button>
            )}
          </div>
        )}
        {image && (
          <p className="flex items-center gap-1 text-[10px] text-[#8A968C]">
            📎 تصویر انتخاب شد: {image.name}
          </p>
        )}
      </div>

      {/* لایت‌باکس تمام‌صفحهٔ تصویر */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1D2B1F]"
            aria-label="بستن"
          >
            ✕
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes jamRecPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        .jam-rec-dot { animation: jamRecPulse 1s ease-in-out infinite; }

        @keyframes jamTypingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-3px); opacity: 1; }
        }
        .jam-typing-dot { animation: jamTypingBounce 1.1s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
