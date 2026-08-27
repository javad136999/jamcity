"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  businessCategoryLabel,
  BUSINESS_CATEGORIES,
  formatPrice,
} from "@/lib/constants";
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

type Product = {
  id: string;
  business_id: string;
  name: string;
  price: number | null;
  description: string | null;
  image_url: string | null;
  discount_percent: number | null;
};

export default function HomePage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [allBusinesses, setAllBusinesses] = useState<BizRow[] | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [goldBusinesses, setGoldBusinesses] = useState<BizRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [goldIndex, setGoldIndex] = useState(0);
  const [loadingGold, setLoadingGold] = useState(true);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.refresh();
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("businesses")
        .select(
          "id, name, category, icon, lat, lng, subscription_tier, rating_avg, rating_count"
        )
        .eq("subscription_status", "approved");

      const rows = (data ?? []) as BizRow[];

      setAllBusinesses(rows);

      const gold = rows.filter(
        (b) => b.subscription_tier === "gold"
      );

      setGoldBusinesses(gold);

      if (gold.length > 0) {
        const ids = gold.map((b) => b.id);

        const { data: productData } = await supabase
          .from("business_products")
          .select(
            "id, business_id, name, price, description, image_url, discount_percent"
          )
          .in("business_id", ids)
          .order("created_at", { ascending: false });

        setProducts((productData ?? []) as Product[]);
      }

      setLoadingGold(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * هر 12 ثانیه دو کسب‌وکار طلایی بعدی
   */
  useEffect(() => {
    if (goldBusinesses.length <= 2) return;

    const timer = window.setInterval(() => {
      setGoldIndex((prev) => {
        const next = prev + 2;
        return next >= goldBusinesses.length ? 0 : next;
      });
    }, 12000);

    return () => window.clearInterval(timer);
  }, [goldBusinesses.length]);

  const visibleBusinesses = goldBusinesses.slice(
    goldIndex,
    goldIndex + 2
  );

  const displayBusinesses =
    visibleBusinesses.length === 2
      ? visibleBusinesses
      : goldBusinesses.length > 1
      ? [visibleBusinesses[0], goldBusinesses[0]]
      : visibleBusinesses;

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
      Array.from(
        new Set((allBusinesses ?? []).map((b) => b.category))
      )
        .map((slug) =>
          BUSINESS_CATEGORIES.find((c) => c.slug === slug)
        )
        .filter(
          (c): c is (typeof BUSINESS_CATEGORIES)[number] =>
            !!c
        ),
    [allBusinesses]
  );

  return (
    <div className="fade-in space-y-3 pb-5 sm:space-y-8">

      {/* هدر */}
      <section className="rounded-2xl glass px-3 py-2.5 shadow-soft sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-slate-800 sm:text-lg">
              شهر جم
            </p>

            <p className="text-[10px] text-slate-400 sm:text-xs">
              {user
                ? `خوش آمدید، ${profile?.display_name || "کاربر"}`
                : "پلتفرم شهری جم"}
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
          به وب‌شهر زیبای جم خوش آمدید 🌿 در دیوار شهر می‌توانید
          آگهی‌های خود را تبلیغ کنید و همچنین روی نقشه، کسب‌وکار خود
          را نمایش دهید.
        </p>
      </section>

      {/* دو دکمه اصلی */}
      <section className="grid grid-cols-2 gap-2 sm:gap-4">

        <Link
          href="/business/register"
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-l from-teal-500 to-cyan-500 p-3 text-white shadow-soft transition hover:-translate-y-0.5 sm:rounded-3xl sm:p-8"
        >
          <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-lg sm:mb-6 sm:h-14 sm:w-14 sm:rounded-2xl sm:text-3xl">
            🏪
          </span>

          <h2 className="mb-0.5 text-xs font-extrabold sm:mb-2 sm:text-2xl">
            ثبت کسب و کار
          </h2>

          <p className="mb-1 hidden text-sm text-white/85 sm:mb-4 sm:block">
            کسب و کار خود را ثبت کنید و روی نقشه نمایش دهید
          </p>

          <span className="text-[10px] font-bold sm:text-sm">
            شروع ثبت ‹
          </span>
        </Link>

        <Link
          href="/wall"
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-l from-orange-500 to-amber-500 p-3 text-white shadow-soft transition hover:-translate-y-0.5 sm:rounded-3xl sm:p-8"
        >
          <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-lg sm:mb-6 sm:h-14 sm:w-14 sm:rounded-2xl sm:text-3xl">
            💬
          </span>

          <h2 className="mb-0.5 text-xs font-extrabold sm:mb-2 sm:text-2xl">
            دیوار شهر جم
          </h2>

          <p className="mb-1 hidden text-sm text-white/85 sm:mb-4 sm:block">
            چت عمومی شهر، آگهی و تبلیغات، صحبت با کاربران
          </p>

          <span className="text-[10px] font-bold sm:text-sm">
            ورود به چت ‹
          </span>
        </Link>

      </section>

      {/* نقشه */}
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
                <span className="text-sm sm:text-lg">
                  {c.icon}
                </span>
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

      {/* =====================================================
          کسب‌وکارهای طلایی - طراحی پویا
         ===================================================== */}

      {!loadingGold && goldBusinesses.length > 0 && (
        <section className="relative overflow-hidden rounded-[26px] border border-amber-200/80 bg-white p-3 shadow-[0_8px_28px_rgba(0,0,0,0.08)]">

          {/* خط طلایی */}
          <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-300" />

          {/* هدر */}
          <div className="mb-3 flex items-center justify-between px-1 pt-1">

            <div>
              <div className="flex items-center gap-1.5">

                <span className="text-lg">👑</span>

                <h2 className="text-sm font-extrabold text-slate-800">
                  پیشنهادهای طلایی جم
                </h2>

              </div>

              <p className="mt-0.5 text-[9px] text-slate-400">
                پیشنهادهای ویژه کسب‌وکارهای منتخب شهر جم
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1">
              <span className="text-[10px]">⭐</span>

              <span className="text-[9px] font-extrabold text-amber-700">
                طلایی
              </span>
            </div>

          </div>

          {/* دو کارت افقی */}
          <div className="grid grid-cols-2 gap-2.5">

            {displayBusinesses.map((business) => {

              const businessProducts = products.filter(
                (p) => p.business_id === business.id
              );

              const featuredProduct =
                businessProducts.find(
                  (p) =>
                    p.discount_percent !== null &&
                    p.discount_percent > 0
                ) ??
                businessProducts[0] ??
                null;

              return (
                <Link
                  key={business.id}
                  href={`/business/${business.id}`}
                  className="group overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.07)] transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-[0_8px_22px_rgba(245,158,11,0.18)]"
                >

                  {/* تصویر */}
                  <div className="relative h-28 overflow-hidden bg-gradient-to-br from-amber-50 to-slate-100">

                    {featuredProduct?.image_url ||
                    business.icon ? (
                      featuredProduct?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={featuredProduct.image_url}
                          alt={business.name}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl">
                          {business.icon}
                        </div>
                      )
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl">
                        🏪
                      </div>
                    )}

                    {/* نشان طلایی */}
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full border border-white/70 bg-white/95 px-1.5 py-1 shadow-sm">
                      <span className="text-[9px]">
                        ⭐
                      </span>

                      <span className="text-[8px] font-extrabold text-amber-600">
                        طلایی
                      </span>
                    </div>

                    {/* تخفیف */}
                    {featuredProduct?.discount_percent &&
                      featuredProduct.discount_percent > 0 && (
                        <div className="absolute bottom-1.5 left-1.5 rounded-full bg-red-500 px-2 py-1 text-[8px] font-extrabold text-white shadow-md">
                          {featuredProduct.discount_percent}% تخفیف
                        </div>
                      )}

                  </div>

                  {/* اطلاعات */}
                  <div className="p-2.5">

                    <div className="flex items-start justify-between gap-1">

                      <div className="min-w-0">

                        <h3 className="truncate text-[11px] font-extrabold text-slate-800">
                          {business.icon} {business.name}
                        </h3>

                        <p className="mt-0.5 truncate text-[8px] text-slate-400">
                          {businessCategoryLabel(
                            business.category
                          )}
                        </p>

                      </div>

                      {business.rating_avg > 0 && (
                        <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold text-amber-700">
                          ⭐ {business.rating_avg.toFixed(1)}
                        </span>
                      )}

                    </div>

                    {/* محصول */}
                    {featuredProduct ? (
                      <div className="mt-2 rounded-xl border border-amber-100 bg-gradient-to-l from-amber-50/80 to-orange-50/50 p-2">

                        <p className="truncate text-[9px] font-extrabold text-slate-700">
                          {featuredProduct.name}
                        </p>

                        {featuredProduct.description && (
                          <p className="mt-0.5 line-clamp-1 text-[8px] leading-4 text-slate-400">
                            {featuredProduct.description}
                          </p>
                        )}

                        {featuredProduct.price !== null && (
                          <div className="mt-1">

                            {featuredProduct.discount_percent &&
                            featuredProduct.discount_percent > 0 ? (
                              <div className="flex items-center gap-1">

                                <span className="text-[7px] text-slate-400 line-through">
                                  {formatPrice(
                                    featuredProduct.price
                                  )}
                                </span>

                                <span className="text-[9px] font-extrabold text-red-500">
                                  {formatPrice(
                                    Math.round(
                                      featuredProduct.price *
                                        (1 -
                                          featuredProduct.discount_percent /
                                            100)
                                    )
                                  )}
                                </span>

                              </div>
                            ) : (
                              <span className="text-[9px] font-extrabold text-jam-darkgreen">
                                {formatPrice(
                                  featuredProduct.price
                                )}
                              </span>
                            )}

                          </div>
                        )}

                      </div>
                    ) : (
                      <div className="mt-2 rounded-xl bg-slate-50 p-2">

                        <p className="line-clamp-2 text-[8px] leading-4 text-slate-400">
                          مشاهده خدمات و اطلاعات این کسب‌وکار
                        </p>

                      </div>
                    )}

                    {/* پایین کارت */}
                    <div className="mt-2 flex items-center justify-between">

                      <span className="text-[8px] font-bold text-slate-400">
                        مشاهده جزئیات
                      </span>

                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-50 text-[9px] font-bold text-amber-600 transition group-hover:bg-amber-100">
                        ←
                      </span>

                    </div>

                  </div>

                </Link>
              );
            })}

          </div>

          {/* اسلایدر */}
          {goldBusinesses.length > 2 && (
            <div className="mt-3 flex items-center justify-center gap-1.5">

              {Array.from({
                length: Math.ceil(goldBusinesses.length / 2),
              }).map((_, index) => {

                const active =
                  Math.floor(goldIndex / 2) === index;

                return (
                  <button
                    key={index}
                    onClick={() =>
                      setGoldIndex(index * 2)
                    }
                    className={`h-1.5 rounded-full transition-all ${
                      active
                        ? "w-5 bg-amber-500"
                        : "w-1.5 bg-amber-200"
                    }`}
                    aria-label={`صفحه ${index + 1}`}
                  />
                );
              })}

            </div>
          )}

          <div className="mt-2 text-center">
            <span className="text-[8px] text-slate-300">
              پیشنهادهای طلایی به‌صورت خودکار تغییر می‌کنند
            </span>
          </div>

        </section>
      )}

    </div>
  );
}