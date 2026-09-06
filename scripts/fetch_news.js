"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/constants";

type NewsSection = "jam" | "jobs" | "economic" | "world";

type NewsItem = {
  id: string;
  section: NewsSection;
  title: string;
  summary: string | null;
  content: string | null;
  source_name: string | null;
  source_url: string | null;
  image_url: string | null;
  published_at: string;
};

const SECTION_META: Record<
  NewsSection,
  { label: string; icon: string; tint: string; tintSoft: string; text: string }
> = {
  jam: { label: "جم", icon: "📍", tint: "#147A4B", tintSoft: "#E3F3E9", text: "#0f9a56" },
  jobs: { label: "مشاغل", icon: "💼", tint: "#2563EB", tintSoft: "#EAF2FF", text: "#2563EB" },
  economic: { label: "اقتصادی", icon: "💹", tint: "#D98F2B", tintSoft: "#FBEEDA", text: "#D98F2B" },
  world: { label: "جهان", icon: "🌍", tint: "#7E22CE", tintSoft: "#F4EAFF", text: "#7E22CE" },
};

const SECTION_ORDER: NewsSection[] = ["jam", "jobs", "economic", "world"];

function excerpt(text: string | null, max: number) {
  if (!text) return null;
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trim() + "…";
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

function NewsCard({ item, featured }: { item: NewsItem; featured?: boolean }) {
  const meta = SECTION_META[item.section];
  const desc = excerpt(item.summary || item.content, featured ? 180 : 100);

  const Wrapper = item.source_url ? "a" : "div";
  const wrapperProps = item.source_url
    ? { href: item.source_url, target: "_blank", rel: "noopener noreferrer" }
    : {};

  if (featured) {
    return (
      <Wrapper
        {...wrapperProps}
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
            {meta.icon} {meta.label}
          </span>
        </div>

        <div className="space-y-2 p-4">
          <h3 className="line-clamp-2 text-[14px] font-black leading-6 text-[#1D2B1F]">
            {item.title}
          </h3>
          {desc && (
            <p className="line-clamp-3 text-[11.5px] leading-6 text-[#66766A]">{desc}</p>
          )}
          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] font-bold text-[#8A968C]">
              {item.source_name || "منبع نامشخص"}
            </p>
            <p className="text-[10px] text-[#B0BAB1]">{timeAgo(item.published_at)}</p>
          </div>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper
      {...wrapperProps}
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
        {desc && (
          <p className="line-clamp-2 text-[10.5px] leading-5 text-[#8A968C]">{desc}</p>
        )}
        <div className="flex items-center gap-1.5 pt-0.5 text-[9.5px] text-[#B0BAB1]">
          <span className="font-bold" style={{ color: meta.text }}>
            {item.source_name || "منبع نامشخص"}
          </span>
          <span>·</span>
          <span>{timeAgo(item.published_at)}</span>
        </div>
      </div>
    </Wrapper>
  );
}

export default function JamCityNews() {
  const supabase = createClient();
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [activeSection, setActiveSection] = useState<NewsSection>("jam");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("jamcity_content")
        .select(
          "id,section,title,summary,content,source_name,source_url,image_url,published_at"
        )
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(120);

      if (error) {
        console.error("news load error", error);
        if (!cancelled) setItems([]);
        return;
      }

      if (!cancelled) setItems((data as NewsItem[]) ?? []);
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sectionCounts = useMemo(() => {
    const counts: Record<NewsSection, number> = { jam: 0, jobs: 0, economic: 0, world: 0 };
    (items ?? []).forEach((item) => {
      counts[item.section] = (counts[item.section] ?? 0) + 1;
    });
    return counts;
  }, [items]);

  const sectionItems = useMemo(
    () => (items ?? []).filter((item) => item.section === activeSection),
    [items, activeSection]
  );

  const featuredItem = sectionItems[0];
  const restItems = sectionItems.slice(1);
  const activeMeta = SECTION_META[activeSection];

  return (
    <section className="rounded-[26px] border border-[#E3EBDE] bg-white p-3.5 shadow-sm sm:p-4">
      {/* هدر بخش اخبار */}
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E3F3E9] text-lg shadow-[0_0_12px_rgba(20,122,75,.18)]">
          📰
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-black text-[#1D2B1F] sm:text-lg">اخبار امروز جم</h2>
          <p className="flex items-center gap-1.5 text-[9.5px] font-bold text-[#8A968C]">
            <span className="flex items-center gap-1 text-[#147A4B]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#147A4B]" />
              زنده
            </span>
            · بروزرسانی روزانه از منابع خبری منطقه
          </p>
        </div>
      </div>

      {/* تب دسته‌بندی‌ها */}
      <div className="mb-3.5 flex gap-1.5 overflow-x-auto pb-0.5">
        {SECTION_ORDER.map((section) => {
          const meta = SECTION_META[section];
          const isActive = section === activeSection;
          return (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(section)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold transition ${
                isActive ? "text-white shadow-sm" : "border border-[#E3EBDE] bg-white text-[#66766A]"
              }`}
              style={isActive ? { backgroundColor: meta.tint } : undefined}
            >
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
              {sectionCounts[section] > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                    isActive ? "bg-white/25 text-white" : "text-[#B0BAB1]"
                  }`}
                  style={!isActive ? { backgroundColor: meta.tintSoft, color: meta.text } : undefined}
                >
                  {sectionCounts[section].toLocaleString("fa-IR")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* بدنه: بارگذاری / خالی / لیست اخبار */}
      {items === null ? (
        <div className="space-y-2.5">
          <NewsCardSkeleton />
          <NewsCardSkeleton />
          <NewsCardSkeleton />
        </div>
      ) : sectionItems.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-14 text-center">
          <span className="text-3xl">{activeMeta.icon}</span>
          <p className="text-[12px] text-[#8A968C]">
            فعلاً خبری در دسته «{activeMeta.label}» ثبت نشده. بعداً دوباره سر بزنید.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {featuredItem && <NewsCard item={featuredItem} featured />}
          {restItems.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
