"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_CONTACT_EMAIL } from "@/lib/constants";

export default function Header() {
  const { user, profile, unreadCount, isAdmin } = useAuth();
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
      {/* =====================================================
          نوار بالای بالای هدر — تم سفید نئونی قرمز
          راست: تماس با مدیر · وسط: پنل کسب و کار (نئونی) · چپ: ورود/کاربر
      ====================================================== */}
      <div className="grid max-w-6xl grid-cols-3 items-center gap-2 mx-auto px-3 py-2 sm:px-4">
        <div className="flex justify-start">
          <a
            href={`mailto:${ADMIN_CONTACT_EMAIL}?subject=${encodeURIComponent("سوال درباره شهر جم")}`}
            className="flex items-center gap-1 whitespace-nowrap rounded-full border border-red-200 bg-white px-2.5 py-1.5 text-[9px] font-bold text-red-500 shadow-sm transition hover:bg-red-50 sm:px-3.5 sm:text-[11px]"
          >
            ☎️ <span className="hidden xs:inline">تماس با مدیر</span>
          </a>
        </div>

        <div className="flex justify-center">
          <Link
            href="/business/manage"
            className="jam-panel-glow flex items-center gap-2 whitespace-nowrap rounded-full bg-[#0f9a56] px-4 py-2 text-[12px] font-black text-white ring-2 ring-red-500/80 sm:px-7 sm:py-3 sm:text-base"
          >
            <span className="text-base sm:text-2xl">🏬</span>
            <span>پنل کسب و کار</span>
          </Link>
        </div>

        <div className="flex justify-end">
          {!user ? (
            <Link
              href="/login"
              className="whitespace-nowrap rounded-full border border-red-200 bg-white px-2.5 py-1.5 text-[9px] font-bold text-red-500 shadow-sm transition hover:bg-red-50 sm:px-3.5 sm:text-[11px]"
            >
              ورود / ثبت‌نام
            </Link>
          ) : (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1 rounded-full border border-red-200 bg-white px-1 py-1 transition hover:bg-red-50 sm:gap-1.5 sm:px-1.5"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[10px] text-white shadow sm:h-7 sm:w-7 sm:text-xs">
                  {(profile?.display_name || "ک").charAt(0)}
                </span>
              </button>

              {menuOpen && (
                <div className="fade-in absolute left-0 top-10 w-52 overflow-hidden rounded-xl2 border border-red-100 bg-white shadow-soft">
                  <div className="border-b border-red-50 px-4 py-2.5">
                    <span className="block text-[11px] font-bold text-slate-800">شهر جم</span>
                    <span className="block text-[10px] text-slate-400">
                      {profile?.display_name || "کاربر"}
                    </span>
                  </div>
                  <Link
                    href="/profile"
                    className="block px-4 py-3 text-sm text-slate-700 hover:bg-red-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    پروفایل من
                  </Link>
                  <Link
                    href="/chat"
                    className="block px-4 py-3 text-sm text-slate-700 hover:bg-red-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    پیام‌ها
                  </Link>
                  <Link
                    href="/discounts"
                    className="block px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    🏷️ تخفیف‌ها
                  </Link>
                  <Link
                    href="/settings"
                    className="block px-4 py-3 text-sm text-slate-700 hover:bg-red-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    تنظیمات
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="block px-4 py-3 text-sm font-bold text-jam-navy hover:bg-red-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      پنل مدیریت
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="block w-full border-t border-red-50 px-4 py-3 text-right text-sm text-red-500 hover:bg-red-50"
                  >
                    خروج
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ردیف پایینی هدر — فقط ناوبری دسکتاپ، جمع‌وجور */}
      <nav className="hidden items-center justify-center gap-6 border-t border-red-50/70 py-1.5 text-sm text-slate-600 md:flex">
        <Link href="/" className="transition hover:text-red-500">
          خانه
        </Link>
        <Link href="/wall" className="transition hover:text-red-500">
          دیوار شهر جم
        </Link>
        <Link href="/businesses" className="transition hover:text-red-500">
          کسب‌وکارها
        </Link>
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

      <style jsx>{`
        @keyframes jamPanelGlow {
          0%,
          100% {
            box-shadow: 0 0 10px 2px rgba(255, 45, 85, 0.5),
              0 0 0 1px rgba(255, 45, 85, 0.35);
          }
          50% {
            box-shadow: 0 0 24px 8px rgba(255, 45, 85, 0.85),
              0 0 0 1px rgba(255, 45, 85, 0.6);
          }
        }
        .jam-panel-glow {
          animation: jamPanelGlow 2.1s ease-in-out infinite;
        }
      `}</style>
    </header>
  );
}
