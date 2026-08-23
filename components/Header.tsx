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
    <header className="sticky top-0 z-40 glass border-b border-black/5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          {user && (
            <button
              onClick={handleLogout}
              className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-600 transition hover:bg-slate-50 sm:px-4 sm:py-1.5 sm:text-xs"
            >
              خروج
            </button>
          )}
          {user && (
            <Link
              href="/business/manage"
              className="flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-700 transition hover:bg-slate-50 sm:px-4 sm:py-1.5 sm:text-xs"
            >
              🏬 پنل کسب و کار
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-1 whitespace-nowrap rounded-full bg-jam-navy px-2 py-1 text-[9px] font-bold text-white transition hover:brightness-110 sm:px-4 sm:py-1.5 sm:text-xs"
            >
              ⚙️ پنل مدیریت
            </Link>
          )}
          <a
            href={`mailto:${ADMIN_CONTACT_EMAIL}?subject=${encodeURIComponent("سوال درباره شهر جم")}`}
            className="flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-600 transition hover:bg-slate-50 sm:px-4 sm:py-1.5 sm:text-xs"
          >
            ☎️ تماس با مدیر
          </a>
        </div>

        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          <Link href="/" className="transition hover:text-orange-500">
            خانه
          </Link>
          <Link href="/wall" className="transition hover:text-orange-500">
            دیوار شهر جم
          </Link>
          <Link href="/businesses" className="transition hover:text-orange-500">
            کسب‌وکارها
          </Link>
          {user && (
            <Link href="/chat" className="relative transition hover:text-orange-500">
              پیام‌ها
              {unreadCount > 0 && (
                <span className="absolute -left-4 -top-2 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {!user ? (
            <Link
              href="/login"
              className="rounded-xl2 bg-jam-green px-3 py-1.5 text-xs font-bold text-white shadow-glow transition hover:brightness-110 sm:px-4 sm:py-2 sm:text-sm"
            >
              ورود / ثبت‌نام
            </Link>
          ) : (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-xl2 px-1.5 py-1 text-right transition hover:bg-black/5 sm:gap-2 sm:px-2 sm:py-1.5"
              >
                <span className="flex flex-col items-end leading-tight">
                  <span className="text-[11px] font-bold text-slate-800 sm:text-sm">شهر جم</span>
                  <span className="text-[9px] text-slate-400 sm:text-[11px]">
                    {profile?.display_name || "کاربر"}
                  </span>
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-sm text-white shadow sm:h-9 sm:w-9 sm:text-base">
                  📍
                </span>
              </button>

              {menuOpen && (
                <div className="fade-in absolute left-0 top-14 w-52 overflow-hidden rounded-xl2 glass shadow-soft">
                  <Link
                    href="/profile"
                    className="block px-4 py-3 text-sm text-slate-700 hover:bg-black/5"
                    onClick={() => setMenuOpen(false)}
                  >
                    پروفایل من
                  </Link>
                  <Link
                    href="/business/manage"
                    className="block px-4 py-3 text-sm text-slate-700 hover:bg-black/5"
                    onClick={() => setMenuOpen(false)}
                  >
                    پنل کسب و کار
                  </Link>
                  <Link
                    href="/chat"
                    className="block px-4 py-3 text-sm text-slate-700 hover:bg-black/5"
                    onClick={() => setMenuOpen(false)}
                  >
                    پیام‌ها
                  </Link>
                  <Link
                    href="/settings"
                    className="block px-4 py-3 text-sm text-slate-700 hover:bg-black/5"
                    onClick={() => setMenuOpen(false)}
                  >
                    تنظیمات
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="block px-4 py-3 text-sm font-bold text-jam-navy hover:bg-black/5"
                      onClick={() => setMenuOpen(false)}
                    >
                      پنل مدیریت
                    </Link>
                  )}
                  <a
                    href={`mailto:${ADMIN_CONTACT_EMAIL}?subject=${encodeURIComponent("سوال درباره شهر جم")}`}
                    className="block px-4 py-3 text-sm text-slate-700 hover:bg-black/5"
                    onClick={() => setMenuOpen(false)}
                  >
                    ☎️ تماس با مدیر
                  </a>
                  <button
                    onClick={handleLogout}
                    className="block w-full border-t border-black/5 px-4 py-3 text-right text-sm text-red-500 hover:bg-black/5"
                  >
                    خروج
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
