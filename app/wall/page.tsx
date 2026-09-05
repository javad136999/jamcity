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
import { getOrCreateConversation } from "@/lib/conversations";

type WallMessage = {
  id: string;
  user_id: string;
  content: string | null;
  reply_to: string | null;
  image_url: string | null;
  audio_url?: string | null;
  is_promo: boolean;
  business_id: string | null;
  category: "car" | "realestate" | null;
  created_at: string;
  profiles?: { display_name: string; avatar_url: string | null } | null;
};

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  car: { label: "خودرو", icon: "🚗" },
  realestate: { label: "املاک", icon: "🏠" },
};

function sanitizeUsername(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

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

function WallGate() {
  const supabase = createClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const clean = sanitizeUsername(username);
    if (clean.length < 3) {
      setError("نام کاربری باید حداقل ۳ حرف انگلیسی/عدد باشد.");
      return;
    }
    if (password.length < 6) {
      setError("رمز عبور باید حداقل ۶ کاراکتر باشد.");
      return;
    }

    setLoading(true);
    const email = `${clean}@wall.jamcity.local`;

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError) {
      setLoading(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: clean, account_source: "wall" } },
    });

    setLoading(false);

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes("already")) {
        setError("این نام کاربری قبلاً ثبت شده. رمز عبور را درست وارد کنید.");
      } else {
        setError("ورود با خطا مواجه شد. دوباره تلاش کنید.");
      }
    }
  }

  return (
    <div className="fade-in flex min-h-[80vh] items-center justify-center bg-[#F4F7F2] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-[0_10px_30px_rgba(20,122,75,.15)] ring-1 ring-[#E3EBDE]">
            💬
          </span>
          <h1 className="text-xl font-black text-[#1D2B1F]">دیوار شهر جم</h1>
          <p className="mt-1.5 text-[12px] leading-6 text-[#8A968C]">
            یک نام کاربری و رمز عبور انتخاب کنید تا وارد گفتگو شوید
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-[22px] border border-[#E3EBDE] bg-white p-5 shadow-[0_10px_30px_rgba(20,60,40,.06)]"
        >
          {error && <ErrorState message={error} />}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#66766A]">نام کاربری</label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              dir="ltr"
              className="w-full rounded-xl border border-[#E3EBDE] bg-[#F7F9F4] px-4 py-3 text-sm text-[#1D2B1F] outline-none transition focus:border-[#147A4B] focus:bg-white"
              placeholder="ali_reza"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#66766A]">رمز عبور</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[#E3EBDE] bg-[#F7F9F4] px-4 py-3 text-sm text-[#1D2B1F] outline-none transition focus:border-[#147A4B] focus:bg-white"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#147A4B] py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(20,122,75,.3)] transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "در حال ورود..." : "ورود به دیوار"}
          </button>

          <p className="text-center text-[10px] leading-5 text-[#B0BAB1]">
            دفعه بعد با همین نام کاربری و رمز عبور وارد شوید. این حساب برای ثبت کسب و کار استفاده نمی‌شود.
          </p>
        </form>
      </div>
    </div>
  );
}

export default function WallPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<WallMessage[] | null>(null);
  const [replyingTo, setReplyingTo] = useState<WallMessage | null>(null);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedByMe, setLikedByMe] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [browse, setBrowse] = useState<{ query: string; category: "car" | "realestate" | null } | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [browseIndex, setBrowseIndex] = useState(0);
  const [replyTo, setReplyTo] = useState<WallMessage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // فقط ظاهری: نمایش دکمهٔ «برو به آخرین پیام» وقتی کاربر اسکرول کرده بالا
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  function handleScrollArea() {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(distanceFromBottom > 240);
  }

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
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
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
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

  // =====================================================
  // آگهی‌های ویژهٔ امروز — نمایش پیام‌های انتخاب‌شده توسط
  // کرون‌جاب روزانه، با نام و آواتار واقعی کاربر اصلی
  // =====================================================
  const [dailyPicks, setDailyPicks] = useState<WallMessage[] | null>(null);

  useEffect(() => {
    if (!user) return;

    async function loadDailyPicks() {
      const today = new Date().toISOString().slice(0, 10);
      const { data: picks, error: picksError } = await supabase
  .from("wall_daily_picks")
  .select("message_id")
  .eq("picked_date", today);

if (picksError || !picks || picks.length === 0) {
  setDailyPicks([]);
  return;
}

const ids = (picks as { message_id: string }[]).map(
  (p) => p.message_id
);
      const { data: rows, error: msgError } = await supabase
        .from("wall_messages")
        .select("*")
        .in("id", ids);

      if (msgError || !rows) {
        setDailyPicks([]);
        return;
      }

      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(
        (profilesData ?? []).map((p) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }])
      );

      rows.forEach((r) => {
        r.profiles = profileMap.get(r.user_id) ?? null;
      });

      setDailyPicks(rows as WallMessage[]);
    }

    loadDailyPicks();
  }, [user]);

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
      // Fetch messages and profiles as two separate queries instead of
      // an embedded join — the embedded-resource join relies on
      // PostgREST's schema cache recognizing the foreign key, which can
      // momentarily fail right after a migration and made the wall
      // appear empty. Two plain queries are more robust.
      const { data: rawMessages, error: msgError } = await supabase
        .from("wall_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);

      if (msgError) {
        console.error("wall load error", msgError);
        setMessages([]);
        return;
      }

      const rows = (rawMessages as WallMessage[]) ?? [];

      if (rows.length > 0) {
        const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds);

        const profileMap = new Map(
          (profilesData ?? []).map((p) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }])
        );

        rows.forEach((r) => {
          r.profiles = profileMap.get(r.user_id) ?? null;
        });
      }

      setMessages(rows);
      const replies: Record<string, number> = {};

rows.forEach((r) => {
  if (r.reply_to) {
    replies[r.reply_to] = (replies[r.reply_to] ?? 0) + 1;
  }
});
      if (rows.length > 0) {
        const { data: likes } = await supabase
          .from("wall_message_likes")
          .select("message_id, user_id")
          .in(
            "message_id",
            rows.map((r) => r.id)
          );
        const counts: Record<string, number> = {};
        const mine = new Set<string>();
        (likes ?? []).forEach((l) => {
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

 const initialScrollDone = useRef(false);

useEffect(() => {
  if (messages === null || initialScrollDone.current) return;

  initialScrollDone.current = true;

  requestAnimationFrame(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "instant",
      block: "end",
    });
  });
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

  const confirmed = window.confirm("آیا مطمئن هستید می‌خواهید این پیام را حذف کنید؟");
  if (!confirmed) return;

  const { error } = await supabase
    .from("wall_messages")
    .delete()
    .eq("id", messageId)
    .eq("user_id", user.id);

  if (error) {
    console.error("delete message error:", error);
    alert("حذف پیام انجام نشد. دوباره تلاش کنید.");
    return;
  }

  setMessages((prev) =>
    prev ? prev.filter((message) => message.id !== messageId) : prev
  );
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
    browse && messages
      ? messages
          .filter(
            (m) =>
              (!browse.category || m.category === browse.category) &&
              (!browse.query || (m.content ?? "").includes(browse.query))
          )
          .slice()
          .reverse()
      : [];

  if (authLoading) return <Spinner label="در حال بررسی ورود..." />;

  if (!user) return <WallGate />;

  return (
    <div className="fade-in -mx-4 -mt-6 flex h-[86dvh] flex-col overflow-hidden rounded-b-[22px] bg-[#EAF1E7] sm:mx-0 sm:mt-0 sm:h-[78dvh] sm:rounded-[22px]">

      {/* =====================================================
          هدر دیوار — جمع‌وجور، سفید، تم روشن
      ====================================================== */}
      <div className="shrink-0 space-y-2 border-b border-[#E3EBDE] bg-white/95 px-3 pb-2 pt-2 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E3F3E9] text-lg">
              💬
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[13px] font-black text-[#1D2B1F]">دیوار شهر جم</h1>
              <p className="flex items-center gap-2 text-[10px] font-bold">
                {onlineCount !== null && (
                  <span className="flex items-center gap-1 text-[#147A4B]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#147A4B]" />
                    {onlineCount.toLocaleString("fa-IR")} آنلاین
                  </span>
                )}
                {memberCount !== null && (
                  <span className="text-[#8A968C]">· {memberCount.toLocaleString("fa-IR")} عضو</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              const shareData = {
                title: "دیوار شهر جم",
                text: "دیوار شهر جم؛ آگهی‌ها و گفتگوهای شهر جم را ببینید 👇",
                url: window.location.origin + "/wall",
              };

              if (navigator.share) {
                try {
                  await navigator.share(shareData);
                } catch {
                  // کاربر پنجره اشتراک‌گذاری را بسته است
                }
              } else {
                try {
                  await navigator.clipboard.writeText(shareData.url);
                  alert(
                    "لینک دیوار شهر جم کپی شد؛ می‌توانید برای دوستانتان ارسال کنید."
                  );
                } catch {
                  alert("کپی لینک انجام نشد.");
                }
              }
            }}
            aria-label="معرفی به دوستان"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E3EBDE] bg-white text-[13px] shadow-sm transition hover:bg-[#F3FAF5]"
          >
            📤
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchInput.trim()) startBrowse(searchInput, null);
          }}
          className="flex items-center gap-2"
        >
          <div className="flex flex-1 items-center gap-2 rounded-full border border-[#E3EBDE] bg-[#F7F9F4] px-3.5 py-2 transition focus-within:border-[#147A4B] focus-within:bg-white">
            <span className="text-[13px] text-[#B0BAB1]">🔍</span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="جستجو در آگهی‌های دیوار..."
              className="w-full bg-transparent text-[12px] text-[#1D2B1F] outline-none placeholder:text-[#B0BAB1]"
            />
          </div>
          <button
            type="submit"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#147A4B] text-white shadow-[0_6px_16px_rgba(20,122,75,.3)] transition hover:brightness-110"
          >
            🔍
          </button>
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => startBrowse("خودرو", null)}
            className="flex shrink-0 items-center gap-1 rounded-full bg-[#EAF2FF] px-2.5 py-1 text-[10px] font-bold text-[#2563EB] transition hover:bg-[#DCE9FF]"
          >
            🚗 آگهی‌های خودرو
          </button>
          <button
            type="button"
            onClick={() => startBrowse("املاک", null)}
            className="flex shrink-0 items-center gap-1 rounded-full bg-[#F4EAFF] px-2.5 py-1 text-[10px] font-bold text-[#7E22CE] transition hover:bg-[#EBDCFF]"
          >
            🏠 آگهی‌های املاک
          </button>
        </div>
      </div>

      {/* =====================================================
          آگهی‌های ویژهٔ امروز — انتخاب روزانه از بین آگهی‌های
          واقعیِ کاربران، با نام و آواتار خودشون
      ====================================================== */}
      {!browse && dailyPicks && dailyPicks.length > 0 && (
        <div className="shrink-0 space-y-1.5 border-b border-[#F0DCB4] bg-[#FFFBF2] px-3 py-2.5">
          <p className="text-[10px] font-black text-[#D98F2B]">✨ آگهی‌های ویژهٔ امروز</p>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {dailyPicks.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  const el = document.getElementById(`message-${m.id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  } else {
                    openChatWith(m.user_id);
                  }
                }}
                className="flex w-40 shrink-0 flex-col overflow-hidden rounded-2xl border border-[#F0DCB4] bg-white text-right shadow-sm"
              >
                {m.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image_url} alt="" className="h-20 w-full object-cover" loading="lazy" />
                )}
                <div className="space-y-1 p-2">
                  <p className="truncate text-[10px] font-bold text-[#1D2B1F]">
                    {m.content || "بدون توضیح"}
                  </p>
                  <p className="flex items-center gap-1 truncate text-[9px] text-[#8A968C]">
                    <Avatar url={m.profiles?.avatar_url} name={m.profiles?.display_name} size={14} />
                    {m.profiles?.display_name || "کاربر"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

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
                    <img src={m.image_url} alt="" className="max-h-72 w-full rounded-2xl object-cover" loading="lazy" />
                  )}
                  {m.content && <p className="whitespace-pre-wrap text-sm leading-7 text-[#1D2B1F]">{m.content}</p>}
                  <p className="text-[10px] text-[#B0BAB1]">{timeAgo(m.created_at)}</p>

                  <div className="flex items-center justify-between border-t border-[#F0F3EE] pt-3">
                    <button
                      onClick={() => reportUser(m.user_id, m.content)}
                      className="text-[11px] font-bold text-[#B0BAB1]"
                    >
                      🚩 گزارش
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBrowseIndex((i) => Math.min(browseResults.length - 1, i + 1))}
                        disabled={browseIndex >= browseResults.length - 1}
                        className="rounded-full bg-[#147A4B] px-4 py-2 text-[11px] font-bold text-white shadow-[0_6px_16px_rgba(20,122,75,.3)] disabled:opacity-40"
                      >
                        ▲ بعدی
                      </button>
                      <button
                        onClick={() => setBrowseIndex((i) => Math.max(0, i - 1))}
                        disabled={browseIndex <= 0}
                        className="rounded-full border border-[#E3EBDE] bg-white px-4 py-2 text-[11px] font-bold text-[#66766A] disabled:opacity-40"
                      >
                        ▼ قبلی
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollAreaRef}
            onScroll={handleScrollArea}
            className="h-full min-h-0 space-y-1 overflow-y-auto bg-[#EAF1E7] px-3 py-3"
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
                  ? messages?.find((msg) => msg.id === m.reply_to)
                  : null;
                const isAdCard = !!m.image_url && !!m.content;
                const liked = likedByMe.has(m.id);
                const count = likeCounts[m.id] ?? 0;

                const prev = index > 0 ? messages[index - 1] : null;
                const showDateDivider =
                  !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
                const showMeta = !mine && (!prev || prev.user_id !== m.user_id || showDateDivider);

                const bubbleTail = mine ? "rounded-br-md" : "rounded-bl-md";

                return (
                  <div key={m.id} id={`message-${m.id}`}>
                    {showDateDivider && (
                      <div className="my-3 flex items-center justify-center">
                        <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold text-[#8A968C] shadow-sm">
                          {dateDividerLabel(m.created_at)}
                        </span>
                      </div>
                    )}

                    {isAdCard ? (
                      <div className={`flex ${mine ? "justify-start" : "justify-end"} ${showMeta ? "mt-2" : "mt-0.5"}`}>
                        <div
                          className={`max-w-[80%] overflow-hidden rounded-2xl border border-[#F0DCB4] bg-white shadow-[0_4px_16px_rgba(20,60,40,.06)] ${bubbleTail}`}
                        >
                          <button type="button" onClick={() => setLightboxUrl(m.image_url)} className="block w-full">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.image_url!} alt="" className="max-h-72 w-full object-cover" loading="lazy" decoding="async" />
                          </button>
                          <div className="space-y-2 p-3">
                            {quoted && (
                              <button
                                type="button"
                                onClick={() => {
                                  document
                                    .getElementById(`message-${quoted.id}`)
                                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                                }}
                                className="w-full rounded-lg border-r-4 border-[#147A4B] bg-[#F7F9F4] px-3 py-2 text-right"
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
                            <p className="whitespace-pre-wrap text-sm font-bold leading-6 text-[#1D2B1F]">
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
                                {mine && (
                                  <button
                                    type="button"
                                    onClick={() => deleteMessage(m.id)}
                                    className="text-[10px] text-[#B0BAB1]"
                                    title="حذف پیام"
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
                      <div className={`flex ${mine ? "justify-start" : "justify-end"} ${showMeta ? "mt-2.5" : "mt-0.5"}`}>
                        <div className="flex max-w-[78%] items-end gap-1.5">
                          {!mine && (
                            <button
                              onClick={() => openChatWith(m.user_id)}
                              className={`mb-0.5 shrink-0 ${showMeta ? "" : "invisible"}`}
                            >
                              <Avatar url={m.profiles?.avatar_url} name={m.profiles?.display_name} size={26} />
                            </button>
                          )}
                          <div
                            className={`px-3.5 py-2 shadow-sm ${bubbleTail} ${
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
                                className={`mb-1.5 w-full rounded-lg border-r-4 px-2 py-1.5 text-right ${
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
                                  className="mb-1 max-h-64 w-full rounded-xl object-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </button>
                            )}

                            {m.audio_url && (
                              <audio
                                controls
                                src={m.audio_url}
                                className="mb-1 h-9 w-56 max-w-full"
                                style={{ filter: mine ? "invert(1) hue-rotate(180deg)" : "none" }}
                              />
                            )}

                            {m.content && (
                              <p className="whitespace-pre-wrap text-[13px] leading-6">{m.content}</p>
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
                                {mine && (
                                  <button
                                    type="button"
                                    onClick={() => deleteMessage(m.id)}
                                    className="text-[10px] text-white/70"
                                    title="حذف پیام"
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

      {/* =====================================================
          نوار ارسال پیام
      ====================================================== */}
      <div className="shrink-0 space-y-1.5 border-t border-[#E3EBDE] bg-white px-2.5 pb-2 pt-2">
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
          <div className="flex items-end gap-1.5 rounded-[22px] border border-[#E3EBDE] bg-[#F7F9F4] p-1.5">
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
