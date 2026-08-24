import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/constants";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  business_id: string;
  name: string;
  price: number | null;
  image_url: string | null;
  discount_percent: number | null;
};

type BizRow = {
  id: string;
  name: string;
  icon: string;
  subscription_status: string;
};

export default async function DiscountsPage() {
  const supabase = createClient();

  const { data: rawProducts } = await supabase
    .from("business_products")
    .select("id, business_id, name, price, image_url, discount_percent")
    .not("discount_percent", "is", null)
    .gt("discount_percent", 0)
    .order("discount_percent", { ascending: false });

  const products = (rawProducts as ProductRow[]) ?? [];

  let bizMap = new Map<string, BizRow>();
  if (products.length > 0) {
    const businessIds = Array.from(new Set(products.map((p) => p.business_id)));
    const { data: rawBiz } = await supabase
      .from("businesses")
      .select("id, name, icon, subscription_status")
      .in("id", businessIds)
      .eq("subscription_status", "approved");
    bizMap = new Map(((rawBiz as BizRow[]) ?? []).map((b) => [b.id, b]));
  }

  const visibleProducts = products.filter((p) => bizMap.has(p.business_id));

  return (
    <div className="fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-red-500">🏷️ تخفیف‌های ویژه شهر جم</h1>
        <p className="text-sm text-slate-500">محصولات و خدمات با تخفیف از کسب‌وکارهای شهر جم</p>
      </div>

      {visibleProducts.length === 0 ? (
        <div className="rounded-xl2 glass p-10 text-center text-sm text-slate-400 shadow-soft">
          در حال حاضر تخفیف فعالی ثبت نشده است.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {visibleProducts.map((p) => {
            const biz = bizMap.get(p.business_id)!;
            const discounted = p.price ? Math.round(p.price * (1 - (p.discount_percent ?? 0) / 100)) : null;
            return (
              <Link
                key={p.id}
                href={`/business/${biz.id}`}
                className="relative overflow-hidden rounded-xl2 border border-red-200 bg-white shadow-soft transition hover:-translate-y-0.5"
              >
                <span className="absolute left-2 top-2 z-10 rounded-full bg-red-500 px-2.5 py-1 text-xs font-extrabold text-white shadow">
                  {p.discount_percent}٪ تخفیف
                </span>
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} className="h-36 w-full object-cover" loading="lazy" decoding="async" />
                )}
                <div className="space-y-1 p-3">
                  <p className="flex items-center gap-1 text-[11px] text-slate-400">
                    {biz.icon} {biz.name}
                  </p>
                  <p className="font-bold text-slate-800">{p.name}</p>
                  {p.price !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 line-through">{formatPrice(p.price)}</span>
                      <span className="text-sm font-extrabold text-red-500">{formatPrice(discounted!)}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
