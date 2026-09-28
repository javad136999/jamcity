"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
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
  loading: () => <Spinner label="Ø¯Ø± Ø­Ø§Ù„ Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ Ù†Ù‚Ø´Ù‡..." />,
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
  const { city } = useAuth();

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
        .not("lng", "is", null)
        .eq("city_id", city.id);

      const { data: ads } = await supabase
        .from("ads")
        .select("id, title, category, lat, lng")
        .eq("status", "active")
        .eq("city_id", city.id)
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
          "ðŸ“",
        tier: b.subscription_tier as MapMarker["tier"],
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
  }, [supabase, city.id]);

  /*
   * ØªØ¹ÙˆÛŒØ¶ Ø®ÙˆØ¯Ú©Ø§Ø± Ú©Ø§Ø±Øªâ€ŒÙ‡Ø§
   * Ø²Ù…Ø§Ù†: 12 Ø«Ø§Ù†ÛŒÙ‡
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
   * Ø¯Ø± Ù‡Ø± Ù„Ø­Ø¸Ù‡ Ø¯Ùˆ Ú©Ø³Ø¨â€ŒÙˆÚ©Ø§Ø± Ø·Ù„Ø§ÛŒÛŒ Ù†Ù…Ø§ÛŒØ´ Ø¯Ø§Ø¯Ù‡ Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯.
   */
  const visibleBusinesses = goldBusinesses.slice(
    goldIndex,
    goldIndex + 2
  );

  /*
   * Ø§Ú¯Ø± Ø¨Ù‡ Ø§Ù†ØªÙ‡Ø§ÛŒ Ù„ÛŒØ³Øª Ø±Ø³ÛŒØ¯Ù‡ Ø¨Ø§Ø´ÛŒÙ… Ùˆ ÙÙ‚Ø· ÛŒÚ© Ú©Ø§Ø±Øª Ù…Ø§Ù†Ø¯Ù‡ Ø¨Ø§Ø´Ø¯ØŒ
   * Ú©Ø§Ø±Øª Ø§ÙˆÙ„ Ø±Ø§ Ù‡Ù… Ø§Ø¶Ø§ÙÙ‡ Ù…ÛŒâ€ŒÚ©Ù†ÛŒÙ… ØªØ§ Ù‡Ù…ÛŒØ´Ù‡ Ø¯Ùˆ Ú©Ø§Ø±Øª Ø¯ÛŒØ¯Ù‡ Ø´ÙˆØ¯.
   */
  const displayBusinesses =
    visibleBusinesses.length === 2
      ? visibleBusinesses
      : goldBusinesses.length > 1
      ? [visibleBusinesses[0], goldBusinesses[0]]
      : visibleBusinesses;

  return (
    <div className="fade-in space-y-4 pb-5">
      {/* Ø¹Ù†ÙˆØ§Ù† */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">
          Ù†Ù‚Ø´Ù‡ {city.name}
        </h1>

        <p className="text-sm text-slate-400">
          Ú©Ø³Ø¨â€ŒÙˆÚ©Ø§Ø±Ù‡Ø§ØŒ Ø®Ø¯Ù…Ø§Øª Ùˆ Ø¢Ú¯Ù‡ÛŒâ€ŒÙ‡Ø§ÛŒ Ø¯Ø§Ø±Ø§ÛŒ Ù…ÙˆÙ‚Ø¹ÛŒØª Ø±ÙˆÛŒ Ù†Ù‚Ø´Ù‡
        </p>
      </div>

      {/* Ù†Ù‚Ø´Ù‡ */}
      {markers === null ? (
        <Spinner label="Ø¯Ø± Ø­Ø§Ù„ Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ Ù…ÙˆÙ‚Ø¹ÛŒØªâ€ŒÙ‡Ø§..." />
      ) : (
        <LeafletMap markers={markers} city={city} />
      )}

      {/* =====================================================
          Ø¨Ø®Ø´ ÙˆÛŒÚ˜Ù‡ Ú©Ø³Ø¨â€ŒÙˆÚ©Ø§Ø±Ù‡Ø§ÛŒ Ø·Ù„Ø§ÛŒÛŒ
         ===================================================== */}

      {!loadingGold && goldBusinesses.length > 0 && (
        <section className="relative overflow-hidden rounded-[26px] border border-amber-200/80 bg-white p-3 shadow-[0_8px_28px_rgba(0,0,0,0.08)]">

          {/* Ø®Ø· Ø·Ù„Ø§ÛŒÛŒ Ø¨Ø§Ù„Ø§ÛŒ Ú©Ø§Ø¯Ø± */}
          <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-300" />

          {/* Ù‡Ø¯Ø± */}
          <div className="mb-3 flex items-center justify-between px-1 pt-1">

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg">ðŸ‘‘</span>

                <h2 className="text-sm font-extrabold text-slate-800">
                  Ù¾ÛŒØ´Ù†Ù‡Ø§Ø¯Ù‡Ø§ÛŒ Ø·Ù„Ø§ÛŒÛŒ {city.name}
                </h2>
              </div>

              <p className="mt-0.5 text-[9px] text-slate-400">
                Ù¾ÛŒØ´Ù†Ù‡Ø§Ø¯Ù‡Ø§ÛŒ ÙˆÛŒÚ˜Ù‡ Ú©Ø³Ø¨â€ŒÙˆÚ©Ø§Ø±Ù‡Ø§ÛŒ Ù…Ù†ØªØ®Ø¨ Ø´Ù‡Ø± {city.name}
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1">
              <span className="text-[10px]">â­</span>

              <span className="text-[9px] font-extrabold text-amber-700">
                Ø·Ù„Ø§ÛŒÛŒ
              </span>
            </div>
          </div>

          {/* Ø¯Ùˆ Ú©Ø§Ø±Øª Ø§ÙÙ‚ÛŒ */}
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
                  {/* ØªØµÙˆÛŒØ± */}
                 <div className="relative h-28 overflow-hidden bg-gradient-to-br from-amber-50 to-slate-100">

  {business.image_url ? (

    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={business.image_url}
      alt={business.name}
      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
      loading="lazy"
    />

  ) : (
                      <div className="flex h-full items-center justify-center text-4xl">
                        {business.icon || "ðŸª"}
                      </div>
                    )}

                    {/* Ù†Ø´Ø§Ù† Ø·Ù„Ø§ÛŒÛŒ */}
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full border border-white/70 bg-white/95 px-1.5 py-1 shadow-sm">
                      <span className="text-[9px]">â­</span>

                      <span className="text-[8px] font-extrabold text-amber-600">
                        Ø·Ù„Ø§ÛŒÛŒ
                      </span>
                    </div>

                    {/* ØªØ®ÙÛŒÙ */}
                    {featuredProduct?.discount_percent &&
                      featuredProduct.discount_percent > 0 && (
                        <div className="absolute bottom-1.5 left-1.5 rounded-full bg-red-500 px-2 py-1 text-[8px] font-extrabold text-white shadow-md">
                          {featuredProduct.discount_percent}% ØªØ®ÙÛŒÙ
                        </div>
                      )}
                  </div>

                  {/* Ø§Ø·Ù„Ø§Ø¹Ø§Øª */}
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
                          â­ {business.rating_avg.toFixed(1)}
                        </span>
                      )}
                    </div>

                    {/* Ù…Ø­ØµÙˆÙ„ / ØªØ®ÙÛŒÙ */}
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
                            "Ù…Ø´Ø§Ù‡Ø¯Ù‡ Ø®Ø¯Ù…Ø§Øª Ùˆ Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ú©Ø³Ø¨â€ŒÙˆÚ©Ø§Ø±"}
                        </p>
                      </div>
                    )}

                    {/* Ù¾Ø§ÛŒÛŒÙ† Ú©Ø§Ø±Øª */}
                    <div className="mt-2 flex items-center justify-between">

                      <span className="text-[8px] font-bold text-slate-400">
                        Ù…Ø´Ø§Ù‡Ø¯Ù‡ Ø¬Ø²Ø¦ÛŒØ§Øª
                      </span>

                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-50 text-[9px] font-bold text-amber-600 transition group-hover:bg-amber-100">
                        â†
                      </span>

                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Ù†Ù‚Ø·Ù‡â€ŒÙ‡Ø§ÛŒ Ø§Ø³Ù„Ø§ÛŒØ¯Ø± */}
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
                    aria-label={`ØµÙØ­Ù‡ ${index + 1}`}
                  />
                );
              })}
            </div>
          )}

          {/* Ù…ØªÙ† Ù¾Ø§ÛŒÛŒÙ† */}
          <div className="mt-2 text-center">
            <span className="text-[8px] text-slate-300">
              Ù¾ÛŒØ´Ù†Ù‡Ø§Ø¯Ù‡Ø§ÛŒ Ø·Ù„Ø§ÛŒÛŒ Ø¨Ù‡â€ŒØµÙˆØ±Øª Ø®ÙˆØ¯Ú©Ø§Ø± ØªØºÛŒÛŒØ± Ù…ÛŒâ€ŒÚ©Ù†Ù†Ø¯
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
