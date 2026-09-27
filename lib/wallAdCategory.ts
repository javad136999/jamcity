import { AD_CATEGORIES } from "@/lib/constants";

export type WallAdCategory = (typeof AD_CATEGORIES)[number]["slug"] | "realestate" | "construction";

export const CATEGORY_META: Record<WallAdCategory, { label: string; icon: string }> = {
  ...Object.fromEntries(
    AD_CATEGORIES.map((category) => [category.slug, { label: category.name, icon: category.icon }])
  ),
  realestate: { label: "املاک", icon: "🏠" },
  construction: { label: "خدمات ساختمانی", icon: "🛠️" },
} as Record<WallAdCategory, { label: string; icon: string }>;

const CATEGORY_TERMS: Record<(typeof AD_CATEGORIES)[number]["slug"], string[]> = {
  "real-estate": ["املاک", "آپارتمان", "اپارتمان", "خانه", "ویلا", "زمین", "مغازه", "ملک", "رهن", "اجاره"],
  car: ["خودرو", "ماشین", "پژو", "پراید", "سمند", "دنا", "تیبا", "کوییک", "شاهین", "ساینا", "رانا", "تارا", "206", "207", "405", "اتوگالری", "لاستیک", "کارواش", "قطعه خودرو"],
  mobile: [
    "موبایل", "گوشی", "آیفون", "iphone", "سامسونگ", "samsung", "شیائومی", "xiaomi", "هواوی", "huawei",
    "نوکیا", "nokia", "وان پلاس", "oneplus", "آنر", "honor", "موتورولا", "motorola", "گوگل پیکسل", "pixel",
    "ردمی", "redmi", "پوکو", "poco", "ریلمی", "realme", "اس 23", "s23", "اس 24", "s24", "اس 25", "s25",
    "اس 26", "s26", "a12", "a13", "a14", "a15", "a16", "a17", "a22", "a23", "a24", "a25", "a26",
    "note 10", "note 11", "note 12", "note 13", "note 14", "ردمی نوت", "پوکو x", "مک‌بوک", "آیفون 11",
    "آیفون 12", "آیفون 13", "آیفون 14", "آیفون 15", "آیفون 16", "آیفون 17", "iphone 11", "iphone 12",
    "iphone 13", "iphone 14", "iphone 15", "iphone 16", "iphone 17"
  ],
  "home-appliances": ["لوازم خانگی", "یخچال", "فریزر", "تلویزیون", "لباسشویی", "ظرفشویی", "جاروبرقی", "کولر", "اجاق", "مایکروویو"],
  jobs: ["استخدام", "استخدامی", "نیروی کار", "کارگر", "کارمند", "فروشنده", "رزومه", "شغل", "نیازمند نیرو", "همکار"],
  services: ["خدمات", "تعمیر", "آرایشگاه", "دندانپزشکی", "پزشک", "آموزش", "کلاس", "نظافت", "پیک", "عکاسی", "تبلیغات"],
  market: ["خرید", "فروش", "فروشی", "قیمت", "تخفیف", "فروشگاه", "بازار"],
  personal: ["لباس", "پوشاک", "کفش", "کیف", "ساعت", "عینک", "زیورآلات", "دوچرخه", "وسایل شخصی"],
  other: [],
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/ۀ/g, "ه");
}

function canonicalCategory(category: string | null | undefined): WallAdCategory | null {
  if (category === "realestate") return "real-estate";
  if (category === "construction") return "services";
  if (category && AD_CATEGORIES.some((c) => c.slug === category)) return category as WallAdCategory;
  return null;
}

export function detectAdCategory(
  content: string | null,
  explicitCategory?: string | null
): WallAdCategory {
  const explicit = canonicalCategory(explicitCategory);
  if (explicit) return explicit;

  const text = normalize(content ?? "");
  if (!text.trim()) return "other";

  let best: WallAdCategory = "other";
  let bestScore = 0;

  for (const category of AD_CATEGORIES) {
    if (category.slug === "other") continue;
    const score = CATEGORY_TERMS[category.slug].reduce(
      (total, term) => total + (text.includes(normalize(term)) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      best = category.slug;
    }
  }

  return best;
}

const MOBILE_PHONE_TERMS = CATEGORY_TERMS.mobile;

export function isMobilePhoneAd(
  content: string | null,
  explicitCategory?: string | null
) {
  const text = normalize(content ?? "");
  return MOBILE_PHONE_TERMS.some((term) => text.includes(normalize(term)));
}

export function contentMatchesCategory(
  content: string | null,
  category: WallAdCategory,
  explicitCategory?: string | null
) {
  if (category === "mobile") return isMobilePhoneAd(content, explicitCategory);
  return detectAdCategory(content, explicitCategory) === category;
}

export function buildCategoryOrFilter(category: WallAdCategory): string {
  if (category === "realestate") category = "real-estate";
  if (category === "construction") category = "services";
  if (category === "other") {
    return "category.eq.other,category.is.null";
  }

  const terms = CATEGORY_TERMS[category]
    .map((term) => "content.ilike.%" + term.replace(/[%_,]/g, "") + "%")
    .join(",");

  return terms ? "category.eq." + category + "," + terms : "category.eq." + category;
}

export function belongsToOtherCategory(
  ad: { category: string | null; content: string | null },
  category: WallAdCategory
) {
  if (category === "mobile") return !isMobilePhoneAd(ad.content, ad.category);
  return detectAdCategory(ad.content, ad.category) !== detectAdCategory(null, category);
}

export function dedupeAndSortNewestFirst<
  T extends { id: string; source_message_id?: string | null; created_at: string }
>(rows: T[]): T[] {
  const groups = new Map<string, T>();
  for (const row of rows) {
    const key = row.source_message_id ?? row.id;
    const existing = groups.get(key);
    if (!existing || new Date(row.created_at).getTime() > new Date(existing.created_at).getTime()) {
      groups.set(key, row);
    }
  }
  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
