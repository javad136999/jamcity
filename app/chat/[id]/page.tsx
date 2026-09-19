"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { uploadSingleFile } from "@/lib/upload";
import { Spinner } from "@/components/Feedback";
import Avatar from "@/components/Avatar";
import EmojiPicker from "@/components/EmojiPicker";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: "text" | "image" | "voice";
  media_url: string | null;
  created_at: string;
  read_at: string | null;
};

type OtherProfile = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
};

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [other, setOther] = useState<OtherProfile | null>(null);
  const [text, setText] = useState("");
  const [notFoundOrForbidden, setNotFoundOrForbidden] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!user) return;
    const currentUserId = user.id;
    let active = true;

    async function load() {
      const { data: convo } = await supabase.from("conversations").select("id, user_one, user_two").eq("id", params.id).maybeSingle();

      if (!convo || (convo.user_one !== currentUserId && convo.user_two !== currentUserId)) {
        if (active) setNotFoundOrForbidden(true);
        return;
      }

      const otherId = convo.user_one === currentUserId ? convo.user_two : convo.user_one;
      const { data: profile } = await supabase.from("profiles").select("id, display_name, username, avatar_url").eq("id", otherId).maybeSingle();

      if (active) setOther(profile as OtherProfile);

      const { data: msgs } = await supabase.from("private_messages").select("*").eq("conversation_id", params.id).order("created_at", { ascending: true });

      if (active) {
        setMessages((msgs as Message[]) ?? []);
        window.setTimeout(scrollToBottom, 100);
      }

      await supabase.from("private_messages").update({ read_at: new Date().toISOString() }).eq("conversation_id", params.id).neq("sender_id", currentUserId).is("read_at", null);
    }

    void load();
    return () => { active = false; };
  }, [user, params.id, supabase, scrollToBottom]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`conversation-${params.id}`).on("postgres_changes", {
      event: "INSERT", schema: "public", table: "private_messages", filter: `conversation_id=eq.${params.id}`,
    }, (payload) => {
      const msg = payload.new as Message;
      setMessages((previous) => {
        if (!previous || previous.some((item) => item.id === msg.id)) return previous ?? [msg];
        return [...previous, msg];
      });
      window.setTimeout(scrollToBottom, 100);
      if (msg.sender_id !== user.id) {
        void supabase.from("private_messages").update({ read_at: new Date().toISOString() }).eq("id", msg.id);
      }
    }).subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user, params.id, supabase, scrollToBottom]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || !user || sending) return;
    const content = text.trim();
    setText("");
    setSending(true);
    try {
      await supabase.from("private_messages").insert({ conversation_id: params.id, sender_id: user.id, content, message_type: "text" });
    } finally { setSending(false); }
  }

  async function handleImagePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    setSending(true);
    try {
      const media_url = await uploadSingleFile(file, "wall-images", user.id, file.name.split(".").pop());
      await supabase.from("private_messages").insert({ conversation_id: params.id, sender_id: user.id, message_type: "image", media_url });
    } finally { setSending(false); }
  }

  async function startRecording() {
    if (!navigator.mediaDevices || recording) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      if (!user) return;
      setSending(true);
      try {
        const media_url = await uploadSingleFile(blob, "voice-messages", user.id, "webm");
        await supabase.from("private_messages").insert({ conversation_id: params.id, sender_id: user.id, message_type: "voice", media_url });
      } finally { setSending(false); }
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    setRecording(false);
  }

  async function reportUser() {
    if (!user || !other) return;
    const reason = window.prompt("دلیل گزارش این کاربر را بنویسید (اختیاری):") ?? "";
    await supabase.from("reports").insert({ reporter_id: user.id, reported_user_id: other.id, context: "chat", reason: reason.trim() || null });
    window.alert("گزارش شما برای بررسی به پنل مدیریت ارسال شد.");
  }

  if (authLoading || (messages === null && !notFoundOrForbidden)) {
    return <div dir="rtl" className="min-h-[500px] bg-[#faf7f2] p-8"><Spinner label="در حال بارگذاری گفتگو..." /></div>;
  }

  if (notFoundOrForbidden) {
    return <main dir="rtl" className="flex min-h-[520px] items-center justify-center bg-[#faf7f2] p-5"><div className="w-full max-w-sm rounded-[28px] border border-[#eadfd4] bg-white p-8 text-center shadow-[0_18px_55px_rgba(93,65,39,.1)]"><p className="text-4xl">🚫</p><p className="mt-4 font-black text-[#3d3028]">این گفتگو در دسترس نیست</p><button onClick={() => router.push("/chat")} className="mt-5 rounded-2xl bg-[#2f7657] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5">بازگشت به پیام‌ها</button></div></main>;
  }

  return (
    <main dir="rtl" className="h-[calc(100dvh-112px)] max-h-[calc(100dvh-112px)] overflow-hidden bg-[#faf7f2] p-0 text-[#34271f] sm:h-auto sm:max-h-none sm:min-h-[calc(100vh-110px)] sm:overflow-visible sm:p-4 lg:p-6">
      <div className="mx-auto flex h-full min-h-0 max-w-6xl overflow-hidden border-y border-[#eadfd4] bg-white shadow-[0_18px_60px_rgba(93,65,39,.1)] sm:h-[calc(100dvh-142px)] sm:min-h-[560px] sm:rounded-[30px] sm:border">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="shrink-0 flex items-center gap-2 border-b border-[#eee5dc] bg-gradient-to-l from-[#fffaf3] to-white px-2.5 py-2 sm:gap-3 sm:px-6 sm:py-4">
            <Link href="/chat" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f7efe5] text-lg text-[#a56b2e] transition hover:-translate-x-1 sm:h-10 sm:w-10 sm:rounded-2xl sm:text-xl" aria-label="بازگشت به پیام‌ها">›</Link>
            <span className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-[15px] bg-[#285f46] ring-2 ring-white shadow-md sm:h-12 sm:w-12 sm:rounded-[18px]"><Avatar url={other?.avatar_url} name={other?.display_name} size={40} /><i className="absolute bottom-0 left-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#43a66b]" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-[#3d3028] sm:text-base">{other?.display_name ?? "کاربر جم‌سیتی"}</p><p className="mt-0.5 truncate text-[10px] text-[#2f7657] sm:text-xs">● آنلاین</p></div>
            <button type="button" onClick={() => setShowDetails((value) => !value)} className={`rounded-2xl px-3 py-2 text-xl transition ${showDetails ? "bg-[#f6eadb] text-[#ae712d]" : "text-[#9a897b] hover:bg-[#f8f1e9]"}`} aria-label="اطلاعات گفتگو">ⓘ</button>
            <button type="button" onClick={() => void reportUser()} className="hidden rounded-2xl px-3 py-2 text-lg text-[#b8a79a] transition hover:bg-[#fff0ed] hover:text-[#c85e51] sm:block" title="گزارش این کاربر">⚑</button>
          </header>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(236,213,177,.3),transparent_28%),#fbfaf7]">
            <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(#c8a576_0.7px,transparent_0.7px)] [background-size:22px_22px]" />
            <div className="relative h-full min-h-0 space-y-2 overflow-y-auto overscroll-contain px-2.5 py-3 [scrollbar-width:thin] [scrollbar-color:#d9c2a7_transparent] sm:space-y-3 sm:px-8 sm:py-6">
              <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-[#eee3d8] bg-white/85 px-4 py-2 text-[10px] font-bold text-[#9b8b7f] shadow-sm">امروز · گفت‌وگوی خصوصی و امن</div>
              {messages && messages.length === 0 && <p className="py-16 text-center text-sm text-[#9b8b7f]">هنوز پیامی ارسال نشده؛ اولین پیام را بفرستید 👋</p>}
              {messages?.map((message) => {
                const mine = message.sender_id === user!.id;
                return <div key={message.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}><div className={`max-w-[84%] sm:max-w-[65%] ${mine ? "items-start" : "items-end"} flex flex-col`}><div className={`rounded-[22px] px-4 py-3 text-sm leading-7 shadow-sm ${mine ? "rounded-bl-md bg-[#2f7657] text-white" : "rounded-br-md border border-[#eee3d8] bg-white text-[#44362e]"}`}>
                  {message.message_type === "image" && message.media_url && <img src={message.media_url} alt="تصویر ارسال‌شده" className="mb-1 max-h-64 w-full rounded-2xl object-cover" />}
                  {message.message_type === "voice" && message.media_url && <audio controls src={message.media_url} className="mb-1 max-w-full" />}
                  {message.content && <p className="whitespace-pre-line">{message.content}</p>}
                  <div className={`mt-1 flex items-center gap-1 text-[10px] ${mine ? "text-white/70" : "text-[#a09287]"}`}><span>{new Date(message.created_at).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}</span>{mine && <span>{message.read_at ? "✓✓" : "✓"}</span>}</div>
                </div></div></div>;
              })}
              <div ref={bottomRef} />
            </div>
          </div>

          <form onSubmit={handleSend} className="shrink-0 border-t border-[#eee5dc] bg-white p-2 pb-[max(.45rem,env(safe-area-inset-bottom))] sm:p-4">
            <div className="flex items-end gap-2">
              <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-[#f7f0e8] text-lg text-[#9a7651] transition hover:bg-[#f0e3d4]" title="ارسال تصویر">📷<input type="file" accept="image/*" className="hidden" onChange={handleImagePick} /></label>
              <button type="button" onMouseDown={() => void startRecording()} onMouseUp={stopRecording} onTouchStart={() => void startRecording()} onTouchEnd={stopRecording} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg transition ${recording ? "bg-[#d9534f] text-white shadow-lg" : "bg-[#f7f0e8] text-[#9a7651] hover:bg-[#f0e3d4]"}`} title="برای ضبط نگه دارید">🎤</button>
              <EmojiPicker onPick={(emoji) => setText((previous) => previous + emoji)} />
              <input value={text} onChange={(event) => setText(event.target.value)} placeholder="پیام خود را بنویسید..." className="min-w-0 flex-1 rounded-2xl border border-[#eee3d8] bg-[#faf7f2] px-3 py-3 text-sm text-[#34271f] outline-none transition placeholder:text-[#ad9d90] focus:border-[#d39a51] focus:bg-white focus:ring-4 focus:ring-[#d39a51]/10 sm:px-4" />
              <button type="submit" disabled={sending || !text.trim()} className="rounded-2xl bg-[#2f7657] px-3.5 py-3 text-sm font-black text-white shadow-[0_8px_20px_rgba(47,118,87,.2)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5">ارسال</button>
            </div>
            <p className="mt-1 hidden px-1 text-[10px] text-[#aa9b8e] sm:block">پیام‌های شما با اتصال زنده ارسال و به‌روزرسانی می‌شوند.</p>
          </form>
        </section>

        {showDetails && <aside className="hidden w-64 border-r border-[#eee5dc] bg-[#fffdfa] p-5 lg:block"><div className="text-center"><span className="mx-auto flex h-24 w-24 overflow-hidden rounded-[28px] bg-[#285f46] shadow-lg"><Avatar url={other?.avatar_url} name={other?.display_name} size={96} /></span><h2 className="mt-4 font-black">{other?.display_name ?? "کاربر جم‌سیتی"}</h2><span className="mt-3 inline-flex rounded-full bg-[#edf6ef] px-3 py-1 text-[10px] font-bold text-[#2f7657]">● آنلاین</span></div><div className="mt-8 space-y-2"><button type="button" className="w-full rounded-xl bg-[#f7f0e8] px-3 py-3 text-right text-xs font-bold text-[#695548]">📌 پیام‌های نشان‌شده</button><button type="button" className="w-full rounded-xl bg-[#f7f0e8] px-3 py-3 text-right text-xs font-bold text-[#695548]">🔔 اعلان‌های گفتگو</button><button type="button" onClick={() => void reportUser()} className="w-full rounded-xl bg-[#fff0ed] px-3 py-3 text-right text-xs font-bold text-[#c85e51]">⚑ گزارش کاربر</button></div></aside>}
      </div>
    </main>
  );
}
