"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  BUSINESS_CATEGORIES,
  businessCategoryLabel,
  categoryLabel,
  formatPrice,
} from "@/lib/constants";
import { Spinner } from "@/components/Feedback";
import type { MapMarker } from "@/components/LeafletMap";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => <Spinner label="در حال بارگذاری نقشه..." />,
});

type GoldBusiness = {
  id: string;
  name: string;
  category: string;
  address: string;
  description: string | null;
  image_url: string | null;
  icon: string;
  lat: number | null;
  lng: number | null;
  subscription_tier: "bronze" | "silver" | "gold" | null;
  subscription_status:
    | "pending"
    | "approved"
    | "rejected"
    | "suspended";
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

export default function MapPage() {
  const supabase = createClient();

  const [markers, setMarkers] = useState<MapMarker[] | null>(null);
  const [goldBusinesses, setGoldBusinesses] = useState<GoldBusiness[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [goldIndex, setGoldIndex] = useState(0);
  const [loadingGold, setLoadingGold] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: businesses } = await supabase
        .from("businesses")
        .select(
          "id, name, category, address, description, image_url, icon, lat, lng, subscription_tier, subscription_status, rating_avg, rating_count"
        )
        .not("lat", "is", null)
        .not("lng", "is", null);

      const { data: ads } = await supabase
        .from("ads")
        .select("id, title, category, lat, lng")
        .eq("status", "active")
        .not("lat", "is", null)
        .not("lng", "is", null);
             const businessMarkers: MapMarker[] = (businesses ?? []).map((b) => ({
        id: `b-${b.id}`,
        lat: b.lat as number,
        lng: b.lng as number,
        title: b.name,
        subtitle: businessCategoryLabel(b.category),
        href: `/business/${b.id}`,
        emoji:
          BUSINESS_CATEGORIES.find((c) => c.slug === b.category)?.icon ||
          b.icon ||
          "📍",
        tier: b.subscription_tier,
        rating: b.rating_avg,
      }));

      const adMarkers: MapMarker[] = (ads ?? []).map((a) => ({
        id: `a-${a.id}`,
        lat: a.lat as number,
        lng: a.lng as number,
        title: a.title,
        subtitle: categoryLabel(a.category),
        href: `/ad/${a.id}`,
      }));

      const approvedGold = (businesses ?? []).filter(
        (b) =>
          b.subscription_tier === "gold" &&
          b.subscription_status === "approved"
      ) as GoldBusiness[];

      setGoldBusinesses(approvedGold);

      if (approvedGold.length > 0) {
        const businessIds = approvedGold.map((b) => b.id);

        const { data: productData } = await supabase
          .from("business_products")
          .select(
            "id, business_id, name, price, description, image_url, discount_percent"
          )
          .in("business_id", businessIds)
          .order("created_at", { ascending: false });

        setProducts((productData ?? []) as Product[]);
      }

      setLoadingGold(false);
    }

    load();
  }, [supabase]);

  /*
   * تعویض خودکار کارت‌ها
   * زمان: 12 ثانیه
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

  /*
   * در هر لحظه دو کسب‌وکار طلایی نمایش داده می‌شوند.
   */
  const visibleBusinesses = goldBusinesses.slice(
    goldIndex,
    goldIndex + 2
  );

  /*
   * اگر به انتهای لیست رسیده باشیم و فقط یک کارت مانده باشد،
   * کارت اول را هم اضافه می‌کنیم تا همیشه دو کارت دیده شود.
   */
  const displayBusinesses =
    visibleBusinesses.length === 2
      ? visibleBusinesses
      : goldBusinesses.length > 1
      ? [visibleBusinesses[0], goldBusinesses[0]]
      : visibleBusinesses;

  return (
    <div className="fade-in space-y-4 pb-5">
      {/* عنوان */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">
          نقشه جم
        </h1>

        <p className="text-sm text-slate-400">
          کسب‌وکارها، خدمات و آگهی‌های دارای موقعیت روی نقشه
        </p>
      </div>

      {/* نقشه */}
      {markers === null ? (
        <Spinner label="در حال بارگذاری موقعیت‌ها..." />
      ) : (
        <LeafletMap markers={markers} />
      )}

      {/* =====================================================
          بخش ویژه کسب‌وکارهای طلایی
         ===================================================== */}

      {!loadingGold && goldBusinesses.length > 0 && (
        <section className="relative overflow-hidden rounded-[26px] border border-amber-200/80 bg-white p-3 shadow-[0_8px_28px_rgba(0,0,0,0.08)]">

          {/* خط طلایی بالای کادر */}
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
                    business.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          featuredProduct?.image_url ||
                          business.image_url ||
                          ""
                        }
                        alt={business.name}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl">
                        {business.icon || "🏪"}
                      </div>
                    )}

                    {/* نشان طلایی */}
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full border border-white/70 bg-white/95 px-1.5 py-1 shadow-sm">
                      <span className="text-[9px]">⭐</span>

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

                    {/* محصول / تخفیف */}
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
                          {business.description ||
                            "مشاهده خدمات و اطلاعات کسب‌وکار"}
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

          {/* نقطه‌های اسلایدر */}
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

          {/* متن پایین */}
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