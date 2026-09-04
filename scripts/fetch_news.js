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
| فقط همین ۴ دسته
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
  {
    name: "مهر",
    url: "https://www.mehrnews.com/rss",
    sourceType: "iran",
  },

  {
    name: "ایسنا",
    url: "https://www.isna.ir/rss",
    sourceType: "iran",
  },

  {
    name: "تسنیم",
    url: "https://www.tasnimnews.com/fa/rss",
    sourceType: "iran",
  },

  {
    name: "ایرنا",
    url: "https://www.irna.ir/rss",
    sourceType: "iran",
  },

  {
    name: "خبرآنلاین",
    url: "https://www.khabaronline.ir/rss",
    sourceType: "iran",
  },

  {
    name: "شانا",
    url: "https://www.shana.ir/rss",
    sourceType: "iran",
  },

  {
    name: "اتحاد خبر",
    url: "https://www.ettehadkhabar.ir/fa/rss",
    sourceType: "south",
  },

  {
    name: "بامداد جنوب",
    url: "https://bamdadjonoub.ir/feed/",
    sourceType: "south",
  },

  {
    name: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    sourceType: "world",
  },

  {
    name: "Reuters World",
    url: "https://feeds.reuters.com/reuters/worldNews",
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
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 JamCityNewsBot/3.0",
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
    .replace(/\u200c/g, " ")
    .replace(/\u200f/g, " ")
    .replace(/\u200e/g, " ")
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

    if (key && normalized.includes(key)) {
      return true;
    }
  }

  return false;
}

/*
|--------------------------------------------------------------------------
| کلمات دقیق جم
|--------------------------------------------------------------------------
*/

const jamKeywords = [
  "شهرستان جم",
  "شهر جم",
  "فرمانداری جم",
  "فرماندار جم",
  "شهرداری جم",
  "شهردار جم",
  "شورای شهر جم",
  "شورای اسلامی شهر جم",
  "شورای اسلامی شهرستان جم",
  "نماینده جم",
  "نماینده شهرستان جم",
  "پتروشیمی جم",
  "انارستان جم",
  "ریز جم",
  "انارستان",
  "ریز",
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
  "فرصت های شغلی",
  "فرصت‌های شغلی",
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
| کلمات اقتصادی
|--------------------------------------------------------------------------
*/

const economicKeywords = [
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
  "طلای ۲۴ عیار",
  "طلای 24 عیار",
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
  "اقتصاد کشور",
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
  "پتروشیمی",
  "نفت",
  "گاز",
  "انرژی",
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
| موضوعات سیاسی / عمومی که اقتصادی نیستند
|--------------------------------------------------------------------------
*/

const politicalKeywords = [
  "امام جمعه",
  "امام‌جمعه",
  "خطیب جمعه",
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
  "نماز جمعه",
  "سخنان",
];

/*
|--------------------------------------------------------------------------
| تشخیص خبر جم
|--------------------------------------------------------------------------
|
| مهم:
| فقط نشانه مستقیم جم قبول می‌شود.
|
| «عسلویه»، «کنگان»، «بوشهر»، «پارس جنوبی»
| به تنهایی JAM نیستند.
|
|--------------------------------------------------------------------------
*/

function isJamNews(title, summary) {
  const text = normalizeText(
    String(title || "") +
      " " +
      String(summary || "")
  );

  /*
  |----------------------------------------------------------------------
  | امام جمعه
  |----------------------------------------------------------------------
  |
  | اگر خبر امام جمعه باشد، فقط امام جمعه جم مجاز است.
  |
  */

  if (
    text.includes("امام جمعه") ||
    text.includes("امام‌جمعه") ||
    text.includes("خطیب جمعه") ||
    text.includes("نماز جمعه")
  ) {
    if (
      containsKeyword(text, [
        "امام جمعه جم",
        "امام جمعه شهرستان جم",
        "امام‌جمعه جم",
        "امام‌جمعه شهرستان جم",
        "خطیب جمعه جم",
        "نماز جمعه جم",
        "نماز جمعه شهرستان جم",
      ])
    ) {
      return true;
    }

    return false;
  }

  /*
  |----------------------------------------------------------------------
  | نشانه‌های قطعی جم
  |----------------------------------------------------------------------
  */

  if (
    containsKeyword(
      text,
      jamKeywords
    )
  ) {
    return true;
  }

  return false;
}

/*
|--------------------------------------------------------------------------
| آیا خبر سیاسی عمومی و غیر اقتصادی است؟
|--------------------------------------------------------------------------
*/

function isGenericPoliticalNews(title, summary) {
  const text = normalizeText(
    String(title || "") +
      " " +
      String(summary || "")
  );

  return containsKeyword(
    text,
    politicalKeywords
  );
}

/*
|--------------------------------------------------------------------------
| تشخیص دسته خبر
|--------------------------------------------------------------------------
*/

function detectSection(
  title,
  summary,
  sourceType
) {
  const fullText = normalizeText(
    String(title || "") +
      " " +
      String(summary || "")
  );

  const titleText = normalizeText(
    title
  );

  /*
  |----------------------------------------------------------------------
  | 1. JOBS
  |----------------------------------------------------------------------
  */

  if (
    containsKeyword(
      fullText,
      jobKeywords
    )
  ) {
    return "jobs";
  }

  /*
  |----------------------------------------------------------------------
  | 2. WORLD
  |----------------------------------------------------------------------
  |
  | منابع جهانی همیشه WORLD هستند.
  |
  */

  if (sourceType === "world") {
    return "world";
  }

  /*
  |----------------------------------------------------------------------
  | خبرهایی که تیترشان نشانه جهانی دارد
  |----------------------------------------------------------------------
  */

  if (
    containsKeyword(
      titleText,
      worldKeywords
    )
  ) {
    return "world";
  }

  /*
  |----------------------------------------------------------------------
  | 3. JAM
  |----------------------------------------------------------------------
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
  |----------------------------------------------------------------------
  | 4. ECONOMIC
  |----------------------------------------------------------------------
  |
  | فقط اگر واقعاً اقتصادی باشد.
  |
  */

  const hasEconomic =
    containsKeyword(
      fullText,
      economicKeywords
    );

  /*
  |----------------------------------------------------------------------
  | اگر سیاسی است ولی نشانه اقتصادی ندارد:
  | اصلاً ذخیره نمی‌شود.
  |----------------------------------------------------------------------
  */

  if (
    isGenericPoliticalNews(
      title,
      summary
    ) &&
    !hasEconomic
  ) {
    return null;
  }

  /*
  |----------------------------------------------------------------------
  | خبر اقتصادی واقعی
  |----------------------------------------------------------------------
  */

  if (hasEconomic) {
    return "economic";
  }

  /*
  |----------------------------------------------------------------------
  | هیچ دسته‌ای پیدا نشد.
  |----------------------------------------------------------------------
  */

  return null;
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
      encodeURIComponent(
        sourceUrl
      );

    url =
      SUPABASE_URL +
      "/rest/v1/jamcity_content" +
      "?select=id" +
      "&source_url=eq." +
      encodedUrl +
      "&limit=1";
  } else {
    const encodedTitle =
      encodeURIComponent(
        title
      );

    url =
      SUPABASE_URL +
      "/rest/v1/jamcity_content" +
      "?select=id" +
      "&title=eq." +
      encodedTitle +
      "&limit=1";
  }

  const response =
    await fetch(
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
  /*
  |----------------------------------------------------------------------
  | اول دسته را مشخص می‌کنیم
  |----------------------------------------------------------------------
  */

  const section =
    detectSection(
      item.title,
      item.summary,
      feed.sourceType
    );

  /*
  |----------------------------------------------------------------------
  | خبر نامرتبط → ذخیره نشود
  |----------------------------------------------------------------------
  */

  if (!section) {
    console.log(
      "SKIP irrelevant: " +
        item.title
    );

    return false;
  }

  /*
  |----------------------------------------------------------------------
  | امنیت دسته
  |----------------------------------------------------------------------
  */

  if (
    !VALID_SECTIONS.includes(
      section
    )
  ) {
    console.log(
      "SKIP invalid section: " +
        section +
        " | " +
        item.title
    );

    return false;
  }

  /*
  |----------------------------------------------------------------------
  | بررسی تکراری
  |----------------------------------------------------------------------
  */

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

  /*
  |----------------------------------------------------------------------
  | ذخیره
  |----------------------------------------------------------------------
  */

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
          JSON.stringify(
            record
          ),
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

  console.log(
    "ADDED [" +
      section +
      "] " +
      feed.name +
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
    "JAM: only direct JAM-related news"
  );

  console.log(
    "Generic Imam Jomeh: BLOCKED"
  );

  console.log(
    "Generic political news: BLOCKED"
  );

  console.log(
    "Generic news without category: BLOCKED"
  );

  console.log(
    "World detection: PRIORITY"
  );

  console.log(
    "Economic: ONLY real economic keywords"
  );

  console.log("");

  let total = 0;

  let added = 0;

  let failedSources = 0;

  let skipped = 0;

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
      |--------------------------------------------------------------------
      | حداکثر ۱۰ خبر از هر منبع
      |--------------------------------------------------------------------
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
          } else {
            skipped++;
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
    "SKIPPED: " +
      skipped
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