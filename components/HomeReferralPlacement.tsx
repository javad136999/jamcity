"use client";

import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const CATEGORY_LABEL = "فیلتر دسته‌بندی کسب‌وکارها";

type Placement = { categoryBox: HTMLElement; section: HTMLElement };

export default function HomeReferralPlacement() {
  const pathname = usePathname();
  const [placement, setPlacement] = useState<Placement | null>(null);

  useEffect(() => {
    if (pathname !== "/") {
      setPlacement(null);
      return;
    }

    let cancelled = false;
    let observer: MutationObserver | null = null;

    const findPlacement = () => {
      const select = document.querySelector<HTMLSelectElement>(`select[aria-label="${CATEGORY_LABEL}"]`);
      const categoryBox = select?.parentElement ?? null;
      const section = categoryBox?.parentElement ?? null;
      if (!select || !categoryBox || !section) return false;
      if (!cancelled) setPlacement({ categoryBox, section });
      return true;
    };

    if (!findPlacement()) {
      observer = new MutationObserver(() => {
        if (findPlacement()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      setPlacement(null);
    };
  }, [pathname]);

  useEffect(() => {
    if (!placement || pathname !== "/") return;

    const position = () => {
      const { categoryBox, section } = placement;
      if (!document.body.contains(categoryBox) || !document.body.contains(section)) return;

      const isMobile = window.innerWidth < 768;
      const sectionRect = section.getBoundingClientRect();
      const categoryRect = categoryBox.getBoundingClientRect();
      const gap = 8;
      const width = isMobile ? sectionRect.width : Math.max(0, (sectionRect.width - gap) / 2);

      categoryBox.style.width = isMobile ? "100%" : `${width}px`;
      if (!isMobile) {
        categoryBox.style.marginLeft = "0";
        categoryBox.style.marginRight = "auto";
      } else {
        categoryBox.style.marginLeft = "";
        categoryBox.style.marginRight = "";
      }
    };

    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, { passive: true });
    const resizeObserver = new ResizeObserver(position);
    resizeObserver.observe(placement.section);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position);
    };
  }, [placement, pathname]);

  if (!placement || pathname !== "/") return null;

  return createPortal(
    <div
      dir="rtl"
      className="pointer-events-auto fixed z-50"
      style={{
        left: placement.section.getBoundingClientRect().left + (window.innerWidth >= 768 ? (placement.section.getBoundingClientRect().width + 8) / 2 : 0),
        top: placement.section.getBoundingClientRect().top + (window.innerWidth >= 768 ? 0 : placement.categoryBox.getBoundingClientRect().height + 8),
        width: window.innerWidth >= 768 ? Math.max(0, (placement.section.getBoundingClientRect().width - 8) / 2) : placement.section.getBoundingClientRect().width,
      }}
    >
      <a
        href="/referral"
        className="group flex w-full items-center gap-2 rounded-2xl border border-[#E8D39A] bg-gradient-to-l from-[#FFF8DD] via-white to-[#FBEEDA] px-3 py-2 shadow-[0_6px_20px_rgba(180,135,35,.18)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(180,135,35,.28)] sm:px-4 sm:py-2.5"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFE29A] to-[#C88B24] text-lg shadow-sm transition group-hover:scale-105 sm:h-10 sm:w-10 sm:text-xl">🎁</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-black text-[#704817] sm:text-sm">معرفی کن جایزه بگیر</span>
          <span className="mt-0.5 block truncate text-[8px] font-bold text-[#A66B19] sm:text-[9px]">دوستت را به جم‌سیتی معرفی کن و جایزه بگیر</span>
        </span>
        <span className="shrink-0 rounded-full bg-[#FFF0C4] px-2 py-1 text-[8px] font-black text-[#8B5A13] sm:text-[9px]">ورود ←</span>
      </a>
    </div>,
    document.body,
  );
}
