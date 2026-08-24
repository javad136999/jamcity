"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_EMAIL } from "@/lib/constants";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  onboarded: boolean;
  is_wall_account: boolean;
  banned: boolean;
  created_at: string;
};

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  unreadCount: number;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  unreadCount: 0,
  isAdmin: false,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadProfile = useCallback(
    async (uid: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      const p = data as Profile | null;
      if (p?.banned) {
        setProfile(p);
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        if (typeof window !== "undefined") {
          window.alert("این حساب کاربری به دلیل تخلف مسدود شده است.");
        }
        return;
      }
      setProfile(p);
    },
    [supabase]
  );

  const loadUnread = useCallback(
    async (uid: string) => {
      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(`user_one.eq.${uid},user_two.eq.${uid}`);
      const ids = (convos ?? []).map((c) => c.id);
      if (ids.length === 0) {
        setUnreadCount(0);
        return;
      }
      const { count } = await supabase
        .from("private_messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", ids)
        .neq("sender_id", uid)
        .is("read_at", null);
      setUnreadCount(count ?? 0);
    },
    [supabase]
  );

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user);
      if (data.user) {
        loadProfile(data.user.id);
        loadUnread(data.user.id);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
        loadUnread(session.user.id);
      } else {
        setProfile(null);
        setUnreadCount(0);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "private_messages" },
        () => loadUnread(user.id)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "private_messages" },
        () => loadUnread(user.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, loadUnread]);

  const isAdmin = !!user?.email && user.email.toLowerCase() === ADMIN_EMAIL;

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, unreadCount, isAdmin, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
