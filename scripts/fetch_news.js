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
  // منابع داخلی
  {
    name: "مهر",
    url: "https://www.mehrnews.com/rss",
    section: "economic",
  },
  {
    name: "ایسنا",
    url: "https://www.isna.ir/rss",
    section: "economic",
  },
  {
    name: "تسنیم",
    url: "https://www.tasnimnews.com/fa/rss",
    section: "economic",
  },

  // منابع خارجی
  {
    name: "BBC",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    section: "world",
  },
  {
    name: "Reuters",
    url: "https://feeds.reuters.com/reuters/worldNews",
    section: "world",
  },
];

/*
|--------------------------------------------------------------------------
| دریافت URL
|--------------------------------------------------------------------------
*/

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "JamCityNewsBot/1.0",
          Accept:
            "application/rss+xml, application/xml, text/xml, text/html",
        },
      },
      (response) => {
        let data = "";

        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
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

    request.on("error", reject);

    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error(`Timeout: ${url}`));
    });
  });
}

/*
|--------------------------------------------------------------------------
| پاکسازی HTML
|--------------------------------------------------------------------------
*/

function stripHtml(text = "") {
  return text
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
| استخراج تگ XML
|--------------------------------------------------------------------------
*/

function getTag(item, tag) {
  const regex = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
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
      title,
      summary: description || null,
      source_url: link || null,
      published_at: publishedAt,
    });
  }

  return items;
}

/*
|--------------------------------------------------------------------------
| تشخیص دسته خبر
|--------------------------------------------------------------------------
*/

function detectSection(title, summary, defaultSection) {
  const text =
    `${title || ""} ${summary || ""}`.toLowerCase();

  /*
  |--------------------------------------------------------------------------
  | اخبار جم، عسلویه، پارس جنوبی و پتروشیمی
  |--------------------------------------------------------------------------
  */

  const jamKeywords = [
    "جم",
    "عسلویه",
    "پارس جنوبی",
    "پتروشیمی",
    "بوشهر",
    "کنگان",
    "دیر",
    "نخل تقی",
    "منطقه ویژه پارس",
  ];

  if (
    jamKeywords.some((keyword) =>
      text.includes(keyword.toLowerCase())
    )
  ) {
    return "jam";
  }

  /*
  |--------------------------------------------------------------------------
  | فرصت‌های شغلی
  |--------------------------------------------------------------------------
  */

  const jobKeywords = [
    "استخدام",
    "استخدامی",
    "فرصت شغلی",
    "فرصت‌های شغلی",
    "کاریابی",
    "شغل",
    "کارآفرینی",
    "job",
    "jobs",
    "career",
    "vacancy",
    "recruitment",
  ];

  if (
    jobKeywords.some((keyword) =>
      text.includes(keyword.toLowerCase())
    )
  ) {
    return "jobs";
  }

  /*
  |--------------------------------------------------------------------------
  | اخبار اقتصادی
  |--------------------------------------------------------------------------
  */

  const economicKeywords = [
    "اقتصاد",
    "اقتصادی",
    "بورس",
    "دلار",
    "ارز",
    "بانک",
    "بانکی",
    "نفت",
    "طلا",
    "سکه",
    "بازار",
    "تورم",
    "سرمایه‌گذاری",
    "سرمایه گذاری",
    "پول",
    "مالیات",
    "صادرات",
    "واردات",
    "سهام",
    "شاخص",
    "قیمت",
    "economy",
    "economic",
    "market",
    "oil",
    "gold",
    "dollar",
    "stock",
    "stocks",
    "finance",
  ];

  if (
    economicKeywords.some((keyword) =>
      text.includes(keyword.toLowerCase())
    )
  ) {
    return "economic";
  }

  /*
  |--------------------------------------------------------------------------
  | در صورت نبودن کلمه کلیدی
  |--------------------------------------------------------------------------
  */

  if (
    defaultSection === "economic" ||
    defaultSection === "world" ||
    defaultSection === "jam" ||
    defaultSection === "jobs"
  ) {
    return defaultSection;
  }

  return "world";
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

    url =
      `${SUPABASE_URL}/rest/v1/jamcity_content` +
      `?select=id` +
      `&source_url=eq.${encodedUrl}` +
      `&limit=1`;
  } else {
    const encodedTitle = encodeURIComponent(title);

    url =
      `${SUPABASE_URL}/rest/v1/jamcity_content` +
      `?select=id` +
      `&title=eq.${encodedTitle}` +
      `&limit=1`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization:
        `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Supabase duplicate check failed: ${response.status} ${errorText}`
    );
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
  const exists = await newsExists(
    item.source_url,
    item.title
  );

  if (exists) {
    console.log(
      `SKIP duplicate: ${item.title}`
    );

    return false;
  }

  const section = detectSection(
    item.title,
    item.summary,
    feed.section
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

    published_at: item.published_at,
  };

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/jamcity_content`,
    {
      method: "POST",

      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,

        Authorization:
          `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

        "Content-Type": "application/json",

        Prefer: "return=minimal",
      },

      body: JSON.stringify(record),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      `Supabase insert error for "${item.title}":`,
      errorText
    );

    return false;
  }

  console.log(
    `ADDED [${section}] ${feed.name}: ${item.title}`
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
  console.log("========================================");
  console.log("       JAM CITY AUTOMATIC NEWS");
  console.log("========================================");
  console.log("");

  let total = 0;
  let added = 0;

  for (const feed of FEEDS) {
    console.log("");
    console.log(`SOURCE: ${feed.name}`);
    console.log(`URL: ${feed.url}`);

    try {
      const xml = await fetchUrl(feed.url);

      const items = parseRSS(xml);

      console.log(`Found ${items.length} items`);

      /*
      |--------------------------------------------------------------------------
      | حداکثر 10 خبر از هر منبع
      |--------------------------------------------------------------------------
      */

      for (const item of items.slice(0, 10)) {
        total++;

        try {
          const saved = await saveNews(
            item,
            feed
          );

          if (saved) {
            added++;
          }
        } catch (error) {
          console.error(
            `Error processing news: ${item.title}`,
            error.message
          );
        }
      }
    } catch (error) {
      console.error(
        `SOURCE FAILED: ${feed.name}`,
        error.message
      );
    }
  }

  console.log("");
  console.log("========================================");
  console.log(`TOTAL: ${total}`);
  console.log(`ADDED: ${added}`);
  console.log("========================================");
  console.log("");
}

main().catch((error) => {
  console.error("FATAL ERROR:", error);

  process.exit(1);
});