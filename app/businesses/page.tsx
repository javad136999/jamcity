"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BUSINESS_CATEGORIES, businessCategoryLabel, tierMeta } from "@/lib/constants";
import { CardSkeleton, EmptyState } from "@/components/Feedback";
import type { Database } from "@/lib/supabase/types";

type Business = Database["public"]["Tables"]["businesses"]["Row"];

export default function BusinessesPage() {
  const supabase = createClient();
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setBusinesses(null);
    const t = setTimeout(async () => {
      let builder = supabase
        .from("businesses")
        .select("*")
        .eq("subscription_status", "approved")
        .order("name");
      if (category !== "all") builder = builder.eq("category", category);
      if (query.trim()) builder = builder.ilike("name", `%${query.trim()}%`);
      const { data } = await builder;
      setBusinesses((data as Business[]) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [category, query, supabase]);

  return (
    <div className="fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">کسب‌وکارهای جم</h1>
        <p className="text-sm text-slate-500">رستوران، فروشگاه و خدمات شهر جم</p>
      </div>

      <div className="space-y-3 rounded-xl2 glass p-4 shadow-soft">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجوی کسب‌وکار..."
          className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategory("all")}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
              category === "all" ? "bg-jam-green text-white" : "bg-black/5 text-slate-500"
            }`}
          >
            🗂️ همه
          </button>
          {BUSINESS_CATEGORIES.map((c) => (
            <button
              key={c.slug}
              onClick={() => setCategory(c.slug)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                category === c.slug ? "bg-jam-green text-white" : "bg-black/5 text-slate-500"
              }`}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>
      </div>

      {businesses === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : businesses.length === 0 ? (
        <EmptyState icon="🏪" title="کسب‌وکاری یافت نشد" />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {businesses.map((b) => {
            const tier = tierMeta(b.subscription_tier);
            return (
              <Link
                key={b.id}
                href={`/business/${b.id}`}
                className="fade-in group overflow-hidden rounded-xl2 glass shadow-soft transition hover:-translate-y-1 hover:shadow-glow"
              >
                <div className="h-32 w-full overflow-hidden bg-slate-100">
                  {b.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.image_url}
                      alt={b.name}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">
                      {b.icon}
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-1 text-sm font-bold text-slate-800">{b.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {businessCategoryLabel(b.category)}
                  </p>
                  <p className="line-clamp-1 text-[11px] text-slate-400">📍 {b.address}</p>
                  {tier && (
                    <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      {tier.name}
                    </span>
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
