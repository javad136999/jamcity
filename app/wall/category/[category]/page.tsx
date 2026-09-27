"use client";

import { useParams } from "next/navigation";
import WallCategoryPage from "@/components/WallCategoryPage";
import { AD_CATEGORIES } from "@/lib/constants";
import type { WallAdCategory } from "@/lib/wallAdCategory";

export default function WallAdCategoryRoute() {
  const params = useParams<{ category: string }>();
  const slug = params?.category ?? "";
  const category = AD_CATEGORIES.some((item) => item.slug === slug)
    ? (slug as WallAdCategory)
    : null;

  if (!category) {
    return <WallCategoryPage category="other" />;
  }

  return <WallCategoryPage category={category} />;
}
