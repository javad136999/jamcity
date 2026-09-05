
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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

const sections = [
  {
    key: "economic",
    title: "اخبار اقتصادی",
    icon: "📰",
    active: "bg-green-500 text-white shadow-md",
  },
  {
    key: "world",
    title: "اخبار جهانی",
    icon: "🌍",
    active: "bg-blue-500 text-white shadow-md",
  },
  {
    key: "jam",
    title: "اخبار جم",
    icon: "📍",
    active: "bg-amber-500 text-white shadow-md",
  },
  {
    key: "jobs",
    title: "فرصت‌های شغلی",
    icon: "💼",
    active: "bg-purple-500 text-white shadow-md",
  },
];

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeSection, setActiveSection] = useState("economic");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNews = useCallback(async (section: string) => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("jamcity_content")
        .select(
          "id,section,title,summary,content,source_name,source_url,image_url,symbol,sentiment,target_price,published_at"
        )
        .eq("is_published", true)
        .eq("section", section)
        .order("published_at", { ascending: false })
        .limit(30);

      if (error) {
        console.error("NEWS ERROR:", error);
        setNews([]);
        setError("خطا در دریافت اخبار");
        return;
      }

      setNews((data ?? []) as NewsItem[]);
    } catch (err) {
      console.error("NEWS LOAD ERROR:", err);
      setNews([]);
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews(activeSection);
  }, [activeSection, loadNews]);

  return (
    <main dir="rtl" className="pb-10">

      {/* CATEGORIES */}
      <section className="mb-5">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-4">
          {sections.map((section) => {
            const isActive = activeSection === section.key;

            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`min-w-[82px] shrink-0 rounded-[14px] px-2 py-2 text-center transition sm:min-w-0 ${
                  isActive
                    ? section.active
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className="text-base">
                  {section.icon}
                </div>

                <div className="mt-1 text-[10px] font-black">
                  {section.title}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* CURRENT CATEGORY */}
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-black text-slate-700">
          {sections.find((x) => x.key === activeSection)?.title}
        </h2>

        {!loading && (
          <span className="text-[9px] font-bold text-slate-400">
            {news.length} خبر
          </span>
        )}
      </div>

      {/* NEWS */}
      <section>

        {/* LOADING */}
        {loading && (
          <div className="py-10 text-center">
            <div className="animate-pulse text-3xl">
              📰
            </div>

            <p className="mt-3 text-[10px] text-slate-400">
              در حال دریافت اخبار...
            </p>
          </div>
        )}

        {/* ERROR */}
        {!loading && error && (
          <div className="py-8 text-center">
            <div className="text-3xl">
              ⚠️
            </div>

            <h2 className="mt-3 text-sm font-black text-red-700">
              {error}
            </h2>

            <button
              type="button"
              onClick={() => loadNews(activeSection)}
              className="mt-4 rounded-xl bg-red-500 px-5 py-2 text-[10px] font-bold text-white"
            >
              تلاش مجدد
            </button>
          </div>
        )}

        {/* EMPTY */}
        {!loading && !error && news.length === 0 && (
          <div className="py-10 text-center">
            <div className="text-4xl">
              📰
            </div>

            <h2 className="mt-3 text-sm font-black text-slate-700">
              خبری در این دسته وجود ندارد
            </h2>

            <p className="mt-2 text-[10px] leading-6 text-slate-400">
              به‌محض دریافت خبر جدید، اینجا نمایش داده خواهد شد.
            </p>

            <button
              type="button"
              onClick={() => loadNews(activeSection)}
              className="mt-4 rounded-xl bg-slate-900 px-5 py-2 text-[10px] font-bold text-white"
            >
              بروزرسانی اخبار
            </button>
          </div>
        )}

        {/* TEXT NEWS LIST */}
        {!loading && !error && news.length > 0 && (
          <div className="divide-y divide-slate-200">
            {news.map((item) => (
              <article
                key={item.id}
                className="py-4"
              >
                {/* TITLE */}
                <h2 className="text-[13px] font-black leading-6 text-slate-800">
                  {item.title}
                </h2>

                {/* SUMMARY */}
                {item.summary && (
                  <p className="mt-1 text-[10px] leading-6 text-slate-500">
                    {item.summary}
                  </p>
                )}

                {/* SOURCE + DATE */}
                <div className="mt-2 flex items-center gap-3 text-[8px]">
                  <span className="font-bold text-green-600">
                    {item.source_name || "جم‌سیتی"}
                  </span>

                  <span className="text-slate-400">
                    {item.published_at
                      ? new Date(item.published_at).toLocaleDateString(
                          "fa-IR"
                        )
                      : ""}
                  </span>
                </div>

                {/* LINK */}
                {item.source_url ? (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-[9px] font-bold text-green-600"
                  >
                    مشاهده منبع ←
                  </a>
                ) : (
                  <Link
                    href={`/news/${item.id}`}
                    className="mt-2 inline-block text-[9px] font-bold text-green-600"
                  >
                    ادامه خبر ←
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

