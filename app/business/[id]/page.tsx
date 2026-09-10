import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { businessCategoryLabel, tierMeta, formatPrice } from "@/lib/constants";
import BusinessRating from "@/components/BusinessRating";

export const dynamic = "force-dynamic";

const CAR_DEALER_CATEGORY = "car_dealer";
const SHOES_BAGS_CATEGORY = "shoes";

export default async function BusinessDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!business) notFound();

  const isCarDealer = business.category === CAR_DEALER_CATEGORY;
  const isShoeStore = business.category === SHOES_BAGS_CATEGORY;

  const { data: products } = isCarDealer || isShoeStore
    ? { data: null }
    : await supabase
        .from("business_products")
        .select("*")
        .eq("business_id", params.id)
        .order("created_at", { ascending: false });

  const { data: vehicles } = isCarDealer
    ? await supabase
        .from("vehicle_listings")
        .select("*")
        .eq("business_id", params.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const { data: footwearItems } = isShoeStore
    ? await supabase
        .from("footwear_bag_listings")
        .select("*")
        .eq("business_id", params.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const mapsHref =
    business.lat && business.lng
      ? `https://www.google.com/maps?q=${business.lat},${business.lng}`
      : null;

  const tier = tierMeta(business.subscription_tier);

  return (
    <div dir="rtl" className="fade-in mx-auto max-w-2xl space-y-4 bg-[#F7F9F4] px-3 py-4 sm:px-0">
      {business.subscription_status !== "approved" && (
        <p className="rounded-2xl border border-[#F0DCB4] bg-[#FBEEDA] p-3 text-center text-[11px] font-bold text-[#8A7150]">
          این کسب و کار هنوز توسط پنل مدیریت تایید نشده و فقط برای شما (یا مدیر) قابل مشاهده است.
        </p>
      )}

      {/* COVER IMAGE */}
      <div className="relative overflow-hidden rounded-[26px] border border-[#E3EBDE] bg-white shadow-[0_10px_28px_rgba(20,60,40,.06)]">
        <div className="relative h-56 w-full bg-[#F3F6F1]">
          {business.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.image_url}
              alt={business.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#EAF7EE] to-[#F7F9F4] text-6xl">
              {business.icon}
            </div>
          )}

          {tier && (
            <span
              className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-[10px] font-black text-white shadow-md ${
                business.subscription_tier === "gold"
                  ? "bg-gradient-to-l from-[#FFE29A] via-[#D98F2B] to-[#B8721E]"
                  : "bg-gradient-to-l from-[#147A4B] to-[#2FAE72]"
              }`}
            >
              {business.subscription_tier === "gold" ? "👑 " : ""}
              {tier.name}
            </span>
          )}
        </div>
      </div>

      {/* INFO CARD */}
      <div className="space-y-4 rounded-[26px] border border-[#E3EBDE] bg-white p-5 shadow-[0_10px_28px_rgba(20,60,40,.06)] sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-black text-[#1D2B1F] sm:text-xl">
              {business.icon} {business.name}
            </h1>
            <span className="mt-1.5 inline-block rounded-full bg-[#F3FAF5] px-3 py-1 text-[10px] font-bold text-[#147A4B]">
              {businessCategoryLabel(business.category)}
            </span>
          </div>
        </div>

        {business.description && (
          <p className="text-[12px] leading-7 text-[#66766A]">{business.description}</p>
        )}

        <div className="rounded-2xl bg-[#F7F9F4] p-3">
          <BusinessRating
            businessId={business.id}
            initialAvg={business.rating_avg}
            initialCount={business.rating_count}
          />
        </div>

        <div className="space-y-2 rounded-2xl border border-[#E3EBDE] bg-[#F7F9F4] p-3.5 text-[11px] text-[#3A4A3D]">
          {business.address && (
            <p className="flex items-start gap-2">
              <span>📍</span>
              <span>{business.address}</span>
            </p>
          )}
          {business.hours && (
            <p className="flex items-center gap-2">
              <span>🕒</span>
              <span>{business.hours}</span>
            </p>
          )}
          {business.phone && (
            <p dir="ltr" className="flex items-center justify-end gap-2 text-right">
              <span>{business.phone}</span>
              <span>☎️</span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {business.phone && (
            <a
              href={`tel:${business.phone}`}
              className="flex-1 rounded-2xl bg-[#0f9a56] py-3 text-center text-[12px] font-black text-white shadow-[0_0_20px_rgba(57,255,143,.35)] transition hover:bg-[#0c8248]"
            >
              ☎️ تماس
            </a>
          )}
          {mapsHref && (
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-2xl border border-[#E3EBDE] bg-white py-3 text-center text-[12px] font-black text-[#1D2B1F] transition hover:border-[#39ff8f]/50 hover:bg-[#F3FAF5]"
            >
              🗺️ مسیریابی
            </a>
          )}
        </div>
      </div>

      {/* VEHICLE SHOWCASE (اتوگالری) */}
      {isCarDealer && (
        <div className="space-y-4 rounded-[26px] border border-[#E7D9B8] bg-gradient-to-b from-white to-[#FBF7EE] p-5 shadow-[0_10px_28px_rgba(184,114,30,.12)] sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2b2f36] to-[#3d434d] text-lg shadow-[0_0_14px_rgba(0,0,0,.25)]">
              🚗
            </span>
            <h2 className="text-[14px] font-black text-[#1D2B1F] sm:text-base">
              ماشین‌های نمایشگاه
            </h2>
          </div>

          {!vehicles || vehicles.length === 0 ? (
            <p className="rounded-2xl bg-[#F7F9F4] p-6 text-center text-[11px] text-[#8A968C]">
              هنوز ماشینی در این نمایشگاه ثبت نشده است.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className={`overflow-hidden rounded-[20px] border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
                    v.is_sold ? "border-slate-200 opacity-60" : "border-[#E3EBDE]"
                  }`}
                >
                  <div className="relative h-44 w-full bg-[#F3F6F1]">
                    {v.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.image_url}
                        alt={`${v.brand} ${v.model}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2b2f36] to-[#3d434d] text-5xl">
                        🚗
                      </div>
                    )}
                    {v.is_sold && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[13px] font-black text-white">
                        فروخته شد
                      </span>
                    )}
                    {v.price !== null && !v.is_sold && (
                      <span className="absolute left-2 top-2 rounded-full bg-[#0f9a56] px-3 py-1 text-[11px] font-black text-white shadow-md">
                        {formatPrice(v.price)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 p-3.5">
                    <p className="text-[13px] font-black text-[#1D2B1F]">
                      {v.brand} {v.model}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {v.year && (
                        <span className="rounded-full bg-[#F3FAF5] px-2.5 py-1 text-[10px] font-bold text-[#147A4B]">
                          📅 مدل {v.year}
                        </span>
                      )}
                      {v.mileage_km !== null && (
                        <span className="rounded-full bg-[#F3FAF5] px-2.5 py-1 text-[10px] font-bold text-[#147A4B]">
                          🛣️ {new Intl.NumberFormat("fa-IR").format(v.mileage_km)} کیلومتر
                        </span>
                      )}
                      {v.color && (
                        <span className="rounded-full bg-[#F3FAF5] px-2.5 py-1 text-[10px] font-bold text-[#147A4B]">
                          🎨 {v.color}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FOOTWEAR & BAG SHOWCASE (کیف و کفش) */}
      {isShoeStore && (
        <div className="space-y-4 rounded-[26px] border border-[#F0D9E8] bg-gradient-to-b from-white to-[#FDF4F8] p-5 shadow-[0_10px_28px_rgba(190,60,120,.12)] sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#C2447A] to-[#8A2F58] text-lg shadow-[0_0_14px_rgba(190,60,120,.3)]">
              👟
            </span>
            <h2 className="text-[14px] font-black text-[#1D2B1F] sm:text-base">
              محصولات فروشگاه
            </h2>
          </div>

          {!footwearItems || footwearItems.length === 0 ? (
            <p className="rounded-2xl bg-[#F7F9F4] p-6 text-center text-[11px] text-[#8A968C]">
              هنوز محصولی در این فروشگاه ثبت نشده است.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {footwearItems.map((f) => (
                <div
                  key={f.id}
                  className={`overflow-hidden rounded-[20px] border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
                    f.stock_quantity === 0 ? "border-slate-200 opacity-60" : "border-[#E3EBDE]"
                  }`}
                >
                  <div className="relative h-40 w-full bg-[#F3F6F1]">
                    {f.image_urls && f.image_urls.length > 0 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.image_urls[0]}
                        alt={`${f.brand} ${f.product_type}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#C2447A] to-[#8A2F58] text-5xl">
                        {f.product_type === "کفش" ? "👟" : "👜"}
                      </div>
                    )}
                    {f.image_urls && f.image_urls.length > 1 && (
                      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white">
                        +{f.image_urls.length - 1} عکس دیگر
                      </span>
                    )}
                    {f.stock_quantity === 0 && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[13px] font-black text-white">
                        ناموجود
                      </span>
                    )}
                    {f.price !== null && f.stock_quantity !== 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-[#0f9a56] px-3 py-1 text-[11px] font-black text-white shadow-md">
                        {formatPrice(f.price)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 p-3.5">
                    <p className="text-[13px] font-black text-[#1D2B1F]">
                      {f.product_type === "کفش" ? "👟" : "👜"} {f.brand}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {f.size && (
                        <span className="rounded-full bg-[#FDF4F8] px-2.5 py-1 text-[10px] font-bold text-[#8A2F58]">
                          📏 سایز {f.size}
                        </span>
                      )}
                      {f.color && (
                        <span className="rounded-full bg-[#FDF4F8] px-2.5 py-1 text-[10px] font-bold text-[#8A2F58]">
                          🎨 {f.color}
                        </span>
                      )}
                      {f.material && (
                        <span className="rounded-full bg-[#FDF4F8] px-2.5 py-1 text-[10px] font-bold text-[#8A2F58]">
                          🧵 {f.material}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* GENERIC PRODUCTS (بقیه دسته‌ها) */}
      {!isCarDealer && !isShoeStore && (
        <div className="space-y-4 rounded-[26px] border border-[#E3EBDE] bg-white p-5 shadow-[0_10px_28px_rgba(20,60,40,.06)] sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FBEEDA] text-lg shadow-[0_0_14px_rgba(255,183,77,.3)]">
              📋
            </span>
            <h2 className="text-[14px] font-black text-[#1D2B1F] sm:text-base">
              منو و محصولات
            </h2>
          </div>

          {!products || products.length === 0 ? (
            <p className="rounded-2xl bg-[#F7F9F4] p-6 text-center text-[11px] text-[#8A968C]">
              هنوز محصولی برای این کسب و کار ثبت نشده است.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-[20px] border border-[#E3EBDE] bg-white transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-36 w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex h-36 w-full items-center justify-center bg-[#F3FAF5] text-4xl">
                      {business.icon}
                    </div>
                  )}
                  <div className="space-y-1 p-3.5">
                    <p className="text-[12px] font-black text-[#1D2B1F]">{p.name}</p>
                    {p.price !== null && (
                      <p className="text-[11px] font-black text-[#147A4B]">
                        {formatPrice(p.price)}
                      </p>
                    )}
                    {p.description && (
                      <p className="text-[10px] text-[#8A968C]">{p.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

}
