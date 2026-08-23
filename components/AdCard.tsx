import Link from "next/link";
import { categoryLabel, formatPrice, statusMeta, timeAgo } from "@/lib/constants";
import type { Database } from "@/lib/supabase/types";

type Ad = Database["public"]["Tables"]["ads"]["Row"] & {
  profiles?: { display_name: string } | null;
};

export default function AdCard({ ad }: { ad: Ad }) {
  const status = statusMeta(ad.status);
  const cover = ad.images?.[0];

  return (
    <Link
      href={`/ad/${ad.id}`}
      className="fade-in group overflow-hidden rounded-xl2 glass shadow-soft transition hover:-translate-y-1 hover:shadow-glow"
    >
      <div className="relative h-40 w-full overflow-hidden bg-white">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={ad.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-slate-300">
            🖼️
          </div>
        )}
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold ${status.color}`}
        >
          {status.label}
        </span>
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-1 text-sm font-bold text-slate-800">{ad.title}</p>
        <p className="text-sm font-extrabold text-jam-green">
          {formatPrice(ad.price)}
        </p>
        <div className="flex items-center justify-between text-[11px] text-slate-800/45">
          <span>{ad.region}</span>
          <span>{timeAgo(ad.created_at)}</span>
        </div>
        <span className="inline-block rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-400">
          {categoryLabel(ad.category)}
        </span>
      </div>
    </Link>
  );
}
