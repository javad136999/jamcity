"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  const supabase = createClient();

  const [messages, setMessages] = useState<Message[] | null>(null);
  const [other, setOther] = useState<OtherProfile | null>(null);
  const [text, setText] = useState("");
  const [notFoundOrForbidden, setNotFoundOrForbidden] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;

    async function load() {
      const { data: convo } = await supabase
        .from("conversations")
        .select("id, user_one, user_two")
        .eq("id", params.id)
        .maybeSingle();

      if (!convo || (convo.user_one !== user!.id && convo.user_two !== user!.id)) {
        if (active) setNotFoundOrForbidden(true);
        return;
      }

      const otherId = convo.user_one === user!.id ? convo.user_two : convo.user_one;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .eq("id", otherId)
        .maybeSingle();

      if (active) setOther(profile as OtherProfile);

      const { data: msgs } = await supabase
        .from("private_messages")
        .select("*")
        .eq("conversation_id", params.id)
        .order("created_at", { ascending: true });

      if (active) {
        setMessages((msgs as Message[]) ?? []);
        setTimeout(scrollToBottom, 100);
      }

      await supabase
        .from("private_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", params.id)
        .neq("sender_id", user!.id)
        .is("read_at", null);
    }

    load();
    return () => {
      active = false;
    };
  }, [user, params.id, supabase, scrollToBottom]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`conversation-${params.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
          filter: `conversation_id=eq.${params.id}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => (prev ? [...prev, msg] : [msg]));
          setTimeout(scrollToBottom, 100);
          if (msg.sender_id !== user.id) {
            supabase
              .from("private_messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", msg.id)
              .then(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, params.id, supabase, scrollToBottom]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !user) return;
    const content = text.trim();
    setText("");

    await supabase.from("private_messages").insert({
      conversation_id: params.id,
      sender_id: user.id,
      content,
      message_type: "text",
    });
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setSending(true);
    try {
      const media_url = await uploadSingleFile(file, "wall-images", user.id, file.name.split(".").pop());
      await supabase.from("private_messages").insert({
        conversation_id: params.id,
        sender_id: user.id,
        message_type: "image",
        media_url,
      });
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      if (!user) return;
      setSending(true);
      try {
        const media_url = await uploadSingleFile(blob, "voice-messages", user.id, "webm");
        await supabase.from("private_messages").insert({
          conversation_id: params.id,
          sender_id: user.id,
          message_type: "voice",
          media_url,
        });
      } finally {
        setSending(false);
      }
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  if (authLoading || (messages === null && !notFoundOrForbidden)) {
    return <Spinner label="در حال بارگذاری گفتگو..." />;
  }

  if (notFoundOrForbidden) {
    return (
      <div className="fade-in py-16 text-center">
        <p className="text-3xl">🚫</p>
        <p className="mt-3 font-bold text-slate-800">این گفتگو در دسترس نیست</p>
        <button
          onClick={() => router.push("/chat")}
          className="mt-4 rounded-xl2 bg-jam-green px-5 py-2 text-sm font-bold text-white"
        >
          بازگشت به پیام‌ها
        </button>
      </div>
    );
  }

  return (
    <div className="fade-in flex h-[calc(100vh-160px)] flex-col rounded-xl2 glass shadow-soft md:h-[75vh]">
      <div className="flex items-center gap-3 border-b border-black/5 p-4">
        <Link href="/chat" className="text-slate-400 hover:text-slate-700">
          ›
        </Link>
        <span className="flex h-10 w-10 overflow-hidden rounded-full bg-jam-darkgreen">
          <Avatar url={other?.avatar_url} name={other?.display_name} size={40} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800">
            {other?.display_name ?? "کاربر جم‌سیتی"}
          </p>
          <p className="text-xs text-slate-400" dir="ltr">
            @{other?.username ?? "unknown"}
          </p>
        </div>
        <button
          onClick={async () => {
            if (!user || !other) return;
            const reason = window.prompt("دلیل گزارش این کاربر را بنویسید (اختیاری):") ?? "";
            await supabase.from("reports").insert({
              reporter_id: user.id,
              reported_user_id: other.id,
              context: "chat",
              reason: reason.trim() || null,
            });
            window.alert("گزارش شما برای بررسی به پنل مدیریت ارسال شد.");
          }}
          className="text-sm text-slate-300"
          title="گزارش این کاربر"
        >
          🚩
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages && messages.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">
            هنوز پیامی ارسال نشده. اولین پیام را بفرستید 👋
          </p>
        )}
        {messages?.map((m) => {
          const mine = m.sender_id === user!.id;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[75%] rounded-xl2 px-4 py-2 text-sm ${
                  mine
                    ? "bg-jam-green text-white"
                    : "border border-slate-200 bg-white text-slate-800"
                }`}
              >
                {m.message_type === "image" && m.media_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.media_url} alt="" className="mb-1 max-h-56 w-full rounded-xl object-cover" />
                )}
                {m.message_type === "voice" && m.media_url && (
                  <audio controls src={m.media_url} className="mb-1 w-full" />
                )}
                {m.content && <p className="whitespace-pre-line">{m.content}</p>}
                <div
                  className={`mt-1 flex items-center gap-1 text-[10px] ${
                    mine ? "text-white/70" : "text-slate-400"
                  }`}
                >
                  <span>
                    {new Date(m.created_at).toLocaleTimeString("fa-IR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {mine && <span>{m.read_at ? "✓✓" : "✓"}</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-black/5 p-3">
        <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/5 text-lg">
          📷
          <input type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
        </label>
        <button
          type="button"
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg ${
            recording ? "bg-red-500 text-white" : "bg-black/5"
          }`}
          title="نگه دارید تا ضبط شود"
        >
          🎤
        </button>
        <EmojiPicker onPick={(emoji) => setText((prev) => prev + emoji)} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="پیام خود را بنویسید..."
          className="flex-1 rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-xl2 bg-jam-green px-5 py-3 text-sm font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
        >
          ارسال
        </button>
      </form>
    </div>
  );
}
