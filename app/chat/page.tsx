"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/Feedback";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/constants";

type ConversationRow = {
  id: string;
  user_one: string;
  user_two: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type ChatItem = {
  id: string;
  otherId: string;
  otherName: string;
  otherUsername: string;
  otherAvatar: string | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
};

export default function ChatListPage() {
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ChatItem[] | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!user) return;

    const { data: convos } = await supabase
      .from("conversations")
      .select("id, user_one, user_two, created_at")
      .or(`user_one.eq.${user.id},user_two.eq.${user.id}`)
      .returns<ConversationRow[]>();

    if (!convos || convos.length === 0) {
      setItems([]);
      return;
    }

    const otherIds = convos.map((conversation) =>
      conversation.user_one === user.id ? conversation.user_two : conversation.user_one
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", otherIds)
      .returns<ProfileRow[]>();

    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const results: ChatItem[] = [];

    for (const conversation of convos) {
      const otherId = conversation.user_one === user.id ? conversation.user_two : conversation.user_one;
      const other = profileMap.get(otherId);

      const { data: lastMessage } = await supabase
        .from("private_messages")
        .select("content, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count: unread } = await supabase
        .from("private_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversation.id)
        .neq("sender_id", user.id)
        .is("read_at", null);

      results.push({
        id: conversation.id,
        otherId,
        otherName: other?.display_name ?? "کاربر جم‌سیتی",
        otherUsername: other?.username ?? "unknown",
        otherAvatar: other?.avatar_url ?? null,
        lastMessage: lastMessage?.content ?? "گفتگو تازه شروع شده",
        lastAt: lastMessage?.created_at ?? conversation.created_at,
        unread: unread ?? 0,
      });
    }

    results.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
    setItems(results);
  }, [supabase, user]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chat-list-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "private_messages" },
        () => void load()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, supabase, load]);

  const filteredItems = (items ?? []).filter((item) => {
    const value = query.trim().toLowerCase();
    if (!value) return true;
    return `${item.otherName} ${item.otherUsername} ${item.lastMessage}`.toLowerCase().includes(value);
  });

  if (authLoading || items === null) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#faf7f2] p-4 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="h-10 w-40 animate-pulse rounded-2xl bg-[#eee7df]" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-[22px] border border-[#eee5dc] bg-white" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#faf7f2] px-3 py-4 text-[#34271f] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black tracking-[0.22em] text-[#bd7b32]">JAM CITY</p>
            <h1 className="mt-1 text-2xl font-black text-[#34271f] sm:text-3xl">پیام‌ها</h1>
            <p className="mt-1 text-xs text-[#98877a]">گفت‌وگوهای خصوصی شما با همشهری‌ها</p>
          </div>
          <Link href="/" className="rounded-2xl border border-[#eaded2] bg-white px-3 py-2 text-xs font-bold text-[#715d4d] shadow-sm transition hover:-translate-y-0.5 hover:border-[#d8b078]">بازگشت به خانه</Link>
        </header>

        <section className="overflow-hidden rounded-[28px] border border-[#eadfd4] bg-white shadow-[0_18px_55px_rgba(93,65,39,.09)]">
          <div className="border-b border-[#f0e8df] bg-gradient-to-l from-[#fffaf3] to-white p-4 sm:p-5">
            <div className="relative">
              <span className="pointer-events-none absolute right-4 top-3 text-lg text-[#b19d8b]">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی نام، نام کاربری یا پیام..." className="w-full rounded-2xl border border-[#eee3d8] bg-[#faf7f2] py-3 pr-11 pl-4 text-sm text-[#34271f] outline-none transition placeholder:text-[#b1a297] focus:border-[#d39a51] focus:bg-white focus:ring-4 focus:ring-[#d39a51]/10" />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-bold text-[#8e7e70]">{filteredItems.length} گفت‌وگو</span>
              <button type="button" onClick={() => void load()} className="rounded-xl bg-[#f8efe5] px-3 py-2 text-xs font-bold text-[#a66b2e] transition hover:bg-[#f3e4d3]">↻ تازه‌سازی</button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="p-6"><EmptyState icon="💬" title="هنوز گفتگویی ندارید" description="از داخل صفحهٔ یک آگهی روی «ارسال پیام» بزنید تا گفتگو شروع شود." /></div>
          ) : filteredItems.length === 0 ? (
            <div className="px-6 py-16 text-center"><div className="text-4xl">⌕</div><h2 className="mt-3 font-black">نتیجه‌ای پیدا نشد</h2><p className="mt-1 text-xs text-[#9a8b7f]">عبارت جست‌وجو را تغییر دهید.</p></div>
          ) : (
            <div className="divide-y divide-[#f3ece5]">
              {filteredItems.map((item) => (
                <Link key={item.id} href={`/chat/${item.id}`} className="group flex items-center gap-3 px-4 py-4 transition hover:bg-[#fffaf4] sm:gap-4 sm:px-5">
                  <span className="relative flex h-13 w-13 shrink-0 overflow-hidden rounded-[18px] bg-[#285f46] ring-2 ring-white shadow-md sm:h-14 sm:w-14"><Avatar url={item.otherAvatar} name={item.otherName} size={56} />{item.unread > 0 && <span className="absolute bottom-0 left-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#43a66b]" />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="truncate text-sm font-black text-[#3d3028] sm:text-base">{item.otherName}</p>{item.unread > 0 && <span className="rounded-full bg-[#d88b39] px-2 py-0.5 text-[10px] font-black text-white">جدید</span>}</div>
                    <p className={`mt-1 truncate text-xs sm:text-sm ${item.unread > 0 ? "font-bold text-[#6e5745]" : "text-[#9b8c80]"}`}>{item.lastMessage}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2"><span className="text-[10px] text-[#aa9b8e] sm:text-xs">{timeAgo(item.lastAt)}</span>{item.unread > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#2f7657] px-1.5 text-[11px] font-black text-white">{item.unread}</span>}</div>
                  <span className="hidden text-xl text-[#c2b2a3] transition group-hover:-translate-x-1 group-hover:text-[#b47735] sm:block">‹</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
