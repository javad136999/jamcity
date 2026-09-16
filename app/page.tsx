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

const CAR_DEALER_CATEGORY = "car_dealer";
const SHOES_BAGS_CATEGORY = "shoes";

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

type DisplayProduct = {
  id: string;
  name: string;
  price: number | null;
  image_url: string | null;
  discount_percent: number | null;
};

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

const CATEGORY_PRIORITY = [
  "cafe",
  "restaurant",
  "fitness",
  "car_dealer",
  "repair",
];

export default function HomePage() {
  const supabase = useMemo(() => createClient(), []);
  const { user, profile } = useAuth();

  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [goldVehicles, setGoldVehicles] = useState<Vehicle[]>([]);
  const [goldFootwearItems, setGoldFootwearItems] = useState<FootwearItem[]>([]);
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
    drag.element.classList.remove("is-manual");
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
        supabase.from("businesses").select("id,name,category,icon,image_url,lat,lng,subscription_tier,rating_avg,rating_count").eq("subscription_status", "approved"),
        supabase.from("business_products").select("id,business_id,name,price,description,image_url,discount_percent").order("created_at", { ascending: false }).limit(30),
        supabase.from("events").select("id,title,category,event_date").eq("is_published", true).order("created_at", { ascending: false }).limit(10),
      ]);

      const { data: businessData, error: businessError } = businessResult;
      if (businessError) console.error("Failed to load businesses:", businessError.message);
      setBusinesses((businessData ?? []) as Business[]);

      const { data: productData, error: productError } = productResult;
      if (productError) console.error("Failed to load products:", productError.message);
      setProducts((productData ?? []) as Product[]);

      const { data: eventData, error: eventError } = eventResult;
      if (eventError) console.error("Failed to load city events:", eventError.message);
      setCityEvents((eventData ?? []) as CityEvent[]);
    }
    loadHome();
  }, [supabase]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TOROB_RECENT_SEARCHES_KEY);
      if (raw) setTorobRecent(JSON.parse(raw));
    } catch {}
  }, []);

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
      const nextRecent = [query, ...torobRecent.filter((item) => item !== query)].slice(0, 5);
      setTorobRecent(nextRecent);
      window.localStorage.setItem(TOROB_RECENT_SEARCHES_KEY, JSON.stringify(nextRecent));
    } catch {}
    const url = `https://torob.com/search/?query=${encodeURIComponent(query)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setTorobModalOpen(false);
    setTorobQuery("");
  }

  const visibleBusinesses = useMemo(() => (businesses ?? []).filter((b) => !activeCategory || b.category === activeCategory), [businesses, activeCategory]);

  const markers: MapMarker[] = useMemo(() => visibleBusinesses.filter((b) => b.lat !== null && b.lng !== null).map((b) => ({ id: b.id, lat: b.lat!, lng: b.lng!, title: b.name, subtitle: businessCategoryLabel(b.category), href: `/business/${b.id}`, emoji: b.icon, tier: b.subscription_tier, rating: b.rating_count ? b.rating_avg : null })), [visibleBusinesses]);

  const categories = useMemo(() => {
    const available = Array.from(new Set((businesses ?? []).map((b) => b.category)))
      .map((slug) => BUSINESS_CATEGORIES.find((category) => category.slug === slug))
      .filter((category): category is NonNullable<typeof category> => Boolean(category));
    return [...available].sort((a, b) => {
      const ai = CATEGORY_PRIORITY.indexOf(a.slug);
      const bi = CATEGORY_PRIORITY.indexOf(b.slug);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [businesses]);

  const goldBusinesses = useMemo(() => [...(businesses ?? [])].filter((b) => b.subscription_tier === "gold").sort((a, b) => goldCategoryPriority(a.category) - goldCategoryPriority(b.category)).slice(0, 5), [businesses]);

  useEffect(() => {
    async function loadGoldSpecialtyProducts() {
      const goldCarDealerIds = goldBusinesses.filter((b) => b.category === CAR_DEALER_CATEGORY).map((b) => b.id);
      const goldShoeStoreIds = goldBusinesses.filter((b) => b.category === SHOES_BAGS_CATEGORY).map((b) => b.id);
      if (goldCarDealerIds.length > 0) {
        const { data, error } = await supabase.from("vehicle_listings").select("id,business_id,brand,model,price,image_url,is_sold").in("business_id", goldCarDealerIds).order("created_at", { ascending: false });
        if (error) console.error("Failed to load gold vehicle listings:", error.message);
        setGoldVehicles((data ?? []) as Vehicle[]);
      } else setGoldVehicles([]);
      if (goldShoeStoreIds.length > 0) {
        const { data, error } = await supabase.from("footwear_bag_listings").select("id,business_id,brand,product_type,price,image_urls,stock_quantity").in("business_id", goldShoeStoreIds).order("created_at", { ascending: false });
        if (error) console.error("Failed to load gold footwear/bag listings:", error.message);
        setGoldFootwearItems((data ?? []) as FootwearItem[]);
      } else setGoldFootwearItems([]);
    }
    if (goldBusinesses.length > 0) loadGoldSpecialtyProducts();
    else { setGoldVehicles([]); setGoldFootwearItems([]); }
  }, [supabase, goldBusinesses]);

  const goldProductGroups = useMemo(() => goldBusinesses.map((business) => {
    let items: DisplayProduct[];
    if (business.category === CAR_DEALER_CATEGORY) {
      items = goldVehicles.filter((v) => v.business_id === business.id && !v.is_sold).map((v) => ({ id: v.id, name: `${v.brand} ${v.model}`, price: v.price, image_url: v.image_url, discount_percent: null }));
    } else if (business.category === SHOES_BAGS_CATEGORY) {
      items = goldFootwearItems.filter((f) => f.business_id === business.id && f.stock_quantity !== 0).map((f) => ({ id: f.id, name: `${f.brand} ${f.product_type}`, price: f.price, image_url: f.image_urls?.[0] ?? null, discount_percent: null }));
    } else {
      items = products.filter((p) => p.business_id === business.id).map((p) => ({ id: p.id, name: p.name, price: p.price, image_url: p.image_url, discount_percent: p.discount_percent }));
    }
    return { business, products: items };
  }).filter((group) => group.products.length > 0), [goldBusinesses, products, goldVehicles, goldFootwearItems]);

  const discounts = useMemo(() => products.filter((p) => (p.discount_percent ?? 0) > 0).slice(0, 5), [products]);

  const popular = useMemo(() => [...(businesses ?? [])].filter((b) => b.rating_count > 0).sort((a, b) => b.rating_avg - a.rating_avg).slice(0, 5), [businesses]);

  function findBusiness(id: string) { return businesses?.find((b) => b.id === id); }
  function formatPrice(value: number | null) { if (value === null) return ""; return `${new Intl.NumberFormat("fa-IR").format(value)} تومان`; }

  return (
    <div dir="rtl" className="home-shell space-y-1 rounded-[30px] pb-8 pt-0 sm:space-y-3 sm:pb-10">
      {/* JAM CITY NEWS BAR — نئون: کل ردیف یه لینک واحده به /news */}
      <Link href="/news" className="group relative mx-auto -mt-1 flex w-full max-w-md items-center gap-1.5 overflow-hidden rounded-full border border-[#39ff8f]/60 bg-white px-3.5 py-1.5 shadow-[0_0_0_1px_rgba(57,255,143,.15),0_6px_24px_rgba(20,122,75,.12)] transition hover:shadow-[0_0_0_1px_rgba(57,255,143,.35),0_0_24px_rgba(57,255,143,.35),0_6px_24px_rgba(20,122,75,.15)]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#39ff8f]/20 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-24 w-24 rounded-full bg-[#39ff8f]/10 blur-2xl" />
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eafff3] text-sm shadow-[0_0_12px_rgba(57,255,143,.45)]">📰</span>
        <p className="relative hidden shrink-0 text-[11px] font-black text-[#0f9a56] sm:block">اخبار روز</p>
        <div className="relative h-4 w-px shrink-0 bg-[#39ff8f]/25" />
        <div className="relative min-w-0 flex-1 overflow-hidden"><div className="flex items-center gap-2"><span className="flex shrink-0 items-center gap-1 rounded-full bg-[#0f9a56] px-1.5 py-0.5 text-[8px] font-black text-white shadow-[0_0_10px_rgba(57,255,143,.6)]"><span className="h-1 w-1 animate-pulse rounded-full bg-white" />زنده</span><p className="truncate text-[10px] font-bold text-[#3A4A3D]">آخرین اخبار ایران، استان بوشهر و شهر جم</p></div></div>
      </Link>

      {cityEvents.length > 0 && (
        <section aria-label="آخرین رویدادهای جم" className="group relative mx-auto -mt-1 flex w-full max-w-[340px] items-center gap-1.5 overflow-hidden rounded-full border border-[#dfe9df] bg-white px-2.5 py-1.5 shadow-sm">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#effaf2] text-sm">📅</span>
          <div className="relative min-w-0 flex-1 overflow-hidden" dir="rtl"><div className="jam-events-track flex w-max items-center gap-8 whitespace-nowrap">{[...cityEvents, ...cityEvents].map((event, index) => <Link key={`${event.id}-${index}`} href="/events" className="text-[9px] font-black text-[#3A4A3D]">{event.title}</Link>)}</div></div>
        </section>
      )}

      {/* WALL FIRST — محور اصلی تجربه صفحه */}
      <section className="wall-home-feature relative overflow-hidden rounded-[28px] border border-[#f1c1cb] bg-white p-3 shadow-[0_16px_38px_rgba(198,38,76,.12)] sm:p-5">
        <div className="absolute -left-10 -top-12 h-40 w-40 rounded-full bg-[#ffd9e1]/70 blur-3xl" /><div className="absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-[#ffe8ae]/55 blur-3xl" />
        <div className="relative flex flex-row items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1 flex items-start gap-2 sm:gap-3"><span className="wall-home-feature-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-[0_10px_24px_rgba(198,38,76,.28)] sm:h-16 sm:w-16 sm:text-4xl">💬</span><div><div className="mb-1 flex items-center gap-2"><span className="rounded-full bg-[#c6264c] px-2 py-1 text-[8px] font-black text-white">محور اصلی شهر</span><span className="text-[9px] font-bold text-[#bd6678]">گفتگو، خبر و آگهی‌های محلی</span></div><h2 className="text-lg font-black text-[#351d25] sm:text-2xl">دیوار شهر جم</h2><p className="mt-1 max-w-xl text-[10px] leading-6 text-[#80636b] sm:text-xs">صدای شهروندان جم را ببینید، با همسایه‌ها گفتگو کنید و پیشنهادها و خبرهای مهم شهر را در یک فضای زنده دنبال کنید.</p></div></div>
          <Link href="/wall" className="wall-entry-cta group flex w-auto max-w-[112px] shrink-0 items-center justify-center gap-1 rounded-2xl bg-gradient-to-l from-[#c6264c] to-[#ef476f] px-2 py-2 text-[9px] leading-4 font-black text-white shadow-[0_10px_22px_rgba(198,38,76,.28)] transition hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(198,38,76,.36)] sm:max-w-none sm:gap-2 sm:px-5 sm:py-3 sm:text-xs"><span className="wall-entry-icon" aria-hidden="true">💬</span><span>ورود به دیوار جم</span><span className="text-base transition group-hover:-translate-x-1">←</span></Link>
        </div>
      </section>

      {goldBusinesses.length > 0 && (
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-[#efd49b] bg-gradient-to-l from-[#fff7df] via-white to-[#fffaf0] p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#ffe29a] to-[#c88b24] text-base shadow-sm">👑</span><div><h3 className="text-[11px] font-black text-[#704817] sm:text-sm">ویترین طلایی کنار دیوار</h3><p className="text-[8px] font-bold text-[#ae8750] sm:text-[9px]">کسب‌وکارها و محصولات منتخب جم</p></div></div><Link href="/businesses" className="rounded-full bg-white px-2.5 py-1.5 text-[8px] font-black text-[#a66b19] shadow-sm transition hover:bg-[#fff3cf]">مشاهده همه ←</Link></div>
          <div className="gold-home-viewport min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-2xl bg-white/55 px-1 py-1.5" dir="ltr" onPointerDown={prepareGoldLoopDrag} onPointerMove={moveStripDrag} onPointerUp={endStripDrag} onPointerCancel={endStripDrag} onWheel={scrollGoldWithWheel} onScroll={keepGoldLoop}><div className="gold-home-track flex w-max gap-2.5" dir="rtl">{[...goldBusinesses, ...goldBusinesses, ...goldBusinesses, ...goldBusinesses].map((business, index) => { const group = goldProductGroups.find((item) => item.business.id === business.id); const firstProduct = group?.products[0]; return <Link key={`${business.id}-${index}`} href={`/business/${business.id}`} className="priority-gold-card group flex min-w-[190px] shrink-0 items-center gap-2 rounded-2xl border border-[#f0ddb2] bg-white/90 p-2 transition hover:-translate-y-1 hover:shadow-[0_10px_22px_rgba(180,119,21,.16)]"><div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-2 border-[#f0d27f] bg-[#fff6dc] shadow-sm">{business.image_url ? <img loading="lazy" decoding="async" src={business.image_url} alt={business.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" /> : <div className="flex h-full w-full items-center justify-center text-2xl">{business.icon || "🏪"}</div>}<span className="absolute -bottom-0.5 -left-0.5 text-xs">👑</span></div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-black text-[#34271f]">{business.name}</p><p className="mt-1 text-[8px] font-bold text-[#bd8b35]">{business.rating_count > 0 ? `⭐ ${business.rating_avg.toFixed(1)}` : "کسب‌وکار منتخب"}</p>{firstProduct ? <p className="mt-1 truncate text-[8px] font-bold text-[#147a4b]">{firstProduct.name}</p> : <p className="mt-1 text-[8px] text-[#9f8b72]">مشاهده محصولات ←</p>}</div></Link>; })}</div></div>
        </div>
      )}

      <section>
        {categories.length > 0 && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-[#E3EBDE] bg-white px-2.5 py-2 shadow-sm">
            <span className="shrink-0 text-[9px] font-black text-[#66766A]">دسته‌بندی</span>
            <select value={activeCategory ?? ""} onChange={(event) => setActiveCategory(event.target.value || null)} aria-label="فیلتر دسته‌بندی کسب‌وکارها" className="min-w-0 flex-1 appearance-none rounded-xl border border-[#E3EBDE] bg-[#F7F9F4] px-3 py-2 text-right text-[10px] font-bold text-[#3A4A3D] outline-none focus:border-[#147A4B]"><option value="">همه کسب‌وکارها</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.icon} {c.name}</option>)}</select>
        )}
        <div className="relative isolate z-0 overflow-hidden rounded-[28px] border-4 border-white bg-white shadow-[0_0_0_1px_rgba(57,255,143,.25),0_0_35px_rgba(57,255,143,.18),0_15px_45px_rgba(20,60,40,.1)]">
          {businesses === null ? <div className="flex h-80 items-center justify-center"><Spinner label="در حال بارگذاری نقشه..." /></div> : <LeafletMap markers={markers} />}
        </div>
      </section>

      {goldProductGroups.length > 0 && (
        <section className="relative overflow-hidden rounded-[24px] border border-[#EFD49B] bg-gradient-to-l from-[#FFF8E6] via-white to-[#FFFCF3] p-3 shadow-[0_8px_26px_rgba(180,119,21,.10)] sm:p-4">
          <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFE29A] to-[#C88B24] text-base shadow-sm">👑</span><div><h2 className="text-[11px] font-black text-[#704817] sm:text-sm">منوی کسب‌وکارهای طلایی</h2><p className="text-[8px] font-bold text-[#AE8750] sm:text-[9px]">محصولات منتخب کسب‌وکارهای ویژه جم</p></div></div>
          <div className="space-y-2.5">{goldProductGroups.map(({ business, products: groupProducts }) => <div key={business.id} className="flex min-w-0 items-stretch gap-2 rounded-2xl border border-[#F0DDB2] bg-white/70 p-1.5 sm:gap-2.5 sm:p-2" dir="rtl"><Link href={`/business/${business.id}`} className="flex w-[72px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-[#F0D27F] bg-gradient-to-b from-[#FFF8DF] to-[#FFF0C4] px-1 py-1.5 text-center transition hover:shadow-[0_8px_18px_rgba(180,119,21,.16)] sm:w-[104px] sm:gap-1 sm:px-2 sm:py-2"><span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border-2 border-[#F0D27F] bg-white text-base shadow-sm sm:h-10 sm:w-10 sm:text-xl">{business.image_url ? <img loading="lazy" decoding="async" src={business.image_url} alt={business.name} className="h-full w-full object-cover" /> : (business.icon || "🏪")}<span className="absolute -bottom-0.5 -left-0.5 text-[8px]">👑</span></span><span className="w-full truncate text-[8px] font-black text-[#34271F] sm:text-[9px]">{business.name}</span><span className="truncate text-[7px] font-bold text-[#BD8B35] sm:text-[8px]">{business.rating_count > 0 ? `⭐ ${business.rating_avg.toFixed(1)}` : "منتخب جم"}</span></Link><div className="gold-products-manual-viewport min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-xl bg-white/65 px-1 py-1.5" dir="ltr" onPointerDown={beginStripDrag} onPointerMove={moveStripDrag} onPointerUp={endStripDrag} onPointerCancel={endStripDrag} onWheel={scrollGoldWithWheel}><div className="flex w-max items-stretch gap-2.5" dir="rtl">{groupProducts.map((product) => <Link key={product.id} href={`/business/${business.id}`} className="group flex w-[172px] shrink-0 items-center gap-2 rounded-xl border border-[#F0DDB2] bg-white p-1.5 transition hover:-translate-y-0.5 hover:border-[#D9A63A] hover:shadow-[0_8px_18px_rgba(180,119,21,.14)] sm:w-[208px] sm:p-2"><div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#FFF6DC] sm:h-14 sm:w-14">{product.image_url ? <img loading="lazy" decoding="async" src={product.image_url} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" /> : <div className="flex h-full w-full items-center justify-center text-xl">{business.icon || "🛍️"}</div>}</div><div className="min-w-0 flex-1"><p className="truncate text-[9px] font-black text-[#34271F] sm:text-[10px]">{product.name}</p>{product.price !== null && <p className="mt-1 truncate text-[9px] font-black text-[#A66B19] sm:text-[10px]">{formatPrice(product.price)}</p>}<p className="mt-1 text-[8px] text-[#9F8B72]">مشاهده ←</p></div></Link>)}</div></div></div>)}</div>
        </section>
      )}

      {discounts.length > 0 && (
        <section className="relative overflow-hidden rounded-[24px] border border-[#F0D4D4] bg-gradient-to-l from-[#FFF4F4] via-white to-[#FFF9F0] p-3 shadow-sm sm:p-4"><div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFE8E8] text-base">🔥</span><div><h2 className="text-[11px] font-black text-[#7E2F2F] sm:text-sm">تخفیف‌های داغ جم</h2><p className="text-[8px] font-bold text-[#A46F6F] sm:text-[9px]">فرصت‌های محدود کسب‌وکارهای جم</p></div></div><div className="discount-home-viewport min-w-0 overflow-x-auto overflow-y-hidden rounded-2xl bg-white/70 px-1 py-1.5" dir="ltr"><div className="discount-home-track flex w-max gap-2.5" dir="rtl">{discounts.map((product) => { const business = findBusiness(product.business_id); return <Link key={product.id} href={`/business/${product.business_id}`} className="flex w-[180px] shrink-0 items-center gap-2 rounded-xl border border-[#F1DADA] bg-white p-2 shadow-sm"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#FFF0F0]">{product.image_url ? <img loading="lazy" decoding="async" src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xl">🔥</span>}</div><div className="min-w-0 flex-1"><p className="truncate text-[9px] font-black text-[#3E2D2D]">{product.name}</p><p className="mt-1 truncate text-[8px] font-bold text-[#9B6666]">{business?.name ?? "کسب‌وکار جم"}</p><div className="mt-1 flex items-center gap-1"><span className="rounded-full bg-[#FFE5E5] px-1.5 py-0.5 text-[7px] font-black text-[#B23B3B]">{product.discount_percent}% تخفیف</span>{product.price !== null && <span className="truncate text-[7px] font-bold text-[#7E2F2F]">{formatPrice(product.price)}</span>}</div></div></Link>; })}</div></div></section>
      )}

      {popular.length > 0 && (
        <section className="rounded-[24px] border border-[#DCE8E0] bg-white p-3 shadow-sm sm:p-4"><div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EAF6EE] text-base">⭐</span><div><h2 className="text-[11px] font-black text-[#255A3D] sm:text-sm">محبوب‌های جم</h2><p className="text-[8px] font-bold text-[#8AA194] sm:text-[9px]">کسب‌وکارهای محبوب شهر</p></div></div><div className="jam-popular-viewport min-w-0 overflow-x-auto overflow-y-hidden rounded-2xl bg-[#F8FBF8] px-1 py-1.5" dir="ltr"><div className="jam-popular-track flex w-max gap-2.5" dir="rtl">{popular.map((business) => <Link key={business.id} href={`/business/${business.id}`} className="flex w-[175px] shrink-0 items-center gap-2 rounded-xl border border-[#E1ECE4] bg-white p-2 shadow-sm"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#EDF7F0]">{business.image_url ? <img loading="lazy" decoding="async" src={business.image_url} alt={business.name} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xl">{business.icon || "🏪"}</span>}</div><div className="min-w-0 flex-1"><p className="truncate text-[9px] font-black text-[#274A36]">{business.name}</p><p className="mt-1 text-[8px] font-bold text-[#C28A29]">⭐ {business.rating_avg.toFixed(1)}</p><p className="mt-1 truncate text-[7px] text-[#8AA194]">{businessCategoryLabel(business.category)}</p></div></Link>)}</div></div></section>
      )}

      {torobModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#15251c]/55 p-4 backdrop-blur-sm" onClick={() => setTorobModalOpen(false)}>
          <div className="relative w-full max-w-lg rounded-[28px] border border-[#E3EBDE] bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between"><button type="button" onClick={() => setTorobModalOpen(false)} className="rounded-full bg-[#F7F9F4] px-3 py-1.5 text-[9px] font-black text-[#526258]">بستن</button><h2 className="text-sm font-black text-[#26382C]">جستجو در ترب</h2></div>
            <div className="mt-4 flex gap-2"><input ref={torobInputRef} value={torobQuery} onChange={(event) => setTorobQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") openTorobSearch(torobQuery); }} placeholder="مثلاً گوشی سامسونگ" className="min-w-0 flex-1 rounded-2xl border border-[#E3EBDE] bg-[#F7F9F4] px-4 py-3 text-xs outline-none focus:border-[#147A4B]" /><button type="button" onClick={() => openTorobSearch(torobQuery)} className="rounded-2xl bg-[#147A4B] px-4 py-3 text-xs font-black text-white">جستجو</button></div>
            {torobRecent.length > 0 && <div className="relative mt-4"><p className="mb-2 text-[8px] font-bold text-[#8A968C]">جستجوهای اخیر</p><div className="flex flex-wrap gap-1.5">{torobRecent.map((item) => <button key={item} type="button" onClick={() => openTorobSearch(item)} className="rounded-full border border-[#E3EBDE] bg-[#F7F9F4] px-3 py-1.5 text-[9px] text-[#3A4A3D]">{item}</button>)}</div></div>}
            <div className="relative mt-4"><p className="mb-2 text-[8px] font-bold text-[#8A968C]">پیشنهادی</p><div className="flex flex-wrap gap-1.5">{TOROB_SUGGESTIONS.map((item) => <button key={item} type="button" onClick={() => openTorobSearch(item)} className="rounded-full border border-[#E3EBDE] bg-[#F7F9F4] px-3 py-1.5 text-[9px] text-[#3A4A3D]">{item}</button>)}</div></div>
            <p className="relative mt-4 text-center text-[7px] text-[#B0BAB1]">نتایج در تب جدید از سایت ترب باز می‌شود</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, iconBg, value, text }: { icon: string; iconBg: string; value: number; text: string }) {
  return <div className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#E3EBDE] bg-white p-2.5 sm:gap-2.5 sm:p-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base sm:h-9 sm:w-9 sm:text-lg" style={{ backgroundColor: iconBg }}>{icon}</span><span><strong className="block text-sm font-black text-[#1D2B1F]">{new Intl.NumberFormat("fa-IR").format(value)}</strong><small className="text-[8px] text-[#8A968C]">{text}</small></span></div>;
}
