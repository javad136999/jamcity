"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import CitySelector from "@/components/CitySelector";
import InsurancePanel from "@/components/InsurancePanel";

export default function Header() {
  const { user, profile, unreadCount, wallUnreadCount, isAdmin, city } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [insuranceOpen, setInsuranceOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-red-100 bg-white">
      <div
        className="relative mx-auto flex h-14 max-w-6xl items-center justify-between px-2 sm:h-16 sm:px-4"
        dir="rtl"
      >
        {/* Profile stays on the right */}
        {!user ? (
          <Link
            href="/login"
            aria-label="ورود به پروفایل"
            title="ورود به پروفایل"
            className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 shrink-0 items-center justify-center rounded-full border border-[#D7DFD9] bg-[#F7F9F7] p-1.5 shadow-sm transition hover:bg-[#EEF4EF] sm:right-4 sm:h-10 sm:w-10"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E5ECE7] text-xs">👤</span>
          </Link>
        ) : (
          <div className="absolute right-2 top-1/2 z-20 -translate-y-1/2" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="پروفایل"
              title="پروفایل"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D7DFD9] bg-[#F7F9F7] p-1 transition hover:bg-[#EEF4EF] sm:h-10 sm:w-10"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E5ECE7] text-[10px] text-[#4B5A4E] shadow-sm sm:h-6 sm:w-6 sm:text-xs">
                {(profile?.display_name || "ک").charAt(0)}
              </span>
            </button>

            {menuOpen && (
              <div className="fade-in absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-xl2 border border-red-100 bg-white shadow-soft">
                <div className="border-b border-red-50 px-4 py-2.5">
                  <span className="block text-[10px] font-bold text-slate-400">شهر فعال: {city.name}</span>
                  <span className="block text-[10px] text-slate-400">{profile?.display_name || "کاربر"}</span>
                </div>
                <Link href="/profile" className="block px-4 py-3 text-sm text-slate-700 hover:bg-red-50" onClick={() => setMenuOpen(false)}>پروفایل من</Link>
                <Link href="/chat" className="block px-4 py-3 text-sm text-slate-700 hover:bg-red-50" onClick={() => setMenuOpen(false)}>پیام‌ها</Link>
                <Link href="/discounts" className="block px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50" onClick={() => setMenuOpen(false)}>🏷️ تخفیف‌ها</Link>
                <Link href="/settings" className="block px-4 py-3 text-sm text-slate-700 hover:bg-red-50" onClick={() => setMenuOpen(false)}>تنظیمات</Link>
                {isAdmin && (
                  <>
                    <Link href="/admin" className="block px-4 py-3 text-sm font-bold text-jam-navy hover:bg-red-50" onClick={() => setMenuOpen(false)}>پنل مدیریت</Link>
                    <Link href="/admin/referrals" className="block px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50" onClick={() => setMenuOpen(false)}>مدیریت معرفی‌ها</Link>
                  </>
                )}
                <button type="button" onClick={handleLogout} className="block w-full border-t border-red-50 px-4 py-3 text-right text-sm text-red-500 hover:bg-red-50">
                  خروج
                </button>
              </div>
            )}
          </div>
        )}

        {/* City selector stays exactly in the center */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <CitySelector />
        </div>

        {/* All header actions stay in one horizontal row on the left */}
        <div className="absolute left-2 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1 sm:left-4 sm:gap-1.5">
          <button
            type="button"
            onClick={() => setInsuranceOpen(true)}
            aria-label="بیمه"
            title="بیمه"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#CBE2D1] bg-[#F2FAF4] text-base shadow-sm transition hover:bg-[#EAF6EC] focus:outline-none focus:ring-2 focus:ring-jam-green/30 sm:h-10 sm:w-10"
          >
            <span aria-hidden="true">🛡️</span>
          </button>

          <Link
            href="/news"
            aria-label="اخبار"
            title="اخبار"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#BFD7F2] bg-[#F3F8FF] p-1.5 text-xs shadow-sm transition hover:bg-[#EAF3FF] sm:h-10 sm:w-10"
          >
            <span aria-hidden="true">📰</span>
          </Link>

          <Link
            href="/business/manage"
            aria-label="پنل کسب‌وکار"
            title="پنل کسب‌وکار"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D8B66A] bg-[#FFF9E8] p-1.5 text-xs shadow-sm transition hover:bg-[#FFF3C9] sm:h-10 sm:w-10"
          >
            <span aria-hidden="true">🏬</span>
          </Link>

          <a
            href="tel:09030827988"
            aria-label="تماس با مدیر"
            title="تماس با مدیر"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-200 bg-[#FFF5F5] p-1.5 text-xs shadow-sm transition hover:bg-red-50 sm:h-10 sm:w-10"
          >
            <span aria-hidden="true">☎️</span>
          </a>
        </div>
      </div>

      {insuranceOpen && <InsurancePanel userId={user?.id ?? null} onClose={() => setInsuranceOpen(false)} />}

      {!pathname.startsWith("/wall") && (
        <nav className="hidden items-center justify-center gap-6 border-t border-red-50/70 py-1.5 text-sm text-slate-600 md:flex">
          <Link href="/" className="transition hover:text-red-500">خانه</Link>
          <Link href="/wall" className="relative transition hover:text-red-500">
            دیوار شهر {city.name}
            {user && wallUnreadCount > 0 && (
              <span className="absolute -left-4 -top-2 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {wallUnreadCount > 99 ? "۹۹+" : wallUnreadCount}
              </span>
            )}
          </Link>
          <Link href="/businesses" className="transition hover:text-red-500">کسب‌وکارها</Link>
          {user && (
            <Link href="/chat" className="relative transition hover:text-red-500">
              پیام‌ها
              {unreadCount > 0 && (
                <span className="absolute -left-4 -top-2 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
