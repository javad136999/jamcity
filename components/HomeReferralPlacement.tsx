"use client";

import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const TARGET_CLASS = "home-referral-map-target";
const CATEGORY_LABEL = "فیلتر دسته‌بندی کسب‌وکارها";

export default function HomeReferralPlacement() {
  const pathname = usePathname();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (pathname !== "/") {
      setTarget(null);
      return;
    }

    let active = true;
    let observer: MutationObserver | null = null;

    const setup = () => {
      const select = document.querySelector<HTMLSelectElement>(`select[aria-label="${CATEGORY_LABEL}"]`);
      const categoryBox = select?.parentElement;
      const section = categoryBox?.parentElement;
      if (!select || !categoryBox || !section) return false;

      let slot = document.querySelector<HTMLElement>(`.${TARGET_CLASS}`);
      if (!slot) {
        slot = document.createElement("div");
        slot.className = TARGET_CLASS;
        document.body.appendChild(slot);
      }

      categoryBox.dataset.homeReferralCategory = "true";
      section.dataset.homeReferralSection = "true";
      if (active) setTarget(slot);
      return true;
    };

    if (!setup()) {
      observer = new MutationObserver(() => {
        if (setup()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      active = false;
      observer?.disconnect();
      const slot = document.querySelector<HTMLElement>(`.${TARGET_CLASS}`);
      slot?.remove();
      const categoryBox = document.querySelector<HTMLElement>('[data-home-referral-category="true"]');
      categoryBox?.removeAttribute("data-home-referral-category");
      const section = document.querySelector<HTMLElement>('[data-home-referral-section="true"]');
      section?.removeAttribute("data-home-referral-section");
      setTarget(null);
    };
  }, [pathname]);

  useEffect(() => {
    if (!target || pathname !== "/") return;

    const position = () => {
      const categoryBox = document.querySelector<HTMLElement>('[data-home-referral-category="true"]');
      const section = document.querySelector<HTMLElement>('[data-home-referral-section="true"]');
      if (!categoryBox || !section) return;

      const isMobile = window.innerWidth < 768;
      const sectionRect = section.getBoundingClientRect();
      const categoryRect = categoryBox.getBoundingClientRect();
      const gap = 8;

      if (isMobile) {
        categoryBox.style.width = "100%";
        target.style.position = "absolute";
        target.style.left = `${sectionRect.left}px`;
        target.style.top = `${categoryRect.bottom + gap + window.scrollY}px`;
        target.style.width = `${sectionRect.width}px`;
      } else {
        const width = Math.max(0, (sectionRect.width - gap) / 2);
        categoryBox.style.width = `${width}px`;
        categoryBox.style.marginLeft = "0";
        categoryBox.style.marginRight = "auto";
        target.style.position = "absolute";
        target.style.left = `${sectionRect.right - width}px`;
        target.style.top = `${categoryRect.top + window.scrollY}px`;
        target.style.width = `${width}px`;
      }
      target.style.zIndex = "5";
    };

    position();
    const observer = new ResizeObserver(position);
    const section = document.querySelector<HTMLElement>('[data-home-referral-section="true"]');
    if (section) observer.observe(section);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position);
    };
  }, [target, pathname]);

  if (!target || pathname !== "/") return null;

  return createPortal(
    <div dir="rtl" className="w-full">
      <a
        href="/referral"
        className="group flex w-full items-center gap-2 rounded-2xl border border-[#E8D39A] bg-gradient-to-l from-[#FFF8DD] via-white to-[#FBEEDA] px-3 py-2 shadow-[0_6px_20px_rgba(180,135,35,.18)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(180,135,35,.28)] sm:px-4 sm:py-2.5"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFE29A] to-[#C88B24] text-lg shadow-sm transition group-hover:scale-105 sm:h-10 sm:w-10 sm:text-xl">
          🎁
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-black text-[#704817] sm:text-sm">معرفی کن جایزه بگیر</span>
          <span className="mt-0.5 block truncate text-[8px] font-bold text-[#A66B19] sm:text-[9px]">دوستت را به جم‌سیتی معرفی کن و جایزه بگیر</span>
        </span>
        <span className="shrink-0 rounded-full bg-[#FFF0C4] px-2 py-1 text-[8px] font-black text-[#8B5A13] sm:text-[9px]">ورود ←</span>
      </a>
    </div>,
    target,
  );
}
