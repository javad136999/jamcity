"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  businessCategoryLabel,
  BUSINESS_CATEGORIES,
} from "@/lib/constants";
import { Spinner } from "@/components/Feedback";
import type { MapMarker } from "@/components/LeafletMap";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => <Spinner label="در حال بارگذاری..." />,
});

type Business = {
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

type Product = {
  id: string;
  business_id: string;
  name: string;
  price: number | null;
  description: string | null;
  image_url: string | null;
  discount_percent: number | null;
};

const TOROB_RECENT_SEARCHES_KEY = "jamcity:torob-recent-searches";
const TOROB_SUGGESTIONS = [
  "گوشی سامسونگ",
  "لپ‌تاپ ایسوس",
  "هدفون بلوتوث",
  "یخچال ساید بای ساید",
];

export default function HomePage() {
  const supabase = createClient();
  const { user, profile } = useAuth();

  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [torobModalOpen, setTorobModalOpen] = useState(false);
  const [torobQuery, setTorobQuery] = useState("");
  const [torobRecent, setTorobRecent] = useState<string[]>([]);
  const torobInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadHome() {
      const { data: businessData, error: businessError } = await supabase
        .from("businesses")
        .select(
          "id,name,category,icon,lat,lng,subscription_tier,rating_avg,rating_count"
        )
        .eq("subscription_status", "approved");

      if (businessError) {
        console.error("Failed to load businesses:", businessError.message);
      }

      setBusinesses((businessData ?? []) as Business[]);

      const { data: productData, error: productError } = await supabase
        .from("business_products")
        .select(
          "id,business_id,name,price,description,image_url,discount_percent"
        )
        .order("created_at", { ascending: false })
        .limit(30);

      if (productError) {
        console.error("Failed to load products:", productError.message);
      }

      setProducts((productData ?? []) as Product[]);
    }

    loadHome();
  }, [supabase]);

  // بارگذاری تاریخچه‌ی جستجوهای اخیر ترب از localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TOROB_RECENT_SEARCHES_KEY);
      if (raw) {
        setTorobRecent(JSON.parse(raw));
      }
    } catch {
      // localStorage در دسترس نبود؛ نادیده بگیر
    }
  }, []);

  // فوکوس خودکار روی اینپوت وقتی modal باز می‌شود + بستن با Escape
  useEffect(() => {
    if (!torobModalOpen) return;

    const timer = window.setTimeout(() => torobInputRef.current?.focus(), 50);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setTorobModalOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [torobModalOpen]);

  function openTorobSearch(rawQuery: string) {
    const query = rawQuery.trim();
    if (!query) return;

    try {
      const nextRecent = [
        query,
        ...torobRecent.filter((item) => item !== query),
      ].slice(0, 5);
      setTorobRecent(nextRecent);
      window.localStorage.setItem(
        TOROB_RECENT_SEARCHES_KEY,
        JSON.stringify(nextRecent)
      );
    } catch {
      // localStorage در دسترس نبود؛ نادیده بگیر
    }

    const url = `https://torob.com/search/?query=${encodeURIComponent(query)}`;
    window.open(url, "_blank", "noopener,noreferrer");

    setTorobModalOpen(false);
    setTorobQuery("");
  }

  const visibleBusinesses = useMemo(
    () =>
      (businesses ?? []).filter(
        (b) => !activeCategory || b.category === activeCategory
      ),
    [businesses, activeCategory]
  );

  const markers: MapMarker[] = useMemo(
    () =>
      visibleBusinesses
        .filter((b) => b.lat !== null && b.lng !== null)
        .map((b) => ({
          id: b.id,
          lat: b.lat!,
          lng: b.lng!,
          title: b.name,
          subtitle: businessCategoryLabel(b.category),
          href: `/business/${b.id}`,
          emoji: b.icon,
          tier: b.subscription_tier,
          rating: b.rating_count ? b.rating_avg : null,
        })),
    [visibleBusinesses]
  );

  const categories = useMemo(
    () =>
      Array.from(new Set((businesses ?? []).map((b) => b.category)))
        .map((slug) =>
          BUSINESS_CATEGORIES.find((category) => category.slug === slug)
        )
        .filter((category): category is NonNullable<typeof category> =>
          Boolean(category)
        ),
    [businesses]
  );

  const goldBusinesses = useMemo(
    () =>
      (businesses ?? [])
        .filter((b) => b.subscription_tier === "gold")
        .slice(0, 5),
    [businesses]
  );

  const discounts = useMemo(
    () =>
      products
        .filter((p) => (p.discount_percent ?? 0) > 0)
        .slice(0, 5),
    [products]
  );

  const popular = useMemo(
    () =>
      [...(businesses ?? [])]
        .filter((b) => b.rating_count > 0)
        .sort((a, b) => b.rating_avg - a.rating_avg)
        .slice(0, 5),
    [businesses]
  );

  function findBusiness(id: string) {
    return businesses?.find((b) => b.id === id);
  }

  function formatPrice(value: number | null) {
    if (value === null) return "";
    return `${new Intl.NumberFormat("fa-IR").format(value)} تومان`;
  }

  return (
    <div dir="rtl" className="space-y-4 pb-10">

      {/* JAM CITY NEWS BAR (NEON) */}
      <section className="relative mx-auto mt-2 max-w-md overflow-hidden rounded-full border border-[#39ff8f]/50 bg-[#03110a] px-4 py-2 sh  adow-[0_0_20px_rgba(57,255,143,.35),inset_0_0_15px_rgba(57,255,143,.08)]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#39ff8f]/20 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-24 w-24 rounded-full bg-[#39ff8f]/20 blur-2xl" />

        <div className="relative flex items-center gap-2">
          <Link href="/news" className="flex shrink-0 items-center gap-1.5">
<span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#39ff8f]/50 bg-[#39ff8f]/10 text-sm shadow-[0_0_10px_rgba(57,255,143,.5)]">
  📰
</span>              📰
            </span>
<p className="hidden text-[11px] font-black text-[#39ff8f] drop-shadow-[0_0_6px_rgba(57,255,143,.7)] sm:block">
  اخبار روز
</p>         
          </Link>

          <div className="h-4 w-px shrink-0 bg-[#39ff8f]/30" />

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-2">
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-[#39ff8f]/40 bg-[#39ff8f]/10 px-1.5 py-0.5 text-[6px] font-black text-[#39ff8f]">
                <span className="h-1 w-1 animate-pulse rounded-full bg-[#39ff8f] shadow-[0_0_8px_rgba(57,255,143,1)]" />
                LIVE
              </span>
          <p className="truncate text-[10px] font-bold text-[#c8ffe0]">
  آخرین اخبار ایران، اقتصاد، جم و عسلویه
</p>
            </div>
          </div>

          <Link
            href="/news"
            className="shrink-0 rounded-full border border-[#39ff8f]/40 bg-[#39ff8f]/10 px-2 py-1 text-[6px] font-black text-[#39ff8f] transition hover:bg-[#39ff8f]/20"
          >
            همه ←
          </Link>
        </div>
      </section>

      {/* HERO */}
      <section className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#050606] text-white shadow-[0_20px_70px_rgba(0,0,0,.22)] sm:rounded-[30px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(34,197,94,.18),transparent_30%),radial-gradient(circle_at_10%_90%,rgba(245,158,11,.12),transparent_28%)]" />

        <div className="relative p-3.5 sm:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-green-400/20 bg-green-400/10 text-base shadow-[0_0_20px_rgba(34,197,94,.10)] sm:h-11 sm:w-11 sm:rounded-2xl sm:text-2xl">
                🌿
              </span>
              <div>
                <p className="text-[11px] font-black sm:text-sm">جم سیتی</p>
                <p className="text-[7px] text-green-400 sm:text-[8px]">
                  شهر دیجیتال جم
                </p>
              </div>
            </div>

            <Link
              href="/wall"
              className="rounded-full border border-green-400/20 bg-green-400/10 px-2.5 py-1.5 text-[8px] font-bold text-green-400 sm:px-3 sm:py-2 sm:text-[9px]"
            >
              ● زنده
            </Link>
          </div>

          <div className="mt-5 flex items-center gap-2.5 sm:mt-8 sm:block">
            <div className="min-w-0 flex-1 max-w-2xl">
              <p className="mb-1 text-[8px] font-bold text-green-400 sm:mb-2 sm:text-[10px]">
                خوش اومدی به جم 👋
              </p>

              <h1 className="text-[20px] font-black leading-[1.45] sm:text-5xl sm:leading-[1.35]">
                همه چیز شهر،
                <span className="block bg-gradient-to-l from-green-300 to-green-500 bg-clip-text text-transparent">
                  همین‌جا کنارته.
                </span>
              </h1>

              <p className="mt-2 text-[8px] leading-5 text-slate-400 sm:mt-4 sm:text-sm sm:leading-7">
                با مردم جم حرف بزن، آگهی ببین، کسب‌وکار پیدا کن،
                تخفیف بگیر و هر چیزی که توی شهر اتفاق می‌افته رو دنبال کن.
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-6 sm:gap-2">
                <Link
                  href="/wall"
                  className="rounded-xl bg-green-500 px-3 py-2 text-[8px] font-black text-black shadow-[0_8px_30px_rgba(34,197,94,.2)] hover:bg-green-400 sm:rounded-2xl sm:px-6 sm:py-3.5 sm:text-xs"
                >
                  💬 بریم توی چت
                </Link>

                <Link
                  href="/businesses"
                  className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-[8px] font-bold text-white hover:bg-white/[.08] sm:rounded-2xl sm:px-6 sm:py-3.5 sm:text-xs"
                >
                  🏪 کشف شهر
                </Link>

                <button
                  type="button"
                  onClick={() => setTorobModalOpen(true)}
                  className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[8px] font-black text-amber-300 transition hover:bg-amber-400/20 sm:rounded-2xl sm:px-6 sm:py-3.5 sm:text-xs"
                >
                  🛒 خرید با کف قیمت بازار
                </button>
              </div>
            </div>

            <Link
              href="/wall"
              className="group relative w-[132px] shrink-0 overflow-hidden rounded-[18px] border border-green-400/30 bg-white/[0.07] p-2.5 shadow-[0_0_35px_rgba(34,197,94,.12)] backdrop-blur-xl transition duration-300 hover:border-green-400/70 hover:bg-white/[0.10] sm:absolute sm:bottom-8 sm:left-8 sm:mt-0 sm:w-[350px] sm:rounded-[28px] sm:p-5"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-400/[0.12] via-white/[0.03] to-transparent" />
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-green-400/10 blur-3xl" />

              <div className="relative">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-green-300/20 bg-green-400/10 text-xl shadow-[0_0_20px_rgba(34,197,94,.16)] sm:h-[68px] sm:w-[68px] sm:rounded-[24px] sm:text-5xl">
                    💬
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h2 className="truncate text-[11px] font-black text-white sm:text-sm">
                        چت عمومی شهر جم
                      </h2>

                      <span className="flex shrink-0 items-center gap-1 rounded-full border border-green-400/20 bg-green-400/10 px-1.5 py-0.5 text-[5px] font-bold text-green-400 sm:px-2 sm:py-1 sm:text-[8px]">
                        <span className="h-1 w-1 animate-pulse rounded-full bg-green-400 sm:h-1.5 sm:w-1.5" />
                        LIVE
                      </span>
                    </div>

                    <p className="mt-1 truncate text-[9px] text-slate-300 sm:mt-1 sm:text-[9px]">
                      گفتگو با همشهری‌ها
                    </p>
                  </div>
                </div>

                <div className="relative mt-2 space-y-1.5 sm:mt-5 sm:space-y-2.5">
                  <div className="flex items-end gap-1 sm:gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[8px] sm:h-7 sm:w-7 sm:text-xs">
                      👤
                    </span>

                    <div className="max-w-[82%] rounded-xl rounded-br-md border border-white/10 bg-white/[0.08] px-2 py-1.5 backdrop-blur-md sm:rounded-2xl sm:px-3 sm:py-2">
                      <p className="text-[6px] font-bold text-green-300 sm:text-[8px]">
                        همشهری جم
                      </p>
                      <p className="mt-0.5 truncate text-[6px] text-slate-300 sm:mt-1 sm:text-[9px]">
                        سلام، کسی امروز بازار بوده؟ 👋
                      </p>
                    </div>
                  </div>

                  <div className="flex items-end justify-end gap-1 sm:gap-2">
                    <div className="max-w-[82%] rounded-xl rounded-bl-md border border-green-400/10 bg-green-400/10 px-2 py-1.5 backdrop-blur-md sm:rounded-2xl sm:px-3 sm:py-2">
                      <p className="text-[6px] text-green-100 sm:text-[9px]">
                        آره، امروز خیلی شلوغ بود 😄
                      </p>
                    </div>

                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-green-400/10 bg-green-400/10 text-[8px] sm:h-7 sm:w-7 sm:text-xs">
                      🧑
                    </span>
                  </div>

                  <div className="hidden items-end gap-2 opacity-60 sm:flex">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-xs">
                      👩
                    </span>
                    <div className="rounded-2xl rounded-br-md border border-white/5 bg-white/[0.04] px-3 py-2">
                      <p className="text-[8px] text-slate-500">
                        چه خبره امروز؟ 😍
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-2 py-1.5 backdrop-blur-md sm:mt-5 sm:rounded-2xl sm:px-4 sm:py-3">
                  <span className="truncate text-[6px] font-bold text-green-300 sm:text-[9px]">
                    وارد گفتگوی زنده شو
                  </span>
                  <span className="text-[9px] text-green-400 transition group-hover:-translate-x-1 sm:text-base">
                    ←
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* HOT PRODUCTS */}
      {products.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <h2 className="text-xl font-black text-slate-800">
                  الان توی جم چی هست؟
                </h2>
              </div>
              <p className="mt-1 text-[9px] text-slate-400">
                آخرین محصولات و پیشنهادهای شهر
              </p>
            </div>

            <Link href="/businesses" className="text-[9px] font-bold text-green-600">
              بیشتر ←
            </Link>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {products.slice(0, 7).map((product) => {
              const b = findBusiness(product.business_id);
              if (!b) return null;

              return (
                <Link
                  key={product.id}
                  href={`/business/${b.id}`}
                  className="group min-w-[180px] max-w-[180px] overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative h-36 overflow-hidden bg-slate-100">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-950 text-5xl text-white">
                        <span className="drop-shadow-[0_0_12px_rgba(255,255,255,.25)]">
                          {b.icon}
                        </span>
                      </div>
                    )}

                    {(product.discount_percent ?? 0) > 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2.5 py-1 text-[8px] font-black text-white">
                        {product.discount_percent}% تخفیف
                      </span>
                    )}
                  </div>

                  <div className="p-3">
                    <h3 className="truncate text-[11px] font-black text-slate-800">
                      {product.name}
                    </h3>
                    <p className="mt-1 truncate text-[8px] text-slate-400">
                      {b.name}
                    </p>
                    {product.price !== null && (
                      <p className="mt-3 text-[9px] font-black text-green-600">
                        {formatPrice(product.price)}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* MAP */}
      <section>
        {categories.length > 0 && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory(null)}
              className={`shrink-0 rounded-full px-4 py-2 text-[9px] font-bold ${
                activeCategory === null
                  ? "bg-green-600 text-white"
                  : "bg-white text-slate-500 shadow-sm"
              }`}
            >
              همه
            </button>

            {categories.map((c) => (
              <button
                key={c.slug}
                onClick={() => setActiveCategory(c.slug)}
                className={`shrink-0 rounded-full px-4 py-2 text-[9px] font-bold ${
                  activeCategory === c.slug
                    ? "bg-green-600 text-white"
                    : "bg-white text-slate-500 shadow-sm"
                }`}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-hidden rounded-[28px] border-4 border-white bg-white shadow-[0_15px_50px_rgba(0,0,0,.1)]">
          {businesses === null ? (
            <div className="flex h-80 items-center justify-center">
              <Spinner label="در حال بارگذاری نقشه..." />
            </div>
          ) : (
            <LeafletMap markers={markers} />
          )}
        </div>
      </section>

      {/* GOLD BUSINESSES */}
      {goldBusinesses.length > 0 && (
        <section className="relative overflow-hidden rounded-[28px] border border-amber-200 bg-[#100d07] p-4 sm:p-5">
          <div className="absolute -left-20 -top-20 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />

          <div className="relative mb-5 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold text-amber-400">PREMIUM</p>
              <h2 className="mt-1 text-xl font-black text-white">
                👑 ویترین طلایی جم
              </h2>
              <p className="mt-1 text-[9px] text-slate-500">
                بهترین کسب‌وکارهای شهر
              </p>
            </div>

            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[8px] font-black text-amber-400">
              GOLD
            </span>
          </div>

          <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-4">
            {goldBusinesses.map((b) => {
              const product = products.find((p) => p.business_id === b.id);

              return (
                <Link
                  key={b.id}
                  href={`/business/${b.id}`}
                  className="group overflow-hidden rounded-[22px] border border-amber-400/20 bg-white"
                >
                  <div className="relative h-32 overflow-hidden bg-slate-100">
                    {product?.image_url ? (
                      <img
                        src={product.image_url}
                        alt={b.name}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-950 text-5xl text-white">
                        <span>{b.icon}</span>
                      </div>
                    )}

                    <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[8px] font-black text-amber-300">
                      👑 GOLD
                    </span>
                  </div>

                  <div className="p-3">
                    <h3 className="truncate text-[10px] font-black text-slate-800">
                      {b.name}
                    </h3>
                    <p className="mt-1 truncate text-[8px] text-slate-400">
                      {businessCategoryLabel(b.category)}
                    </p>
                    {b.rating_count > 0 && (
                      <p className="mt-2 text-[8px] font-black text-amber-500">
                        ⭐ {b.rating_avg.toFixed(1)}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* DISCOUNTS */}
      {discounts.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[9px] font-bold text-red-500">LIMITED OFFERS</p>
              <h2 className="mt-1 text-xl font-black text-slate-800">
                🎁 تخفیف‌های داغ جم
              </h2>
            </div>

            <span className="rounded-full bg-red-500 px-3 py-1.5 text-[8px] font-black text-white">
              HOT
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {discounts.map((product) => {
              const b = findBusiness(product.business_id);
              if (!b) return null;

              const finalPrice =
                product.price !== null
                  ? Math.round(
                      product.price * (1 - (product.discount_percent ?? 0) / 100)
                    )
                  : null;

              return (
                <Link
                  key={product.id}
                  href={`/business/${b.id}`}
                  className="group overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative h-32 overflow-hidden bg-slate-100">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-950 text-5xl text-white">
                        <span>{b.icon}</span>
                      </div>
                    )}

                    <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-1 text-[8px] font-black text-white">
                      {product.discount_percent}%
                    </span>
                  </div>

                  <div className="p-3">
                    <h3 className="truncate text-[10px] font-black text-slate-800">
                      {product.name}
                    </h3>
                    <p className="mt-1 truncate text-[8px] text-slate-400">
                      {b.name}
                    </p>

                    {finalPrice !== null && (
                      <div className="mt-2">
                        <span className="text-[10px] font-black text-red-500">
                          {formatPrice(finalPrice)}
                        </span>
                        <span className="mr-2 text-[8px] text-slate-300 line-through">
                          {formatPrice(product.price)}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* POPULAR */}
      {popular.length > 0 && (
        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <p className="text-[9px] font-bold text-amber-500">COMMUNITY PICKS</p>
            <h2 className="mt-1 text-xl font-black text-slate-800">
              ⭐ محبوب‌های جم
            </h2>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {popular.map((b) => (
              <Link
                key={b.id}
                href={`/business/${b.id}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3 transition hover:border-green-200 hover:bg-green-50/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xl text-white">
                  {b.icon}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-black text-slate-700">
                    {b.name}
                  </span>
                  <span className="mt-1 block text-[8px] text-slate-400">
                    {businessCategoryLabel(b.category)}
                  </span>
                </span>

                <span className="text-[9px] font-black text-amber-500">
                  ⭐ {b.rating_avg.toFixed(1)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* BIG CHAT CTA */}
      <section className="relative overflow-hidden rounded-[28px] bg-[#060807] p-6 text-white sm:p-8">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-green-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[9px] font-bold text-green-400">JAM CITY COMMUNITY</p>
            <h2 className="mt-2 text-2xl font-black">
              حرفی داری؟
              <span className="text-green-400"> بیا توی جم بگو.</span>
            </h2>
            <p className="mt-2 max-w-xl text-[10px] leading-6 text-slate-500">
              با همشهری‌ها صحبت کن، آگهی بگذار و از اتفاقات شهر باخبر شو.
            </p>
          </div>

          <Link
            href="/wall"
            className="shrink-0 rounded-2xl bg-green-500 px-7 py-3.5 text-center text-xs font-black text-black shadow-lg shadow-green-500/20"
          >
            💬 ورود به دیوار جم
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section className="grid grid-cols-3 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
        <Stat icon="🏪" value={businesses?.length ?? 0} text="کسب‌وکار" />
        <Stat icon="👑" value={goldBusinesses.length} text="طلایی" />
        <Stat icon="🎁" value={discounts.length} text="تخفیف فعال" />
      </section>

      {/* USER */}
      <section className="text-center">
        <p className="text-[9px] text-slate-400">
          {user
            ? `خوش آمدی ${profile?.display_name || "همشهری"} 🌿`
            : "جم سیتی؛ شهر دیجیتال خودت را بساز."}
        </p>

        {!user && (
          <Link
            href="/login"
            className="mt-3 inline-block rounded-full bg-slate-900 px-6 py-2.5 text-[9px] font-bold text-white"
          >
            ورود / ثبت‌نام
          </Link>
        )}
      </section>

      {/* =====================================================
          TOROB SEARCH MODAL
      ====================================================== */}
      {torobModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setTorobModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="torob-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-t-[28px] border border-amber-400/20 bg-[#0d0b07] p-5 shadow-[0_-20px_60px_rgba(0,0,0,.4)] sm:rounded-[28px] sm:p-6"
          >
            <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-base">
                  🛒
                </span>
                <div>
                  <h2
                    id="torob-modal-title"
                    className="text-[12px] font-black text-white"
                  >
                    خرید با کف قیمت بازار
                  </h2>
                  <p className="text-[8px] text-slate-500">
                    جستجو در ترب، مقایسه‌گر قیمت
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTorobModalOpen(false)}
                aria-label="بستن"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[10px] text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                openTorobSearch(torobQuery);
              }}
              className="relative mt-4"
            >
              <input
                ref={torobInputRef}
                type="text"
                value={torobQuery}
                onChange={(e) => setTorobQuery(e.target.value)}
                placeholder="اسم وسیله رو تایپ کن، مثلاً: گوشی سامسونگ"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[11px] text-white placeholder:text-slate-500 outline-none transition focus:border-amber-400/50 focus:bg-white/[0.08]"
              />

              <button
                type="submit"
                disabled={!torobQuery.trim()}
                className="mt-3 w-full rounded-2xl bg-amber-400 px-4 py-3 text-[10px] font-black text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                جستجو در ترب ←
              </button>
            </form>

            {torobRecent.length > 0 && (
              <div className="relative mt-4">
                <p className="mb-2 text-[8px] font-bold text-slate-500">
                  جستجوهای اخیر
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {torobRecent.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => openTorobSearch(item)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] text-slate-300 transition hover:border-amber-400/30 hover:text-amber-300"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative mt-4">
              <p className="mb-2 text-[8px] font-bold text-slate-500">
                پیشنهادی
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TOROB_SUGGESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => openTorobSearch(item)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] text-slate-300 transition hover:border-amber-400/30 hover:text-amber-300"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <p className="relative mt-4 text-center text-[7px] text-slate-600">
              نتایج در تب جدید از سایت ترب باز می‌شود
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

function Stat({
  icon,
  value,
  text,
}: {
  icon: string;
  value: number;
  text: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 border-l border-slate-100 p-4 last:border-l-0">
      <span className="text-xl">{icon}</span>

      <span>
        <strong className="block text-sm font-black text-slate-800">
          {new Intl.NumberFormat("fa-IR").format(value)}
        </strong>

        <small className="text-[8px] text-slate-400">{text}</small>
      </span>
    </div>
  );
}
