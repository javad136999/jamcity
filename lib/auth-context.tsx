"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { canonicalCitySlug, FALLBACK_JAM_CITY, type City } from "@/lib/cities";

const CITY_COOKIE = "jamcity_city_slug";

function persistCitySlug(slug: string, cityId?: string) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const attributes = `Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  document.cookie = `${CITY_COOKIE}=${encodeURIComponent(slug)}; ${attributes}`;
  if (cityId) document.cookie = `jamcity_city_id=${encodeURIComponent(cityId)}; ${attributes}`;
}

function readCitySlug() {
  if (typeof document === "undefined") return null;
  const entry = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${CITY_COOKIE}=`));
  return entry ? decodeURIComponent(entry.slice(CITY_COOKIE.length + 1)) : null;
}

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  onboarded: boolean;
  is_wall_account: boolean;
  banned: boolean;
  is_admin: boolean;
  created_at: string;
  city_id: string;
};

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  unreadCount: number;
  wallUnreadCount: number;
  isAdmin: boolean;
  markWallRead: (seenAt?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  city: City;
  cities: City[];
  setCity: (cityId: string) => Promise<void>;
  refreshCities: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  unreadCount: 0,
  wallUnreadCount: 0,
  isAdmin: false,
  markWallRead: async () => {},
  refreshProfile: async () => {},
  city: FALLBACK_JAM_CITY,
  cities: [],
  setCity: async () => {},
  refreshCities: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [city, setCityState] = useState<City>(FALLBACK_JAM_CITY);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [wallUnreadCount, setWallUnreadCount] = useState(0);

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

  const loadWallUnread = useCallback(
    async (uid: string) => {
      if (!city.id) {
        setWallUnreadCount(0);
        return;
      }
      const { data: state, error: stateError } = await supabase
        .from("wall_read_state")
        .select("last_read_at")
        .eq("user_id", uid)
        .maybeSingle();

      if (stateError) {
        console.error("wall unread state error", stateError);
        setWallUnreadCount(0);
        return;
      }

      if (!state) {
        const now = new Date().toISOString();
        const { error: insertError } = await supabase
          .from("wall_read_state")
          .insert({ user_id: uid, last_read_at: now, updated_at: now });
        if (insertError) console.error("wall read state insert error", insertError);
        setWallUnreadCount(0);
        return;
      }

      const { count, error: countError } = await supabase
        .from("wall_messages")
        .select("id", { count: "exact", head: true })
        .gt("created_at", state.last_read_at)
        .eq("city_id", city.id)
        .neq("user_id", uid);

      if (countError) {
        console.error("wall unread count error", countError);
        setWallUnreadCount(0);
        return;
      }

      setWallUnreadCount(count ?? 0);
    },
    [supabase, city.id]
  );

  const markWallRead = useCallback(
    async (seenAt?: string) => {
      if (!user) return;
      const timestamp = seenAt ?? new Date().toISOString();
      const { error } = await supabase.from("wall_read_state").upsert(
        {
          user_id: user.id,
          last_read_at: timestamp,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) {
        console.error("wall read state update error", error);
        return;
      }
      setWallUnreadCount(0);
    },
    [supabase, user]
  );

  const setCity = useCallback(async (cityId: string) => {
    const selected = cities.find((item) => item.id === cityId);
    if (!selected) return;
    setCityState(selected);
    persistCitySlug(selected.slug, selected.id);
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ city_id: cityId }).eq("id", user.id);
    if (error) console.error("city update error", error);
  }, [supabase, user, cities]);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const refreshCities = useCallback(async () => {
    const { data } = await supabase.from("cities").select("*").eq("is_active", true).order("name");
    if (data?.length) setCities(data as City[]);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    void refreshCities();

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user);
      if (data.user) {
        loadProfile(data.user.id);
        loadUnread(data.user.id);
        loadWallUnread(data.user.id);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
        loadUnread(session.user.id);
        loadWallUnread(session.user.id);
      } else {
        setProfile(null);
        setUnreadCount(0);
        setWallUnreadCount(0);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCities]);

  useEffect(() => {
    if (user && city.id) void loadWallUnread(user.id);
  }, [user, city.id, loadWallUnread]);

  useEffect(() => {
    if (!cities.length) return;

    const firstPathSegment = pathname.split("/").filter(Boolean)[0] ?? "";
    const routeSlug = canonicalCitySlug(firstPathSegment);
    const routeCity = cities.find((item) => item.slug === routeSlug);
    const savedSlug = readCitySlug();
    const savedCity = savedSlug
      ? cities.find((item) => item.slug === canonicalCitySlug(savedSlug))
      : undefined;
    const profileCity = profile?.city_id
      ? cities.find((item) => item.id === profile.city_id)
      : undefined;
    const jamCity = cities.find((item) => item.slug === "jam");
    const nextCity = routeCity ?? savedCity ?? profileCity ?? jamCity ?? cities[0];

    setCityState(nextCity);
    persistCitySlug(nextCity.slug, nextCity.id);
  }, [cities, pathname, profile?.city_id]);

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

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`wall-unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wall_messages" },
        () => loadWallUnread(user.id)
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "wall_messages" },
        () => loadWallUnread(user.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, loadWallUnread]);

  const isAdmin = profile?.is_admin === true;
  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        unreadCount,
        wallUnreadCount,
        isAdmin,
        markWallRead,
        refreshProfile,
        city,
        cities,
        setCity,
        refreshCities,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
