const https = require("https");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    keywords: ["اقتصاد", "بازار", "بورس", "دلار", "ارز", "بانک", "نفت"],
  },

  {
    name: "ایسنا",
    url: "https://www.isna.ir/rss",
    section: "jam",
    keywords: ["جم", "عسلویه", "پارس جنوبی", "بوشهر", "پتروشیمی"],
  },

  {
    name: "تسنیم",
    url: "https://www.tasnimnews.com/fa/rss",
    section: "economic",
    keywords: ["اقتصاد", "بورس", "دلار", "نفت", "پتروشیمی"],
  },

  // منابع خارجی
  {
    name: "BBC",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    section: "world",
    keywords: [
      "world",
      "international",
      "iran",
      "usa",
      "europe",
      "china",
      "russia",
    ],
  },

  {
    name: "Reuters",
    url: "https://feeds.reuters.com/reuters/worldNews",
    section: "world",
    keywords: [
      "world",
      "iran",
      "usa",
      "china",
      "russia",
      "europe",
      "market",
    ],
  },
];

/*
|--------------------------------------------------------------------------
| دریافت RSS
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
          if (response.statusCode >= 200 && response.statusCode < 400) {
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
| استخراج XML
|--------------------------------------------------------------------------
*/

function getTag(item, tag) {
  const regex = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
    "i"
  );

  const match = item.match(regex);

  if (!match) return "";

  return stripHtml(match[1]);
}

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

    if (!title) continue;

    items.push({
      title,
      summary: description || null,
      source_url: link || null,
      published_at: pubDate
        ? new Date(pubDate).toISOString()
        : new Date().toISOString(),
    });
  }

  return items;
}

/*
|--------------------------------------------------------------------------
| تعیین دسته خبر
|--------------------------------------------------------------------------
*/

function detectSection(title, summary, defaultSection, keywords) {
  const text = `${title} ${summary || ""}`.toLowerCase();

  /*
   * اخبار جم و عسلویه
   */

  const jamKeywords = [
    "جم",
    "عسلویه",
    "پارس جنوبی",
    "پتروشیمی",
    "بوشهر",
  ];

  if (jamKeywords.some((keyword) => text.includes(keyword))) {
    return "jam";
  }

  /*
   * فرصت شغلی
   */

  const jobKeywords = [
    "استخدام",
    "استخدامی",
    "فرصت شغلی",
    "کاریابی",
    "شغل",
    "job",
    "jobs",
    "career",
    "vacancy",
  ];

  if (jobKeywords.some((keyword) => text.includes(keyword))) {
    return "jobs";
  }

  /*
   * اقتصادی
   */

  const economicKeywords = [
    "اقتصاد",
    "اقتصادی",
    "بورس",
    "دلار",
    "ارز",
    "بانک",
    "نفت",
    "طلا",
    "بازار",
    "تورم",
    "اقتصادی",
    "economy",
    "economic",
    "market",
    "oil",
    "gold",
    "dollar",
  ];

  if (
    economicKeywords.some((keyword) =>
      text.includes(keyword.toLowerCase())
    )
  ) {
    return "economic";
  }

  /*
   * اگر منبع از قبل دسته مشخص داشته باشد
   */

  if (defaultSection) {
    return defaultSection;
  }

  return "world";
}

/*
|--------------------------------------------------------------------------
| بررسی وجود خبر تکراری
|--------------------------------------------------------------------------
*/

async function newsExists(sourceUrl, title) {
  const encodedTitle = encodeURIComponent(title);

  let url =
    `${SUPABASE_URL}/rest/v1/jamcity_content` +
    `?select=id` +
    `&title=eq.${encodedTitle}` +
    `&limit=1`;

  if (sourceUrl) {
    const encodedUrl = encodeURIComponent(sourceUrl);

    url =
      `${SUPABASE_URL}/rest/v1/jamcity_content` +
      `?select=id` +
      `&source_url=eq.${encodedUrl}` +
      `&limit=1`;
  }

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Supabase duplicate check failed: ${response.status}`
    );
  }

  const data = await response.json();

  return Array.isArray(data) && data.length > 0;
}

/*
|--------------------------------------------------------------------------
| ذخیره خبر در Supabase
|--------------------------------------------------------------------------
*/

async function saveNews(item, feed) {
  const exists = await newsExists(
    item.source_url,
    item.title
  );

  if (exists) {
    console.log(`SKIP duplicate: ${item.title}`);
    return false;
  }

  const section = detectSection(
    item.title,
    item.summary,
    feed.section,
    feed.keywords
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
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
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
  console.log("========================================");
  console.log("       JAM CITY AUTOMATIC NEWS");
  console.log("========================================");
  console.log("");

  let total = 0;
  let added = 0;

  for (const feed of FEEDS) {
    console.log(`\nSOURCE: ${feed.name}`);
    console.log(`URL: ${feed.url}`);

    try {
      const xml = await fetchUrl(feed.url);

      const items = parseRSS(xml);

      console.log(`Found ${items.length} items`);

      /*
       * حداکثر 10 خبر از هر منبع
       */

      for (const item of items.slice(0, 10)) {
        total++;

        try {
          const saved = await saveNews(item, feed);

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
}

main().catch((error) => {
  console.error("FATAL ERROR:", error);
  process.exit(1);
});