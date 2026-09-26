"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";

export default function ConditionalHeader() {
  const pathname = usePathname();

  if (pathname === "/wall" || pathname.startsWith("/wall/")) {
    return null;
  }

  return <Header />;
}