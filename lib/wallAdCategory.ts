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
  "real-estate": [
    "املاک", "آپارتمان", "اپارتمان", "ویلا", "زمین", "باغ", "باغچه", "خانه برای فروش",
    "خانه برای اجاره", "فروش خانه", "فروش ملک", "فروش زمین", "رهن کامل", "رهن و اجاره",
    "اجاره آپارتمان", "اجاره خانه", "مغازه برای فروش", "مغازه برای اجاره", "سرقفلی"
  ],
  car: [
    "خودرو", "ماشین", "اتومبیل", "پژو", "پراید", "سمند", "دنا", "تیبا", "کوییک", "شاهین",
    "ساینا", "رانا", "تارا", "آریزو", "فونیکس", "چری", "ام‌وی‌ام", "mvm", "j4", "j7",
    "206", "207", "405", "پارس", "دنا پلاس", "اتوگالری", "خودرو صفر", "خودرو کارکرده",
    "قطعات خودرو", "لوازم یدکی خودرو", "لاستیک خودرو", "باتری خودرو", "کارواش خودرو"
  ],
  mobile: [
    "موبایل", "گوشی", "تلفن همراه", "آیفون", "iphone", "سامسونگ", "samsung", "شیائومی", "xiaomi",
    "هواوی", "huawei", "نوکیا", "nokia", "وان پلاس", "oneplus", "آنر", "honor", "موتورولا", "motorola",
    "پیکسل", "pixel", "ردمی", "redmi", "پوکو", "poco", "ریلمی", "realme", "اس 23", "s23", "اس 24",
    "s24", "اس 25", "s25", "اس 26", "s26", "a12", "a13", "a14", "a15", "a16", "a17", "a22",
    "a23", "a24", "a25", "a26", "a52", "a53", "a54", "a55", "a71", "note 10", "note 11",
    "note 12", "note 13", "note 14", "ردمی نوت", "پوکو x", "آیفون 11", "آیفون 12", "آیفون 13",
    "آیفون 14", "آیفون 15", "آیفون 16", "آیفون 17", "iphone 11", "iphone 12", "iphone 13",
    "iphone 14", "iphone 15", "iphone 16", "iphone 17"
  ],
  "home-appliances": [
    "لوازم خانگی", "یخچال", "فریزر", "یخچال فریزر", "تلویزیون", "لباسشویی", "ماشین لباسشویی",
    "ظرفشویی", "ماشین ظرفشویی", "جاروبرقی", "کولر گازی", "کولر", "اسپلیت", "اجاق گاز",
    "مایکروویو", "مایکروفر", "هود", "آبگرمکن", "پنکه", "چرخ گوشت"
  ],
  jobs: [
    "استخدام", "استخدامی", "فرصت شغلی", "نیروی کار", "نیروی انسانی", "کارگر", "کارمند",
    "فروشنده", "منشی", "حسابدار", "راننده", "رزومه", "کاریابی", "شغل", "نیازمند نیرو",
    "نیروی خدماتی", "همکار می‌پذیریم", "استخدام فوری"
  ],
  services: [
    "خدمات", "تعمیرکار", "تعمیرات", "نصب و تعمیر", "آرایشگاه", "دندانپزشکی", "پزشک",
    "پرستاری", "آموزش", "کلاس خصوصی", "تدریس", "نظافت", "قالیشویی", "پیک موتوری",
    "عکاسی", "فیلمبرداری", "تبلیغات", "طراحی", "ترجمه", "خیاطی", "لوله کشی", "برقکاری",
    "جوشکاری", "نجاری"
  ],
  market: [
    "خرید و فروش کالا", "کالای نو", "کالای دست دوم", "دست دوم", "کالای کارکرده", "حراج",
    "مزایده", "فروشگاه", "فروش عمده", "فروش جزئی", "عمده فروشی", "خرده فروشی", "بازارچه"
  ],
  personal: [
    "پوشاک", "لباس", "کفش", "کیف", "کیف و کفش", "ساعت مچی", "عینک", "زیورآلات", "بدلیجات",
    "گردنبند", "دستبند", "انگشتر", "دوچرخه", "اسباب بازی", "لوازم شخصی", "وسایل شخصی"
  ],
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

const REAL_ESTATE_TRANSACTION_TERMS = [
  "خرید",
  "فروش",
  "رهن",
  "اجاره",
  "خرید و فروش",
  "رهن و اجاره",
];

const REAL_ESTATE_CONTEXT_TERMS = [
  "املاک",
  "آپارتمان",
  "اپارتمان",
  "ویلا",
  "زمین",
  "باغ",
  "باغچه",
  "خانه",
  "ملک",
  "مغازه",
  "سرقفلی",
];

export function isMobilePhoneAd(
  content: string | null,
  explicitCategory?: string | null
) {
  const text = normalize(content ?? "");
  return MOBILE_PHONE_TERMS.some((term) => text.includes(normalize(term)));
}

export function isPublicRealEstateMessage(content: string | null) {
  const text = normalize(content ?? "");

  const hasTransactionTerm = REAL_ESTATE_TRANSACTION_TERMS.some((term) =>
    text.includes(normalize(term))
  );

  const hasRealEstateContext = REAL_ESTATE_CONTEXT_TERMS.some((term) =>
    text.includes(normalize(term))
  );

  return hasTransactionTerm && hasRealEstateContext;
}

export function contentMatchesCategory(
  content: string | null,
  category: WallAdCategory,
  explicitCategory?: string | null
) {
  if (category === "mobile") return isMobilePhoneAd(content, explicitCategory);
  if (category === "real-estate" && !explicitCategory) {
    return isPublicRealEstateMessage(content);
  }
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
  ad: { category: string | null; content: string | null; ad_id?: string | null },
  category: WallAdCategory
) {
  if (category === "mobile") return !isMobilePhoneAd(ad.content, ad.category);

  // آگهی‌هایی که کاربر هنگام ثبت آگهی دسته‌بندی کرده، دست‌نخورده باقی می‌مانند.
  // فقط پیام‌های عمومی باید برای ورود به املاک شرط معامله + زمینه ملکی داشته باشند.
  if (category === "real-estate" && !("ad_id" in ad && ad.ad_id)) {
    return !isPublicRealEstateMessage(ad.content);
  }

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
