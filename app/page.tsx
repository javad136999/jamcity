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
    <div dir="rtl" className="space-y-5 bg-[#F7F9F4] pb-10">

      {/* JAM CITY NEWS BAR — نئون: کل ردیف یه لینک واحده به /news */}
      <Link
        href="/news"
        className="group relative mx-auto mt-2 flex max-w-md items-center gap-2 overflow-hidden rounded-full border border-[#39ff8f]/60 bg-white px-4 py-2 shadow-[0_0_0_1px_rgba(57,255,143,.15),0_6px_24px_rgba(20,122,75,.12)] transition hover:shadow-[0_0_0_1px_rgba(57,255,143,.35),0_0_24px_rgba(57,255,143,.35),0_6px_24px_rgba(20,122,75,.15)]"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#39ff8f]/20 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-24 w-24 rounded-full bg-[#39ff8f]/10 blur-2xl" />

        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eafff3] text-sm shadow-[0_0_12px_rgba(57,255,143,.45)]">
          📰
        </span>

        <p className="relative hidden shrink-0 text-[11px] font-black text-[#0f9a56] sm:block">
          اخبار روز
        </p>

        <div className="relative h-4 w-px shrink-0 bg-[#39ff8f]/25" />

        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#0f9a56] px-1.5 py-0.5 text-[8px] font-black text-white shadow-[0_0_10px_rgba(57,255,143,.6)]">
              <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
              زنده
            </span>
            <p className="truncate text-[10px] font-bold text-[#3A4A3D]">
              آخرین اخبار ایران، اقتصاد، جم و عسلویه
            </p>
          </div>
        </div>

        <span className="relative shrink-0 rounded-full bg-[#eafff3] px-2.5 py-1 text-[9px] font-black text-[#0f9a56] transition group-hover:bg-[#d4ecdc]">
          همه ←
        </span>
      </Link>

     ```tsx
{/* HERO */}
<section className="relative overflow-hidden rounded-[24px] border border-[#E3EBDE] bg-white shadow-[0_20px_60px_rgba(20,60,40,.06)] sm:rounded-[30px]">
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(57,255,143,.16),transparent_35%),radial-gradient(circle_at_0%_100%,rgba(255,183,77,.14),transparent_32%),radial-gradient(circle_at_50%_120%,rgba(226,87,76,.08),transparent_30%)]" />

  <div className="relative p-3.5 sm:p-8">

    {/* عنوان + چت عمومی */}
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

      {/* عنوان سایت */}
      <div className="flex flex-col items-center text-center sm:items-start sm:text-right">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E3F3E9] text-2xl shadow-[0_0_18px_rgba(57,255,143,.35)] sm:h-16 sm:w-16 sm:text-4xl">
          🌴
        </span>

        <h1 className="mt-2 text-[19px] font-black leading-snug text-[#1D2B1F] sm:mt-3 sm:text-4xl">
          به شهر جم
          <span className="bg-gradient-to-l from-[#147A4B] to-[#2FAE72] bg-clip-text text-transparent">
            {" "}خوش آمدید
          </span>
        </h1>
      </div>

      {/* پنل چت عمومی */}
      <Link
        href="/wall"
        className="group relative w-full overflow-hidden rounded-[20px] border border-[#CFE6D6] bg-[#F3FAF5] p-3 shadow-[0_10px_30px_rgba(20,122,75,.08)] transition duration-300 hover:border-[#a9d9bb] hover:bg-[#EAF7EE] sm:w-[350px] sm:rounded-[28px] sm:p-5"
      >
        <div className="relative">

          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-[0_0_18px_6px_rgba(226,87,76,.40)] ring-2 ring-[#E2574C]/60 sm:h-[72px] sm:w-[72px] sm:rounded-[22px] sm:text-5xl">
              💬
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[13px] font-black text-[#1D2B1F] sm:text-lg">
                چت عمومی شهر جم
              </h2>

              <p className="mt-1 text-[9px] text-[#66766A] sm:text-[10px]">
                گفتگو با همشهری‌ها
              </p>
            </div>
          </div>

          {/* نمونه پیام‌ها */}
          <div className="mt-3 space-y-1.5 sm:mt-4 sm:space-y-2.5">

            <div className="flex items-end gap-1.5 sm:gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[9px] shadow-sm sm:h-7 sm:w-7 sm:text-xs">
                👤
              </span>

              <div className="max-w-[82%] rounded-xl rounded-br-md border border-[#E3EBDE] bg-white px-2.5 py-1.5 sm:rounded-2xl sm:px-3 sm:py-2">
                <p className="text-[7px] font-bold text-[#147A4B] sm:text-[8px]">
                  همشهری جم
                </p>

                <p className="mt-0.5 truncate text-[7px] text-[#3A4A3D] sm:text-[9px]">
                  سلام، کسی امروز بازار بوده؟ 👋
                </p>
              </div>
            </div>

            <div className="flex items-end justify-end gap-1.5 sm:gap-2">
              <div className="max-w-[82%] rounded-xl rounded-bl-md bg-[#147A4B] px-2.5 py-1.5 sm:rounded-2xl sm:px-3 sm:py-2">
                <p className="text-[7px] text-white sm:text-[9px]">
                  آره، امروز خیلی شلوغ بود 😄
                </p>
              </div>

              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[9px] shadow-sm sm:h-7 sm:w-7 sm:text-xs">
                🧑
              </span>
            </div>

          </div>

          {/* ورود به چت */}
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm sm:mt-4 sm:rounded-2xl sm:px-4 sm:py-3">
            <span className="text-[7px] font-bold text-[#147A4B] sm:text-[9px]">
              وارد گفتگوی زنده شو
            </span>

            <span className="text-[11px] text-[#147A4B] transition group-hover:-translate-x-1 sm:text-base">
              ←
            </span>
          </div>

        </div>
      </Link>

    </div>

  </div>
</section>
```

      {/* HOT PRODUCTS */}
      {products.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCE7E4] text-lg shadow-[0_0_14px_rgba(226,87,76,.3)]">
                🔥
              </span>
              <div>
                <h2 className="text-lg font-black text-[#1D2B1F] sm:text-xl">
                  الان توی جم چی هست؟
                </h2>
                <p className="text-[9px] text-[#8A968C]">
                  آخرین محصولات و پیشنهادهای شهر
                </p>
              </div>
            </div>

            <Link href="/businesses" className="shrink-0 text-[9px] font-bold text-[#147A4B]">
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
                  className="group min-w-[180px] max-w-[180px] overflow-hidden rounded-[22px] border border-[#E3EBDE] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative h-36 overflow-hidden bg-[#F3F6F1]">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#F3FAF5] text-5xl">
                        <span>{b.icon}</span>
                      </div>
                    )}

                    {(product.discount_percent ?? 0) > 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-[#E2574C] px-2.5 py-1 text-[8px] font-black text-white">
                        {product.discount_percent}% تخفیف
                      </span>
                    )}
                  </div>

                  <div className="p-3">
                    <h3 className="truncate text-[11px] font-black text-[#1D2B1F]">
                      {product.name}
                    </h3>
                    <p className="mt-1 truncate text-[8px] text-[#8A968C]">
                      {b.name}
                    </p>
                    {product.price !== null && (
                      <p className="mt-3 text-[9px] font-black text-[#147A4B]">
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
              className={`shrink-0 rounded-full px-4 py-2 text-[9px] font-bold transition ${
                activeCategory === null
                  ? "bg-[#147A4B] text-white"
                  : "border border-[#E3EBDE] bg-white text-[#66766A]"
              }`}
            >
              همه
            </button>

            {categories.map((c) => (
              <button
                key={c.slug}
                onClick={() => setActiveCategory(c.slug)}
                className={`shrink-0 rounded-full px-4 py-2 text-[9px] font-bold transition ${
                  activeCategory === c.slug
                    ? "bg-[#147A4B] text-white"
                    : "border border-[#E3EBDE] bg-white text-[#66766A]"
                }`}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        )}

        {/*
          نکته‌ی مهم: relative + isolate + z-0 اینجا یه stacking context
          مستقل برای نقشه می‌سازه. لیفلت داخل خودش کنترل‌ها و پنل‌هاش رو
          با z-index های بالا (تا ۱۰۰۰) می‌سازه؛ بدون isolate، همون
          z-index های داخلی از مرز این باکس بیرون می‌زنن و روی بخش‌های
          دیگه‌ی صفحه (مثل بخش‌های بالاتر/پایین‌تر) موقع اسکرول میفتن.
          isolate این نشتی رو کاملاً مهار می‌کنه.
        */}
        <div className="relative isolate z-0 overflow-hidden rounded-[28px] border-4 border-white bg-white shadow-[0_0_0_1px_rgba(57,255,143,.25),0_0_35px_rgba(57,255,143,.18),0_15px_45px_rgba(20,60,40,.1)]">
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
        <section className="relative overflow-hidden rounded-[28px] border border-[#F0DCB4] bg-gradient-to-b from-[#FBEEDA] to-white p-4 shadow-[0_0_30px_rgba(255,183,77,.18)] sm:p-5">
          <div className="relative mb-5 flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-[0_0_14px_rgba(255,183,77,.4)]">
              👑
            </span>
            <div>
              <h2 className="text-lg font-black text-[#1D2B1F] sm:text-xl">
                ویترین طلایی جم
              </h2>
              <p className="text-[9px] text-[#8A7150]">
                بهترین کسب‌وکارهای شهر
              </p>
            </div>
          </div>

          <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-4">
            {goldBusinesses.map((b) => {
              const product = products.find((p) => p.business_id === b.id);

              return (
                <Link
                  key={b.id}
                  href={`/business/${b.id}`}
                  className="group overflow-hidden rounded-[22px] border border-[#F0DCB4] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative h-32 overflow-hidden bg-[#FBEEDA]">
                    {product?.image_url ? (
                      <img
                        src={product.image_url}
                        alt={b.name}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-5xl">
                        <span>{b.icon}</span>
                      </div>
                    )}

                    <span className="absolute right-2 top-2 rounded-full bg-white px-2 py-1 text-[8px] font-black text-[#D98F2B] shadow-sm">
                      👑 طلایی
                    </span>
                  </div>

                  <div className="p-3">
                    <h3 className="truncate text-[10px] font-black text-[#1D2B1F]">
                      {b.name}
                    </h3>
                    <p className="mt-1 truncate text-[8px] text-[#8A968C]">
                      {businessCategoryLabel(b.category)}
                    </p>
                    {b.rating_count > 0 && (
                      <p className="mt-2 text-[8px] font-black text-[#D98F2B]">
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
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCE7E4] text-lg shadow-[0_0_14px_rgba(226,87,76,.3)]">
              🎁
            </span>
            <div>
              <h2 className="text-lg font-black text-[#1D2B1F] sm:text-xl">
                تخفیف‌های داغ جم
              </h2>
              <p className="text-[9px] text-[#8A968C]">
                محدود و فقط برای امروز
              </p>
            </div>
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
                  className="group overflow-hidden rounded-[22px] border border-[#E3EBDE] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative h-32 overflow-hidden bg-[#F3F6F1]">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-5xl">
                        <span>{b.icon}</span>
                      </div>
                    )}

                    <span className="absolute left-2 top-2 rounded-full bg-[#E2574C] px-2 py-1 text-[8px] font-black text-white">
                      {product.discount_percent}%
                    </span>
                  </div>

                  <div className="p-3">
                    <h3 className="truncate text-[10px] font-black text-[#1D2B1F]">
                      {product.name}
                    </h3>
                    <p className="mt-1 truncate text-[8px] text-[#8A968C]">
                      {b.name}
                    </p>

                    {finalPrice !== null && (
                      <div className="mt-2">
                        <span className="text-[10px] font-black text-[#E2574C]">
                          {formatPrice(finalPrice)}
                        </span>
                        <span className="mr-2 text-[8px] text-[#B7C2B8] line-through">
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
        <section className="rounded-[26px] border border-[#E3EBDE] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FBEEDA] text-lg shadow-[0_0_14px_rgba(255,183,77,.3)]">
              ⭐
            </span>
            <h2 className="text-lg font-black text-[#1D2B1F] sm:text-xl">
              محبوب‌های جم
            </h2>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {popular.map((b) => (
              <Link
                key={b.id}
                href={`/business/${b.id}`}
                className="flex items-center gap-3 rounded-2xl border border-[#E3EBDE] p-3 transition hover:border-[#CFE6D6] hover:bg-[#F7FAF6]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3FAF5] text-xl">
                  {b.icon}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-black text-[#1D2B1F]">
                    {b.name}
                  </span>
                  <span className="mt-1 block text-[8px] text-[#8A968C]">
                    {businessCategoryLabel(b.category)}
                  </span>
                </span>

                <span className="text-[9px] font-black text-[#D98F2B]">
                  ⭐ {b.rating_avg.toFixed(1)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* BIG CHAT CTA */}
      <section className="relative overflow-hidden rounded-[28px] border border-[#CFE6D6] bg-gradient-to-l from-[#EAF7EE] to-[#F7F9F4] p-6 sm:p-8">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-xl shadow-sm sm:flex">
              💬
            </span>
            <div>
              <h2 className="text-xl font-black text-[#1D2B1F] sm:text-2xl">
                حرفی داری؟
                <span className="text-[#147A4B]"> بیا توی جم بگو.</span>
              </h2>
              <p className="mt-2 max-w-xl text-[10px] leading-6 text-[#66766A]">
                با همشهری‌ها صحبت کن، آگهی بگذار و از اتفاقات شهر باخبر شو.
              </p>
            </div>
          </div>

          <Link
            href="/wall"
            className="shrink-0 rounded-2xl bg-[#0f9a56] px-7 py-3.5 text-center text-xs font-black text-white shadow-[0_0_26px_rgba(57,255,143,.55)] transition hover:bg-[#0c8248] hover:shadow-[0_0_36px_rgba(57,255,143,.75)]"
          >
            💬 ورود به دیوار جم
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section className="grid grid-cols-3 gap-3">
        <Stat icon="🏪" iconBg="#E3F3E9" value={businesses?.length ?? 0} text="کسب‌وکار" />
        <Stat icon="👑" iconBg="#FBEEDA" value={goldBusinesses.length} text="طلایی" />
        <Stat icon="🎁" iconBg="#FCE7E4" value={discounts.length} text="تخفیف فعال" />
      </section>

      {/* USER */}
      <section className="text-center">
        <p className="text-[9px] text-[#8A968C]">
          {user
            ? `خوش آمدی ${profile?.display_name || "همشهری"} 🌿`
            : "جم سیتی؛ شهر دیجیتال خودت را بساز."}
        </p>

        {!user && (
          <Link
            href="/login"
            className="mt-3 inline-block rounded-full bg-[#1D2B1F] px-6 py-2.5 text-[9px] font-bold text-white"
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#1D2B1F]/40 backdrop-blur-sm sm:items-center"
          onClick={() => setTorobModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="torob-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-t-[28px] border border-[#F0DCB4] bg-white p-5 shadow-[0_-20px_50px_rgba(0,0,0,.15)] sm:rounded-[28px] sm:p-6"
          >
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FBEEDA] text-base">
                  🛒
                </span>
                <div>
                  <h2
                    id="torob-modal-title"
                    className="text-[12px] font-black text-[#1D2B1F]"
                  >
                    خرید با کف قیمت بازار
                  </h2>
                  <p className="text-[8px] text-[#8A968C]">
                    جستجو در ترب، مقایسه‌گر قیمت
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTorobModalOpen(false)}
                aria-label="بستن"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F3F6F1] text-[10px] text-[#66766A] transition hover:bg-[#E3EBDE] hover:text-[#1D2B1F]"
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
                className="w-full rounded-2xl border border-[#E3EBDE] bg-[#F7F9F4] px-4 py-3 text-[11px] text-[#1D2B1F] placeholder:text-[#B0BAB1] outline-none transition focus:border-[#D98F2B] focus:bg-white"
              />

              <button
                type="submit"
                disabled={!torobQuery.trim()}
                className="mt-3 w-full rounded-2xl bg-[#D98F2B] px-4 py-3 text-[10px] font-black text-white transition hover:bg-[#c47f26] disabled:cursor-not-allowed disabled:opacity-40"
              >
                جستجو در ترب ←
              </button>
            </form>

            {torobRecent.length > 0 && (
              <div className="relative mt-4">
                <p className="mb-2 text-[8px] font-bold text-[#8A968C]">
                  جستجوهای اخیر
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {torobRecent.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => openTorobSearch(item)}
                      className="rounded-full border border-[#E3EBDE] bg-[#F7F9F4] px-3 py-1.5 text-[9px] text-[#3A4A3D] transition hover:border-[#F0DCB4] hover:bg-[#FBEEDA] hover:text-[#8A7150]"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative mt-4">
              <p className="mb-2 text-[8px] font-bold text-[#8A968C]">
                پیشنهادی
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TOROB_SUGGESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => openTorobSearch(item)}
                    className="rounded-full border border-[#E3EBDE] bg-[#F7F9F4] px-3 py-1.5 text-[9px] text-[#3A4A3D] transition hover:border-[#F0DCB4] hover:bg-[#FBEEDA] hover:text-[#8A7150]"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <p className="relative mt-4 text-center text-[7px] text-[#B0BAB1]">
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
  iconBg,
  value,
  text,
}: {
  icon: string;
  iconBg: string;
  value: number;
  text: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[#E3EBDE] bg-white p-4">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </span>

      <span>
        <strong className="block text-sm font-black text-[#1D2B1F]">
          {new Intl.NumberFormat("fa-IR").format(value)}
        </strong>

        <small className="text-[8px] text-[#8A968C]">{text}</small>
      </span>
    </div>
  );
}
