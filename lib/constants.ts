export const AD_CATEGORIES = [
  { slug: "real-estate", name: "املاک", icon: "🏠" },
  { slug: "car", name: "خودرو", icon: "🚗" },
  { slug: "mobile", name: "موبایل", icon: "📱" },
  { slug: "home-appliances", name: "لوازم خانه", icon: "🛋️" },
  { slug: "jobs", name: "استخدام", icon: "💼" },
  { slug: "services", name: "خدمات", icon: "🛠️" },
  { slug: "market", name: "خرید و فروش", icon: "🛒" },
  { slug: "personal", name: "لوازم شخصی", icon: "🎒" },
  { slug: "other", name: "سایر", icon: "✨" },
] as const;

export const AD_STATUS = [
  { value: "active", label: "فعال", color: "bg-jam-green/20 text-jam-green" },
  { value: "reserved", label: "رزرو شده", color: "bg-yellow-500/20 text-yellow-400" },
  { value: "sold", label: "فروخته شده", color: "bg-white/10 text-white/50" },
  { value: "expired", label: "منقضی", color: "bg-red-500/20 text-red-400" },
] as const;

export const BUSINESS_CATEGORIES = [
  { slug: "restaurant", name: "رستوران", icon: "🍽️" },
  { slug: "cafe", name: "کافه", icon: "☕" },
  { slug: "shop", name: "فروشگاه", icon: "🛍️" },
  { slug: "repair", name: "تعمیرگاه", icon: "🔧" },
  { slug: "technical", name: "خدمات فنی", icon: "🧰" },
  { slug: "doctor", name: "پزشکان", icon: "🩺" },
  { slug: "pharmacy", name: "داروخانه", icon: "💊" },
  { slug: "education", name: "آموزش", icon: "📚" },
  { slug: "beauty", name: "زیبایی", icon: "💇" },
  { slug: "other", name: "سایر", icon: "✨" },
] as const;

export const ADMIN_EMAIL = "exina30@gmail.com";
export const ADMIN_CONTACT_EMAIL = "javad.hosseini199167@gmail.com";

export const AVATAR_PRESETS = {
  female: ["👩‍🦰", "👩‍🦱", "👩‍🦳", "👱‍♀️", "🧕", "👸", "🧑‍🎤", "🧑‍🚀".replace("🧑", "👩"), "🧝‍♀️", "🧚‍♀️", "🦸‍♀️", "🧙‍♀️"],
  male: ["👨‍🦰", "👨‍🦱", "👨‍🦳", "🧔", "👳‍♂️", "🤴", "🧑‍🎤".replace("🧑", "👨"), "👨‍🚀", "🧝‍♂️", "🧚‍♂️", "🦸‍♂️", "🧙‍♂️"],
} as const;

export function isEmojiAvatar(url: string | null | undefined) {
  return !!url && url.startsWith("emoji:");
}

export function avatarEmoji(url: string | null | undefined) {
  return url && url.startsWith("emoji:") ? url.slice("emoji:".length) : "🙂";
}

export const PAYMENT_CARD_NUMBER = "5041721074262636";
export const PAYMENT_CARD_HOLDER = "جواد حسینی";

export const SUBSCRIPTION_TIERS = [
  {
    value: "bronze",
    name: "اشتراک برنزی",
    price: 500000,
    color: "from-amber-700 to-amber-500",
    perks: ["نمایش روی نقشه و صفحه اصلی", "ثبت منو و محصولات"],
  },
  {
    value: "silver",
    name: "اشتراک نقره‌ای",
    price: 1000000,
    color: "from-slate-400 to-slate-300",
    perks: ["همه امکانات برنزی", "اولویت نمایش بالاتر در لیست"],
  },
  {
    value: "gold",
    name: "اشتراک طلایی",
    price: 2000000,
    color: "from-yellow-500 to-amber-300",
    perks: ["همه امکانات نقره‌ای", "ارسال روزانه تبلیغ در دیوار شهر جم"],
  },
] as const;

export function tierMeta(value: string | null) {
  return SUBSCRIPTION_TIERS.find((t) => t.value === value) ?? null;
}

export function categoryLabel(slug: string) {
  return AD_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}

export function businessCategoryLabel(slug: string) {
  return BUSINESS_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}

export function statusMeta(value: string) {
  return AD_STATUS.find((s) => s.value === value) ?? AD_STATUS[0];
}

export function formatPrice(price: number | null) {
  if (price === null || price === undefined) return "توافقی";
  return new Intl.NumberFormat("fa-IR").format(price) + " تومان";
}

export function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "همین الان";
  if (mins < 60) return `${mins} دقیقه پیش`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} روز پیش`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ماه پیش`;
  return `${Math.floor(months / 12)} سال پیش`;
}
