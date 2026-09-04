```javascript
const https = require("https");

/*
|--------------------------------------------------------------------------
| Supabase
|--------------------------------------------------------------------------
*/

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase environment variables.");
  process.exit(1);
}

/*
|--------------------------------------------------------------------------
| فقط همین ۴ دسته مجاز هستند
|--------------------------------------------------------------------------
*/

const VALID_SECTIONS = [
  "jam",
  "jobs",
  "economic",
  "world",
];

/*
|--------------------------------------------------------------------------
| منابع خبری
|--------------------------------------------------------------------------
*/

const FEEDS = [
  // -----------------------------
  // منابع عمومی ایران
  // -----------------------------

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

  // -----------------------------
  // منابع انرژی
  // -----------------------------

  {
    name: "شانا",
    url: "https://www.shana.ir/rss",
    section: "economic",
    sourceType: "iran",
  },

  // -----------------------------
  // منابع جنوب و بوشهر
  // -----------------------------

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

  // -----------------------------
  // منابع جهانی
  // -----------------------------

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
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 JamCityNewsBot/2.0",
            Accept:
              "application/rss+xml, application/xml, text/xml, text/html, */*",
          },
        },
        function (response) {
          let data = "";

          response.setEncoding("utf8");

          response.on("data", function (chunk) {
            data += chunk;
          });

          response.on("end", function () {
            if (
              response.statusCode >= 200 &&
              response.statusCode < 400
            ) {
              resolve(data);
              return;
            }

            if (number < retries) {
              console.log(
                "Retry " +
                  number +
                  "/" +
                  retries +
                  " → " +
                  url
              );

              setTimeout(function () {
                attempt(number + 1);
              }, 1000);

              return;
            }

            reject(
              new Error(
                "HTTP " +
                  response.statusCode +
                  " for " +
                  url
              )
            );
          });
        }
      );

      request.on("error", function (error) {
        if (number < retries) {
          console.log(
            "Retry " +
              number +
              "/" +
              retries +
              " → " +
              url
          );

          setTimeout(function () {
            attempt(number + 1);
          }, 1000);

          return;
        }

        reject(error);
      });

      request.setTimeout(30000, function () {
        request.destroy(
          new Error("Timeout: " + url)
        );
      });
    }

    attempt(1);
  });
}

/*
|--------------------------------------------------------------------------
| پاکسازی HTML
|--------------------------------------------------------------------------
*/

function stripHtml(text) {
  if (!text) {
    return "";
  }

  return String(text)
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      ""
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      ""
    )
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
| استخراج تگ XML
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

  const matches = xml.match(
    /<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi
  );

  if (!matches) {
    return items;
  }

  for (const item of matches) {
    const title = getTag(item, "title");

    const description =
      getTag(item, "description") ||
      getTag(item, "summary");

    const link =
      getTag(item, "link") ||
      getTag(item, "guid");

    const pubDate =
      getTag(item, "pubDate") ||
      getTag(item, "published") ||
      getTag(item, "updated");

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
    .replace(/\s+/g, " ")
    .trim();
}

/*
|--------------------------------------------------------------------------
| بررسی کلمه
|--------------------------------------------------------------------------
*/

function containsKeyword(text, keywords) {
  const normalized = normalizeText(text);

  for (const keyword of keywords) {
    const key = normalizeText(keyword);

    if (normalized.includes(key)) {
      return true;
    }
  }

  return false;
}

/*
|--------------------------------------------------------------------------
| کلمات دقیق مربوط به شهر / شهرستان جم
|--------------------------------------------------------------------------
|
| نکته:
| کلمه مستقل «جم» عمداً حذف شده است.
|--------------------------------------------------------------------------
*/

const jamStrongKeywords = [
  "شهرستان جم",
  "شهر جم",
  "شهرستانِ جم",
  "شهرِ جم",
  "فرمانداری جم",
  "فرماندار جم",
  "امام جمعه جم",
  "امام جمعه شهرستان جم",
  "امام‌جمعه جم",
  "امام‌جمعه شهرستان جم",
  "شهردار جم",
  "شهرداری جم",
  "شورای شهر جم",
  "شورای اسلامی شهر جم",
  "شورای اسلامی شهرستان جم",
  "نماینده جم",
  "نماینده شهرستان جم",
  "پتروشیمی جم",
  "پتروشیمی پارس",
  "منطقه ویژه اقتصادی انرژی پارس",
  "منطقه ویژه پارس",
  "پارس جنوبی",
  "عسلویه",
  "عسلوی",
  "شهرستان عسلویه",
  "فرمانداری عسلویه",
  "فرماندار عسلویه",
  "امام جمعه عسلویه",
  "کنگان",
  "شهرستان کنگان",
  "فرمانداری کنگان",
  "فرماندار کنگان",
  "امام جمعه کنگان",
  "نخل تقی",
  "سیراف",
  "دیر",
  "شهرستان دیر",
  "ریز",
  "انارستان",
  "بوشهر",
];

/*
|--------------------------------------------------------------------------
| کلمات استخدام
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
| کلمات اقتصادی قوی
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
  "دلار",
  "دلار آزاد",
  "دلار نیمایی",
  "نرخ ارز",
  "ارز",
  "ارز دیجیتال",
  "رمزارز",
  "رمز ارز",
  "بیت کوین",
  "بیت‌کوین",
  "اتریوم",
  "تتر",
  "کریپتو",
  "قیمت طلا",
  "طلای ۱۸ عیار",
  "طلای 24 عیار",
  "طلای ۲۴ عیار",
  "سکه امامی",
  "قیمت سکه",
  "نیم سکه",
  "ربع سکه",
  "اونس طلا",
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
  "بازار مسکن",
  "قیمت مسکن",
  "اجاره بها",
  "اجاره‌بها",
  "صادرات",
  "واردات",
  "تراز تجاری",
  "رشد اقتصادی",
  "اقتصاد ایران",
  "وزارت اقتصاد",
  "وزیر اقتصاد",
  "بودجه",
  "کسری بودجه",
  "درآمد نفتی",
  "قیمت نفت",
  "قیمت بنزین",
  "قیمت کالا",
  "گرانی",
  "ارزان شد",
  "گران شد",
  "افزایش قیمت",
  "کاهش قیمت",
  "بازار خودرو",
  "قیمت خودرو",
  "خودرو",
];

/*
|--------------------------------------------------------------------------
| کلمات جهانی
|--------------------------------------------------------------------------
*/

const worldKeywords = [
  "آمریکا",
  "امریکا",
  "ایالات متحده",
  "رئیس جمهور آمریکا",
  "رئیس‌جمهور آمریکا",
  "ترامپ",
  "کاخ سفید",
  "واشنگتن",
  "پنتاگون",
  "اسرائیل",
  "رژیم صهیونیستی",
  "غزه",
  "فلسطین",
  "حماس",
  "تل آویو",
  "کرانه باختری",
  "لبنان",
  "بیروت",
  "اوکراین",
  "روسیه",
  "مسکو",
  "کی‌یف",
  "کی یف",
  "چین",
  "پکن",
  "ژاپن",
  "توکیو",
  "کره جنوبی",
  "کره شمالی",
  "هند",
  "دهلی",
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
  "سازمان ملل",
  "ترکیه",
  "آنکارا",
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
  "پاکستان",
  "افغانستان",
  "بین المللی",
  "بین‌المللی",
  "جهان",
  "world",
  "international",
  "united states",
  "usa",
  "america",
  "trump",
  "white house",
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
| کلمات سیاسی عمومی
|--------------------------------------------------------------------------
|
| اینها به تنهایی economic نیستند.
|--------------------------------------------------------------------------
*/

const politicalKeywords = [
  "امام جمعه",
  "امام‌جمعه",
  "رهبر",
  "رئیس جمهور",
  "رئیس‌جمهور",
  "رئیس مجلس",
  "نماینده مجلس",
  "مجلس شورای اسلامی",
  "دولت",
  "وزیر",
  "استاندار",
  "فرماندار",
  "تحریم",
  "انتخابات",
  "سیاست",
  "سیاسی",
  "دشمن",
  "مذاکره",
  "مقاومت",
  "جنگ",
  "صلح",
  "دیپلماسی",
  "امنیت ملی",
  "کشورهای اسلامی",
];

/*
|--------------------------------------------------------------------------
| تشخیص خبر واقعاً محلی
|--------------------------------------------------------------------------
*/

function isJamNews(title, summary) {
  const text = normalizeText(
    String(title || "") +
      " " +
      String(summary || "")
  );

  /*
  |--------------------------------------------------------------------------
  | اگر «امام جمعه» وجود دارد،
  | فقط امام جمعه جم/عسلویه/کنگان می‌تواند JAM شود.
  |--------------------------------------------------------------------------
  */

  if (
    text.includes("امام جمعه") ||
    text.includes("امام‌جمعه")
  ) {
    if (
      text.includes("امام جمعه جم") ||
      text.includes("امام جمعه شهرستان جم") ||
      text.includes("امام جمعه عسلویه") ||
      text.includes("امام جمعه کنگان")
    ) {
      return true;
    }

    return false;
  }

  /*
  |--------------------------------------------------------------------------
  | عبارات بسیار قوی جم
  |--------------------------------------------------------------------------
  */

  const strongJamKeywords = [
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
    "پتروشیمی جم",
    "پتروشیمی پارس",
    "انارستان",
    "ریز",
    "انارستان جم",
    "ریز جم",
  ];

  if (
    containsKeyword(
      text,
      strongJamKeywords
    )
  ) {
    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | مناطق جنوب:
  | برای جلوگیری از اشتباه، وجود بوشهر به تنهایی کافی نیست.
  |--------------------------------------------------------------------------
  */

  const southKeywords = [
    "عسلویه",
    "شهرستان عسلویه",
    "کنگان",
    "شهرستان کنگان",
    "نخل تقی",
    "سیراف",
    "دیر",
    "شهرستان دیر",
    "پارس جنوبی",
    "منطقه ویژه پارس",
    "منطقه ویژه اقتصادی انرژی پارس",
  ];

  /*
  |--------------------------------------------------------------------------
  | اگر خبر جنوبی باشد ولی هیچ نشانه‌ای از جم نداشته باشد،
  | JAM نمی‌شود.
  |--------------------------------------------------------------------------
  */

  if (
    containsKeyword(
      text,
      southKeywords
    )
  ) {
    /*
    برای اخبار عسلویه/کنگان/پارس جنوبی
    به عنوان اخبار منطقه‌ای قابل قبول است.
    */
    return true;
  }

  return false;
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
  const text = normalizeText(
    String(title || "") +
      " " +
      String(summary || "")
  );

  /*
  |--------------------------------------------------------------------------
  | 1. JOBS
  |--------------------------------------------------------------------------
  */

  if (
    containsKeyword(
      text,
      jobKeywords
    )
  ) {
    return "jobs";
  }

  /*
  |--------------------------------------------------------------------------
  | 2. WORLD
  |--------------------------------------------------------------------------
  |
  | خبر جهانی قبل از اقتصادی بررسی می‌شود.
  | بنابراین:
  |
  | «ترامپ درباره اقتصاد...»
  |
  | → world
  |--------------------------------------------------------------------------
  */

  if (
    sourceType === "world"
  ) {
    return "world";
  }

  /*
  |--------------------------------------------------------------------------
  | اگر نشانه قوی جهانی در تیتر باشد
  |--------------------------------------------------------------------------
  */

  const titleText = normalizeText(title);

  if (
    containsKeyword(
      titleText,
      worldKeywords
    )
  ) {
    return "world";
  }

  /*
  |--------------------------------------------------------------------------
  | 3. JAM
  |--------------------------------------------------------------------------
  */

  if (
    isJamNews(
      title,
      summary
    )
  ) {
    return "jam";
  }

  /*
  |--------------------------------------------------------------------------
  | 4. POLITICAL OVERRIDE
  |--------------------------------------------------------------------------
  |
  | چون فقط ۴ دسته داریم، اخبار سیاسی عمومی
  | را در world یا economic نمی‌فرستیم.
  |
  | در صورت سیاسی بودن ولی محلی نبودن:
  | اگر کلمه اقتصادی قوی ندارد → از default استفاده می‌کنیم.
  |--------------------------------------------------------------------------
  */

  const hasPolitical =
    containsKeyword(
      text,
      politicalKeywords
    );

  /*
  |--------------------------------------------------------------------------
  | 5. ECONOMIC
  |--------------------------------------------------------------------------
  */

  if (
    containsKeyword(
      text,
      economicStrongKeywords
    )
  ) {
    /*
    اگر خبر سیاسی است ولی موضوع اقتصادی مشخص دارد،
    economic قابل قبول است.
    */
    return "economic";
  }

  /*
  |--------------------------------------------------------------------------
  | 6. پیش‌فرض
  |--------------------------------------------------------------------------
  */

  if (
    VALID_SECTIONS.includes(
      defaultSection
    )
  ) {
    return defaultSection;
  }

  return "economic";
}

/*
|--------------------------------------------------------------------------
| بررسی خبر تکراری
|--------------------------------------------------------------------------
*/

async function newsExists(
  sourceUrl,
  title
) {
  let url;

  if (sourceUrl) {
    const encodedUrl =
      encodeURIComponent(sourceUrl);

    url =
      SUPABASE_URL +
      "/rest/v1/jamcity_content" +
      "?select=id" +
      "&source_url=eq." +
      encodedUrl +
      "&limit=1";
  } else {
    const encodedTitle =
      encodeURIComponent(title);

    url =
      SUPABASE_URL +
      "/rest/v1/jamcity_content" +
      "?select=id" +
      "&title=eq." +
      encodedTitle +
      "&limit=1";
  }

  const response = await fetch(
    url,
    {
      method: "GET",
      headers: {
        apikey:
          SUPABASE_SERVICE_ROLE_KEY,
        Authorization:
          "Bearer " +
          SUPABASE_SERVICE_ROLE_KEY,
      },
    }
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      "Supabase duplicate check failed: " +
        response.status +
        " " +
        errorText
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

  /*
  |--------------------------------------------------------------------------
  | امنیت:
  | فقط ۴ دسته اجازه ورود به دیتابیس دارند.
  |--------------------------------------------------------------------------
  */

  if (
    !VALID_SECTIONS.includes(section)
  ) {
    console.error(
      "INVALID SECTION → " +
        section +
        " | " +
        item.title
    );

    return false;
  }

  const record = {
    section: section,

    title: item.title,

    summary:
      item.summary,

    content:
      item.summary,

    source_name:
      feed.name,

    source_url:
      item.source_url,

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
    const errorText =
      await response.text();

    console.error(
      'Supabase insert error for "' +
        item.title +
        '":',
      errorText
    );

    return false;
  }

  const jamStatus =
    isJamNews(
      item.title,
      item.summary
    );

  console.log(
    "ADDED [" +
      section +
      "] " +
      feed.name +
      " | JAM:" +
      (jamStatus ? "1" : "0") +
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
    "Categories: JAM / JOBS / ECONOMIC / WORLD"
  );

  console.log(
    "JAM detection: city/region specific"
  );

  console.log(
    "Standalone 'جم': DISABLED"
  );

  console.log(
    "Generic 'امام جمعه': NOT JAM"
  );

  console.log(
    "World detection runs BEFORE economic"
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
        await fetchUrl(
          feed.url
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

main().catch(function (error) {
  console.error(
    "FATAL ERROR:",
    error
  );

  process.exit(1);
});
```
