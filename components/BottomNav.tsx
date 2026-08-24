"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const items = [
  { href: "/", label: "خانه", icon: "🏠", red: false },
  { href: "/wall", label: "دیوار", icon: "💬", red: false },
  { href: "/business/register", label: "ثبت کسب‌وکار", icon: "🏬", red: false },
  { href: "/chat", label: "پیام‌ها", icon: "✉️", red: false },
  { href: "/discounts", label: "تخفیف‌ها", icon: "🏷️", red: true },
  { href: "/profile", label: "پروفایل", icon: "👤", red: false },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { unreadCount } = useAuth();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 glass border-t border-black/5 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto flex max-w-6xl items-stretch justify-between px-1">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] transition ${
                item.red
                  ? active
                    ? "text-red-600"
                    : "text-red-500"
                  : active
                  ? "text-orange-500"
                  : "text-slate-400"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
              {item.href === "/chat" && unreadCount > 0 && (
                <span className="absolute right-1/4 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
