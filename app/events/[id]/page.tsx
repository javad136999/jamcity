"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CityEvent = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  is_published: boolean;
  is_featured: boolean;
};

export default function EventDetailPage() {
  const params = useParams();

  const eventId =
    typeof params?.id === "string"
      ? params.id
      : "";

  const supabase = createClient() as any;

  const [event, setEvent] =
    useState<CityEvent | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [notFound, setNotFound] =
    useState(false);

  useEffect(() => {
    if (eventId) {
      loadEvent(eventId);
    }
  }, [eventId]);

  async function loadEvent(id: string) {
    setLoading(true);

    const { data, error } = await supabase
      .from("events")
      .select(
        "id,title,description,image_url,category,event_date,event_time,location,is_published,is_featured"
      )
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle();

    if (error || !data) {
      console.error(error);

      setNotFound(true);
      setEvent(null);
    } else {
      setEvent(data as CityEvent);
      setNotFound(false);
    }

    setLoading(false);
  }

  function categoryLabel(category: string | null) {
    switch (category) {
      case "cultural":
        return "فرهنگی";
      case "sport":
        return "ورزشی";
      case "religious":
        return "مذهبی";
      case "educational":
        return "آموزشی";
      case "business":
        return "اقتصادی";
      case "entertainment":
        return "تفریحی";
      case "government":
        return "اداری";
      default:
        return "عمومی";
    }
  }

  function formatDate(date: string | null) {
    if (!date) return "تاریخ اعلام نشده";

    try {
      return new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(date));
    } catch {
      return date;
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-[#F5FAF6] px-4 py-10"
      >

        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-12 text-center">

          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#D9EBDD] border-t-[#2E8B57]" />

          <p className="text-sm font-bold text-black">
            در حال دریافت رویداد...
          </p>

        </div>

      </main>
    );
  }

  if (notFound || !event) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-[#F5FAF6] px-4 py-10 text-black"
      >

        <div className="mx-auto max-w-xl rounded-3xl border border-[#D9EBDD] bg-white p-10 text-center shadow-sm">

          <div className="mb-4 text-6xl">
            📅
          </div>

          <h1 className="text-xl font-black">
            رویداد پیدا نشد
          </h1>

          <p className="mt-3 text-sm leading-7 text-[#68736C]">
            ممکن است رویداد حذف شده باشد یا هنوز منتشر نشده باشد.
          </p>

          <div className="mt-6 flex justify-center gap-2">

            <Link
              href="/events"
              className="rounded-2xl bg-[#2E8B57] px-5 py-3 text-xs font-black text-white"
            >
              همه رویدادها
            </Link>

            <Link
              href="/"
              className="rounded-2xl bg-[#EAF7ED] px-5 py-3 text-xs font-black text-[#18713D]"
            >
              صفحه اصلی
            </Link>

          </div>

        </div>

      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#F5FAF6] px-4 py-6 text-black"
    >

      <div className="mx-auto max-w-3xl">

        <div className="mb-4 flex items-center justify-between gap-2">

          <Link
            href="/events"
            className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-[#18713D] shadow-sm"
          >
            ← همه رویدادها
          </Link>

          <Link
            href="/"
            className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-[#18713D] shadow-sm"
          >
            خانه
          </Link>

        </div>

        <article className="overflow-hidden rounded-3xl border border-[#D9EBDD] bg-white shadow-sm">

          {event.image_url ? (

            <div className="h-56 sm:h-80">

              <img
                src={event.image_url}
                alt={event.title}
                className="h-full w-full object-cover"
              />

            </div>

          ) : (

            <div className="flex h-48 items-center justify-center bg-[#EAF3EC] text-6xl">
              📅
            </div>

          )}

          <div className="p-5 sm:p-7">

            <div className="mb-4 flex flex-wrap items-center gap-2">

              <span className="rounded-full bg-[#EAF7ED] px-3 py-1 text-[10px] font-black text-[#18713D]">
                {categoryLabel(event.category)}
              </span>

              {event.is_featured && (
                <span className="rounded-full bg-[#FFF4CF] px-3 py-1 text-[10px] font-black text-[#795A0C]">
                  ⭐ رویداد ویژه
                </span>
              )}

            </div>

            <h1 className="text-2xl font-black leading-10 text-black sm:text-3xl">
              {event.title}
            </h1>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">

              {event.event_date && (
                <div className="rounded-2xl bg-[#F6FAF7] p-4">

                  <div className="text-[10px] font-bold text-[#718078]">
                    تاریخ
                  </div>

                  <div className="mt-1 text-xs font-black text-black">
                    📅 {formatDate(event.event_date)}
                  </div>

                </div>
              )}

              {event.event_time && (
                <div className="rounded-2xl bg-[#F6FAF7] p-4">

                  <div className="text-[10px] font-bold text-[#718078]">
                    ساعت
                  </div>

                  <div className="mt-1 text-xs font-black text-black">
                    ⏰ {event.event_time}
                  </div>

                </div>
              )}

              {event.location && (
                <div className="rounded-2xl bg-[#F6FAF7] p-4">

                  <div className="text-[10px] font-bold text-[#718078]">
                    مکان
                  </div>

                  <div className="mt-1 text-xs font-black text-black">
                    📍 {event.location}
                  </div>

                </div>
              )}

            </div>

            {event.description && (
              <div className="mt-7 border-t border-[#E8EFE9] pt-6">

                <h2 className="mb-3 text-base font-black text-black">
                  درباره این رویداد
                </h2>

                <p className="whitespace-pre-line text-sm leading-8 text-[#3F4C43]">
                  {event.description}
                </p>

              </div>
            )}

          </div>

        </article>

      </div>

    </main>
  );
}