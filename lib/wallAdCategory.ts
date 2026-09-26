// جم‌سیتی — تشخیص دسته‌بندی آگهی‌های دیوار (خودرو / املاک)
//
// این فایل منطق تشخیص دسته‌بندی را که قبلاً فقط داخل app/wall/page.tsx بود
// به‌صورت مشترک درآورده تا هم صفحه‌ی دیوار و هم صفحات اختصاصی
// /wall/car و /wall/realestate از یک منبع واحد استفاده کنند.
//
// منبع اصلی تشخیص، فیلد ستون `category` روی wall_messages است (اگر ثبت شده باشد).
// برای آگهی‌های قدیمی‌تر که این فیلد را ندارند (category = null)، از همان
// کلیدواژه‌های قبلی روی متن پیام به‌عنوان راه تشخیص جایگزین استفاده می‌شود؛
// بدون هیچ تغییری در ساختار دیتابیس.

export type WallAdCategory = "car" | "realestate";

const CAR_TERMS = [
  "خودرو", "ماشین", "پژو", "پراید", "سمند", "دنا", "تیبا", "کوییک",
  "شاهین", "ساینا", "رانا", "پارس", "آریسان", "تارا", "206", "207",
  "405", "پارس خودرو",
];

const REAL_ESTATE_TRANSACTION_TERMS = ["خرید", "فروش", "رهن", "اجاره"];
const REAL_ESTATE_PROPERTY_TERMS = ["آپارتمان", "اپارتمان", "واحد", "ویلایی", "ویلا"];

/**
 * رشته‌ی فیلتر ilike روی متن پیام برای Supabase .or(...) — همان منطق قبلی
 * startCategoryBrowse در app/wall/page.tsx، فقط این‌بار قابل استفاده مجدد.
 */
function buildContentIlikeFilter(category: WallAdCategory): string {
  if (category === "car") {
    return CAR_TERMS
      .flatMap((term) => [
        `and(content.ilike.%خرید%,content.ilike.%${term}%)`,
        `and(content.ilike.%فروش%,content.ilike.%${term}%)`,
      ])
      .join(",");
  }
  return REAL_ESTATE_PROPERTY_TERMS
    .flatMap((propertyTerm) =>
      REAL_ESTATE_TRANSACTION_TERMS.map(
        (transactionTerm) => `and(content.ilike.%${transactionTerm}%,content.ilike.%${propertyTerm}%)`
      )
    )
    .join(",");
}

/**
 * فیلتر کامل برای کوئری Supabase: هم آگهی‌هایی که فیلد category رویشان
 * ثبت شده، هم آگهی‌های قدیمی‌تر که از روی متن قابل تشخیصند.
 */
export function buildCategoryOrFilter(category: WallAdCategory): string {
  return `category.eq.${category},${buildContentIlikeFilter(category)}`;
}

/** تشخیص سمت کلاینت: آیا متن یک آگهی با کلیدواژه‌های این دسته مطابقت دارد؟ */
export function contentMatchesCategory(content: string | null, category: WallAdCategory): boolean {
  if (!content) return false;
  if (category === "car") {
    return CAR_TERMS.some(
      (term) => content.includes(term) && (content.includes("خرید") || content.includes("فروش"))
    );
  }
  return REAL_ESTATE_PROPERTY_TERMS.some(
    (propertyTerm) =>
      content.includes(propertyTerm) &&
      REAL_ESTATE_TRANSACTION_TERMS.some((t) => content.includes(t))
  );
}

/**
 * آیا این آگهی قطعاً به دسته‌ی مقابل تعلق دارد؟ (برای جلوگیری از نمایش
 * یک آگهی در هر دو صفحه‌ی خودرو و املاک). اگر فیلد category ثبت شده
 * باشد، همان معیار قطعی است؛ در غیر این صورت فقط وقتی که متن با
 * کلیدواژه‌های دسته‌ی مقابل مطابقت دارد و با کلیدواژه‌های دسته‌ی فعلی
 * مطابقت ندارد، آگهی را متعلق به دسته‌ی مقابل در نظر می‌گیریم.
 */
export function belongsToOtherCategory(
  ad: { category: WallAdCategory | null; content: string | null },
  category: WallAdCategory
): boolean {
  const other: WallAdCategory = category === "car" ? "realestate" : "car";
  if (ad.category) return ad.category === other;
  return contentMatchesCategory(ad.content, other) && !contentMatchesCategory(ad.content, category);
}

export const CATEGORY_META: Record<WallAdCategory, { label: string; icon: string }> = {
  car: { label: "خودرو", icon: "🚗" },
  realestate: { label: "املاک", icon: "🏠" },
};

/**
 * حذف آگهی‌های تکراری: آگهی‌هایی که به‌صورت خودکار بازنشر شده‌اند
 * (is_auto_republish + source_message_id) همان آگهی اصلی هستند، نه یک
 * آگهی جدید. برای هر آگهی منطقی (بر اساس source_message_id یا id خودش)
 * فقط جدیدترین رکورد نگه داشته می‌شود و نتیجه بر اساس تاریخ ثبت،
 * جدید به قدیم مرتب می‌گردد.
 */
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
