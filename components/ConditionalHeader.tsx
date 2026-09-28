"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";

export default function ConditionalHeader() {
  const pathname = usePathname();

  // هدر اصلی سایت در تمام صفحات «دیوار» شهرها نمایش داده نشود.
  // این شامل مسیرهای چندشهری و دسته‌بندی‌های دیوار هم می‌شود.
  if (pathname === "/wall" || pathname.startsWith("/wall/") || pathname.includes("/wall")) {
    return null;
  }

  return <Header />;
}