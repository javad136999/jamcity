"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MarketTicker from "@/components/MarketTicker";

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
    title: "اقتصادی",
    icon: "📰",
    tint: "#147A4B",
    tintSoft: "#E3F3E9",
    active: "bg-[#147A4B] text-white shadow-[0_0_18px_rgba(20,122,75,.30)]",
  },
  {
    key: "world",
    title: "جهانی",
    icon: "🌍",
    tint: "#3B82F6",
    tintSoft: "#EAF2FF",
    active: "bg-[#3B82F6] text-white shadow-[0_0_18px_rgba(59,130,246,.25)]",
  },
  {
    key: "jam",
    title: "اخبار جم",
    icon: "📍",
    tint: "#D98F2B",
    tintSoft: "#FBEEDA",
    active: "bg-[#D98F2B] text-white shadow-[0_0_18px_rgba(255,183,77,.30)]",
  },
  {
    key: "jobs",
    title: "فرصت شغلی",
    icon: "💼",
    tint: "#8B5CF6",
    tintSoft: "#F1EBFF",
    active: "bg-[#8B5CF6] text-white shadow-[0_0_18px_rgba(139,92,246,.25)]",
  },
];

function findSectionMeta(key: string) {
  return sections.find((s) => s.key === key) ?? sections[0];
}

function excerpt(text: string | null, max: number) {
  if (!text) return null;
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trim() + "…";
}

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fa-IR", {
    month: "long",
    day: "numeric",
  });
}

function NewsCardSkeleton() {
  return (
    <div className="flex animate-pulse gap-3 rounded-[20px] border border-[#E3EBDE] bg-white p-3">
      <div className="h-20 w-20 shrink-0 rounded-2xl bg-[#F0F3EE]" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-3/4 rounded-full bg-[#F0F3EE]" />
        <div className="h-2.5 w-full rounded-full bg-[#F0F3EE]" />
        <div className="h-2.5 w-2/3 rounded-full bg-[#F0F3EE]" />
      </div>
    </div>
  );
}

function FeaturedNewsCard({ item, sectionKey }: { item: NewsItem; sectionKey: string }) {
  const meta = findSectionMeta(sectionKey);
  const desc = excerpt(item.summary || item.content, 170);
  const Wrapper = item.source_url ? "a" : Link;
  const wrapperProps = item.source_url
    ? { href: item.source_url, target: "_blank", rel: "noopener noreferrer" }
    : { href: `/news/${item.id}` };

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Wrapper
      {...(wrapperProps as any)}
      className="group block overflow-hidden rounded-[24px] border border-[#E3EBDE] bg-white shadow-[0_10px_28px_rgba(20,60,40,.06)] transition hover:shadow-[0_14px_34px_rgba(20,60,40,.1)]"
    >
      <div className="relative h-40 w-full overflow-hidden bg-[#F3F6F1]">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt=""
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-5xl"
            style={{ backgroundColor: meta.tintSoft }}
          >
            {meta.icon}
          </div>
        )}
        <span
          className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black text-white shadow-sm"
          style={{ backgroundColor: meta.tint }}
        >
          {meta.icon} {meta.title}
        </span>
      </div>

      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 text-[14px] font-black leading-6 text-[#1D2B1F]">
          {item.title}
        </h3>
        {desc && <p className="line-clamp-3 text-[11.5px] leading-6 text-[#66766A]">{desc}</p>}
        <div className="flex items-center justify-between pt-1">
          <p className="text-[10px] font-bold text-[#8A968C]">
            {item.source_name || "جم‌سیتی"}
          </p>
          <p className="text-[10px] text-[#B0BAB1]">{formatDate(item.published_at)}</p>
        </div>
      </div>
    </Wrapper>
  );
}

function NewsCard({ item, sectionKey }: { item: NewsItem; sectionKey: string }) {
  const meta = findSectionMeta(sectionKey);
  const desc = excerpt(item.summary || item.content, 110);
  const Wrapper = item.source_url ? "a" : Link;
  const wrapperProps = item.source_url
    ? { href: item.source_url, target: "_blank", rel: "noopener noreferrer" }
    : { href: `/news/${item.id}` };

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Wrapper
      {...(wrapperProps as any)}
      className="group flex gap-3 rounded-[20px] border border-[#E3EBDE] bg-white p-3 shadow-sm transition hover:border-[#CFE6D6] hover:bg-[#FAFCF9]"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#F3F6F1]">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-2xl"
            style={{ backgroundColor: meta.tintSoft }}
          >
            {meta.icon}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="line-clamp-2 text-[12.5px] font-black leading-5 text-[#1D2B1F]">
          {item.title}
        </h3>
        {desc && <p className="line-clamp-2 text-[10.5px] leading-5 text-[#8A968C]">{desc}</p>}
        <div className="flex items-center gap-1.5 pt-0.5 text-[9.5px] text-[#B0BAB1]">
          <span className="font-bold" style={{ color: meta.tint }}>
            {item.source_name || "جم‌سیتی"}
          </span>
          <span>·</span>
          <span>{formatDate(item.published_at)}</span>
        </div>
      </div>
    </Wrapper>
  );
}

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

  const activeMeta = findSectionMeta(activeSection);
  const featuredItem = news[0];
  const restItems = news.slice(1);

  return (
    <main dir="rtl" className="min-h-screen space-y-5 bg-[#F7F9F4] px-4 pb-10 pt-3">
      {/* شاخص‌های بازار — بالای همه چیز */}
      <MarketTicker />

      {/* هدر صفحه */}
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E3F3E9] text-lg shadow-[0_0_12px_rgba(20,122,75,.18)]">
          📰
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-black text-[#1D2B1F]">اخبار جم‌سیتی</h1>
          <p className="flex items-center gap-1.5 text-[9.5px] font-bold text-[#8A968C]">
            <span className="flex items-center gap-1 text-[#147A4B]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#147A4B]" />
              زنده
            </span>
            · بروزرسانی روزانه از منابع خبری
          </p>
        </div>
      </div>

      {/* CATEGORIES */}
      <section>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-4">
          {sections.map((section) => {
            const isActive = activeSection === section.key;

            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`min-w-[82px] shrink-0 rounded-[14px] px-2 py-2 text-center transition ${
                  isActive
                    ? section.active
                    : "border border-[#E3EBDE] bg-white text-[#66766A] hover:bg-[#F3FAF5]"
                }`}
              >
                <div className="text-base">{section.icon}</div>
                <div className="mt-1 text-[10px] font-black">{section.title}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* CURRENT CATEGORY */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-[#1D2B1F]">
          {activeMeta.title}
        </h2>

        {!loading && (
          <span className="text-[9px] font-bold text-[#8A968C]">
            {new Intl.NumberFormat("fa-IR").format(news.length)} خبر
          </span>
        )}
      </div>

      {/* NEWS */}
      <section className="space-y-2.5">
        {/* LOADING */}
        {loading && (
          <div className="space-y-2.5">
            <NewsCardSkeleton />
            <NewsCardSkeleton />
            <NewsCardSkeleton />
          </div>
        )}

        {/* ERROR */}
        {!loading && error && (
          <div className="rounded-[22px] border border-[#F5D9D9] bg-white py-8 text-center">
            <div className="text-3xl">⚠️</div>
            <h2 className="mt-3 text-sm font-black text-[#E2574C]">{error}</h2>
            <button
              type="button"
              onClick={() => loadNews(activeSection)}
              className="mt-4 rounded-xl bg-[#147A4B] px-5 py-2 text-[10px] font-bold text-white"
            >
              تلاش مجدد
            </button>
          </div>
        )}

        {/* EMPTY */}
        {!loading && !error && news.length === 0 && (
          <div className="rounded-[22px] border border-[#E3EBDE] bg-white py-10 text-center">
            <div className="text-4xl">{activeMeta.icon}</div>
            <h2 className="mt-3 text-sm font-black text-[#1D2B1F]">
              خبری در این دسته وجود ندارد
            </h2>
            <p className="mt-2 px-4 text-[10px] leading-6 text-[#8A968C]">
              به‌محض دریافت خبر جدید، اینجا نمایش داده خواهد شد.
            </p>
            <button
              type="button"
              onClick={() => loadNews(activeSection)}
              className="mt-4 rounded-xl bg-[#1D2B1F] px-5 py-2 text-[10px] font-bold text-white"
            >
              بروزرسانی اخبار
            </button>
          </div>
        )}

        {/* NEWS LIST */}
        {!loading && !error && news.length > 0 && (
          <>
            {featuredItem && <FeaturedNewsCard item={featuredItem} sectionKey={activeSection} />}
            {restItems.map((item) => (
              <NewsCard key={item.id} item={item} sectionKey={activeSection} />
            ))}
          </>
        )}
      </section>
    </main>
  );
}
