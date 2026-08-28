
"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
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
  image_url: string | null;
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

/* ============================================================
   REAL BUSINESS CATEGORY IMAGES
============================================================ */

const BUSINESS_IMAGES: Record<string, string> = {
  restaurant:
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1000&q=85",

  cafe:
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1000&q=85",

  shop:
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=85",

  repair:
    "https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=1000&q=85",

  technical:
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85",

  doctor:
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1000&q=85",

  pharmacy:
    "https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=1000&q=85",

  education:
    "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1000&q=85",

  beauty:
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1000&q=85",

  other:
    "https://images.unsplash.com/photo-1444723121867-7a241cacace9?auto=format&fit=crop&w=1000&q=85",
};

function businessImage(b: Business) {
  return b.image_url || BUSINESS_IMAGES[b.category] || BUSINESS_IMAGES.other;
}

export default function HomePage() {
  const supabase = createClient();
  const { user, profile } = useAuth();

  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    async function loadHome() {
      const { data: businessData } = await supabase
        .from("businesses")
        .select(
          "id,name,category,icon,image_url,lat,lng,subscription_tier,rating_avg,rating_count"
        )
        .eq("subscription_status", "approved");

      setBusinesses((businessData ?? []) as Business[]);

      const { data: productData } = await supabase
        .from("business_products")
        .select(
          "id,business_id,name,price,description,image_url,discount_percent"
        )
        .order("created_at", { ascending: false })
        .limit(30);

      setProducts((productData ?? []) as Product[]);
    }

    loadHome();
  }, [supabase]);

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
        .filter(Boolean),
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
    <div dir="rtl" className="space-y-6 pb-10">

      {/* HERO */}

      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#050606] text-white shadow-[0_20px_70px_rgba(0,0,0,.22)]">

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(34,197,94,.18),transparent_30%),radial-gradient(circle_at_10%_90%,rgba(245,158,11,.12),transparent_28%)]" />

        <div className="relative p-5 sm:p-8">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-2">

              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-green-400/20 bg-green-400/10 text-2xl">
                🌿
              </span>

              <div>
                <p className="text-sm font-black">جم سیتی</p>
                <p className="text-[8px] text-green-400">
                  شهر دیجیتال جم
                </p>
              </div>

            </div>

            <Link
              href="/wall"
              className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-2 text-[9px] font-bold text-green-400"
            >
              ● زنده
            </Link>

          </div>

          <div className="mt-8 max-w-2xl">

            <p className="mb-2 text-[10px] font-bold text-green-400">
              خوش اومدی به جم 👋
            </p>

            <h1 className="text-3xl font-black leading-[1.35] sm:text-5xl">
              همه چیز شهر،
              <span className="block bg-gradient-to-l from-green-300 to-green-500 bg-clip-text text-transparent">
                همین‌جا کنارته.
              </span>
            </h1>

            <p className="mt-4 text-xs leading-7 text-slate-400 sm:text-sm">
              با مردم جم حرف بزن، آگهی ببین، کسب‌وکار پیدا کن،
              تخفیف بگیر و هر چیزی که توی شهر اتفاق می‌افته رو دنبال کن.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">

              <Link
                href="/wall"
                className="rounded-2xl bg-green-500 px-6 py-3.5 text-xs font-black text-black shadow-[0_8px_30px_rgba(34,197,94,.2)] hover:bg-green-400"
              >
                💬 بریم توی چت
              </Link>

              <Link
                href="/businesses"
                className="rounded-2xl border border-white/10 bg-white/[.04] px-6 py-3.5 text-xs font-bold text-white hover:bg-white/[.08]"
              >
                🏪 کشف شهر
              </Link>

            </div>

          </div>

          {/* GLASS CHAT */}

          <Link
            href="/wall"
            className="group relative mt-8 block overflow-hidden rounded-[28px] border border-green-400/30 bg-white/[0.07] p-5 shadow-[0_0_45px_rgba(34,197,94,.12)] backdrop-blur-xl transition duration-300 hover:border-green-400/70 hover:bg-white/[0.10] sm:absolute sm:bottom-8 sm:left-8 sm:mt-0 sm:w-[350px]"
          >

            <div className="absolute inset-0 bg-gradient-to-br from-green-400/[0.12] via-white/[0.03] to-transparent" />

            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-green-400/10 blur-3xl" />

            <div className="relative">

              <div className="flex items-center gap-4">

                <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[24px] border border-green-300/20 bg-green-400/10 text-5xl shadow-[0_0_30px_rgba(34,197,94,.16)]">
                  💬
                </div>

                <div className="min-w-0 flex-1">

                  <div className="flex items-center justify-between gap-2">

                    <h2 className="text-sm font-black text-white">
                      چت عمومی شهر جم
                    </h2>

                    <span className="flex items-center gap-1 rounded-full border border-green-400/20 bg-green-400/10 px-2 py-1 text-[8px] font-bold text-green-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                      LIVE
                    </span>

                  </div>

                  <p className="mt-1 text-[9px] text-slate-500">
                    گفتگو با همشهری‌ها
                  </p>

                </div>

              </div>

              <div className="relative mt-5 space-y-2.5">

                <div className="flex items-end gap-2">

                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xs">
                    👤
                  </span>

                  <div className="max-w-[78%] rounded-2xl rounded-br-md border border-white/10 bg-white/[0.08] px-3 py-2 backdrop-blur-md">

                    <p className="text-[8px] font-bold text-green-300">
                      همشهری جم
                    </p>

                    <p className="mt-1 text-[9px] text-slate-300">
                      سلام، کسی امروز بازار بوده؟ 👋
                    </p>

                  </div>

                </div>

                <div className="flex items-end justify-end gap-2">

                  <div className="max-w-[78%] rounded-2xl rounded-bl-md border border-green-400/10 bg-green-400/10 px-3 py-2 backdrop-blur-md">

                    <p className="text-[9px] text-green-100">
                      آره، امروز خیلی شلوغ بود 😄
                    </p>

                  </div>

                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-green-400/10 bg-green-400/10 text-xs">
                    🧑
                  </span>

                </div>

                <div className="flex items-end gap-2 opacity-60">

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

              <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 backdrop-blur-md">

                <span className="text-[9px] font-bold text-green-300">
                  وارد گفتگوی زنده شو
                </span>

                <span className="text-green-400 transition group-hover:-translate-x-1">
                  ←
                </span>

              </div>

            </div>

          </Link>

        </div>

      </section>

      {/* QUICK ACTIONS */}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">

        <QuickCard href="/wall" icon="💬" title="دیوار جم" text="چت و آگهی" />

        <QuickCard
          href="/businesses"
          icon="🏪"
          title="کسب‌وکارها"
          text="ویترین شهر"
        />

        <QuickCard
          href="/map"
          icon="📍"
          title="نقشه شهر"
          text="پیدا کردن مکان‌ها"
        />

        <QuickCard
          href="/business/register"
          icon="🚀"
          title="ثبت کسب‌وکار"
          text="کسب‌وکارت رو معرفی کن"
        />

      </section>

      {/* PRODUCTS */}

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

            <Link
              href="/businesses"
              className="text-[9px] font-bold text-green-600"
            >
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

                    <img
                      src={product.image_url || businessImage(b)}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                    />

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

        <div className="mb-4 flex items-end justify-between">

          <div>

            <p className="text-[9px] font-bold text-green-600">
              EXPLORE JAM
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-800">
              📍 شهر رو روی نقشه ببین
            </h2>

            <p className="mt-1 text-[9px] text-slate-400">
              کسب‌وکارهای اطراف جم را پیدا کن
            </p>

          </div>

          <Link
            href="/map"
            className="rounded-full bg-slate-900 px-4 py-2 text-[9px] font-bold text-white"
          >
            نقشه کامل
          </Link>

        </div>

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

            {categories.map((c: any) => (
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

              <p className="text-[9px] font-bold text-amber-400">
                PREMIUM
              </p>

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

              const product = products.find(
                (p) => p.business_id === b.id
              );

              return (
                <Link
                  key={b.id}
                  href={`/business/${b.id}`}
                  className="group overflow-hidden rounded-[22px] border border-amber-400/20 bg-white"
                >

                  <div className="relative h-32 overflow-hidden bg-slate-100">

                    <img
                      src={product?.image_url || businessImage(b)}
                      alt={b.name}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                    />

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

              <p className="text-[9px] font-bold text-red-500">
                LIMITED OFFERS
              </p>

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
                      product.price *
                        (1 -
                          (product.discount_percent ?? 0) / 100)
                    )
                  : null;

              return (
                <Link
                  key={product.id}
                  href={`/business/${b.id}`}
                  className="group overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >

                  <div className="relative h-32 overflow-hidden bg-slate-100">

                    <img
                      src={product.image_url || businessImage(b)}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />

                    <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-1 text-[8px] font-black text-white">
                      {product.discount_percent}%- 
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

            <p className="text-[9px] font-bold text-amber-500">
              COMMUNITY PICKS
            </p>

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

                <img
                  src={businessImage(b)}
                  alt={b.name}
                  className="h-12 w-12 shrink-0 rounded-xl object-cover"
                />

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

            <p className="text-[9px] font-bold text-green-400">
              JAM CITY COMMUNITY
            </p>

            <h2 className="mt-2 text-2xl font-black">
              حرفی داری؟
              <span className="text-green-400">
                {" "}بیا توی جم بگو.
              </span>
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

        <Stat
          icon="🏪"
          value={businesses?.length ?? 0}
          text="کسب‌وکار"
        />

        <Stat
          icon="👑"
          value={goldBusinesses.length}
          text="طلایی"
        />

        <Stat
          icon="🎁"
          value={discounts.length}
          text="تخفیف فعال"
        />

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

    </div>
  );
}

/* ============================================================
   COMPONENTS
============================================================ */

function QuickCard({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-green-300 hover:shadow-md"
    >

      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl transition group-hover:bg-green-100">
        {icon}
      </span>

      <h3 className="mt-3 text-xs font-black text-slate-800">
        {title}
      </h3>

      <p className="mt-1 text-[8px] text-slate-400">
        {text}
      </p>

    </Link>
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

      <span className="text-xl">
        {icon}
      </span>

      <span>

        <strong className="block text-sm font-black text-slate-800">
          {new Intl.NumberFormat("fa-IR").format(value)}
        </strong>

        <small className="text-[8px] text-slate-400">
          {text}
        </small>

      </span>

    </div>
  );
}

