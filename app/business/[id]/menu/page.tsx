import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function BusinessMenuPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, icon")
    .eq("id", params.id)
    .maybeSingle();

  if (!business) notFound();

  const { data: products } = await supabase
    .from("business_products")
    .select("*")
    .eq("business_id", params.id)
    .order("created_at", { ascending: false });

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">
            منوی {business.icon} {business.name}
          </h1>
          <p className="text-sm text-slate-500">محصولات و قیمت‌ها</p>
        </div>
        <Link href={`/business/${business.id}`} className="text-sm font-bold text-jam-green">
          بازگشت ‹
        </Link>
      </div>

      {!products || products.length === 0 ? (
        <div className="rounded-xl2 glass p-10 text-center text-sm text-slate-400 shadow-soft">
          هنوز محصولی برای این کسب و کار ثبت نشده است.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl2 glass shadow-soft">
              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={p.name} className="h-36 w-full object-cover" />
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
  );
}
