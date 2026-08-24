import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { businessCategoryLabel, tierMeta, formatPrice } from "@/lib/constants";

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
    <div className="fade-in mx-auto max-w-2xl space-y-6 py-4">
      {business.subscription_status !== "approved" && (
        <p className="rounded-xl2 border border-yellow-200 bg-yellow-50 p-3 text-center text-sm text-yellow-700">
          این کسب و کار هنوز توسط پنل مدیریت تایید نشده و فقط برای شما (یا مدیر) قابل مشاهده است.
        </p>
      )}

      <div className="overflow-hidden rounded-xl2 glass shadow-soft">
        <div className="h-56 w-full bg-slate-100">
          {business.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.image_url} alt={business.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl">
              {business.icon}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-xl2 glass p-6 shadow-soft">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">
              {business.icon} {business.name}
            </h1>
            <span className="mt-1 inline-block rounded-full bg-black/5 px-3 py-1 text-xs text-slate-500">
              {businessCategoryLabel(business.category)}
            </span>
          </div>
          {tier && (
            <span className={`rounded-full bg-gradient-to-l ${tier.color} px-3 py-1 text-xs font-bold text-white`}>
              {tier.name}
            </span>
          )}
        </div>

        {business.description && (
          <p className="text-sm leading-7 text-slate-600">{business.description}</p>
        )}

        <div className="space-y-2 text-sm text-slate-500">
          <p>📍 {business.address}</p>
          {business.hours && <p>🕒 {business.hours}</p>}
          {business.phone && (
            <p dir="ltr" className="text-right">
              ☎️ {business.phone}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {business.phone && (
            <a
              href={`tel:${business.phone}`}
              className="flex-1 rounded-xl2 bg-jam-green py-3 text-center text-sm font-bold text-white shadow-glow transition hover:brightness-110"
            >
              ☎️ تماس
            </a>
          )}
          {mapsHref && (
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-xl2 glass py-3 text-center text-sm font-bold text-slate-700 transition hover:bg-black/5"
            >
              🗺️ مسیریابی
            </a>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-xl2 glass p-6 shadow-soft">
        <h2 className="text-lg font-extrabold text-slate-800">📋 منو و محصولات</h2>

        {!products || products.length === 0 ? (
          <p className="rounded-xl2 bg-black/5 p-6 text-center text-sm text-slate-400">
            هنوز محصولی برای این کسب و کار ثبت نشده است.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl2 border border-slate-200 bg-white">
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} className="h-36 w-full object-cover" loading="lazy" decoding="async" />
                )}
                <div className="space-y-1 p-4">
                  <p className="font-bold text-slate-800">{p.name}</p>
                  {p.price !== null && (
                    <p className="text-sm font-bold text-jam-darkgreen">{formatPrice(p.price)}</p>
                  )}
                  {p.description && <p className="text-xs text-slate-500">{p.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
