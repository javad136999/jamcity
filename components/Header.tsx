"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

export default function Header() {
  const { user, profile, unreadCount, wallUnreadCount, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:px-4" dir="rtl">
        <a
          href="tel:09030827988"
          className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-red-200 bg-white px-2.5 py-1.5 text-[9px] font-bold text-red-500 shadow-sm transition hover:bg-red-50 sm:px-3.5 sm:text-[11px]"
        >
          ☎️ <span className="sm:hidden">تماس</span>
          <span className="hidden sm:inline">تماس با مدیر</span>
        </a>

        <Link
          href="/business/manage"
          className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-[#D8B66A] bg-white px-2 py-1.5 text-[9px] font-black text-[#8B691F] shadow-sm transition hover:bg-[#FFF9E8] sm:gap-1.5 sm:px-3 sm:py-2 sm:text-[11px]"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-md text-[11px] sm:h-6 sm:w-6 sm:text-sm">🏬</span>
          <span>پنل کسب‌وکار</span>
        </Link>

        <Link
          href="/news"
          className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#E3EBDE] bg-white px-2 py-1.5 text-[9px] font-black text-[#4B5A4E] shadow-sm transition hover:bg-[#F3F8F2] sm:px-3 sm:text-[11px]"
          aria-label="اخبار"
        >
          <span className="text-sm">📰</span>
          <span>اخبار</span>
        </Link>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          {!user ? (
            <Link
              href="/login"
              className="flex items-center gap-1 whitespace-nowrap rounded-full border border-red-200 bg-white px-2 py-1.5 text-[9px] font-bold text-red-500 shadow-sm transition hover:bg-red-50 sm:px-3 sm:text-[11px]"
            >
              <span className="text-sm">👤</span>
              <span>پروفایل</span>
            </Link>
          ) : (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="پروفایل"
                className="flex items-center gap-1 whitespace-nowrap rounded-full border border-[#E3EBDE] bg-white px-1.5 py-1 transition hover:bg-[#F3F8F2] sm:gap-1.5 sm:px-2"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F3F8F2] text-[10px] text-[#66766A] shadow-sm sm:h-7 sm:w-7 sm:text-xs">
                  {(profile?.display_name || "ک").charAt(0)}
                </span>
                <span className="text-[9px] font-bold text-[#4B5A4E] sm:text-[11px]">پروفایل</span>
              </button>

              {menuOpen && (
                <div className="fade-in absolute left-0 top-10 w-52 overflow-hidden rounded-xl2 border border-red-100 bg-white shadow-soft">
                  <div className="border-b border-red-50 px-4 py-2.5">
                    <span className="block text-[11px] font-bold text-slate-800">شهر جم</span>
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
                  <button type="button" onClick={handleLogout} className="block w-full border-t border-red-50 px-4 py-3 text-right text-sm text-red-500 hover:bg-red-50">خروج</button>
                </div>
              )}
            </div>
          )}

          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#D8B66A] bg-[#FFF9E8] text-base sm:h-9 sm:w-9 sm:text-lg"
            title="بیمه"
            aria-label="بیمه"
          >
            🛡️
          </span>
        </div>
      </div>

      <nav className="hidden items-center justify-center gap-6 border-t border-red-50/70 py-1.5 text-sm text-slate-600 md:flex">
        <Link href="/" className="transition hover:text-red-500">خانه</Link>
        <Link href="/wall" className="relative transition hover:text-red-500">
          دیوار شهر جم
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
              <span className="absolute -left-4 -top-2 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{unreadCount}</span>
            )}
          </Link>
        )}
      </nav>
    </header>
  );
}
