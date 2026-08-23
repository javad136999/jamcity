"use client";

import { useEffect, useState, useCallback } from "react";
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
  const supabase = createClient();
  const [items, setItems] = useState<ChatItem[] | null>(null);

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

    const otherIds = convos.map((c) =>
      c.user_one === user.id ? c.user_two : c.user_one
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", otherIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const results: ChatItem[] = [];

    for (const c of convos) {
      const otherId = c.user_one === user.id ? c.user_two : c.user_one;
      const other = profileMap.get(otherId);

      const { data: lastMsg } = await supabase
        .from("private_messages")
        .select("content, created_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count: unread } = await supabase
        .from("private_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .neq("sender_id", user.id)
        .is("read_at", null);

      results.push({
        id: c.id,
        otherId,
        otherName: other?.display_name ?? "کاربر جم‌سیتی",
        otherUsername: other?.username ?? "unknown",
        otherAvatar: other?.avatar_url ?? null,
        lastMessage: lastMsg?.content ?? "گفتگو تازه شروع شده",
        lastAt: lastMsg?.created_at ?? c.created_at,
        unread: unread ?? 0,
      });
    }

    results.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
    setItems(results);
  }, [user, supabase]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chat-list-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "private_messages" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, load]);

  if (authLoading || items === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-20 rounded-xl2" />
        ))}
      </div>
    );
  }

  return (
    <div className="fade-in space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-800">پیام‌ها</h1>

      {items.length === 0 ? (
        <EmptyState
          icon="💬"
          title="هنوز گفتگویی ندارید"
          description="از داخل صفحه یک آگهی روی «ارسال پیام» بزنید تا گفتگو شروع شود."
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/chat/${item.id}`}
              className="flex items-center gap-3 rounded-xl2 glass p-3 shadow-soft transition hover:bg-white"
            >
              <span className="flex h-12 w-12 shrink-0 overflow-hidden rounded-full bg-jam-darkgreen">
                <Avatar url={item.otherAvatar} name={item.otherName} size={48} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-bold text-slate-800">
                    {item.otherName}
                  </p>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {timeAgo(item.lastAt)}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-400">{item.lastMessage}</p>
              </div>
              {item.unread > 0 && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-jam-green text-[11px] font-bold text-slate-800">
                  {item.unread}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
