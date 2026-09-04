"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NewsItem = {
  id: string;
  section: string;
  title: string;
  summary: string | null;
  content: string | null;
  source_name: string | null;
  source_url: string | null;
  image_url: string | null;
  symbol: string | null;
  sentiment: string | null;
  target_price: number | null;
  published_at: string;
};

export default function NewsDetailPage() {
  const params = useParams();
  const supabase = createClient();

  const [news, setNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNews() {
      if (!params?.id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("jamcity_content")
        .select(
          "id,section,title,summary,content,source_name,source_url,image_url,symbol,sentiment,target_price,published_at"
        )
        .eq("id", String(params.id))
        .eq("is_published", true)
        .maybeSingle();

      if (!error) {
        setNews(data as NewsItem | null);
      } else {
        console.error("News detail error:", error);
      }

      setLoading(false);
    }

    loadNews();
  }, [params, supabase]);

  if (loading) {
    return (
      <main dir="rtl" className="pb-10">
        <section className="rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="animate-pulse text-3xl">
            📰
          </div>

          <p className="mt-3 text-sm text-slate-400">
            در حال دریافت خبر...
          </p>
        </section>
      </main>
    );
  }

  if (!news) {
    return (
      <main dir="rtl" className="pb-10">
        <section className="rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm">

          <div className="text-4xl">
            😕
          </div>

          <h1 className="mt-3 text-lg font-black text-slate-700">
            خبر پیدا نشد
          </h1>

          <p className="mt-2 text-[10px] text-slate-400">
            این خبر وجود ندارد یا دیگر منتشر نشده است.
          </p>

          <Link
            href="/news"
            className="mt-5 inline-block rounded-xl bg-green-500 px-5 py-2.5 text-[9px] font-black text-black"
          >
            بازگشت به اخبار
          </Link>

        </section>
      </main>
    );
  }

  return (
    <main dir="rtl" className="pb-10">

      <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">

        {news.image_url && (
          <div className="h-56 overflow-hidden bg-slate-100 sm:h-80">

            <img
              src={news.image_url}
              alt={news.title}
              className="h-full w-full object-cover"
            />

          </div>
        )}

        <div className="p-5 sm:p-8">

          <Link
            href="/news"
            className="text-[9px] font-bold text-green-600"
          >
            ← بازگشت به اخبار
          </Link>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-[8px] text-slate-400">

            <span>
              {news.source_name || "جم‌سیتی"}
            </span>

            <span>
              •
            </span>

            <span>
              {new Date(news.published_at).toLocaleDateString("fa-IR")}
            </span>

            {news.symbol && (
              <>
                <span>
                  •
                </span>

                <span className="font-black text-green-600">
                  {news.symbol}
                </span>
              </>
            )}

          </div>

          <h1 className="mt-4 text-2xl font-black leading-9 text-slate-800 sm:text-3xl">
            {news.title}
          </h1>

          {news.summary && (
            <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-7 text-slate-600">
              {news.summary}
            </p>
          )}

          {news.symbol && (
            <div className="mt-5 rounded-2xl border border-green-100 bg-green-50 p-4">

              <div className="flex flex-wrap items-center justify-between gap-3">

                <div>
                  <p className="text-[8px] text-slate-400">
                    دارایی / نماد
                  </p>

                  <p className="mt-1 text-lg font-black text-slate-800">
                    {news.symbol}
                  </p>
                </div>

                {news.sentiment && (
                  <div>
                    <p className="text-[8px] text-slate-400">
                      دیدگاه تحلیل
                    </p>

                    <p className="mt-1 text-sm font-black text-green-600">
                      {news.sentiment}
                    </p>
                  </div>
                )}

                {news.target_price !== null && (
                  <div>
                    <p className="text-[8px] text-slate-400">
                      هدف تحلیل
                    </p>

                    <p className="mt-1 text-sm font-black text-slate-800">
                      {new Intl.NumberFormat("fa-IR").format(
                        news.target_price
                      )}
                    </p>
                  </div>
                )}

              </div>

            </div>
          )}

          {news.content && (
            <div className="mt-7 whitespace-pre-line text-sm leading-8 text-slate-700">
              {news.content}
            </div>
          )}

          {news.source_url && (
            <a
              href={news.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 block rounded-2xl bg-slate-900 px-5 py-3 text-center text-[10px] font-black text-white transition hover:bg-slate-800"
            >
              مشاهده منبع اصلی خبر ←
            </a>
          )}

        </div>

      </article>

    </main>
  );
}