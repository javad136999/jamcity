"use client";

import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function HomeReferralPlacement() {
  const pathname = usePathname();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (pathname !== "/") {
      setTarget(null);
      return;
    }

    let cancelled = false;
    let observer: MutationObserver | null = null;

    const findTarget = () => {
      const element = document.querySelector<HTMLElement>(".jam-map-category-bar");
      if (!element) return false;
      if (!cancelled) setTarget(element);
      return true;
    };

    if (!findTarget()) {
      observer = new MutationObserver(() => {
        if (findTarget()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [pathname]);

  if (!target || pathname !== "/") return null;

  return createPortal(
    <a
      href="/referral"
      dir="rtl"
      aria-label="معرفی کن جایزه بگیر"
      className="absolute left-2 top-2 z-[1300] flex max-w-[48%] items-center gap-2 rounded-2xl border border-[#E8D39A] bg-gradient-to-l from-[#FFF8DD] via-white to-[#FBEEDA] px-2.5 py-1.5 shadow-[0_6px_20px_rgba(180,135,35,.18)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(180,135,35,.28)] sm:left-3 sm:top-2 sm:max-w-[45%] sm:px-3 sm:py-2"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFE29A] to-[#C88B24] text-base shadow-sm sm:h-9 sm:w-9 sm:text-lg">🎁</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-black text-[#704817] sm:text-xs">معرفی کن جایزه بگیر</span>
        <span className="mt-0.5 block truncate text-[7px] font-bold text-[#A66B19] sm:text-[8px]">دوستت را به جم‌سیتی معرفی کن و جایزه بگیر</span>
      </span>
      <span className="shrink-0 rounded-full bg-[#FFF0C4] px-1.5 py-0.5 text-[7px] font-black text-[#8B5A13] sm:px-2 sm:py-1 sm:text-[8px]">ورود ←</span>
    </a>,
    target,
  );
}
