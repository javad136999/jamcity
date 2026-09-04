"use client";

import { useEffect, useState } from "react";
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

const supabase = createClient();

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

  useEffect(() => {
    let cancelled = false;

    async function loadNews() {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("jamcity_content")
          .select(
            "id,section,title,summary,content,source_name,source_url,image_url,symbol,sentiment,target_price,published_at"
          )
          .eq("is_published", true)
          .eq("section", activeSection)
          .order("published_at", { ascending: false })
          .limit(30);

        if (cancelled) return;

        if (error) {
          console.error("NEWS ERROR:", error);
          setNews([]);
          setError("خطا در دریافت اخبار");
          return;
        }

        setNews((data ?? []) as NewsItem[]);
      } catch (err) {
        console.error("NEWS LOAD ERROR:", err);

        if (!cancelled) {
          setNews([]);
          setError("خطا در ارتباط با سرور");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadNews();

    return () => {
      cancelled = true;
    };
  }, [activeSection]);

  return (
    <main dir="rtl" className="space-y-5 pb-10">

      {/* HEADER */}

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">

        <p className="text-[9px] font-black text-green-600">
          JAM CITY NEWS
        </p>

        <h1 className="mt-1 text-2xl font-black text-slate-800">
          📰 اخبار جم‌سیتی
        </h1>

        <p className="mt-2 text-[10px] leading-6 text-slate-400">
          آخرین اخبار ایران، اقتصاد، جهان، جم و فرصت‌های شغلی
        </p>

      </section>


      {/* CATEGORIES */}

      <section className="rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm">

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">

          {sections.map((section) => {

            const isActive = activeSection === section.key;

            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`min-h-[68px] rounded-[18px] px-2 text-center transition ${
                  isActive
                    ? section.active
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >

                <div className="text-xl">
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

      <div className="flex items-center justify-between px-1">

        <h2 className="text-sm font-black text-slate-700">
          {sections.find((x) => x.key === activeSection)?.title}
        </h2>

        {!loading && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[9px] font-bold text-slate-500">
            {news.length} خبر
          </span>
        )}

      </div>


      {/* NEWS */}

      <section>

        {/* LOADING */}

        {loading && (

          <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm">

            <div className="animate-pulse text-3xl">
              📰
            </div>

            <p className="mt-3 text-sm text-slate-400">
              در حال دریافت اخبار...
            </p>

          </div>

        )}


        {/* ERROR */}

        {!loading && error && (

          <div className="rounded-[28px] border border-red-200 bg-red-50 p-8 text-center">

            <div className="text-3xl">
              ⚠️
            </div>

            <h2 className="mt-3 text-sm font-black text-red-700">
              {error}
            </h2>

            <button
              type="button"
              onClick={() => {
                setActiveSection((current) => current);
              }}
              className="mt-4 rounded-xl bg-red-500 px-5 py-2 text-[10px] font-bold text-white"
            >
              تلاش مجدد
            </button>

          </div>

        )}


        {/* EMPTY */}

        {!loading && !error && news.length === 0 && (

          <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm">

            <div className="text-4xl">
              📰
            </div>

            <h2 className="mt-3 text-lg font-black text-slate-700">
              خبری در این دسته وجود ندارد
            </h2>

            <p className="mt-2 text-[10px] leading-6 text-slate-400">
              به‌محض دریافت خبر جدید، اینجا نمایش داده خواهد شد.
            </p>

          </div>

        )}


        {/* NEWS LIST */}

        {!loading && !error && news.length > 0 && (

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

            {news.map((item) => (

              <article
                key={item.id}
                className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >

                {/* IMAGE */}

                {item.image_url ? (

                  <div className="h-44 overflow-hidden bg-slate-100">

                    <img
                      src={item.image_url}
                      alt={item.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 hover:scale-105"
                    />

                  </div>

                ) : (

                  <div className="flex h-28 items-center justify-center bg-slate-50">

                    <span className="text-4xl opacity-30">
                      📰
                    </span>

                  </div>

                )}


                {/* CONTENT */}

                <div className="p-4">

                  {/* SOURCE + DATE */}

                  <div className="mb-3 flex items-center justify-between gap-2">

                    <span className="truncate text-[8px] font-bold text-green-600">
                      {item.source_name || "جم‌سیتی"}
                    </span>

                    <span className="shrink-0 text-[8px] text-slate-400">
                      {item.published_at
                        ? new Date(item.published_at).toLocaleDateString(
                            "fa-IR"
                          )
                        : ""}
                    </span>

                  </div>


                  {/* TITLE */}

                  <h2 className="line-clamp-3 text-sm font-black leading-6 text-slate-800">
                    {item.title}
                  </h2>


                  {/* SUMMARY */}

                  {item.summary && (

                    <p className="mt-2 line-clamp-3 text-[10px] leading-6 text-slate-400">
                      {item.summary}
                    </p>

                  )}


                  {/* CRYPTO / ANALYSIS */}

                  {item.symbol && (

                    <div className="mt-3 rounded-xl bg-slate-50 p-3">

                      <div className="flex items-center justify-between">

                        <span className="text-[9px] font-black text-slate-700">
                          {item.symbol}
                        </span>

                        {item.sentiment && (

                          <span className="text-[8px] font-bold text-green-600">
                            {item.sentiment}
                          </span>

                        )}

                      </div>


                      {item.target_price !== null && (

                        <p className="mt-1 text-[8px] text-slate-400">
                          هدف تحلیل:{" "}
                          {new Intl.NumberFormat("fa-IR").format(
                            item.target_price
                          )}
                        </p>

                      )}

                    </div>

                  )}


                  {/* BUTTON */}

                  {item.source_url ? (

                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 block rounded-xl bg-slate-900 px-4 py-2.5 text-center text-[9px] font-bold text-white transition hover:bg-slate-800"
                    >
                      مشاهده منبع خبر ←
                    </a>

                  ) : (

                    <Link
                      href={`/news/${item.id}`}
                      className="mt-4 block rounded-xl bg-green-500 px-4 py-2.5 text-center text-[9px] font-bold text-black transition hover:bg-green-400"
                    >
                      ادامه خبر ←
                    </Link>

                  )}

                </div>

              </article>

            ))}

          </div>

        )}

      </section>

    </main>
  );
}