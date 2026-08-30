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
  image_url: string | null;
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
    <div className="fade-in mx-auto flex max-w-md flex-col gap-6 py-16">
      <div className="text-center">
        <span className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-3xl text-white shadow-soft">
          💬
        </span>
        <h1 className="text-2xl font-extrabold text-slate-800">ورود به دیوار شهر جم</h1>
        <p className="mt-1 text-sm text-slate-400">
          فقط یک نام کاربری و رمز عبور انتخاب کنید تا وارد چت شوید
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl2 glass p-6 shadow-soft">
        {error && <ErrorState message={error} />}

        <div className="space-y-1">
          <label className="text-xs text-slate-500">نام کاربری</label>
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            dir="ltr"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
            placeholder="ali_reza"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">رمز عبور</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl2 bg-jam-green py-3 text-sm font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "در حال ورود..." : "ورود به دیوار"}
        </button>
        <p className="text-center text-[11px] text-slate-400">
          دفعه بعد با همین نام کاربری و رمز عبور وارد شوید. این حساب برای ثبت کسب و کار استفاده نمی‌شود.
        </p>
      </form>
    </div>
  );
}

export default function WallPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<WallMessage[] | null>(null);
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
  const bottomRef = useRef<HTMLDivElement>(null);

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
      const { error } = await supabase.from("wall_messages").insert({
        user_id: user.id,
        content: text.trim() || null,
        image_url,
      });
      if (error) throw error;
      setText("");
      setImage(null);
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
  <div className="fade-in fixed inset-0 h-[100dvh] min-h-0 box-border flex flex-col overflow-hidden pt-[8.5rem]">
      {memberCount !== null && (
        <div className="mb-1.5 flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-emerald-50 py-1 text-[10px] font-bold text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          {memberCount.toLocaleString("fa-IR")} عضو در دیوار شهر جم
        </div>
      )}
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-base font-extrabold text-slate-800 sm:text-xl">دیوار شهر جم</h1>
          <p className="text-[10px] text-slate-400 sm:text-xs">
            وارد شده‌اید با نام کاربری «{profile?.display_name}»
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        await navigator.clipboard.writeText(shareData.url);
        alert("لینک دیوار شهر جم کپی شد؛ می‌توانید برای دوستانتان ارسال کنید.");
      }
    }}
    className="flex h-8 items-center gap-1.5 rounded-full bg-orange-50 px-3 text-xs font-bold text-orange-600 sm:h-10"
  >
    📤
    <span>معرفی به دوستان</span>
  </button>

  <Link
    href="/chat"
    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-base sm:h-10 sm:w-10 sm:text-lg"
    title="لیست چت‌های من"
  >
    ✉️
  </Link>
</div>
      </div>

      <div className="mb-2 shrink-0 space-y-1.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchInput.trim()) startBrowse(searchInput, null);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="جستجو در آگهی‌های دیوار (مثلاً خودرو، اجاره، ...)"
            className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-800 outline-none focus:border-jam-green"
          />
          <button
            type="submit"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-jam-green text-white shadow-glow"
          >
            🔍
          </button>
        </form>
        <div className="flex gap-2">
          <button
            onClick={() => startBrowse("خودرو", null)}
            className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700"
          >
            🚗 آگهی‌های خودرو
          </button>
          <button
            onClick={() => startBrowse("املاک", null)}
            className="flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700"
          >
            🏠 آگهی‌های املاک
          </button>
        </div>
      </div>

      {browse ? (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl2 glass p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500">
              {browseResults.length > 0
                ? `${browseIndex + 1} از ${browseResults.length} آگهی`
                : "نتیجه‌ای یافت نشد"}
            </p>
            <button
              onClick={() => setBrowse(null)}
              className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-slate-600"
            >
              ✕ بستن جستجو
            </button>
          </div>

          {browseResults.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">
              آگهی‌ای با این مشخصات پیدا نشد.
            </p>
          ) : (
            (() => {
              const m = browseResults[browseIndex];
              const cat = m.category ? CATEGORY_META[m.category] : null;
              return (
                <div className="space-y-3 rounded-xl2 border border-slate-200 bg-white p-4">
                  <button
                    onClick={() => openChatWith(m.user_id)}
                    className="flex items-center gap-2 text-xs font-bold text-orange-500"
                  >
                    <Avatar url={m.profiles?.avatar_url} name={m.profiles?.display_name} size={24} />
                    {m.profiles?.display_name || "کاربر"}
                  </button>
                  {cat && (
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                      {cat.icon} {cat.label}
                    </span>
                  )}
                  {m.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image_url} alt="" className="max-h-72 w-full rounded-xl object-cover" loading="lazy" />
                  )}
                  {m.content && <p className="whitespace-pre-wrap text-sm text-slate-800">{m.content}</p>}
                  <p className="text-[10px] text-slate-400">{timeAgo(m.created_at)}</p>

                  <div className="flex items-center justify-between border-t border-black/5 pt-3">
                    <button
                      onClick={() => reportUser(m.user_id, m.content)}
                      className="text-[11px] font-bold text-slate-400"
                    >
                      🚩 گزارش
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBrowseIndex((i) => Math.min(browseResults.length - 1, i + 1))}
                        disabled={browseIndex >= browseResults.length - 1}
                        className="rounded-full bg-jam-green px-4 py-2 text-xs font-bold text-white shadow-glow disabled:opacity-40"
                      >
                        ▲ بعدی
                      </button>
                      <button
                        onClick={() => setBrowseIndex((i) => Math.max(0, i - 1))}
                        disabled={browseIndex <= 0}
                        className="rounded-full bg-black/5 px-4 py-2 text-xs font-bold text-slate-600 disabled:opacity-40"
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
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl2 glass p-4 shadow-soft">
        {messages === null ? (
          <Spinner label="در حال بارگذاری پیام‌ها..." />
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            هنوز پیامی ارسال نشده. اولین نفری باشید که پیام می‌گذارد!
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === user.id;
            const isAdCard = !!m.image_url && !!m.content;
            const liked = likedByMe.has(m.id);
            const count = likeCounts[m.id] ?? 0;

            if (isAdCard) {
              return (
                <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                  <div className="max-w-[85%] overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.image_url!} alt="" className="max-h-72 w-full object-cover" loading="lazy" decoding="async" />
                    <div className="space-y-2 p-3">
                      <button
                        onClick={() => openChatWith(m.user_id)}
                        className="flex items-center gap-2 text-[11px] font-bold text-orange-500"
                      >
                        <Avatar url={m.profiles?.avatar_url} name={m.profiles?.display_name} size={20} />
                        {m.profiles?.display_name || "کاربر"}
                      </button>
                      {m.category && (
                        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {CATEGORY_META[m.category].icon} {CATEGORY_META[m.category].label}
                        </span>
                      )}
                      <p className="whitespace-pre-wrap text-sm font-bold text-slate-800">
                        {m.content}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-slate-400">{timeAgo(m.created_at)}</p>
                        <div className="flex items-center gap-3">
                          {!mine && (
                            <button
                              onClick={() => reportUser(m.user_id, m.content)}
                              className="text-[10px] text-slate-300"
                              title="گزارش"
                            >
                              🚩
                            </button>
                          )}
                          <button
                            onClick={() => toggleLike(m.id)}
                            className={`flex items-center gap-1 text-xs font-bold ${
                              liked ? "text-red-500" : "text-slate-400"
                            }`}
                          >
                            {liked ? "❤️" : "🤍"} {count > 0 && count}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                <div className="flex max-w-[75%] items-end gap-2">
                  {!mine && (
                    <button onClick={() => openChatWith(m.user_id)} className="mb-1">
                      <Avatar url={m.profiles?.avatar_url} name={m.profiles?.display_name} size={28} />
                    </button>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2 shadow-sm ${
                      mine ? "bg-jam-green text-white" : "bg-white text-slate-800"
                    }`}
                  >
                    {!mine && (
                      <button
                        onClick={() => openChatWith(m.user_id)}
                        className="mb-0.5 text-[11px] font-bold text-orange-500"
                      >
                        {m.profiles?.display_name || "کاربر"}
                      </button>
                    )}
                    {m.category && (
                      <span className="mb-0.5 mr-1 inline-block rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold">
                        {CATEGORY_META[m.category].icon} {CATEGORY_META[m.category].label}
                      </span>
                    )}
                    {m.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.image_url}
                        alt=""
                        className="mb-1 max-h-64 w-full rounded-xl object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    {m.content && <p className="whitespace-pre-wrap text-sm">{m.content}</p>}
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p className="text-[10px] opacity-60">{timeAgo(m.created_at)}</p>
                      <div className="flex items-center gap-3">
                        {!mine && (
                          <button
                            onClick={() => reportUser(m.user_id, m.content)}
                            className="text-[10px] opacity-50"
                            title="گزارش"
                          >
                            🚩
                          </button>
                        )}
                        <button
                          onClick={() => toggleLike(m.id)}
                          className={`flex items-center gap-1 text-[11px] font-bold ${
                            mine ? "text-white/80" : liked ? "text-red-500" : "text-slate-400"
                          }`}
                        >
                          {liked ? "❤️" : "🤍"} {count > 0 && count}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      )}

      <div className="mt-2 shrink-0 space-y-1 pb-2">
        {sendError && <ErrorState message={sendError} />}
        <div className="flex items-end gap-2 rounded-xl2 glass p-2 shadow-soft">
          <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/5 text-lg">
            📷
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
          </label>
          <EmojiPicker onPick={(emoji) => setText((prev) => prev + emoji)} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="پیام خود را بنویسید..."
            rows={1}
            className="flex-1 resize-none rounded-xl2 border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-jam-green"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-jam-green text-white shadow-glow disabled:opacity-50"
          >
            ➤
          </button>
        </div>
        {image && <p className="text-xs text-slate-400">تصویر انتخاب شد: {image.name}</p>}
      </div>
    </div>
  );
}
