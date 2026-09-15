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

  useEffect(() => {
    async function loadHome() {
      const { data: businessData, error: businessError } = await supabase
        .from("businesses")
        .select(
          "id,name,category,icon,image_url,lat,lng,subscription_tier,rating_avg,rating_count"
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

      /* =====================================================
         CITY EVENTS
         فقط رویدادهای منتشرشده
      ===================================================== */

      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id,title,category,event_date")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(10);

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
    <div dir="rtl" className="space-y-2 bg-[#F7F9F4] pb-10">
      {/* JAM CITY NEWS BAR — نئون: کل ردیف یه لینک واحده به /news */}
      <Link
        href="/news"
        className="group relative mx-auto flex max-w-md items-center gap-2 overflow-hidden rounded-full border border-[#39ff8f]/60 bg-white px-3.5 py-1.5 shadow-[0_0_0_1px_rgba(57,255,143,.15),0_6px_24px_rgba(20,122,75,.12)] transition hover:shadow-[0_0_0_1px_rgba(57,255,143,.35),0_0_24px_rgba(57,255,143,.35),0_6px_24px_rgba(20,122,75,.15)]"
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
          className="group relative mx-auto flex max-w-[340px] items-center gap-2 overflow-hidden rounded-full border border-[#39ff8f]/60 bg-white px-3.5 py-1.5 shadow-[0_0_0_1px_rgba(57,255,143,.15),0_6px_24px_rgba(20,122,75,.12)] transition hover:shadow-[0_0_0_1px_rgba(57,255,143,.35),0_0_24px_rgba(57,255,143,.30),0_6px_24px_rgba(20,122,75,.15)]"
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
      <section className="relative overflow-hidden rounded-[20px] border border-[#E3EBDE] bg-white shadow-[0_10px_28px_rgba(20,60,40,.06)] sm:rounded-[24px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(57,255,143,.12),transparent_35%),radial-gradient(circle_at_0%_100%,rgba(255,183,77,.10),transparent_32%)]" />

        <div className="relative p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E3F3E9] text-lg shadow-[0_0_14px_rgba(57,255,143,.30)] sm:h-12 sm:w-12 sm:text-2xl">
                🌴
              </span>

              <div className="min-w-0">
                <h1 className="truncate text-[14px] font-black leading-tight text-[#1D2B1F] sm:text-2xl">
                  به شهر جم
                  <span className="bg-gradient-to-l from-[#147A4B] to-[#2FAE72] bg-clip-text text-transparent">
                    {" "}خوش آمدید
                  </span>
                </h1>
                <p className="mt-0.5 truncate text-[8px] text-[#8A968C] sm:text-[10px]">
                  شهر دیجیتال خودت را بساز
                </p>
              </div>
            </div>

            {/* چت عمومی شهر جم — آیکون نئونی + متن دیوار جم */}
            <Link
              href="/wall"
              aria-label="دیوار شهر جم"
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <span className="jam-chat-glow relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl ring-2 ring-[#ff2d55]/70 sm:h-14 sm:w-14 sm:text-3xl">
                <span className="jam-chat-ping pointer-events-none absolute inset-0 rounded-2xl" />
                <span className="relative">💬</span>
              </span>
              <span className="whitespace-nowrap text-[8px] font-black text-[#c9184a] sm:text-[9px]">
                دیوار جم
              </span>
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Link
              href="/businesses"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E3EBDE] bg-white px-2.5 py-2.5 text-[9px] font-black text-[#1D2B1F] transition hover:border-[#39ff8f]/50 hover:bg-[#F3FAF5] sm:flex-none sm:px-5"
            >
              🏪
              <span>کشف شهر</span>
            </Link>

            <Link
              href="/games/hokm"
              className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-[#E8C36A] bg-gradient-to-l from-[#FFF0C7] to-[#FFF9EA] px-1.5 py-2.5 text-center text-[9px] font-black text-[#8B5A16] shadow-[0_5px_16px_rgba(217,143,43,.18)] transition hover:-translate-y-1 hover:shadow-md sm:flex-row sm:gap-1.5 sm:px-5"
            >
              <span className="text-xl leading-none sm:text-lg">🃏</span>
              <span className="truncate">بازی حکم</span>
            </Link>

            <button
              type="button"
              onClick={() => setTorobModalOpen(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#D98F2B] px-2.5 py-2.5 text-[9px] font-black text-white shadow-[0_0_16px_rgba(255,183,77,.35)] transition hover:bg-[#c47f26] sm:flex-none sm:px-5"
            >
              🛒
              <span>خرید با کف قیمت بازار</span>
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link
              href="/games/hokm/leaderboard"
              className="flex min-h-[44px] min-w-0 items-center justify-center gap-1.5 rounded-xl border border-[#D9C6F1] bg-gradient-to-l from-[#F3EAFE] to-white px-2 py-2 text-center text-[9px] font-black text-[#68419A] shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <span className="text-lg">🏆</span>
              <span className="truncate">قهرمانان حکم</span>
            </Link>

            <Link
              href="/referral"
              className="flex min-h-[44px] min-w-0 items-center justify-center gap-1.5 rounded-xl border border-[#EBCB93] bg-gradient-to-l from-[#FFF0D0] to-white px-2 py-2 text-center text-[9px] font-black text-[#A96819] shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <span className="text-lg">🎁</span>
              <span className="truncate">باشگاه معرفی جم‌سیتی</span>
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
            transform: translateX(-50%);
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
          from { transform: translateX(-50%); }
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
          animation: none !important;
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

      {/* GOLD BUSINESSES — ویترین ثابت راست + حرکت آرام کارت‌ها به سمت راست */}
      {goldBusinesses.length > 0 && (
        <section className="gold-home-showcase relative overflow-hidden rounded-[24px] border border-[#F0DCB4] bg-gradient-to-l from-[#FBEEDA] via-white to-[#FFF9EF] px-3 py-3.5 shadow-[0_0_24px_rgba(255,183,77,.15)] sm:px-4">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FFE29A] via-[#D98F2B] to-[#FFE29A]" />
      
          <div className="flex items-stretch gap-2.5 pt-1" dir="rtl">
            {/* عنوان ثابت سمت راست */}
            <div className="gold-home-label relative z-20 flex w-[92px] shrink-0 flex-col items-center justify-center rounded-2xl border border-[#F0DCB4] bg-gradient-to-b from-[#FFF9E8] to-[#FFE8A8] px-1.5 py-2 text-center shadow-[0_5px_18px_rgba(217,143,43,.16)] sm:w-[126px] sm:px-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-xl shadow-sm sm:h-12 sm:w-12 sm:text-2xl">👑</span>
              <h2 className="mt-1.5 text-[10px] font-black leading-4 text-[#805318] sm:text-xs">ویترین طلایی جم</h2>
              <p className="mt-0.5 text-[7px] leading-3 text-[#A77737] sm:text-[8px]">بهترین کسب‌وکارهای شهر</p>
              <Link href="/businesses" className="mt-1.5 rounded-full bg-white/80 px-2 py-1 text-[7px] font-black text-[#B47735] transition hover:bg-white sm:text-[8px]">همه ←</Link>
            </div>
      
            {/* کسب‌وکارها: حرکت از چپ به راست، پنل راست ثابت است */}
            <div className="gold-home-viewport min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-2xl bg-white/45 px-1 py-1.5" onPointerDown={beginStripDrag} onPointerMove={moveStripDrag} onPointerUp={endStripDrag} onPointerCancel={endStripDrag}>
              <div className="gold-home-track flex w-max items-start gap-2.5">
                {[...goldBusinesses, ...goldBusinesses].map((business, index) => (
                  <Link key={`${business.id}-${index}`} href={`/business/${business.id}`} className="gold-home-card group flex w-[72px] shrink-0 flex-col items-center gap-1.5 sm:w-[82px]">
                    <div className="relative h-[62px] w-[62px] rounded-full bg-gradient-to-br from-[#FFE29A] via-[#D98F2B] to-[#B8721E] p-[2px] shadow-[0_4px_14px_rgba(217,143,43,.32)] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_8px_18px_rgba(217,143,43,.46)] sm:h-[70px] sm:w-[70px]">
                      <div className="h-full w-full overflow-hidden rounded-full border-2 border-white bg-[#FBEEDA]">
                        {business.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img loading="lazy" decoding="async" src={business.image_url} alt={business.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl">{business.icon || "🏪"}</div>
                        )}
                      </div>
                      <span className="absolute -bottom-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#D98F2B] text-[7px] shadow ring-2 ring-white">👑</span>
                    </div>
                    <p className="w-full truncate text-center text-[8px] font-black leading-tight text-[#1D2B1F] sm:text-[9px]">{business.name}</p>
                    {business.rating_count > 0 && <p className="text-[7px] font-bold text-[#D98F2B] sm:text-[8px]">⭐ {business.rating_avg.toFixed(1)}</p>}
                  </Link>
                ))}
              </div>
            </div>
          </div>
      
          {/* محصولات هر کسب‌وکار طلایی؛ بدون تغییر در منطق فعلی */}
          {goldProductGroups.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-[#F0DCB4] pt-3.5">
              {goldProductGroups.map(({ business, products: businessProducts }) => (
                <div key={business.id} className="flex items-stretch gap-3" dir="rtl">
                  <Link href={`/business/${business.id}`} className="flex w-[84px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#F0DCB4] bg-white/75 px-1.5 py-2 text-center">
                    <div className="relative h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-[#FBEEDA] shadow-sm">
                      {business.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img loading="lazy" decoding="async" src={business.image_url} alt={business.name} className="h-full w-full object-cover" />
                      ) : <div className="flex h-full w-full items-center justify-center text-lg">{business.icon || "🏪"}</div>}
                    </div>
                    <p className="line-clamp-2 text-[9px] font-black leading-tight text-[#1D2B1F]">{business.name}</p>
                  </Link>
                  <div className="flex min-w-0 flex-1 gap-2.5 overflow-x-auto pb-1">
                    {businessProducts.map((product) => (
                      <Link key={product.id} href={`/business/${business.id}`} className="group min-w-[104px] max-w-[104px] shrink-0 overflow-hidden rounded-[16px] border border-[#E3EBDE] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                        <div className="relative h-20 overflow-hidden bg-[#F3F6F1]">
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img loading="lazy" decoding="async" src={product.image_url} alt={product.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
                          ) : <div className="flex h-full w-full items-center justify-center bg-[#F3FAF5] text-2xl">{business.icon || "🏪"}</div>}
                          {(product.discount_percent ?? 0) > 0 && <span className="absolute left-1 top-1 rounded-full bg-[#E2574C] px-1.5 py-0.5 text-[6.5px] font-black text-white">{product.discount_percent}% تخفیف</span>}
                        </div>
                        <div className="p-1.5"><h3 className="truncate text-[9px] font-black text-[#1D2B1F]">{product.name}</h3>{product.price !== null && <p className="mt-1 truncate text-[7.5px] font-black text-[#147A4B]">{formatPrice(product.price)}</p>}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
      
          <div className="mt-2 flex items-center justify-center gap-1.5"><span className="h-1.5 w-5 rounded-full bg-[#D98F2B]" /><span className="h-1.5 w-1.5 rounded-full bg-[#F0DCB4]" /><span className="text-[8px] text-slate-400">حرکت آرام پیشنهادهای طلایی</span></div>
      
          <style dangerouslySetInnerHTML={{ __html: `            .gold-home-label { isolation:isolate; }
            .gold-home-label::after { content:""; position:absolute; inset:0; z-index:-1; border-radius:inherit; background:linear-gradient(135deg,rgba(255,255,255,.75),transparent 60%); pointer-events:none; }
            .gold-home-track { animation:goldHomeMoveRight 38s linear infinite; will-change:transform; }
            .gold-home-viewport:hover .gold-home-track { animation-play-state:paused; }
            @keyframes goldHomeMoveRight { from { transform:translateX(-50%); } to { transform:translateX(0); } }
            @media (max-width:640px) { .gold-home-track { animation-duration:44s; } }
            @media (prefers-reduced-motion:reduce) { .gold-home-track { animation:none; } }
` }} />
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

            <div className="discount-home-viewport min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-2xl bg-white/45 px-1 py-1.5" onPointerDown={beginStripDrag} onPointerMove={moveStripDrag} onPointerUp={endStripDrag} onPointerCancel={endStripDrag}>
              <div className="discount-home-track flex w-max items-stretch gap-2.5">
                {[...discounts, ...discounts].map((product, index) => {
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
            .discount-home-track { animation:discountHomeMoveRight 36s linear infinite; will-change:transform; }
            .discount-home-viewport:hover .discount-home-track { animation-play-state:paused; }
            @keyframes discountHomeMoveRight { from { transform:translateX(-50%); } to { transform:translateX(0); } }
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
                {[...popular, ...popular].map((b, index) => (
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
