"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  source_name: string | null;
  source_url: string | null;
  image_url: string | null;
  published_at: string;
};

export default function JamCityNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNews() {
      const { data, error } = await supabase
        .from("jamcity_content")
        .select(
          "id,title,summary,source_name,source_url,image_url,published_at"
        )
        .eq("section", "news")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(6);

      if (!error) {
        setNews(data ?? []);
      }

      setLoading(false);
    }

    loadNews();
  }, []);

  if (loading) {
    return (
      <section className="mt-8">
        <div className="h-32 animate-pulse rounded-3xl bg-white/5" />
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            📰 اخبار روز
          </h2>
          <p className="mt-1 text-xs text-white/50">
            مهم‌ترین خبرهای ایران، اقتصاد، جم و عسلویه
          </p>
        </div>

        <a
          href="/news"
          className="text-sm text-emerald-400 transition hover:text-emerald-300"
        >
          مشاهده همه ←
        </a>
      </div>

      {news.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
          هنوز خبری منتشر نشده است.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {news.map((item) => (
            <a
              key={item.id}
              href={item.source_url || "#"}
              target={item.source_url ? "_blank" : undefined}
              rel={item.source_url ? "noopener noreferrer" : undefined}
              className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition hover:-translate-y-1 hover:bg-white/[0.07]"
            >
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              )}

              <div className="p-4">
                <h3 className="line-clamp-2 font-bold text-white group-hover:text-emerald-400">
                  {item.title}
                </h3>

                {item.summary && (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/60">
                    {item.summary}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between text-xs text-white/40">
                  <span>
                    {item.source_name || "جم‌سیتی"}
                  </span>

                  <span>
                    {new Date(item.published_at).toLocaleDateString("fa-IR")}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
