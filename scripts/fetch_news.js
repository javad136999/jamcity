const https = require("https");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase environment variables.");
  process.exit(1);
}

/*
|--------------------------------------------------------------------------
| منابع خبری
|--------------------------------------------------------------------------
*/

const FEEDS = [
  {
    name: "مهر",
    url: "https://www.mehrnews.com/rss",
    section: "economic",
    sourceType: "iran",
  },
  {
    name: "ایسنا",
    url: "https://www.isna.ir/rss",
    section: "economic",
    sourceType: "iran",
  },
  {
    name: "تسنیم",
    url: "https://www.tasnimnews.com/fa/rss",
    section: "economic",
    sourceType: "iran",
  },
  {
    name: "فارس",
    url: "https://www.farsnews.ir/rss",
    section: "economic",
    sourceType: "iran",
  },
  {
    name: "ایلنا",
    url: "https://www.ilna.ir/rss",
    section: "economic",
    sourceType: "iran",
  },
  {
    name: "ایرنا",
    url: "https://www.irna.ir/rss",
    section: "economic",
    sourceType: "iran",
  },
  {
    name: "برنا",
    url: "https://www.borna.news/rss",
    section: "economic",
    sourceType: "iran",
  },
  {
    name: "خبرآنلاین",
    url: "https://www.khabaronline.ir/rss",
    section: "economic",
    sourceType: "iran",
  },
  {
    name: "تابناک",
    url: "https://www.tabnak.ir/fa/rss",
    section: "economic",
    sourceType: "iran",
  },

  /*
  |--------------------------------------------------------------------------
  | منابع جنوب
  |--------------------------------------------------------------------------
  */

  {
    name: "اتحاد خبر",
    url: "https://www.ettehadkhabar.ir/fa/rss",
    section: "jam",
    sourceType: "south",
  },

  {
    name: "بامداد جنوب",
    url: "https://bamdadjonoub.ir/feed/",
    section: "jam",
    sourceType: "south",
  },

  /*
  |--------------------------------------------------------------------------
  | انرژی
  |--------------------------------------------------------------------------
  */

  {
    name: "شانا",
    url: "https://www.shana.ir/rss",
    section: "energy",
    sourceType: "energy",
  },

  /*
  |--------------------------------------------------------------------------
  | جهان
  |--------------------------------------------------------------------------
  */

  {
    name: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    section: "world",
    sourceType: "world",
  },

  {
    name: "Reuters World",
    url: "https://feeds.reuters.com/reuters/worldNews",
    section: "world",
    sourceType: "world",
  },
];

/*
|--------------------------------------------------------------------------
| دریافت URL
|--------------------------------------------------------------------------
*/

function fetchUrl(url, timeout = 20000) {
  return new Promise((resolve, reject) => {
    let finished = false;

    const request = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 JamCityNewsBot/3.0",
          Accept:
            "application/rss+xml, application/xml, text/xml, text/html, */*",
          "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
        },
      },
      (response) => {
        let data = "";

        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          if (finished) return;
          finished = true;

          if (
            response.statusCode >= 200 &&
            response.statusCode < 400
          ) {
            resolve(data);
          } else {
            reject(
              new Error(
                `HTTP ${response.statusCode} for ${url}`
              )
            );
          }
        });
      }
    );

    request.on("error", (error) => {
      if (finished) return;

      finished = true;
      reject(error);
    });

    request.setTimeout(timeout, () => {
      if (finished) return;

      finished = true;
      request.destroy();

      reject(
        new Error(`Timeout: ${url}`)
      );
    });
  });
}

/*
|--------------------------------------------------------------------------
| Retry
|--------------------------------------------------------------------------
*/

async function fetchWithRetry(url, retries = 2) {
  let lastError;

  for (
    let attempt = 1;
    attempt <= retries + 1;
    attempt++
  ) {
    try {
      return await fetchUrl(url);
    } catch (error) {
      lastError = error;

      if (attempt <= retries) {
        console.log(
          `Retry ${attempt}/${retries} → ${url}`
        );

        await new Promise((resolve) =>
          setTimeout(resolve, 1500)
        );
      }
    }
  }

  throw lastError;
}

/*
|--------------------------------------------------------------------------
| پاکسازی HTML
|--------------------------------------------------------------------------
*/

function stripHtml(text) {
  if (!text) return "";

  return String(text)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/*
|--------------------------------------------------------------------------
| نرمال‌سازی فارسی
|--------------------------------------------------------------------------
*/

function normalizePersian(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ۀ/g, "ه")
    .replace(/ة/g, "ه")
    .replace(/أ/g, "ا")
    .replace(/إ/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
|--------------------------------------------------------------------------
| استخراج XML
|--------------------------------------------------------------------------
*/

function getTag(item, tag) {
  const regex = new RegExp(
    "<" +
      tag +
      "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" +
      tag +
      ">",
    "i"
  );

  const match = item.match(regex);

  if (!match) return "";

  return stripHtml(match[1]);
}

/*
|--------------------------------------------------------------------------
| Parse RSS
|--------------------------------------------------------------------------
*/

function parseRSS(xml) {
  const items = [];

  if (!xml) return items;

  const matches = xml.match(
    /<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi
  );

  if (!matches) return items;

  for (const item of matches) {
    const title = getTag(item, "title");

    const description =
      getTag(item, "description") ||
      getTag(item, "summary") ||
      getTag(item, "content");

    const link =
      getTag(item, "link") ||
      getTag(item, "guid");

    const pubDate =
      getTag(item, "pubDate") ||
      getTag(item, "published") ||
      getTag(item, "updated");

    if (!title) continue;

    let publishedAt = new Date().toISOString();

    if (pubDate) {
      const parsedDate = new Date(pubDate);

      if (!isNaN(parsedDate.getTime())) {
        publishedAt =
          parsedDate.toISOString();
      }
    }

    items.push({
      title: title.trim(),
      summary: description
        ? description.trim()
        : null,
      source_url: link
        ? link.trim()
        : null,
      published_at: publishedAt,
    });
  }

  return items;
}

/*
|--------------------------------------------------------------------------
| اخبار جم و جنوب
|--------------------------------------------------------------------------
|
| مهم:
| "جم" به تنهایی وجود ندارد.
|
| بنابراین:
| جمعه
| جمعیت
| جامع
| جمع‌آوری
|
| باعث تشخیص شهر جم نمی‌شوند.
|--------------------------------------------------------------------------
*/

const jamKeywords = [
  "شهر جم",
  "شهرستان جم",
  "جم استان بوشهر",
  "فرمانداری جم",
  "فرماندار جم",
  "شهرداری جم",
  "شهردار جم",
  "شورای شهر جم",
  "شورای اسلامی شهر جم",
  "بخش مرکزی جم",
  "بخش ریز جم",
  "ریز جم",
  "انارستان جم",
  "روستاهای جم",

  "عسلویه",
  "شهر عسلویه",
  "شهرستان عسلویه",
  "فرمانداری عسلویه",
  "فرماندار عسلویه",
  "شهرداری عسلویه",

  "کنگان",
  "شهر کنگان",
  "شهرستان کنگان",
  "فرمانداری کنگان",
  "فرماندار کنگان",

  "دیر استان بوشهر",
  "شهرستان دیر",
  "شهر دیر",

  "نخل تقی",
  "سیراف",

  "استان بوشهر",
  "شهر بوشهر",
  "شهرستان بوشهر",

  "پارس جنوبی",
  "منطقه ویژه اقتصادی انرژی پارس",
  "منطقه ویژه پارس",
  "منطقه ویژه اقتصادی پارس",

  "پتروشیمی جم",
];

/*
|--------------------------------------------------------------------------
| انرژی / پتروشیمی
|--------------------------------------------------------------------------
*/

const energyKeywords = [
  "پتروشیمی",
  "پالایشگاه",
  "پارس جنوبی",
  "نفت",
  "گاز",
  "پالایش گاز",
  "میدان گازی",
  "سکوی گازی",
  "فلر",
  "فلرینگ",
  "مشعل",
  "پتروپالایش",
  "صنایع نفت",
  "صنایع گاز",
  "صنعت پتروشیمی",
  "وزارت نفت",
  "شرکت ملی نفت",
  "شرکت ملی گاز",
  "اوره",
  "متانول",
  "اتیلن",
  "پلی اتیلن",
  "پتروشیمی جم",
  "پتروشیمی پارس",
  "پتروشیمی پردیس",
  "پتروشیمی زاگرس",
  "پتروشیمی آریاساسول",
  "پتروشیمی مروارید",
  "پتروشیمی دماوند",
  "منطقه ویژه پارس",
];

/*
|--------------------------------------------------------------------------
| استخدام
|--------------------------------------------------------------------------
*/

const jobKeywords = [
  "استخدام",
  "استخدامی",
  "استخدام نیرو",
  "جذب نیرو",
  "جذب نیروی",
  "جذب کارکنان",
  "فرصت شغلی",
  "فرصت‌های شغلی",
  "فرصت های شغلی",
  "کاریابی",
  "شغل",
  "شغلی",
  "آزمون استخدامی",
  "آزمون استخدام",
  "ثبت نام استخدام",
  "ثبت‌نام استخدام",
  "استخدام پتروشیمی",
  "استخدام عسلویه",
  "استخدام بوشهر",
  "استخدام جم",
  "job",
  "jobs",
  "career",
  "vacancy",
  "recruitment",
];

/*
|--------------------------------------------------------------------------
| اقتصاد
|--------------------------------------------------------------------------
*/

const economicKeywords = [
  "اقتصاد",
  "اقتصادی",
  "بورس",
  "بازار سرمایه",
  "سهام",
  "شاخص بورس",
  "شاخص کل",
  "فرابورس",
  "عرضه اولیه",
  "دلار",
  "ارز",
  "ارز دیجیتال",
  "رمزارز",
  "رمز ارز",
  "بیت کوین",
  "بیت‌کوین",
  "اتریوم",
  "تتر",
  "طلا",
  "طلای ۱۸ عیار",
  "سکه",
  "سکه امامی",
  "ربع سکه",
  "نیم سکه",
  "اونس طلا",
  "بانک",
  "بانکی",
  "بانک مرکزی",
  "نرخ بهره",
  "سپرده",
  "وام",
  "صادرات",
  "واردات",
  "تورم",
  "مالیات",
  "سرمایه گذاری",
  "سرمایه‌گذاری",
  "نقدینگی",
  "بازار",
  "قیمت",
  "finance",
  "financial",
  "market",
  "stock",
  "stocks",
  "dollar",
  "gold",
];

/*
|--------------------------------------------------------------------------
| حوادث
|--------------------------------------------------------------------------
*/

const accidentKeywords = [
  "تصادف",
  "سانحه",
  "حادثه",
  "آتش سوزی",
  "آتش‌سوزی",
  "انفجار",
  "واژگونی",
  "غرق شد",
  "غرق‌شد",
  "غرق شدن",
  "فوت",
  "کشته",
  "جان باخت",
  "جان‌باخت",
  "مصدوم",
  "مصدومان",
  "مسمومیت",
  "آتش نشانی",
  "آتش‌نشانی",
  "اورژانس",
  "نجات",
];

/*
|--------------------------------------------------------------------------
| ورزش
|--------------------------------------------------------------------------
*/

const sportKeywords = [
  "فوتبال",
  "ورزش",
  "ورزشی",
  "والیبال",
  "بسکتبال",
  "تنیس",
  "فوتسال",
  "کشتی",
  "قهرمانی",
  "لیگ برتر",
  "جام حذفی",
  "مسابقات",
  "تیم ملی",
  "بازیکن",
  "مربی",
  "استقلال",
  "پرسپولیس",
  "سپاهان",
  "ورزشکار",
];

/*
|--------------------------------------------------------------------------
| اجتماعی
|--------------------------------------------------------------------------
*/

const socialKeywords = [
  "اجتماعی",
  "آموزش و پرورش",
  "مدرسه",
  "دانشگاه",
  "دانشجو",
  "معلم",
  "دانش آموز",
  "دانش‌آموز",
  "شهرداری",
  "شورای شهر",
  "آب و فاضلاب",
  "برق",
  "آب",
  "قطعی برق",
  "قطعی آب",
  "راه و شهرسازی",
  "راهسازی",
  "جاده",
  "حمل و نقل",
  "سلامت",
  "بیمارستان",
  "بهداشت",
  "درمان",
];

/*
|--------------------------------------------------------------------------
| جهان
|--------------------------------------------------------------------------
*/

const worldKeywords = [
  "آمریکا",
  "ایالات متحده",
  "ترامپ",
  "کاخ سفید",
  "واشنگتن",
  "اسرائیل",
  "غزه",
  "فلسطین",
  "حماس",
  "تل آویو",
  "اوکراین",
  "روسیه",
  "مسکو",
  "کی‌یف",
  "چین",
  "پکن",
  "ژاپن",
  "کره جنوبی",
  "کره شمالی",
  "هند",
  "انگلیس",
  "بریتانیا",
  "لندن",
  "فرانسه",
  "پاریس",
  "آلمان",
  "برلین",
  "اروپا",
  "اتحادیه اروپا",
  "ترکیه",
  "عراق",
  "سوریه",
  "لبنان",
  "یمن",
  "عربستان",
  "امارات",
  "قطر",
  "سازمان ملل",
  "ناتو",
  "بین المللی",
  "بین‌المللی",
  "usa",
  "america",
  "united states",
  "trump",
  "russia",
  "ukraine",
  "china",
  "israel",
  "gaza",
  "palestine",
  "europe",
  "nato",
  "world",
  "international",
];

/*
|--------------------------------------------------------------------------
| تطبیق کلمات
|--------------------------------------------------------------------------
*/

function containsKeyword(text, keywords) {
  const normalized =
    normalizePersian(text);

  return keywords.some((keyword) =>
    normalized.includes(
      normalizePersian(keyword)
    )
  );
}

function countMatches(text, keywords) {
  const normalized =
    normalizePersian(text);

  let count = 0;

  for (const keyword of keywords) {
    if (
      normalized.includes(
        normalizePersian(keyword)
      )
    ) {
      count++;
    }
  }

  return count;
}

/*
|--------------------------------------------------------------------------
| امتیاز جم
|--------------------------------------------------------------------------
*/

function getJamScore(title, summary) {
  const titleText =
    normalizePersian(title);

  const summaryText =
    normalizePersian(summary);

  let score = 0;

  for (const keyword of jamKeywords) {
    const k =
      normalizePersian(keyword);

    if (titleText.includes(k)) {
      score += 20;
    }

    if (summaryText.includes(k)) {
      score += 6;
    }
  }

  /*
  |--------------------------------------------------------------
  | عبارت‌های کاملاً اختصاصی شهر جم
  |--------------------------------------------------------------
  */

  const verySpecificJam = [
    "شهر جم",
    "شهرستان جم",
    "جم استان بوشهر",
    "فرمانداری جم",
    "فرماندار جم",
    "شهرداری جم",
    "شهردار جم",
    "شورای شهر جم",
    "بخش مرکزی جم",
    "بخش ریز جم",
    "انارستان جم",
  ];

  for (const keyword of verySpecificJam) {
    const k =
      normalizePersian(keyword);

    if (titleText.includes(k)) {
      score += 30;
    }

    if (summaryText.includes(k)) {
      score += 10;
    }
  }

  return score;
}

/*
|--------------------------------------------------------------------------
| تشخیص دسته
|--------------------------------------------------------------------------
*/

function detectSection(
  title,
  summary,
  defaultSection,
  sourceType
) {
  const titleText =
    normalizePersian(title);

  const summaryText =
    normalizePersian(summary);

  const fullText =
    titleText +
    " " +
    summaryText;

  const scores = {
    jam: 0,
    jobs: 0,
    energy: 0,
    economic: 0,
    accidents: 0,
    sport: 0,
    social: 0,
    world: 0,
  };

  /*
  |--------------------------------------------------------------------------
  | جم
  |--------------------------------------------------------------------------
  */

  scores.jam =
    getJamScore(title, summary);

  /*
  |--------------------------------------------------------------------------
  | استخدام
  |--------------------------------------------------------------------------
  */

  scores.jobs +=
    countMatches(
      fullText,
      jobKeywords
    ) * 8;

  if (
    containsKeyword(
      titleText,
      jobKeywords
    )
  ) {
    scores.jobs += 15;
  }

  /*
  |--------------------------------------------------------------------------
  | انرژی
  |--------------------------------------------------------------------------
  */

  scores.energy +=
    countMatches(
      fullText,
      energyKeywords
    ) * 7;

  if (
    containsKeyword(
      titleText,
      energyKeywords
    )
  ) {
    scores.energy += 15;
  }

  /*
  |--------------------------------------------------------------------------
  | اقتصاد
  |--------------------------------------------------------------------------
  */

  scores.economic +=
    countMatches(
      fullText,
      economicKeywords
    ) * 5;

  if (
    containsKeyword(
      titleText,
      economicKeywords
    )
  ) {
    scores.economic += 10;
  }

  /*
  |--------------------------------------------------------------------------
  | حوادث
  |--------------------------------------------------------------------------
  */

  scores.accidents +=
    countMatches(
      fullText,
      accidentKeywords
    ) * 9;

  if (
    containsKeyword(
      titleText,
      accidentKeywords
    )
  ) {
    scores.accidents += 18;
  }

  /*
  |--------------------------------------------------------------------------
  | ورزش
  |--------------------------------------------------------------------------
  */

  scores.sport +=
    countMatches(
      fullText,
      sportKeywords
    ) * 7;

  if (
    containsKeyword(
      titleText,
      sportKeywords
    )
  ) {
    scores.sport += 15;
  }

  /*
  |--------------------------------------------------------------------------
  | اجتماعی
  |--------------------------------------------------------------------------
  */

  scores.social +=
    countMatches(
      fullText,
      socialKeywords
    ) * 4;

  if (
    containsKeyword(
      titleText,
      socialKeywords
    )
  ) {
    scores.social += 8;
  }

  /*
  |--------------------------------------------------------------------------
  | جهان
  |--------------------------------------------------------------------------
  */

  scores.world +=
    countMatches(
      fullText,
      worldKeywords
    ) * 6;

  if (
    containsKeyword(
      titleText,
      worldKeywords
    )
  ) {
    scores.world += 15;
  }

  /*
  |--------------------------------------------------------------------------
  | منابع جهانی
  |--------------------------------------------------------------------------
  */

  if (sourceType === "world") {
    scores.world += 100;
  }

  /*
  |--------------------------------------------------------------------------
  | منابع انرژی
  |--------------------------------------------------------------------------
  */

  if (sourceType === "energy") {
    scores.energy += 20;
  }

  /*
  |--------------------------------------------------------------------------
  | خیلی مهم:
  |
  | منبع جنوبی به تنهایی باعث jam نمی‌شود.
  |--------------------------------------------------------------------------
  */

  /*
  |--------------------------------------------------------------------------
  | اگر خبر واقعاً درباره جم/جنوب است
  |--------------------------------------------------------------------------
  */

  if (scores.jam >= 20) {
    /*
    | اگر موضوع مشخصی مثل استخدام، حادثه یا پتروشیمی
    | دارد، همان دسته تخصصی را حفظ می‌کنیم.
    |
    | مثال:
    | "استخدام نیرو در پتروشیمی عسلویه"
    |
    | → jobs
    */

    const specialtyScores = {
      jobs: scores.jobs,
      energy: scores.energy,
      accidents: scores.accidents,
      sport: scores.sport,
      economic: scores.economic,
      social: scores.social,
    };

    let bestSpecialty = null;
    let bestSpecialtyScore = 0;

    for (
      const [section, score]
      of Object.entries(
        specialtyScores
      )
    ) {
      if (
        score > bestSpecialtyScore
      ) {
        bestSpecialtyScore = score;
        bestSpecialty = section;
      }
    }

    /*
    | اگر موضوع تخصصی بسیار قوی بود
    | همان دسته انتخاب شود.
    */

    if (
      bestSpecialty &&
      bestSpecialtyScore >= 15
    ) {
      return bestSpecialty;
    }

    return "jam";
  }

  /*
  |--------------------------------------------------------------------------
  | خبر جهانی
  |--------------------------------------------------------------------------
  */

  if (
    scores.world >= 20 &&
    scores.world >=
      scores.economic
  ) {
    return "world";
  }

  /*
  |--------------------------------------------------------------------------
  | بیشترین امتیاز
  |--------------------------------------------------------------------------
  */

  let bestSection =
    defaultSection;

  let bestScore = 0;

  for (
    const [section, score]
    of Object.entries(scores)
  ) {
    if (score > bestScore) {
      bestScore = score;
      bestSection = section;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | حداقل امتیاز
  |--------------------------------------------------------------------------
  */

  if (bestScore >= 8) {
    return bestSection;
  }

  /*
  |--------------------------------------------------------------------------
  | پیش‌فرض
  |--------------------------------------------------------------------------
  */

  const validSections = [
    "jam",
    "economic",
    "jobs",
    "world",
    "energy",
    "accidents",
    "sport",
    "social",
  ];

  if (
    validSections.includes(
      defaultSection
    )
  ) {
    return defaultSection;
  }

  return "economic";
}

/*
|--------------------------------------------------------------------------
| بررسی تکراری
|--------------------------------------------------------------------------
*/

async function newsExists(
  sourceUrl,
  title
) {
  let url;

  if (sourceUrl) {
    url =
      SUPABASE_URL +
      "/rest/v1/jamcity_content" +
      "?select=id" +
      "&source_url=eq." +
      encodeURIComponent(
        sourceUrl
      ) +
      "&limit=1";
  } else {
    url =
      SUPABASE_URL +
      "/rest/v1/jamcity_content" +
      "?select=id" +
      "&title=eq." +
      encodeURIComponent(
        title
      ) +
      "&limit=1";
  }

  const response =
    await fetch(url, {
      method: "GET",
      headers: {
        apikey:
          SUPABASE_SERVICE_ROLE_KEY,
        Authorization:
          "Bearer " +
          SUPABASE_SERVICE_ROLE_KEY,
      },
    });

  if (!response.ok) {
    throw new Error(
      "Supabase duplicate check failed: " +
        response.status +
        " " +
        (await response.text())
    );
  }

  const data =
    await response.json();

  return (
    Array.isArray(data) &&
    data.length > 0
  );
}

/*
|--------------------------------------------------------------------------
| ذخیره خبر
|--------------------------------------------------------------------------
*/

async function saveNews(
  item,
  feed
) {
  const exists =
    await newsExists(
      item.source_url,
      item.title
    );

  if (exists) {
    console.log(
      "SKIP duplicate: " +
        item.title
    );

    return false;
  }

  const section =
    detectSection(
      item.title,
      item.summary,
      feed.section,
      feed.sourceType
    );

  const jamScore =
    getJamScore(
      item.title,
      item.summary
    );

  const record = {
    section,
    title: item.title,
    summary: item.summary,
    content: item.summary,
    source_name: feed.name,
    source_url: item.source_url,
    image_url: null,
    symbol: null,
    sentiment: null,
    target_price: null,
    is_automatic: true,
    is_published: true,
    published_at:
      item.published_at,
  };

  const response =
    await fetch(
      SUPABASE_URL +
        "/rest/v1/jamcity_content",
      {
        method: "POST",
        headers: {
          apikey:
            SUPABASE_SERVICE_ROLE_KEY,
          Authorization:
            "Bearer " +
            SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type":
            "application/json",
          Prefer:
            "return=minimal",
        },
        body:
          JSON.stringify(record),
      }
    );

  if (!response.ok) {
    console.error(
      'Supabase insert error for "' +
        item.title +
        '":',
      await response.text()
    );

    return false;
  }

  console.log(
    "ADDED [" +
      section +
      "] " +
      feed.name +
      " | JAM:" +
      jamScore +
      " | " +
      item.title
  );

  return true;
}

/*
|--------------------------------------------------------------------------
| اجرای اصلی
|--------------------------------------------------------------------------
*/

async function main() {
  console.log("");

  console.log(
    "========================================"
  );

  console.log(
    "       JAM CITY AUTOMATIC NEWS"
  );

  console.log(
    "========================================"
  );

  console.log("");

  console.log(
    "JAM detection: city-specific"
  );

  console.log(
    "Standalone 'جم' keyword: DISABLED"
  );

  console.log(
    "South source does NOT automatically mean JAM"
  );

  console.log("");

  let total = 0;
  let added = 0;
  let failedSources = 0;

  for (const feed of FEEDS) {
    console.log("");

    console.log(
      "SOURCE: " +
        feed.name
    );

    console.log(
      "URL: " +
        feed.url
    );

    try {
      const xml =
        await fetchWithRetry(
          feed.url,
          2
        );

      const items =
        parseRSS(xml);

      console.log(
        "Found " +
          items.length +
          " items"
      );

      /*
      |--------------------------------------------------------------------------
      | حداکثر 10 خبر از هر منبع
      |--------------------------------------------------------------------------
      */

      for (
        const item of
        items.slice(0, 10)
      ) {
        total++;

        try {
          const saved =
            await saveNews(
              item,
              feed
            );

          if (saved) {
            added++;
          }
        } catch (error) {
          console.error(
            "Error processing news: " +
              item.title,
            error.message
          );
        }
      }
    } catch (error) {
      failedSources++;

      console.error(
        "SOURCE FAILED: " +
          feed.name +
          " → " +
          error.message
      );
    }
  }

  console.log("");

  console.log(
    "========================================"
  );

  console.log(
    "TOTAL: " +
      total
  );

  console.log(
    "ADDED: " +
      added
  );

  console.log(
    "FAILED SOURCES: " +
      failedSources
  );

  console.log(
    "========================================"
  );

  console.log("");
}

main().catch((error) => {
  console.error(
    "FATAL ERROR:",
    error
  );

  process.exit(1);
});