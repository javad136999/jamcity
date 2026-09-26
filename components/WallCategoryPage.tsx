"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { timeAgo } from "@/lib/constants";
import { Spinner } from "@/components/Feedback";
import Avatar from "@/components/Avatar";
import WallGate from "@/components/WallGate";
import { getOrCreateConversation } from "@/lib/conversations";
import {
  CATEGORY_META,
  belongsToOtherCategory,
  buildCategoryOrFilter,
  dedupeAndSortNewestFirst,
  type WallAdCategory,
} from "@/lib/wallAdCategory";

type CategoryAd = {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  business_id: string | null;
  category: WallAdCategory | null;
  source_message_id: string | null;
  created_at: string;
  profiles?: {
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export default function WallCategoryPage({
  category,
}: {
  category: WallAdCategory;
}) {
  const supabase = createClient();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const meta = CATEGORY_META[category];

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [ads, setAds] = useState<CategoryAd[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function load() {
      setAds(null);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("wall_messages")
        .select(
          "id,user_id,content,image_url,business_id,category,source_message_id,created_at"
        )
        .or(buildCategoryOrFilter(category))
        .order("created_at", { ascending: false })
        .limit(300);

      if (cancelled) return;

      if (error) {
        console.error(`wall ${category} fetch error`, error);
        setErrorMsg("بارگذاری آگهی‌ها با خطا مواجه شد. دوباره تلاش کنید.");
        setAds([]);
        return;
      }

      const rows = (data ?? []) as unknown as CategoryAd[];

      const scoped = rows.filter(
        (row) => !belongsToOtherCategory(row, category)
      );

      const deduped = dedupeAndSortNewestFirst(scoped);

      const userIds = Array.from(
        new Set(deduped.map((row) => row.user_id))
      );

      const { data: profiles } = userIds.length
        ? await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .in("id", userIds)
        : {
            data: [] as {
              id: string;
              display_name: string;
              avatar_url: string | null;
            }[],
          };

      if (cancelled) return;

      const profileMap = new Map(
        (profiles ?? []).map((profile) => [
          profile.id,
          {
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          },
        ])
      );

      deduped.forEach((row) => {
        row.profiles = profileMap.get(row.user_id) ?? null;
      });

      setAds(deduped);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user, category, supabase]);

  const visibleAds = useMemo(() => {
    if (!ads) return null;

    const query = searchInput.trim();

    if (!query) return ads;

    return ads.filter((ad) =>
      (ad.content ?? "").includes(query)
    );
  }, [ads, searchInput]);

  const displayAds = useMemo(() => {
    if (!visibleAds) return null;

    // جدیدترین آگهی پایین قرار می‌گیرد
    // آگهی‌های قدیمی‌تر در بالا قرار می‌گیرند
    return [...visibleAds].reverse();
  }, [visibleAds]);

  useEffect(() => {
    if (!displayAds || displayAds.length === 0) return;

    const timer = window.setTimeout(() => {
      const element = scrollRef.current;

      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    }, 50);

    return () => {
      window.clearTimeout(timer);
    };
  }, [displayAds]);

  async function openChatWith(otherId: string) {
    if (!user || otherId === user.id || navigating) return;

    setNavigating(true);

    const id = await getOrCreateConversation(
      supabase,
      user.id,
      otherId
    );

    setNavigating(false);

    if (id) {
      router.push(`/chat/${id}`);
    }
  }

  async function reportAd(
    reportedUserId: string,
    messageContent: string | null
  ) {
    if (!user || reportedUserId === user.id) return;

    const reason =
      window.prompt(
        "دلیل گزارش این آگهی را بنویسید (اختیاری):"
      ) ?? "";

    await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId,
      context: "wall",
      message_content: messageContent,
      reason: reason.trim() || null,
    });

    window.alert(
      "گزارش شما برای بررسی به پنل مدیریت ارسال شد."
    );
  }

  if (authLoading) {
    return <Spinner label="در حال بررسی ورود..." />;
  }

  if (!user) {
    return <WallGate />;
  }

  return (
    <div className="fade-in mx-auto -mt-4 flex h-[calc(100dvh-105px)] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] bg-[#EAF1E7] sm:mt-0 sm:h-[82dvh]">
      <div className="shrink-0 border-b border-[#E3EBDE] bg-white/95 px-3 pb-2 pt-2 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/wall")}
              aria-label="بستن"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3F6F1] text-lg font-bold text-[#66766A] transition hover:bg-[#E3EBDE]"
            >
              ×
            </button>

            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E3F3E9] text-base">
              {meta.icon}
            </span>

            <div className="min-w-0">
              <h1 className="truncate text-[13px] font-black text-[#1D2B1F]">
                آگهی‌های {meta.label}
              </h1>

              <p className="text-[10px] font-bold text-[#66766A]">
                {ads === null
                  ? "در حال بارگذاری..."
                  : `${ads.length.toLocaleString("fa-IR")} آگهی`}
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-2 flex w-full items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[#E3EBDE] bg-[#F7F9F4] px-3 py-2 transition focus-within:border-[#147A4B] focus-within:bg-white">
            <span className="text-[12px] text-[#B0BAB1]">
              🔍
            </span>

            <input
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
              placeholder={`جستجو در آگهی‌های ${meta.label}...`}
              className="w-full bg-transparent text-[11px] text-[#1D2B1F] outline-none placeholder:text-[#B0BAB1]"
            />
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#F4F7F2] p-3"
      >
        {ads === null ? (
          <Spinner label="در حال بارگذاری آگهی‌ها..." />
        ) : errorMsg ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="text-3xl">⚠️</span>

            <p className="text-[12px] text-[#8A968C]">
              {errorMsg}
            </p>
          </div>
        ) : (displayAds?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <span className="text-3xl">
              {meta.icon}
            </span>

            <p className="text-[12px] text-[#8A968C]">
              {searchInput.trim()
                ? "آگهی‌ای با این مشخصات پیدا نشد."
                : `هنوز آگهی‌ای در دسته‌ی ${meta.label} ثبت نشده.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayAds!.map((ad) => (
              <div
                key={ad.id}
                className="overflow-hidden rounded-[18px] border border-[#E3EBDE] bg-white shadow-sm"
              >
                {ad.image_url && (
                  <img
                    src={ad.image_url}
                    alt=""
                    className="aspect-[4/3] max-h-64 w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                )}

                <div className="space-y-2 p-3">
                  <button
                    type="button"
                    onClick={() =>
                      openChatWith(ad.user_id)
                    }
                    className="flex items-center gap-2 text-[12px] font-bold text-[#147A4B]"
                  >
                    <Avatar
                      url={ad.profiles?.avatar_url}
                      name={ad.profiles?.display_name}
                      size={24}
                    />

                    {ad.profiles?.display_name || "کاربر"}
                  </button>

                  {ad.content && (
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#1D2B1F]">
                      {ad.content}
                    </p>
                  )}

                  <div className="flex items-center justify-between border-t border-[#F0F3EE] pt-2.5">
                    <p className="text-[10px] text-[#B0BAB1]">
                      {timeAgo(ad.created_at)}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        reportAd(
                          ad.user_id,
                          ad.content
                        )
                      }
                      className="text-[10px] font-bold text-[#B0BAB1]"
                    >
                      🚩 گزارش
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}