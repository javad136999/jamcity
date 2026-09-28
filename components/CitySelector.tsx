"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function CitySelector() {
  const { city, cities, setCity } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  async function chooseCity(cityId: string) {
    const selected = cities.find((item) => item.id === cityId);
    if (!selected) return;
    setOpen(false);
    if (selected.id === city.id) return;
    await setCity(selected.id);
    router.push(`/${selected.slug}`);
  }

  return (
    <div ref={rootRef} className="relative shrink-0" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`انتخاب شهر؛ شهر فعال ${city.name}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="انتخاب شهر"
        className="flex h-9 w-9 items-center justify-center gap-1 rounded-full border border-[#CFE3D5] bg-[#F3FAF5] text-base shadow-sm transition hover:bg-[#EAF6EC] focus:outline-none focus:ring-2 focus:ring-jam-green/30 sm:h-10 sm:w-auto sm:px-2.5"
      >
        <span aria-hidden="true">🏙️</span>
        <span className="sr-only text-[10px] font-black text-[#35704A] sm:not-sr-only">انتخاب شهر</span>
      </button>

      {open && (
        <div className="fade-in absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-xl2 border border-[#CFE3D5] bg-white p-2 shadow-soft">
          <div className="border-b border-slate-100 px-2 pb-2">
            <p className="text-[11px] font-black text-slate-800">انتخاب شهر</p>
            <p className="mt-0.5 text-[10px] text-slate-400">شهر فعال: {city.name}</p>
          </div>
          <div className="mt-1 max-h-64 overflow-y-auto" role="listbox" aria-label="شهرهای فعال">
            {cities.length === 0 ? (
              <p className="px-2 py-3 text-[10px] text-slate-400">در حال دریافت شهرها…</p>
            ) : cities.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={item.id === city.id}
                onClick={() => void chooseCity(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-right text-[11px] font-bold transition ${item.id === city.id ? "bg-[#F0F8F2] text-[#27633E]" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <span>{item.name}</span>
                {item.id === city.id && <span aria-hidden="true" className="text-[#2F8A50]">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
