"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { businessCategoryLabel, tierMeta, BUSINESS_CATEGORIES } from "@/lib/constants";
import { Spinner } from "@/components/Feedback";
import type { MapMarker } from "@/components/LeafletMap";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => <Spinner label="در حال بارگذاری نقشه..." />,
});

type BizRow = {
  id: string;
  name: string;
  category: string;
  icon: string;
  lat: number | null;
  lng: number | null;
  subscription_tier: "bronze" | "silver" | "gold" | null;
  rating_avg: number;
  rating_count: number;
};

export default function HomePage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [allBusinesses, setAllBusinesses] = useState<BizRow[] | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [featured, setFeatured] = useState<BizRow[] | null>(null);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.refresh();
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("businesses")
        .select("id, name, category, icon, lat, lng, subscription_tier, rating_avg, rating_count")
        .eq("subscription_status", "approved");

      const rows = (data ?? []) as BizRow[];
      setAllBusinesses(rows);
      setFeatured(rows.filter((b) => b.subscription_tier));
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markers: MapMarker[] = useMemo(() => {
    const visible = (allBusinesses ?? []).filter(
      (b) => !activeCategory || b.category === activeCategory
    );
    return visible
      .filter((b) => b.lat !== null && b.lng !== null)
      .map((b) => ({
        id: b.id,
        lat: b.lat as number,
        lng: b.lng as number,
        title: b.name,
        subtitle: businessCategoryLabel(b.category),
        href: `/business/${b.id}`,
        emoji: b.icon,
        tier: b.subscription_tier,
        rating: b.rating_count > 0 ? b.rating_avg : null,
      }));
  }, [allBusinesses, activeCategory]);

  const presentCategories = useMemo(
    () =>
      Array.from(new Set((allBusinesses ?? []).map((b) => b.category)))
        .map((slug) => BUSINESS_CATEGORIES.find((c) => c.slug === slug))
        .filter((c): c is (typeof BUSINESS_CATEGORIES)[number] => !!c),
    [allBusinesses]
  );

  const gold = (featured ?? []).filter((b) => b.subscription_tier === "gold");
  const bronze = (featured ?? []).filter((b) => b.subscription_tier === "bronze" || b.subscription_tier === "silver");

  return (
    <div className="fade-in space-y-3 sm:space-y-8">
      <section className="rounded-2xl glass px-3 py-2.5 shadow-soft sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-slate-800 sm:text-lg">شهر جم</p>
            <p className="text-[10px] text-slate-400 sm:text-xs">
              {user ? `خوش آمدید، ${profile?.display_name || "کاربر"}` : "پلتفرم شهری جم"}
            </p>
          </div>
          {user ? (
            <button
              onClick={handleLogout}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold text-red-500 shadow-soft transition hover:bg-red-50 sm:px-5 sm:py-2 sm:text-sm"
            >
              خروج
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-jam-green px-3 py-1 text-[10px] font-bold text-white shadow-glow transition hover:brightness-110 sm:px-5 sm:py-2 sm:text-sm"
            >
              ورود / ثبت‌نام
            </Link>
          )}
        </div>
        <p className="mt-2 hidden text-sm leading-7 text-slate-500 sm:block">
          به وب‌شهر زیبای جم خوش آمدید 🌿 در دیوار شهر می‌توانید آگهی‌های خود را تبلیغ کنید و
          همچنین روی نقشه، کسب و کار خود را نمایش دهید و قیمت محصولات یا خدمات خود را مدیریت کنید.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-4">
        <Link
          href="/business/register"
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-l from-teal-500 to-cyan-500 p-3 text-white shadow-soft transition hover:-translate-y-0.5 sm:rounded-3xl sm:p-8"
        >
          <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-lg sm:mb-6 sm:h-14 sm:w-14 sm:rounded-2xl sm:text-3xl">
            🏪
          </span>
          <h2 className="mb-0.5 text-xs font-extrabold sm:mb-2 sm:text-2xl">ثبت کسب و کار</h2>
          <p className="mb-1 hidden text-sm text-white/85 sm:mb-4 sm:block">
            کسب و کار خود را ثبت کنید و روی نقشه نمایش دهید
          </p>
          <span className="text-[10px] font-bold sm:text-sm">شروع ثبت ‹</span>
        </Link>

        <Link
          href="/wall"
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-l from-orange-500 to-amber-500 p-3 text-white shadow-soft transition hover:-translate-y-0.5 sm:rounded-3xl sm:p-8"
        >
          <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-lg sm:mb-6 sm:h-14 sm:w-14 sm:rounded-2xl sm:text-3xl">
            💬
          </span>
          <h2 className="mb-0.5 text-xs font-extrabold sm:mb-2 sm:text-2xl">دیوار شهر جم</h2>
          <p className="mb-1 hidden text-sm text-white/85 sm:mb-4 sm:block">
            چت عمومی شهر، آگهی و تبلیغات، صحبت با کاربران
          </p>
          <span className="text-[10px] font-bold sm:text-sm">ورود به چت ‹</span>
        </Link>
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-800 sm:text-lg">
          📍 نقشه کسب و کارهای شهر جم
        </h2>

        {presentCategories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:gap-2">
            <button
              onClick={() => setActiveCategory(null)}
              className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[10px] font-bold transition sm:gap-1 sm:rounded-2xl sm:px-4 sm:py-2 sm:text-xs ${
                activeCategory === null
                  ? "bg-jam-green text-white shadow-glow"
                  : "bg-white text-slate-500 shadow-soft"
              }`}
            >
              <span className="text-sm sm:text-lg">🗂️</span>
              همه
            </button>
            {presentCategories.map((c) => (
              <button
                key={c.slug}
                onClick={() => setActiveCategory(c.slug)}
                className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[10px] font-bold transition sm:gap-1 sm:rounded-2xl sm:px-4 sm:py-2 sm:text-xs ${
                  activeCategory === c.slug
                    ? "bg-jam-green text-white shadow-glow"
                    : "bg-white text-slate-500 shadow-soft"
                }`}
              >
                <span className="text-sm sm:text-lg">{c.icon}</span>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {allBusinesses === null ? (
          <Spinner label="در حال بارگذاری نقشه..." />
        ) : (
          <LeafletMap markers={markers} />
        )}
        <p className="text-center text-xs text-slate-400">
          روی هر دسته کلیک کنید تا فقط همان کسب‌وکارها روی نقشه نمایش داده شوند
        </p>
      </section>

      {gold.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-800">
            🥇 اشتراک طلایی
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {gold.map((b) => (
              <BizCard key={b.id} b={b} />
            ))}
          </div>
        </section>
      )}

      {bronze.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-800">
            🥉 اشتراک برنزی و نقره‌ای
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {bronze.map((b) => (
              <BizCard key={b.id} b={b} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BizCard({ b }: { b: BizRow }) {
  const tier = tierMeta(b.subscription_tier);
  return (
    <Link
      href={`/business/${b.id}`}
      className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-soft transition hover:-translate-y-0.5"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow">
        {b.icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-bold text-slate-800">{b.name}</span>
        <span className="block truncate text-xs text-slate-500">
          {businessCategoryLabel(b.category)}
        </span>
      </span>
    </Link>
  );
}
