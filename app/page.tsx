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
  image_url: string | null; // عکس واقعی کسب‌وکار — اگر اسم ستون در دیتابیس شما فرق دارد همینجا و در select پایین‌تر عوض کنید
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

// دسته‌هایی که پنل اختصاصی و جدول محصول جدا از business_products دارن.
// وقتی دسته‌ی جدیدی پنل اختصاصی گرفت، همینجا و توی افکت/useMemo مربوطه اضافه‌ش کن.
const CAR_DEALER_CATEGORY = "car_dealer";
const SHOES_BAGS_CATEGORY = "shoes";

// اولویت نمایش کسب‌وکارهای طلایی روی صفحه اصلی (وقتی بیشتر از ۵ تا طلایی وجود داشته باشه):
// ۱) اتوگالری  ۲) فروشگاه‌های خرده‌فروشی  ۳) املاک  ۴) بقیه‌ی دسته‌ها
const GOLD_PRIORITY_GROUPS: string[][] = [
  ["car_dealer"],
  [
    "clothing",
    "shoes",
    "cosmetics",
    "jewelry",
    "watch_glasses",
    "mobile",
    "computer",
    "electronics",
    "home_appliances",
    "furniture",
    "supermarket",
    "fruit_store",
    "butcher",
    "bakery",
    "shop",
  ],
  ["real_estate"],
];

function goldCategoryPriority(category: string) {
  const idx = GOLD_PRIORITY_GROUPS.findIndex((group) => group.includes(category));
  return idx === -1 ? GOLD_PRIORITY_GROUPS.length : idx;
}

type Vehicle = {
  id: string;
  business_id: string;
  brand: string;
  model: string;
  price: number | null;
  image_url: string | null;
  is_sold: boolean;
};

type FootwearItem = {
  id: string;
  business_id: string;
  brand: string;
  product_type: string;
  price: number | null;
  image_urls: string[] | null;
  stock_quantity: number | null;
};

// شکل یکسان‌شده‌ی محصول برای نمایش توی ردیف طلایی، صرف‌نظر از این‌که از کدوم جدول اومده
type DisplayProduct = {
  id: string;
  name: string;
  price: number | null;
  image_url: string | null;
  discount_percent: number | null;
};

/* =========================================================
   CITY EVENTS
========================================================= */

type CityEvent = {
  id: string;
  title: string;
  category: string | null;
  event_date: string | null;
};

const TOROB_RECENT_SEARCHES_KEY = "jamcity:torob-recent-searches";
const TOROB_SUGGESTIONS = [
  "گوشی سامسونگ",
  "لپ‌تاپ ایسوس",
  "هدفون بلوتوث",
  "یخچال ساید بای ساید",
];

export default function HomePage() {
  const supabase = useMemo(() => createClient(), []);
  const { user, profile } = useAuth();

  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // محصولات دسته‌های با پنل اختصاصی (فقط برای طلایی‌ها، برای ردیف ویترین طلایی)
  const [goldVehicles, setGoldVehicles] = useState<Vehicle[]>([]);
  const [goldFootwearItems, setGoldFootwearItems] = useState<FootwearItem[]>([]);

  /* رویدادهای منتشرشده */
  const [cityEvents, setCityEvents] = useState<CityEvent[]>([]);

  const [torobModalOpen, setTorobModalOpen] = useState(false);
  const [torobQuery, setTorobQuery] = useState("");
  const [torobRecent, setTorobRecent] = useState<string[]>([]);
  const torobInputRef = useRef<HTMLInputElement>(null);
  const stripDragRef = useRef<{
    element: HTMLDivElement;
    pointerId: number;
    startX: number;
    startScrollLeft: number;
  } | null>(null);

  function beginStripDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const element = event.currentTarget;
    element.classList.add("is-manual");
    element.setPointerCapture(event.pointerId);
    stripDragRef.current = {
      element,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: element.scrollLeft,
    };
  }

  function moveStripDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = stripDragRef.current;
    if (!drag || drag.element !== event.currentTarget || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    drag.element.scrollLeft = drag.startScrollLeft - (event.clientX - drag.startX);
  }

  function endStripDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = stripDragRef.current;
    if (!drag || drag.element !== event.currentTarget || drag.pointerId !== event.pointerId) return;
    if (drag.element.hasPointerCapture(event.pointerId)) drag.element.releasePointerCapture(event.pointerId);
    stripDragRef.current = null;
  }

  function scrollGoldWithWheel(event: React.WheelEvent<HTMLDivElement>) {
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    event.preventDefault();
    event.currentTarget.scrollLeft += delta;
  }

  function prepareGoldLoopDrag(event: React.PointerEvent<HTMLDivElement>) {
    beginStripDrag(event);
    const element = event.currentTarget;
    const segment = element.scrollWidth / 4;
    if (segment > 0 && element.scrollLeft < segment) element.scrollLeft = segment;
  }

  function keepGoldLoop(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const segment = element.scrollWidth / 4;
    if (segment <= 0) return;
    if (element.scrollLeft <= 1) {
      element.scrollLeft = segment + Math.max(0, element.scrollLeft);
    } else if (element.scrollLeft >= segment * 2 - 1) {
      element.scrollLeft = segment + (element.scrollLeft - segment * 2);
    }
  }

  useEffect(() => {
    async function loadHome() {
      const [businessResult, productResult, eventResult] = await Promise.all([
        supabase
          .from("businesses")
          .select(
            "id,name,category,icon,image_url,lat,lng,subscription_tier,rating_avg,rating_count"
          )
          .eq("subscription_status", "approved"),
        supabase
          .from("business_products")
          .select(
            "id,business_id,name,price,description,image_url,discount_percent"
          )
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("events")
          .select("id,title,category,event_date")
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const { data: businessData, error: businessError } = businessResult;

      if (businessError) {
        console.error("Failed to load businesses:", businessError.message);
      }

      setBusinesses((businessData ?? []) as Business[]);

      const { data: productData, error: productError } = productResult;

      if (productError) {
        console.error("Failed to load products:", productError.message);
      }

      setProducts((productData ?? []) as Product[]);

      /* فقط رویدادهای منتشرشده؛ این درخواست هم‌زمان با دو درخواست بالاست. */
      const { data: eventData, error: eventError } = eventResult;

      if (eventError) {
        console.error(
          "Failed to load city events:",
          eventError.message
        );
      }

      setCityEvents((eventData ?? []) as CityEvent[]);
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
      [...(businesses ?? [])]
        .filter((b) => b.subscription_tier === "gold")
        .sort((a, b) => goldCategoryPriority(a.category) - goldCategoryPriority(b.category))
        .slice(0, 5),
    [businesses]
  );

  // برای کسب‌وکارهای طلایی‌ای که دسته‌شون پنل اختصاصی داره (اتوگالری، کیف‌وکفش)،
  // محصولاتشون توی business_products نیست؛ باید از جدول اختصاصی خودشون بخونیم.
  useEffect(() => {
    async function loadGoldSpecialtyProducts() {
      const goldCarDealerIds = goldBusinesses
        .filter((b) => b.category === CAR_DEALER_CATEGORY)
        .map((b) => b.id);

      const goldShoeStoreIds = goldBusinesses
        .filter((b) => b.category === SHOES_BAGS_CATEGORY)
        .map((b) => b.id);

      if (goldCarDealerIds.length > 0) {
        const { data, error } = await supabase
          .from("vehicle_listings")
          .select("id,business_id,brand,model,price,image_url,is_sold")
          .in("business_id", goldCarDealerIds)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Failed to load gold vehicle listings:", error.message);
        }
        setGoldVehicles((data ?? []) as Vehicle[]);
      } else {
        setGoldVehicles([]);
      }

      if (goldShoeStoreIds.length > 0) {
        const { data, error } = await supabase
          .from("footwear_bag_listings")
          .select("id,business_id,brand,product_type,price,image_urls,stock_quantity")
          .in("business_id", goldShoeStoreIds)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Failed to load gold footwear/bag listings:", error.message);
        }
        setGoldFootwearItems((data ?? []) as FootwearItem[]);
      } else {
        setGoldFootwearItems([]);
      }
    }

    if (goldBusinesses.length > 0) {
      loadGoldSpecialtyProducts();
    } else {
      setGoldVehicles([]);
      setGoldFootwearItems([]);
    }
  }, [supabase, goldBusinesses]);

  // ردیف‌های «محصولات ویترین طلایی»: برای هر کسب‌وکار طلایی که محصول ثبت کرده،
  // اسم کسب‌وکار + اسکرول افقی محصولاتش. فقط طلایی‌ها؛ کسب‌وکار طلایی بدون محصول نمایش داده نمی‌شود.
  // هر دسته محصولاتش رو از جدول خودش می‌گیره (عمومی‌ها از business_products،
  // اتوگالری از vehicle_listings، کیف‌وکفش از footwear_bag_listings).
  const goldProductGroups = useMemo(
    () =>
      goldBusinesses
        .map((business) => {
          let items: DisplayProduct[];

          if (business.category === CAR_DEALER_CATEGORY) {
            items = goldVehicles
              .filter((v) => v.business_id === business.id && !v.is_sold)
              .map((v) => ({
                id: v.id,
                name: `${v.brand} ${v.model}`,
                price: v.price,
                image_url: v.image_url,
                discount_percent: null,
              }));
          } else if (business.category === SHOES_BAGS_CATEGORY) {
            items = goldFootwearItems
              .filter((f) => f.business_id === business.id && f.stock_quantity !== 0)
              .map((f) => ({
                id: f.id,
                name: `${f.brand} ${f.product_type}`,
                price: f.price,
                image_url: f.image_urls?.[0] ?? null,
                discount_percent: null,
              }));
          } else {
            items = products
              .filter((p) => p.business_id === business.id)
              .map((p) => ({
                id: p.id,
                name: p.name,
                price: p.price,
                image_url: p.image_url,
                discount_percent: p.discount_percent,
              }));
          }

          return { business, products: items };
        })
        .filter((group) => group.products.length > 0),
    [goldBusinesses, products, goldVehicles, goldFootwearItems]
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
    <div dir="rtl" className="home-shell space-y-1 rounded-[30px] pb-8 pt-0 sm:space-y-3 sm:pb-10">
      {/* JAM CITY NEWS BAR — نئون: کل ردیف یه لینک واحده به /news */}
      <Link
        href="/news"
        className="group relative mx-auto -mt-1 flex w-full max-w-md items-center gap-1.5 overflow-hidden rounded-full border border-[#39ff8f]/60 bg-white px-3.5 py-1.5 shadow-[0_0_0_1px_rgba(57,255,143,.15),0_6px_24px_rgba(20,122,75,.12)] transition hover:shadow-[0_0_0_1px_rgba(57,255,143,.35),0_0_24px_rgba(57,255,143,.35),0_6px_24px_rgba(20,122,75,.15)]"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#39ff8f]/20 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-24 w-24 rounded-full bg-[#39ff8f]/10 blur-2xl" />

        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eafff3] text-sm shadow-[0_0_12px_rgba(57,255,143,.45)]">
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

      {/* =====================================================
          CITY EVENTS TICKER
          رویدادهای دستی ثبت‌شده توسط مدیر
      ====================================================== */}

      {cityEvents.length > 0 && (
        <section
          aria-label="آخرین رویدادهای جم"
          className="group relative mx-auto -mt-1 flex w-full max-w-[340px] items-center gap-1.5 overflow-hidden rounded-full border border-[#39ff8f]/60 bg-white px-3.5 py-1.5 shadow-[0_0_0_1px_rgba(57,255,143,.15),0_6px_24px_rgba(20,122,75,.12)] transition hover:shadow-[0_0_0_1px_rgba(57,255,143,.35),0_0_24px_rgba(57,255,143,.30),0_6px_24px_rgba(20,122,75,.15)]"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#39ff8f]/15 blur-2xl" />

          <div className="pointer-events-none absolute -left-10 -bottom-10 h-24 w-24 rounded-full bg-[#39ff8f]/10 blur-2xl" />

          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eafff3] text-sm shadow-[0_0_12px_rgba(57,255,143,.45)]">
            📅
          </span>

          <p className="relative hidden shrink-0 text-[11px] font-black text-[#0f9a56] sm:block">
            آخرین رویدادها
          </p>

          <div className="relative h-4 w-px shrink-0 bg-[#39ff8f]/25" />

          <div
            className="relative min-w-0 flex-1 overflow-hidden"
            dir="rtl"
          >
            <div className="jam-events-track flex w-max items-center gap-8 whitespace-nowrap">
              {[...cityEvents, ...cityEvents].map(
                (event, index) => (
                  <Link
                    key={`${event.id}-${index}`}
                    href={`/events/${event.id}`}
                    className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold text-[#3A4A3D] transition hover:text-[#0f9a56]"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#e2574c]" />
                    {event.title}
                  </Link>
                )
              )}
            </div>
          </div>

          <Link
            href="/events"
            className="relative shrink-0 rounded-full bg-[#eafff3] px-2.5 py-1 text-[9px] font-black text-[#0f9a56] transition hover:bg-[#d4ecdc]"
          >
            همه ←
          </Link>
        </section>
      )}

      {/* =====================================================
          HERO — جمع‌وجور، بدون فضای الکی، آیکون چت عمومی نئونی
      ====================================================== */}
      <section className="home-hero relative -mt-1 overflow-hidden rounded-[20px] border border-[#E3EBDE] bg-white shadow-[0_10px_28px_rgba(20,60,40,.06)] sm:rounded-[24px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(57,255,143,.12),transparent_35%),radial-gradient(circle_at_0%_100%,rgba(255,183,77,.10),transparent_32%)]" />

        <div className="relative p-2.5 sm:p-4">
          <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap sm:gap-4 sm:justify-between">
            <div className="min-w-0 flex-1 flex items-center gap-1.5 sm:gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E3F3E9] text-base shadow-[0_0_14px_rgba(57,255,143,.30)] sm:h-12 sm:w-12 sm:text-2xl">🌴</span>
              <div className="min-w-0">
                <h1 className="truncate text-[14px] font-black leading-tight text-[#1D2B1F] sm:text-2xl">
                  به شهر جم <span className="bg-gradient-to-l from-[#147A4B] to-[#2FAE72] bg-clip-text text-transparent">خوش آمدید</span>
                </h1>
                <p className="mt-0.5 truncate text-[8px] text-[#8A968C] sm:text-[10px]">شهر دیجیتال خودت را بساز</p>
              </div>
            </div>
            <Link href="/referral" aria-label="باشگاه معرفی جم‌سیتی" className="flex shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-[#EBCB93] bg-gradient-to-l from-[#FFF0D0] via-white to-[#FFF9EA] px-2.5 py-2 text-[9px] font-black text-[#A96819] shadow-[0_8px_20px_rgba(217,143,43,.16)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(217,143,43,.24)] sm:w-auto sm:min-w-[220px] sm:px-4 sm:py-3 sm:text-[11px]">
              <span className="text-xl">🎁</span><span>باشگاه معرفی جم‌سیتی</span><span className="text-sm">←</span>
            </Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes jamChatGlow {
          0%, 100% {
            box-shadow: 0 0 10px 2px rgba(255, 45, 85, 0.55),
              0 0 0 1px rgba(255, 45, 85, 0.35);
          }
          50% {
            box-shadow: 0 0 24px 8px rgba(255, 45, 85, 0.85),
              0 0 0 1px rgba(255, 45, 85, 0.6);
          }
        }
        .jam-chat-glow {
          animation: jamChatGlow 2.1s ease-in-out infinite;
        }
        @keyframes jamChatPing {
          0% {
            box-shadow: 0 0 0 0 rgba(255, 45, 85, 0.5);
          }
          70% {
            box-shadow: 0 0 0 14px rgba(255, 45, 85, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(255, 45, 85, 0);
          }
        }
        .jam-chat-ping {
          animation: jamChatPing 2.1s ease-out infinite;
        }

        @keyframes jamEventsTicker {
          from {
            transform: translateX(-50%);
          }

          to {
            transform: translateX(0);
          }
        }

        .jam-events-track {
          animation: jamEventsTicker 32s linear infinite;
          will-change: transform;
        }

        .jam-events-track:hover {
          animation-play-state: paused;
        }

            @keyframes jamPopularTicker {
              from {
                transform: translateX(-33.3333%);
              }
              to {
                transform: translateX(0);
              }
            }

        .jam-popular-track {
          animation: jamPopularTicker 42s linear infinite;
          will-change: transform;
        }

        .jam-popular-track:hover {
          animation-play-state: paused;
        }

            @keyframes jamDiscountTicker {
              from { transform: translateX(-33.3333%); }
              to { transform: translateX(0); }
            }

        .jam-discount-track {
          animation: jamDiscountTicker 46s linear infinite;
          will-change: transform;
        }

        .jam-discount-track:hover {
          animation-play-state: paused;
        }

        .jam-popular-viewport,
        .gold-home-viewport,
        .discount-home-viewport {
          scrollbar-width: none;
          -ms-overflow-style: none;
          cursor: grab;
          touch-action: pan-x;
          overscroll-behavior-x: contain;
        }

        .jam-popular-viewport::-webkit-scrollbar,
        .gold-home-viewport::-webkit-scrollbar,
        .discount-home-viewport::-webkit-scrollbar {
          display: none;
        }

        .jam-popular-viewport.is-manual,
        .gold-home-viewport.is-manual,
        .discount-home-viewport.is-manual {
          cursor: grabbing;
        }

        .jam-popular-viewport.is-manual .jam-popular-track,
        .gold-home-viewport.is-manual .gold-home-track,
        .discount-home-viewport.is-manual .discount-home-track {
          animation-play-state: paused !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .jam-events-track {
            animation: none;
          }
          .jam-popular-track,
          .jam-discount-track {
            animation: none;
          }
        }
      `}</style>

      {/* WALL FIRST — محور اصلی تجربه صفحه */}
      <section className="wall-home-feature relative overflow-hidden rounded-[28px] border border-[#f1c1cb] bg-white p-3 shadow-[0_16px_38px_rgba(198,38,76,.12)] sm:p-5">
        <div className="absolute -left-10 -top-12 h-40 w-40 rounded-full bg-[#ffd9e1]/70 blur-3xl" />
        <div className="absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-[#ffe8ae]/55 blur-3xl" />
        <div className="relative flex flex-row items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1 flex items-start gap-2 sm:gap-3">
            <span className="wall-home-feature-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-[0_10px_24px_rgba(198,38,76,.28)] sm:h-16 sm:w-16 sm:text-4xl">💬</span>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-[#c6264c] px-2 py-1 text-[8px] font-black text-white">محور اصلی شهر</span>
                <span className="text-[9px] font-bold text-[#bd6678]">گفتگو، خبر و آگهی‌های محلی</span>
              </div>
              <h2 className="text-lg font-black text-[#351d25] sm:text-2xl">دیوار شهر جم</h2>
              <p className="mt-1 max-w-xl text-[10px] leading-6 text-[#80636b] sm:text-xs">صدای شهروندان جم را ببینید، با همسایه‌ها گفتگو کنید و پیشنهادها و خبرهای مهم شهر را در یک فضای زنده دنبال کنید.</p>
            </div>
          </div>
          <Link href="/wall" className="wall-entry-cta group flex w-auto max-w-[112px] shrink-0 items-center justify-center gap-1 rounded-2xl bg-gradient-to-l from-[#c6264c] to-[#ef476f] px-2 py-2 text-[9px] leading-4 font-black text-white shadow-[0_10px_22px_rgba(198,38,76,.28)] transition hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(198,38,76,.36)] sm:max-w-none sm:gap-2 sm:px-5 sm:py-3 sm:text-xs">
            <span className="wall-entry-icon" aria-hidden="true">💬</span>
            <span>ورود به دیوار جم</span>
            <span className="text-base transition group-hover:-translate-x-1">←</span>
          </Link>
        </div>


      </section>

        {goldBusinesses.length > 0 && (
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-[#efd49b] bg-gradient-to-l from-[#fff7df] via-white to-[#fffaf0] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#ffe29a] to-[#c88b24] text-base shadow-sm">👑</span>
                <div>
                  <h3 className="text-[11px] font-black text-[#704817] sm:text-sm">ویترین طلایی کنار دیوار</h3>
                  <p className="text-[8px] font-bold text-[#ae8750] sm:text-[9px]">کسب‌وکارها و محصولات منتخب جم</p>
                </div>
              </div>
              <Link href="/businesses" className="rounded-full bg-white px-2.5 py-1.5 text-[8px] font-black text-[#a66b19] shadow-sm transition hover:bg-[#fff3cf]">مشاهده همه ←</Link>
            </div>

            <div
              className="gold-home-viewport min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-2xl bg-white/55 px-1 py-1.5"
              dir="ltr"
              onPointerDown={prepareGoldLoopDrag}
              onPointerMove={moveStripDrag}
              onPointerUp={endStripDrag}
              onPointerCancel={endStripDrag}
              onWheel={scrollGoldWithWheel}
              onScroll={keepGoldLoop}
            >
              <div className="gold-home-track flex w-max gap-2.5" dir="rtl">
              {[...goldBusinesses, ...goldBusinesses, ...goldBusinesses, ...goldBusinesses].map((business, index) => {
                const group = goldProductGroups.find((item) => item.business.id === business.id);
                const firstProduct = group?.products[0];
                return (
                  <Link key={business.id} href={`/business/${business.id}`} className="priority-gold-card group flex min-w-[190px] shrink-0 items-center gap-2 rounded-2xl border border-[#f0ddb2] bg-white/90 p-2 transition hover:-translate-y-1 hover:shadow-[0_10px_22px_rgba(180,119,21,.16)]">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-2 border-[#f0d27f] bg-[#fff6dc] shadow-sm">
                      {business.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img loading="lazy" decoding="async" src={business.image_url} alt={business.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                      ) : <div className="flex h-full w-full items-center justify-center text-2xl">{business.icon || "🏪"}</div>}
                      <span className="absolute -bottom-0.5 -left-0.5 text-xs">👑</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-black text-[#34271f]">{business.name}</p>
                      <p className="mt-1 text-[8px] font-bold text-[#bd8b35]">{business.rating_count > 0 ? `⭐ ${business.rating_avg.toFixed(1)}` : "کسب‌وکار منتخب"}</p>
                      {firstProduct ? (
                        <p className="mt-1 truncate text-[8px] font-bold text-[#147a4b]">{firstProduct.name}</p>
                      ) : <p className="mt-1 text-[8px] text-[#9f8b72]">مشاهده محصولات ←</p>}
                    </div>
                  </Link>
                );
              })}
              </div>
            </div>
          </div>
        )}


      {/* MAP */}
      <section>
        {categories.length > 0 && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-[#E3EBDE] bg-white px-2.5 py-2 shadow-sm">
            <span className="shrink-0 text-[9px] font-black text-[#66766A]">دسته‌بندی</span>
            <select
              value={activeCategory ?? ""}
              onChange={(event) => setActiveCategory(event.target.value || null)}
              aria-label="فیلتر دسته‌بندی کسب‌وکارها"
              className="min-w-0 flex-1 appearance-none rounded-xl border border-[#E3EBDE] bg-[#F7F9F4] px-3 py-2 text-right text-[10px] font-bold text-[#3A4A3D] outline-none focus:border-[#147A4B]"
            >
              <option value="">همه کسب‌وکارها</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
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

      {/* GOLD PRODUCTS BELOW MAP — ثابت و فقط قابل اسکرول دستی */}
      {goldProductGroups.length > 0 && (
        <section className="relative overflow-hidden rounded-[24px] border border-[#EFD49B] bg-gradient-to-l from-[#FFF8E6] via-white to-[#FFFCF3] p-3 shadow-[0_8px_26px_rgba(180,119,21,.10)] sm:p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFE29A] to-[#C88B24] text-base shadow-sm">👑</span>
            <div>
              <h2 className="text-[11px] font-black text-[#704817] sm:text-sm">منوی کسب‌وکارهای طلایی</h2>
              <p className="text-[8px] font-bold text-[#AE8750] sm:text-[9px]">محصولات منتخب کسب‌وکارهای ویژه جم</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {goldProductGroups.map(({ business, products: groupProducts }) => (
              <div key={business.id} className="flex min-w-0 items-stretch gap-2 rounded-2xl border border-[#F0DDB2] bg-white/70 p-1.5 sm:gap-2.5 sm:p-2" dir="rtl">
                <Link href={`/business/${business.id}`} className="flex w-[72px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-[#F0D27F] bg-gradient-to-b from-[#FFF8DF] to-[#FFF0C4] px-1 py-1.5 text-center transition hover:shadow-[0_8px_18px_rgba(180,119,21,.16)] sm:w-[104px] sm:gap-1 sm:px-2 sm:py-2">
                  <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border-2 border-[#F0D27F] bg-white text-base shadow-sm sm:h-10 sm:w-10 sm:text-xl">
                    {business.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img loading="lazy" decoding="async" src={business.image_url} alt={business.name} className="h-full w-full object-cover" />
                    ) : (business.icon || "🏪")}
                    <span className="absolute -bottom-0.5 -left-0.5 text-[8px]">👑</span>
                  </span>
                  <span className="w-full truncate text-[8px] font-black text-[#34271F] sm:text-[9px]">{business.name}</span>
                  <span className="truncate text-[7px] font-bold text-[#BD8B35] sm:text-[8px]">{business.rating_count > 0 ? `⭐ ${business.rating_avg.toFixed(1)}` : "منتخب جم"}</span>
                </Link>

                <div className="gold-products-manual-viewport min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-xl bg-white/65 px-1 py-1.5" dir="ltr" onPointerDown={beginStripDrag} onPointerMove={moveStripDrag} onPointerUp={endStripDrag} onPointerCancel={endStripDrag} onWheel={scrollGoldWithWheel}>
                  <div className="flex w-max items-stretch gap-2.5" dir="rtl">
                    {groupProducts.map((product) => (
                      <Link key={product.id} href={`/business/${business.id}`} className="group flex w-[172px] shrink-0 items-center gap-2 rounded-xl border border-[#F0DDB2] bg-white p-1.5 transition hover:-translate-y-0.5 hover:border-[#D9A63A] hover:shadow-[0_8px_18px_rgba(180,119,21,.14)] sm:w-[208px] sm:p-2">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#FFF6DC] sm:h-14 sm:w-14">
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img loading="lazy" decoding="async" src={product.image_url} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                          ) : <div className="flex h-full w-full items-center justify-center text-xl">{business.icon || "🛍️"}</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[9px] font-black text-[#34271F] sm:text-[10px]">{product.name}</p>
                          {product.price !== null && <p className="mt-1 truncate text-[9px] font-black text-[#A66B19] sm:text-[10px]">{formatPrice(product.price)}</p>}
                          <p className="mt-1 text-[8px] text-[#9F8B72]">مشاهده ←</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* DISCOUNTS — پنل ثابت راست + حرکت آرام کارت‌ها به سمت راست */}
      {discounts.length > 0 && (
        <section className="discount-home-showcase relative overflow-hidden rounded-[24px] border border-[#F0D4CE] bg-gradient-to-l from-[#FFF1EE] via-white to-[#FFF9F7] px-3 py-3.5 shadow-[0_0_24px_rgba(226,87,76,.12)] sm:px-4">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FFC2B9] via-[#E2574C] to-[#FFC2B9]" />
          <div className="flex items-stretch gap-2.5 pt-1" dir="rtl">
            <div className="discount-home-label relative z-20 flex w-[92px] shrink-0 flex-col items-center justify-center rounded-2xl border border-[#F0D4CE] bg-gradient-to-b from-[#FFF8F5] to-[#FFE1DC] px-1.5 py-2 text-center shadow-[0_5px_18px_rgba(226,87,76,.14)] sm:w-[126px] sm:px-2.5">
              <span className="discount-gift flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-xl shadow-sm sm:h-12 sm:w-12 sm:text-2xl">🎁</span>
              <h2 className="mt-1.5 text-[10px] font-black leading-4 text-[#A43E37] sm:text-xs">تخفیف‌های داغ جم</h2>
              <p className="mt-0.5 text-[7px] leading-3 text-[#B87972] sm:text-[8px]">پیشنهادهای ویژه امروز</p>
              <span className="mt-1.5 rounded-full bg-white/80 px-2 py-1 text-[7px] font-black text-[#D65349] sm:text-[8px]">فرصت محدود</span>
            </div>

            <div className="discount-home-viewport min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-2xl bg-white/45 px-1 py-1.5" dir="ltr" onPointerDown={beginStripDrag} onPointerMove={moveStripDrag} onPointerUp={endStripDrag} onPointerCancel={endStripDrag} onWheel={scrollGoldWithWheel} onScroll={keepGoldLoop}>
              <div className="discount-home-track flex w-max items-stretch gap-2.5" dir="rtl">
                {[...discounts, ...discounts, ...discounts, ...discounts].map((product, index) => {
                  const business = findBusiness(product.business_id);
                  if (!business) return null;
                  const finalPrice = product.price !== null ? Math.round(product.price * (1 - (product.discount_percent ?? 0) / 100)) : null;
                  return (
                    <Link key={`${product.id}-${index}`} href={`/business/${business.id}`} dir="rtl" className="discount-home-card group flex w-[190px] shrink-0 items-center gap-2 rounded-2xl border border-[#F0D4CE] bg-white p-2 shadow-[0_3px_12px_rgba(128,60,50,.06)] transition hover:-translate-y-1 hover:border-[#E99A90] hover:shadow-[0_9px_22px_rgba(226,87,76,.17)] sm:w-[215px]">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#FFF1EE] sm:h-16 sm:w-16">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img loading="lazy" decoding="async" src={product.image_url} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                        ) : <div className="flex h-full w-full items-center justify-center text-2xl">{business.icon || "🎁"}</div>}
                        <span className="absolute left-1 top-1 rounded-full bg-[#E2574C] px-1.5 py-0.5 text-[7px] font-black text-white shadow-sm">{product.discount_percent}%</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[9px] font-black text-[#34271F] sm:text-[10px]">{product.name}</h3>
                        <p className="mt-1 truncate text-[8px] text-[#9A807A]">{business.name}</p>
                        {finalPrice !== null && <p className="mt-1 truncate text-[9px] font-black text-[#E2574C] sm:text-[10px]">{formatPrice(finalPrice)}</p>}
                      </div>
                      <span className="text-lg text-[#E2574C] transition group-hover:-translate-x-1">←</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1.5"><span className="h-1.5 w-5 rounded-full bg-[#E2574C]" /><span className="h-1.5 w-1.5 rounded-full bg-[#F0D4CE]" /><span className="text-[8px] text-slate-400">حرکت آرام تخفیف‌های ویژه</span></div>
          <style dangerouslySetInnerHTML={{ __html: `            .discount-home-label { isolation:isolate; }
            .discount-home-label::after { content:""; position:absolute; inset:0; z-index:-1; border-radius:inherit; background:linear-gradient(135deg,rgba(255,255,255,.8),transparent 60%); pointer-events:none; }
            .discount-gift { animation:discountGiftFloat 3s ease-in-out infinite; }
            .discount-home-viewport.is-manual .discount-home-track { animation-play-state:paused; }
            @keyframes discountGiftFloat { 0%,100% { transform:translateY(0) rotate(-2deg); } 50% { transform:translateY(-3px) rotate(2deg); } }
            @media (max-width:640px) { .discount-home-track { animation-duration:42s; } }
            @media (prefers-reduced-motion:reduce) { .discount-home-track,.discount-gift { animation:none; } }
` }} />
        </section>
      )}

      {/* POPULAR — آیکون ثابت سمت راست و حرکت آرام لیست از چپ به راست */}
      {popular.length > 0 && (
        <section className="overflow-hidden rounded-[26px] border border-[#E3EBDE] bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-center gap-3">
            <div className="flex w-[92px] shrink-0 flex-col items-center justify-center gap-1 border-l border-[#E3EBDE] pl-3 text-center sm:w-[120px]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FBEEDA] text-lg shadow-[0_0_14px_rgba(255,183,77,.3)]">⭐</span>
              <h2 className="text-[11px] font-black leading-tight text-[#1D2B1F] sm:text-sm">محبوب‌های جم</h2>
            </div>

            <div className="jam-popular-viewport min-w-0 flex-1 overflow-x-auto overflow-y-hidden" dir="ltr" onPointerDown={beginStripDrag} onPointerMove={moveStripDrag} onPointerUp={endStripDrag} onPointerCancel={endStripDrag}>
              <div className="jam-popular-track flex w-max items-stretch gap-2 py-1">
                {[...popular, ...popular, ...popular].map((b, index) => (
                  <Link
                    key={`${b.id}-${index}`}
                    href={`/business/${b.id}`}
                    dir="rtl"
                    className="flex w-[190px] shrink-0 items-center gap-2 rounded-2xl border border-[#E3EBDE] bg-[#FFFEFC] p-2 transition hover:border-[#CFE6D6] hover:bg-[#F7FAF6] sm:w-[215px]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F3FAF5] text-lg">{b.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[9px] font-black text-[#1D2B1F]">{b.name}</span>
                      <span className="mt-1 block truncate text-[8px] text-[#8A968C]">{businessCategoryLabel(b.category)}</span>
                    </span>
                    <span className="shrink-0 text-[8px] font-black text-[#D98F2B]">⭐ {b.rating_avg.toFixed(1)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* BIG CHAT CTA */}
      <section className="relative overflow-hidden rounded-[28px] border border-[#CFE6D6] bg-gradient-to-l from-[#EAF7EE] to-[#F7F9F4] p-3.5 sm:p-8">
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
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
            className="shrink-0 rounded-2xl bg-[#0f9a56] px-4 py-2.5 text-center text-[10px] font-black sm:px-7 sm:py-3.5 sm:text-xs text-white shadow-[0_0_26px_rgba(57,255,143,.55)] transition hover:bg-[#0c8248] hover:shadow-[0_0_36px_rgba(57,255,143,.75)]"
          >
            💬 ورود به دیوار جم
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section className="grid grid-cols-3 gap-1.5 sm:gap-3">
        <Stat icon="🏪" iconBg="#E3F3E9" value={businesses?.length ?? 0} text="کسب‌وکار" />
        <Stat icon="👑" iconBg="#FBEEDA" value={goldBusinesses.length} text="طلایی" />
        <Stat icon="🎁" iconBg="#FCE7E4" value={discounts.length} text="تخفیف فعال" />
      </section>

      {/* USER */}
      {user && (
        <section className="text-center">
          <p className="text-[9px] text-[#8A968C]">
            خوش آمدی {profile?.display_name || "همشهری"} 🌿
          </p>
        </section>
      )}

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
    <div className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#E3EBDE] bg-white p-2.5 sm:gap-2.5 sm:p-4">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base sm:h-9 sm:w-9 sm:text-lg"
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
