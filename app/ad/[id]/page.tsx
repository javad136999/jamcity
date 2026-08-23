import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { categoryLabel, formatPrice, statusMeta, timeAgo } from "@/lib/constants";
import AdActions from "./AdActions";
import AdGallery from "./AdGallery";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function AdDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: ad } = await supabase
    .from("ads")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!ad) notFound();

  const { data: seller } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .eq("id", ad.user_id)
    .maybeSingle();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const status = statusMeta(ad.status);
  const isOwner = user?.id === ad.user_id;

  return (
    <div className="fade-in mx-auto max-w-3xl space-y-6 py-4">
      <AdGallery images={ad.images ?? []} title={ad.title} />

      <div className="space-y-4 rounded-xl2 glass p-6 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">{ad.title}</h1>
            <p className="mt-1 text-2xl font-extrabold text-jam-green">
              {formatPrice(ad.price)}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${status.color}`}>
            {status.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="rounded-full bg-white px-3 py-1">
            {categoryLabel(ad.category)}
          </span>
          <span className="rounded-full bg-white px-3 py-1">📍 {ad.region}</span>
          <span className="rounded-full bg-white px-3 py-1">
            {timeAgo(ad.created_at)}
          </span>
        </div>

        <p className="whitespace-pre-line text-sm leading-7 text-slate-600">
          {ad.description}
        </p>

        <div className="flex items-center gap-3 rounded-xl2 border border-slate-200 p-3">
          <span className="flex h-10 w-10 overflow-hidden rounded-full bg-jam-darkgreen">
            <Avatar url={seller?.avatar_url} name={seller?.display_name} size={40} />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-800">
              {seller?.display_name ?? "کاربر جم‌سیتی"}
            </p>
            <p className="text-xs text-slate-400" dir="ltr">
              @{seller?.username ?? "unknown"}
            </p>
          </div>
        </div>

        <AdActions
          adId={ad.id}
          sellerId={ad.user_id}
          phone={ad.phone}
          isOwner={isOwner}
          currentUserId={user?.id ?? null}
        />
      </div>
    </div>
  );
}
