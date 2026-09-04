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

const sections = [
  {
    key: "economic",
    title: "اخبار اقتصادی",
    icon: "📰",
    color: "green",
  },
  {
    key: "world",
    title: "اخبار جهانی",
    icon: "🌍",
    color: "blue",
  },
  {
    key: "jam",
    title: "اخبار جم",
    icon: "📍",
    color: "amber",
  },
  {
    key: "jobs",
    title: "فرصت‌های شغلی",
    icon: "💼",
    color: "purple",
  },
];

export default function NewsPage() {
  const supabase = createClient();

  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeSection, setActiveSection] = useState("economic");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNews() {
      setLoading(true);

      const { data, error } = await supabase
        .from("jamcity_content")
        .select(
          "id,section,title,summary,content,source_name,source_url,image_url,symbol,sentiment,target_price,published_at"
        )
        .eq("is_published", true)
        .eq("section", activeSection)
        .order("published_at", { ascending: false })
        .limit(20);

      if (!error) {
        setNews((data ?? []) as NewsItem[]);
      } else {
        console.error("News loading error:", error);
        setNews([]);
      }

      setLoading(false);
    }

    loadNews();
  }, [activeSection, supabase]);

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

        <p className="mt-2 text-[10px] text-slate-400">
          آخرین اخبار ایران، اقتصاد، جهان، جم و فرصت‌های شغلی
        </p>

      </section>


      {/* CATEGORIES */}

      <section className="rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm">

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">

          {sections.map((section) => (

            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className={`min-h-[65px] rounded-[18px] px-2 text-center text-[11px] font-black transition ${
                activeSection === section.key
                  ? section.color === "green"
                    ? "bg-green-500 text-white shadow-md"
                    : section.color === "blue"
                    ? "bg-blue-500 text-white shadow-md"
                    : section.color === "amber"
                    ? "bg-amber-500 text-white shadow-md"
                    : "bg-purple-500 text-white shadow-md"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >

              <span className="text-xl">
                {section.icon}
              </span>

              <span className="mr-1">
                {section.title}
              </span>

            </button>

          ))}

        </div>

      </section>


      {/* NEWS LIST */}

      <section>

        {loading ? (

          <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm">

            <div className="animate-pulse text-3xl">
              📰
            </div>

            <p className="mt-3 text-sm text-slate-400">
              در حال دریافت اخبار...
            </p>

          </div>

        ) : news.length === 0 ? (

          <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm">

            <div className="text-4xl">
              📰
            </div>

            <h2 className="mt-3 text-lg font-black text-slate-700">
              هنوز خبری منتشر نشده است
            </h2>

            <p className="mt-2 text-[10px] leading-6 text-slate-400">
              به‌محض انتشار خبر، اینجا نمایش داده خواهد شد.
            </p>

          </div>

        ) : (

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

            {news.map((item) => (

              <Link
                key={item.id}
                href={`/news/${item.id}`}
                className="group block overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >

                {/* IMAGE */}

                {item.image_url && (
                  <div className="h-44 overflow-hidden bg-slate-100">

                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />

                  </div>
                )}


                {/* CONTENT */}

                <div className="p-4">

                  <div className="mb-3 flex items-center justify-between">

                    <span className="text-[8px] font-bold text-green-600">
                      {item.source_name || "جم‌سیتی"}
                    </span>

                    <span className="text-[8px] text-slate-400">
                      {new Date(item.published_at).toLocaleDateString(
                        "fa-IR"
                      )}
                    </span>

                  </div>


                  <h2 className="line-clamp-2 text-sm font-black leading-6 text-slate-800 transition group-hover:text-green-600">
                    {item.title}
                  </h2>


                  {item.summary && (
                    <p className="mt-2 line-clamp-3 text-[10px] leading-6 text-slate-400">
                      {item.summary}
                    </p>
                  )}


                  {/* CRYPTO DATA */}

                  {item.symbol && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-2">

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
                          هدف تحلیل:
                          {" "}
                          {new Intl.NumberFormat("fa-IR").format(
                            item.target_price
                          )}
                        </p>
                      )}

                    </div>
                  )}


                  {/* CONTINUE */}

                  <div className="mt-4 rounded-xl bg-green-500 px-4 py-2.5 text-center text-[9px] font-bold text-black transition group-hover:bg-green-400">
                    ادامه خبر ←
                  </div>

                </div>

              </Link>

            ))}

          </div>

        )}

      </section>

    </main>
  );
}