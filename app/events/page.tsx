"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

export default function EventsPage() {
  const supabase = createClient() as any;

  const [events, setEvents] = useState<CityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    const { data, error } = await supabase
      .from("events")
      .select(
        "id,title,description,image_url,category,event_date,event_time,location,is_published,is_featured"
      )
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("event_date", { ascending: true });

    if (error) {
      console.error(error);
      setEvents([]);
    } else {
      setEvents((data ?? []) as CityEvent[]);
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

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#F5FAF6] px-4 py-6 text-[#111111]"
    >
      <div className="mx-auto max-w-5xl">

        <header className="mb-6 rounded-3xl border border-[#D9EBDD] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">

            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">📅</span>

                <h1 className="text-xl font-black text-black">
                  رویدادهای جم
                </h1>
              </div>

              <p className="mt-1 text-xs text-[#68736C]">
                آخرین رویدادها و برنامه‌های شهر جم
              </p>
            </div>

            <Link
              href="/"
              className="rounded-2xl bg-[#EAF7ED] px-4 py-2 text-xs font-black text-[#18713D]"
            >
              خانه
            </Link>

          </div>
        </header>

        {loading ? (
          <div className="rounded-3xl bg-white p-12 text-center text-sm font-bold">
            در حال دریافت رویدادها...
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#CFE0D2] bg-white p-12 text-center">

            <div className="mb-3 text-5xl">
              📅
            </div>

            <h2 className="text-lg font-black text-black">
              هنوز رویدادی منتشر نشده
            </h2>

            <p className="mt-2 text-xs text-[#68736C]">
              به‌زودی رویدادهای جدید شهر جم در این بخش قرار می‌گیرند.
            </p>

          </div>
        ) : (

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {events.map((event) => (

              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group overflow-hidden rounded-3xl border border-[#DCE8DE] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >

                <div className="relative h-48 bg-[#EAF3EC]">

                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl">
                      📅
                    </div>
                  )}

                  <div className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-black text-black shadow">
                    {categoryLabel(event.category)}
                  </div>

                  {event.is_featured && (
                    <div className="absolute left-3 top-3 rounded-full bg-[#FFF4CF] px-3 py-1 text-[10px] font-black text-[#795A0C] shadow">
                      ⭐ ویژه
                    </div>
                  )}

                </div>

                <div className="p-4">

                  <h2 className="line-clamp-2 text-base font-black leading-7 text-black">
                    {event.title}
                  </h2>

                  {event.description && (
                    <p className="mt-2 line-clamp-2 text-xs leading-6 text-[#68736C]">
                      {event.description}
                    </p>
                  )}

                  <div className="mt-4 space-y-2 text-[10px] font-bold text-[#526158]">

                    {event.event_date && (
                      <div>
                        📅 {formatDate(event.event_date)}
                      </div>
                    )}

                    {event.event_time && (
                      <div>
                        ⏰ {event.event_time}
                      </div>
                    )}

                    {event.location && (
                      <div>
                        📍 {event.location}
                      </div>
                    )}

                  </div>

                  <div className="mt-4 border-t border-[#EDF2EE] pt-3 text-center text-[10px] font-black text-[#18713D]">
                    مشاهده جزئیات ←
                  </div>

                </div>

              </Link>

            ))}

          </div>

        )}

      </div>
    </main>
  );
}