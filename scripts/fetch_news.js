const https = require("https");

/*
|--------------------------------------------------------------------------
| Supabase
|--------------------------------------------------------------------------
*/

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase environment variables.");
  process.exit(1);
}

/*
|--------------------------------------------------------------------------
| فقط همین ۴ دسته مجاز هستند
|--------------------------------------------------------------------------
*/

const VALID_SECTIONS = ["jam", "jobs", "economic", "world"];

/*
|--------------------------------------------------------------------------
| منابع خبری
| نکته: فید Reuters (feeds.reuters.com) سال‌هاست RSS عمومی‌اش را جمع کرده،
| احتمالاً همیشه با خطا مواجه می‌شود. یا حذفش کنید یا با یک آدرس معتبر
| جایگزین‌اش کنید.
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
    name: "ایرنا",
    url: "https://www.irna.ir/rss",
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
    name: "شانا",
    url: "https://www.shana.ir/rss",
    section: "economic",
    sourceType: "iran",
  },
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
  {
    name: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    section: "world",
    sourceType: "world",
  },
  {
    name: "Reuters World",
    url: "https://feeds.reuters.com/reuters/worldNews", // ⚠️ احتمالاً از کار افتاده - جایگزین کنید
    section: "world",
    sourceType: "world",
  },
];

/*
|--------------------------------------------------------------------------
| دریافت URL با Retry
|--------------------------------------------------------------------------
*/

function fetchUrl(url, retries = 2) {
  return new Promise(function (resolve, reject) {
    function attempt(number) {
      const request = https.get(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 JamCityNewsBot/3.0",
            Accept: "application/rss+xml, application/xml, text/xml, text/html, */*",
          },
        },
        function (response) {
          let data = "";

          response.setEncoding("utf8");

          response.on("data", function (chunk) {
            data += chunk;
          });

          response.on("end", function () {
            if (response.statusCode >= 200 && response.statusCode < 400) {
              resolve(data);
              return;
            }

            if (number < retries) {
              console.log("Retry " + number + "/" + retries + " → " + url);

              setTimeout(function () {
                attempt(number + 1);
              }, 1000);

              return;
            }

            reject(new Error("HTTP " + response.statusCode + " for " + url));
          });
        }
      );

      request.on("error", function (error) {
        if (number < retries) {
          console.log("Retry " + number + "/" + retries + " → " + url);

          setTimeout(function () {
            attempt(number + 1);
          }, 1000);

          return;
        }

        reject(error);
      });

      request.setTimeout(30000, function () {
        request.destroy(new Error("Timeout: " + url));
      });
    }

    attempt(1);
  });
}

/*
|--------------------------------------------------------------------------
| پاکسازی HTML
|--------------------------------------------------------------------------
| FIX: قبل از حذف تگ‌ها، بلاک‌های CDATA باز می‌شوند (فقط محتوای داخلشان
| نگه داشته می‌شود). قبلاً regex عمومی <[^>]*> کل بلاک
| <![CDATA[متن واقعی خبر]]> را - چون تا اولین ">" را می‌بلعد - با متن خبر
| یکجا پاک می‌کرد و عنوان/خلاصه خالی می‌شد.
|--------------------------------------------------------------------------
*/

function stripHtml(text) {
  if (!text) {
    return "";
  }

  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/\s+/g, " ")
    .trim();
}

/*
|--------------------------------------------------------------------------
| استخراج XML Tag
|--------------------------------------------------------------------------
*/

function getTag(item, tag) {
  const regex = new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + tag + ">", "i");

  const match = item.match(regex);

  if (!match) {
    return "";
  }

  return stripHtml(match[1]);
}

/*
|--------------------------------------------------------------------------
| استخراج RSS
|--------------------------------------------------------------------------
*/

function parseRSS(xml) {
  const items = [];

  const matches = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi);

  if (!matches) {
    return items;
  }

  for (const item of matches) {
    const title = getTag(item, "title");

    const description = getTag(item, "description") || getTag(item, "summary");

    const link = getTag(item, "link") || getTag(item, "guid");

    const pubDate = getTag(item, "pubDate") || getTag(item, "published") || getTag(item, "updated");

    if (!title) {
      continue;
    }

    let publishedAt;

    if (pubDate) {
      const parsedDate = new Date(pubDate);

      if (!isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate.toISOString();
      } else {
        publishedAt = new Date().toISOString();
      }
    } else {
      publishedAt = new Date().toISOString();
    }

    items.push({
      title: title,
      summary: description || null,
      source_url: link || null,
      published_at: publishedAt,
    });
  }

  return items;
}

/*
|--------------------------------------------------------------------------
| نرمال‌سازی فارسی
|--------------------------------------------------------------------------
*/

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ۀ/g, "ه")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/إ/g, "ا")
    .replace(/أ/g, "ا")
    .replace(/ئ/g, "ی")
    .replace(/‌/g, " ")
    .replace(/\u200c/g, " ")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/*
|--------------------------------------------------------------------------
| بررسی Keyword
|--------------------------------------------------------------------------
*/

function containsKeyword(text, keywords) {
  const normalized = normalizeText(text);

  for (const keyword of keywords) {
    const key = normalizeText(keyword);

    if (key && normalized.includes(key)) {
      return true;
    }
  }

  return false;
}

/*
|--------------------------------------------------------------------------
| 🚫 اخبار کاملاً ممنوع (امام جمعه)
|--------------------------------------------------------------------------
*/

const BLOCKED_RELIGIOUS_NEWS = [
  "امام جمعه",
  "امام‌جمعه",
  "امامجمعه",
  "ائمه جمعه",
  "ائمه‌جمعه",
  "ائمهجمعه",
  "خطیب جمعه",
  "خطیب نماز جمعه",
  "خطیب نمازجمعه",
  "نماز جمعه",
  "نمازجمعه",
  "خطبه جمعه",
  "خطبه‌های جمعه",
  "خطبه های جمعه",
  "خطبه نماز جمعه",
  "خطبه‌های نماز جمعه",
  "خطبه های نماز جمعه",
  "خطبه نمازجمعه",
  "خطبه‌های نمازجمعه",
  "سخنان امام جمعه",
  "سخنان امام‌جمعه",
  "دیدار با امام جمعه",
  "دیدار با امام‌جمعه",
  "دفتر امام جمعه",
  "دفتر امام‌جمعه",
  "ستاد نماز جمعه",
  "ستاد نمازجمعه",
  "مصلای نماز جمعه",
  "مصلای نمازجمعه",
];

/*
|--------------------------------------------------------------------------
| تشخیص خبر ممنوع
|--------------------------------------------------------------------------
*/

function isBlockedNews(title, summary) {
  const text = normalizeText(String(title || "") + " " + String(summary || ""));

  return containsKeyword(text, BLOCKED_RELIGIOUS_NEWS);
}

/*
|--------------------------------------------------------------------------
| JOB Keywords
|--------------------------------------------------------------------------
*/

const jobKeywords = [
  "استخدام",
  "استخدامی",
  "استخدام نیرو",
  "جذب نیرو",
  "جذب نیروی انسانی",
  "فرصت شغلی",
  "فرصت‌های شغلی",
  "فرصت های شغلی",
  "کاریابی",
  "آگهی استخدام",
  "شغل",
  "شغلی",
  "کارآفرینی",
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
| ECONOMIC Keywords
|--------------------------------------------------------------------------
*/

const economicStrongKeywords = [
  "بورس",
  "بازار سرمایه",
  "شاخص بورس",
  "شاخص کل بورس",
  "فرابورس",
  "عرضه اولیه",
  "معاملات بورس",
  "سهام",
  "سهامداران",
  "سهام عدالت",
  "دلار",
  "دلار آزاد",
  "دلار نیمایی",
  "نرخ ارز",
  "ارز دیجیتال",
  "رمزارز",
  "رمز ارز",
  "بیت کوین",
  "بیت‌کوین",
  "بیتکوین",
  "اتریوم",
  "تتر",
  "کریپتو",
  "کریپتوکارنسی",
  "دوج کوین",
  "سولانا",
  "ریپل",
  "یورو",
  "پوند",
  "لیر",
  "درهم",
  "قیمت طلا",
  "طلای ۱۸ عیار",
  "طلای 24 عیار",
  "طلای ۲۴ عیار",
  "سکه امامی",
  "قیمت سکه",
  "نیم سکه",
  "ربع سکه",
  "سکه بهار آزادی",
  "اونس طلا",
  "انس طلا",
  "بانک مرکزی",
  "نرخ بهره",
  "نرخ سود",
  "سپرده بانکی",
  "وام بانکی",
  "تسهیلات بانکی",
  "نقدینگی",
  "تورم",
  "مالیات",
  "سرمایه گذاری",
  "سرمایه‌گذاری",
  "سرمایه‌گذار",
  "قیمت مسکن",
  "بازار مسکن",
  "اجاره بها",
  "اجاره‌بها",
  "قیمت خودرو",
  "بازار خودرو",
  "رشد اقتصادی",
  "اقتصاد ایران",
  "وزارت اقتصاد",
  "وزیر اقتصاد",
  "بودجه",
  "کسری بودجه",
  "درآمد نفتی",
  "قیمت نفت",
  "قیمت بنزین",
  "تراز تجاری",
  "صادرات غیرنفتی",
  "تعرفه گمرکی",
  "تحریم",
];

const economicWeakKeywords = ["قیمت", "نرخ", "بازار", "اقتصاد", "اقتصادی", "کالا", "واردات", "صادرات", "گرانی", "ارزان"];

/*
|--------------------------------------------------------------------------
| WORLD Keywords
|--------------------------------------------------------------------------
*/

const worldKeywords = [
  "آمریکا",
  "امریکا",
  "ایالات متحده",
  "ترامپ",
  "کاخ سفید",
  "واشنگتن",
  "پنتاگون",
  "بایدن",
  "هریس",
  "اسرائیل",
  "غزه",
  "فلسطین",
  "حماس",
  "تل آویو",
  "لبنان",
  "بیروت",
  "حزب الله",
  "اوکراین",
  "روسیه",
  "مسکو",
  "کی‌یف",
  "انگلیس",
  "بریتانیا",
  "لندن",
  "فرانسه",
  "پاریس",
  "آلمان",
  "برلین",
  "اروپا",
  "اتحادیه اروپا",
  "ناتو",
  "چین",
  "پکن",
  "ژاپن",
  "توکیو",
  "کره جنوبی",
  "کره شمالی",
  "هند",
  "ترکیه",
  "آنکارا",
  "اردوغان",
  "پاکستان",
  "افغانستان",
  "طالبان",
  "عراق",
  "بغداد",
  "سوریه",
  "دمشق",
  "یمن",
  "صنعا",
  "عربستان",
  "ریاض",
  "امارات",
  "ابوظبی",
  "قطر",
  "دوحه",
  "بحرین",
  "بین المللی",
  "بین‌المللی",
  "جهان",
  "سازمان ملل",
  "شورای امنیت",
  "world",
  "international",
  "usa",
  "america",
  "trump",
  "russia",
  "ukraine",
  "china",
  "israel",
  "gaza",
  "palestine",
  "europe",
  "nato",
];

/*
|--------------------------------------------------------------------------
| کلمات سیاسی (برای رد کردن کامل)
|--------------------------------------------------------------------------
*/

const politicalKeywords = [
  "رهبر",
  "رهبری",
  "رهبر معظم",
  "رئیس جمهور",
  "رئیس‌جمهور",
  "رئیس مجلس",
  "نماینده مجلس",
  "مجلس شورای اسلامی",
  "دولت",
  "وزیر",
  "استاندار",
  "فرماندار",
  "انتخابات",
  "سیاست",
  "سیاسی",
  "مذاکره",
  "مقاومت",
  "جنگ",
  "صلح",
  "دیپلماسی",
  "امنیت ملی",
  "دیدار",
  "ملاقات",
  "سفر",
  "جلسه",
  "نشست",
  "همایش",
  "کنفرانس",
  "شهید",
  "تشییع",
  "خاکسپاری",
  "جانشین فرمانده",
  "سپاه",
  "پدافند هوایی",
  "ارتش",
  "قوه قضائیه",
  "انتظامی",
];

/*
|--------------------------------------------------------------------------
| JAM Keywords - فقط مواردی که واقعاً به منطقه مرتبط هستند
|--------------------------------------------------------------------------
| FIX: کلیدواژه‌های عمومی صنعت نفت/گاز که هیچ اسم مکانی نداشتند
| («پالایشگاه»، «پتروشیمی»، «صنعت نفت»، «نفت و گاز»، «تولید گاز» و ...)
| حذف شدند. این کلمات باعث می‌شدند هر خبر نفت‌وگازی از سراسر ایران
| (آبادان، ماهشهر، خارک و...) به‌غلط زیر تب «جم» بیفتد، چون لیست
| jamBlockedKeywords همه‌ی شهرهای دیگر را پوشش نمی‌داد.
| حالا فقط اسم‌های مکانیِ واقعی منطقه (جم، عسلویه، کنگان، پارس جنوبی،
| انارستان، ریز، نخل تقی، سیراف، دیر) به‌عنوان کلید جم شناخته می‌شوند.
|--------------------------------------------------------------------------
*/

const jamStrongKeywords = [
  // شهر جم و اطراف
  "شهرستان جم",
  "شهر جم",
  "فرمانداری جم",
  "فرماندار جم",
  "شهردار جم",
  "شهرداری جم",
  "شورای شهر جم",
  "شورای اسلامی شهر جم",
  "نماینده جم",
  "نماینده شهرستان جم",

  // پتروشیمی و پالایشگاه با نام مکان مشخص
  "پتروشیمی جم",
  "مجتمع پتروشیمی جم",
  "پالایشگاه جم",

  // انارستان و ریز
  "انارستان جم",
  "انارستان",
  "ریز جم",
  "شهرستان ریز",
  "شهر ریز",

  // عسلویه
  "عسلویه",
  "شهرستان عسلویه",
  "فرمانداری عسلویه",
  "فرماندار عسلویه",
  "پتروشیمی عسلویه",
  "پالایشگاه عسلویه",
  "منطقه ویژه عسلویه",
  "منطقه ویژه اقتصادی عسلویه",
  "پارس جنوبی عسلویه",

  // کنگان
  "کنگان",
  "شهرستان کنگان",
  "فرمانداری کنگان",
  "فرماندار کنگان",
  "پتروشیمی کنگان",
  "پالایشگاه کنگان",

  // پارس جنوبی
  "پارس جنوبی",
  "منطقه ویژه پارس",
  "منطقه ویژه اقتصادی انرژی پارس",
  "میدان گازی پارس جنوبی",
  "فاز پارس جنوبی",

  // سایر مناطق مرتبط
  "نخل تقی",
  "سیراف",
  "دیر",
  "شهرستان دیر",
];

/*
|--------------------------------------------------------------------------
| کلمات ممنوع برای JAM (اگر اینها باشن، خبر JAM نمی‌شه)
|--------------------------------------------------------------------------
*/

const jamBlockedKeywords = [
  // شهرهای دیگه استان بوشهر
  "بوشهر",
  "بندر بوشهر",
  "برازجان",
  "دشتستان",
  "گناوه",
  "دیلم",
  "تنگستان",
  "دشتی",
  "بندر دیر",
  "اهرم",
  "خورموج",
  "خارک",
  "بندر خارک",
  "پتروشیمی خارک",

  // استان‌های دیگه
  "اصفهان",
  "شیراز",
  "تهران",
  "مشهد",
  "تبریز",
  "یزد",
  "همدان",
  "کرمانشاه",
  "لرستان",
  "گیلان",
  "اردبیل",
  "هرمزگان",
  "فارس",
  "ارومیه",
  "خلخال",
  "ساوه",
  // شهرهای مهم صنعت نفت/گاز خارج از منطقه جم که باید از تب جم حذف شوند
  "آبادان",
  "ماهشهر",
  "بندرماهشهر",
  "اهواز",
  "خوزستان",
  "عسلویه۲", // placeholder امن - بدون اثر
];

/*
|--------------------------------------------------------------------------
| تشخیص JAM (با قوانین سخت‌گیرانه)
|--------------------------------------------------------------------------
*/

function isJamNews(title, summary) {
  const titleText = normalizeText(String(title || ""));
  const summaryText = normalizeText(String(summary || ""));
  const fullText = titleText + " " + summaryText;

  // شرط اول: خبر نباید کلمات ممنوع JAM داشته باشد
  if (containsKeyword(fullText, jamBlockedKeywords)) {
    return false;
  }

  // شرط دوم: خبر باید حداقل یک کلمه قوی JAM داشته باشد
  if (!containsKeyword(fullText, jamStrongKeywords)) {
    return false;
  }

  // شرط سوم: خبر نباید سیاسی باشد
  if (containsKeyword(fullText, politicalKeywords)) {
    return false;
  }

  return true;
}

/*
|--------------------------------------------------------------------------
| تشخیص دسته
|--------------------------------------------------------------------------
| FIX: ترتیب اولویت عوض شد.
| قبلاً: مسدود → شغلی → جهانی (sourceType + کلیدواژه) → جم → اقتصادی → ...
| مشکل: چک «جهانی با کلیدواژه» قبل از «جم» بود، پس هر خبر محلی جم/عسلویه
| که اسم یک کشور دیگر را می‌آورد (مثلاً صادرات گاز به قطر) به‌غلط
| «جهانی» می‌شد، نه «جم».
| الان: مسدود → شغلی → جهانی-فقط-از-منبع-جهانی (سخت) → جم → اقتصادی قوی
| → جهانی-با-کلیدواژه (نرم) → رد سیاسی → رد اقتصادی ضعیف → null
| یعنی دسته‌ی محلی (جم) و دسته‌ی اقتصادی قوی، قبل از تشخیص عمومیِ
| «جهانی بر اساس کلیدواژه» چک می‌شوند.
|--------------------------------------------------------------------------
*/

function detectSection(title, summary, sourceType) {
  const titleText = normalizeText(String(title || ""));
  const summaryText = normalizeText(String(summary || ""));
  const fullText = titleText + " " + summaryText;

  /*
  ---------------------------------------------------------
  0. اخبار ممنوع (امام جمعه)
  ---------------------------------------------------------
  */

  if (isBlockedNews(title, summary)) {
    return null;
  }

  /*
  ---------------------------------------------------------
  1. JOBS
  ---------------------------------------------------------
  */

  if (containsKeyword(fullText, jobKeywords)) {
    return "jobs";
  }

  /*
  ---------------------------------------------------------
  2. WORLD - قانون سخت برای منابع خبرگزاری جهانی
  (هر محتوایی از BBC/Reuters ذاتاً جهانی است، صرف‌نظر از کلیدواژه)
  ---------------------------------------------------------
  */

  if (sourceType === "world") {
    return "world";
  }

  /*
  ---------------------------------------------------------
  3. JAM - با قوانین سخت (قبل از اقتصادی و قبل از جهانیِ نرم)
  ---------------------------------------------------------
  */

  if (isJamNews(title, summary)) {
    return "jam";
  }

  /*
  ---------------------------------------------------------
  4. ECONOMIC (کلیدواژه‌های قوی)
  ---------------------------------------------------------
  */

  if (containsKeyword(fullText, economicStrongKeywords)) {
    return "economic";
  }

  /*
  ---------------------------------------------------------
  5. WORLD - تشخیص نرم بر اساس کلیدواژه (فقط اگر جم/اقتصادی نبود)
  ---------------------------------------------------------
  */

  if (containsKeyword(fullText, worldKeywords)) {
    return "world";
  }

  /*
  ---------------------------------------------------------
  6. رد اخبار سیاسی
  ---------------------------------------------------------
  */

  if (containsKeyword(fullText, politicalKeywords)) {
    return null;
  }

  /*
  ---------------------------------------------------------
  7. رد اخبار با کلمات ضعیف اقتصادی
  ---------------------------------------------------------
  */

  if (containsKeyword(fullText, economicWeakKeywords)) {
    return null;
  }

  /*
  ---------------------------------------------------------
  8. Fallback - نامشخص، رد می‌شود
  ---------------------------------------------------------
  */

  return null;
}

/*
|--------------------------------------------------------------------------
| بررسی خبر تکراری
|--------------------------------------------------------------------------
*/

async function newsExists(sourceUrl, title) {
  let url;

  if (sourceUrl) {
    const encodedUrl = encodeURIComponent(sourceUrl);

    url = SUPABASE_URL + "/rest/v1/jamcity_content" + "?select=id" + "&source_url=eq." + encodedUrl + "&limit=1";
  } else {
    const encodedTitle = encodeURIComponent(title);

    url = SUPABASE_URL + "/rest/v1/jamcity_content" + "?select=id" + "&title=eq." + encodedTitle + "&limit=1";
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error("Supabase duplicate check failed: " + response.status + " " + errorText);
  }

  const data = await response.json();

  return Array.isArray(data) && data.length > 0;
}

/*
|--------------------------------------------------------------------------
| ذخیره خبر
|--------------------------------------------------------------------------
*/

async function saveNews(item, feed) {
  if (isBlockedNews(item.title, item.summary)) {
    console.log("SKIP religious/political: " + item.title);
    return false;
  }

  const exists = await newsExists(item.source_url, item.title);

  if (exists) {
    console.log("SKIP duplicate: " + item.title);
    return false;
  }

  const section = detectSection(item.title, item.summary, feed.sourceType);

  if (!section) {
    console.log("SKIP irrelevant: " + item.title);
    return false;
  }

  if (!VALID_SECTIONS.includes(section)) {
    console.error("INVALID SECTION → " + section + " | " + item.title);
    return false;
  }

  if (section === "jam" && !isJamNews(item.title, item.summary)) {
    console.log("SKIP fake JAM: " + item.title);
    return false;
  }

  const record = {
    section: section,
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
    published_at: item.published_at,
  };

  const response = await fetch(SUPABASE_URL + "/rest/v1/jamcity_content", {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error('Supabase insert error for "' + item.title + '":', errorText);

    return false;
  }

  console.log("ADDED [" + section + "] " + feed.name + " | " + item.title);

  return true;
}

/*
|--------------------------------------------------------------------------
| اجرای اصلی
|--------------------------------------------------------------------------
*/

async function main() {
  console.log("");
  console.log("========================================");
  console.log("       JAM CITY AUTOMATIC NEWS");
  console.log("========================================");
  console.log("");
  console.log("Categories: JAM / JOBS / ECONOMIC / WORLD");
  console.log("JAM: ONLY Jam, Asaluyeh, Kangan, Petrochemical (named), South Pars");
  console.log("🚫 Imam Jom'e / Friday Prayer news: BLOCKED");
  console.log("Priority: blocked -> jobs -> world-source -> JAM -> economic -> world-keyword -> reject");
  console.log("");

  let total = 0;
  let added = 0;
  let skipped = 0;
  let failedSources = 0;

  for (const feed of FEEDS) {
    console.log("");
    console.log("SOURCE: " + feed.name);
    console.log("URL: " + feed.url);

    try {
      const xml = await fetchUrl(feed.url);
      const items = parseRSS(xml);

      console.log("Found " + items.length + " items");

      for (const item of items.slice(0, 10)) {
        total++;

        try {
          const saved = await saveNews(item, feed);

          if (saved) {
            added++;
          } else {
            skipped++;
          }
        } catch (error) {
          console.error("Error processing news: " + item.title, error.message);
        }
      }
    } catch (error) {
      failedSources++;
      console.error("SOURCE FAILED: " + feed.name + " → " + error.message);
    }
  }

  console.log("");
  console.log("========================================");
  console.log("TOTAL: " + total);
  console.log("ADDED: " + added);
  console.log("SKIPPED: " + skipped);
  console.log("FAILED SOURCES: " + failedSources);
  console.log("========================================");
  console.log("");
}

/*
|--------------------------------------------------------------------------
| اجرا
|--------------------------------------------------------------------------
*/

main().catch(function (error) {
  console.error("FATAL ERROR:", error);
  process.exit(1);
});