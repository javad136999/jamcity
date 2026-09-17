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
      className="absolute left-6 top-2 z-[1300] flex min-h-[44px] w-[270px] max-w-[42%] items-center gap-2 rounded-2xl border border-[#E8D39A] bg-gradient-to-l from-[#FFF8DD] via-white to-[#FBEEDA] px-2.5 py-1.5 shadow-[0_0_12px_rgba(218,165,55,.48),0_5px_18px_rgba(180,135,35,.18)] transition hover:-translate-y-0.5 hover:shadow-[0_0_18px_rgba(218,165,55,.68),0_8px_22px_rgba(180,135,35,.28)] sm:left-6 sm:top-2 sm:w-[280px] sm:max-w-[41%] sm:gap-2 sm:px-2.5 sm:py-1.5 referral-sun-glow"
    >
      <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#FFE29A] to-[#C88B24] text-sm shadow-[0_0_10px_rgba(218,165,55,.5)] sm:h-[32px] sm:w-[32px] sm:text-sm">🎁</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-black text-[#704817] sm:text-[10px]">معرفی کن جایزه بگیر</span>
        <span className="mt-0.5 block truncate text-[7px] font-bold text-[#A66B19] sm:text-[7px]">دوستت را به جم‌سیتی معرفی کن و جایزه بگیر</span>
      </span>
      <span className="shrink-0 rounded-full bg-[#FFF0C4] px-1.5 py-0.5 text-[7px] font-black text-[#8B5A13] sm:px-1.5 sm:py-0.5 sm:text-[7px]">ورود ←</span>
      <style jsx>{`
        .referral-sun-glow {
          animation: referralSunGlow 2.4s ease-in-out infinite;
        }
        @keyframes referralSunGlow {
          0%, 100% {
            box-shadow: 0 0 10px rgba(218,165,55,.36), 0 5px 18px rgba(180,135,35,.16);
          }
          50% {
            box-shadow: 0 0 24px rgba(218,165,55,.78), 0 0 42px rgba(218,165,55,.28), 0 7px 22px rgba(180,135,35,.22);
          }
        }
      `}</style>
    </a>,
    target,
  );
}
