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
  { slug: "fastfood", name: "فست‌فود", icon: "🍔" },
  { slug: "bakery", name: "نانوایی و شیرینی", icon: "🥖" },

  { slug: "supermarket", name: "سوپرمارکت و مواد غذایی", icon: "🛒" },
  { slug: "fruit_store", name: "میوه و تره‌بار", icon: "🍎" },
  { slug: "butcher", name: "پروتئینی و قصابی", icon: "🥩" },

  { slug: "clothing", name: "پوشاک", icon: "👕" },
  { slug: "shoes", name: "کفش و کیف", icon: "👟" },
  { slug: "cosmetics", name: "لوازم آرایشی و بهداشتی", icon: "💄" },
  { slug: "jewelry", name: "طلا و جواهر", icon: "💎" },
  { slug: "watch_glasses", name: "ساعت و عینک", icon: "⌚" },

  { slug: "mobile", name: "موبایل و لوازم جانبی", icon: "📱" },
  { slug: "computer", name: "کامپیوتر و تجهیزات", icon: "💻" },
  { slug: "electronics", name: "لوازم الکترونیکی", icon: "🔌" },
  { slug: "home_appliances", name: "لوازم خانگی", icon: "🏠" },
  { slug: "furniture", name: "مبلمان و دکوراسیون", icon: "🛋️" },

  { slug: "car_dealer", name: "اتوگالری و خرید و فروش خودرو", icon: "🚗" },
  { slug: "car_service", name: "خدمات خودرو", icon: "🔧" },
  { slug: "car_parts", name: "قطعات و لوازم خودرو", icon: "⚙️" },
  { slug: "car_wash", name: "کارواش", icon: "🚿" },
  { slug: "tire", name: "لاستیک و آپاراتی", icon: "🛞" },

  { slug: "technical", name: "خدمات فنی", icon: "🧰" },
  { slug: "construction", name: "ساختمان و مصالح", icon: "🏗️" },
  { slug: "electrician", name: "برق‌کاری", icon: "💡" },
  { slug: "plumbing", name: "لوله‌کشی و تاسیسات", icon: "🚰" },
  { slug: "welding", name: "جوشکاری و آهنگری", icon: "🔩" },

  { slug: "doctor", name: "پزشکان و درمان", icon: "🩺" },
  { slug: "dentist", name: "دندانپزشکی", icon: "🦷" },
  { slug: "pharmacy", name: "داروخانه", icon: "💊" },
  { slug: "laboratory", name: "آزمایشگاه و تشخیص پزشکی", icon: "🧪" },

  { slug: "beauty", name: "آرایشگاه و زیبایی", icon: "💇" },
  { slug: "fitness", name: "ورزشی و باشگاه", icon: "🏋️" },
  { slug: "education", name: "آموزش و کلاس", icon: "📚" },
  { slug: "kindergarten", name: "مهدکودک و پیش‌دبستانی", icon: "🧸" },

  { slug: "real_estate", name: "املاک", icon: "🏠" },
  { slug: "travel", name: "گردشگری و اقامت", icon: "🏨" },
  { slug: "printing", name: "چاپ و تبلیغات", icon: "🖨️" },
  { slug: "photography", name: "عکاسی و فیلم‌برداری", icon: "📷" },
  { slug: "florist", name: "گل‌فروشی", icon: "🌷" },
  { slug: "pet", name: "پت‌شاپ و خدمات حیوانات", icon: "🐾" },
  { slug: "laundry", name: "خشکشویی و شست‌وشو", icon: "👔" },
  { slug: "delivery", name: "پیک و ارسال", icon: "🛵" },
  { slug: "services", name: "خدمات عمومی", icon: "🛠️" },

  { slug: "shop", name: "فروشگاه", icon: "🛍️" },
  { slug: "repair", name: "تعمیرگاه", icon: "🔧" },
  { slug: "other", name: "سایر", icon: "✨" },
] as const;
export const ADMIN_EMAIL = "09174057031@wall.jamcity.local";export const ADMIN_CONTACT_EMAIL = "javad.hosseini199167@gmail.com";

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
    value: "gold",
    name: "اشتراک طلایی",
    price: 2000000,
    color: "from-yellow-500 to-amber-300",
    perks: [
      "⭐ درج روی نقشه با نشان ستاره طلایی",
      "📢 ارسال خودکار روزانه یک آگهی در دیوار شهر جم (ساعت ۹ صبح)",
      "🏬 پنل کامل مدیریت منو و محصولات",
    ],
  },
  {
    value: "silver",
    name: "اشتراک نقره‌ای",
    price: 1000000,
    color: "from-slate-400 to-slate-300",
    perks: ["📍 درج روی نقشه شهر جم", "🏬 پنل کامل مدیریت منو و محصولات"],
  },
] as const;

export type SubscriptionTierValue = (typeof SUBSCRIPTION_TIERS)[number]["value"];

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
