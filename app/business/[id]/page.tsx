import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { businessCategoryLabel, tierMeta, formatPrice } from "@/lib/constants";
import BusinessRating from "@/components/BusinessRating";

export const dynamic = "force-dynamic";

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

  const { data: products } = await supabase
    .from("business_products")
    .select("*")
    .eq("business_id", params.id)
    .order("created_at", { ascending: false });

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

      {/* PRODUCTS */}
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
    </div>
  );
}
