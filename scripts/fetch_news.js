const https = require("https");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const VALID_SECTIONS = ["jam", "jobs", "economic", "world"];

const RSS_FEEDS = [
  {
    url: "https://www.mehrnews.com/rss",
    sourceName: "خبرگزاری مهر",
    sourceType: "iran",
  },
  {
    url: "https://www.isna.ir/rss",
    sourceName: "ایسنا",
    sourceType: "iran",
  },
  {
    url: "https://www.tasnimnews.com/fa/rss",
    sourceName: "تسنیم",
    sourceType: "iran",
  },
  {
    url: "https://www.irna.ir/rss",
    sourceName: "ایرنا",
    sourceType: "iran",
  },
  {
    url: "https://www.khabaronline.ir/rss",
    sourceName: "خبرآنلاین",
    sourceType: "iran",
  },
  {
    url: "https://www.shana.ir/rss",
    sourceName: "شانا",
    sourceType: "iran",
  },
  {
    url: "https://www.ettehadkhabar.ir/fa/rss",
    sourceName: "اتحاد خبر",
    sourceType: "south",
  },
  {
    url: "https://bamdadjonoub.ir/feed/",
    sourceName: "بامداد جنوب",
    sourceType: "south",
  },
  {
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    sourceName: "BBC World",
    sourceType: "world",
  },
];

const SPECIAL_HTML_SOURCES = [
  {
    url: "https://www.mehrnews.com/tag/%D8%A8%D9%88%D8%B4%D9%87%D8%B1",
    sourceName: "خبرگزاری مهر - بوشهر",
    sourceType: "jam",
  },
  {
    url: "https://khabarfarsi.com/city/71",
    sourceName: "خبر فارسی - شهرستان جم",
    sourceType: "jam",
  },
];

const BLOCKED_RELIGIOUS_KEYWORDS = [
  "امام جمعه",
  "امام‌جمعه",
  "ائمه جمعه",
  "ائمه‌جمعه",
  "خطیب جمعه",
  "نماز جمعه",
  "نمازجمعه",
  "خطبه جمعه",
  "خطبه‌های نماز جمعه",
  "سخنان امام جمعه",
  "دیدار با امام جمعه",
  "دیدار امام جمعه",
  "دفتر امام جمعه",
  "ستاد نماز جمعه",
  "مصلای نماز جمعه",
  "مصلی نماز جمعه",
];

const JOB_KEYWORDS = [
  "استخدام",
  "استخدامی",
  "جذب نیرو",
  "فرصت شغلی",
  "کاریابی",
  "شغل",
  "کارآفرینی",
  "آزمون استخدامی",
  "ثبت نام استخدام",
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

const ECONOMIC_STRONG_KEYWORDS = [
  "بورس",
  "بازار سرمایه",
  "شاخص بورس",
  "فرابورس",
  "سهام",
  "دلار",
  "نرخ ارز",
  "ارز دیجیتال",
  "رمزارز",
  "بیت کوین",
  "بیت‌کوین",
  "اتریوم",
  "تتر",
  "طلا",
  "سکه",
  "بانک مرکزی",
  "نرخ بهره",
  "وام",
  "تورم",
  "مالیات",
  "سرمایه گذاری",
  "سرمایه‌گذاری",
  "مسکن",
  "خودرو",
  "رشد اقتصادی",
  "اقتصاد ایران",
  "وزارت اقتصاد",
  "بودجه",
  "نفت",
  "بنزین",
  "صادرات",
  "تعرفه",
  "تحریم",
  "گمرک",
  "تجارت",
  "بازار ارز",
  "قیمت دلار",
  "قیمت طلا",
];

const ECONOMIC_WEAK_KEYWORDS = [
  "قیمت",
  "نرخ",
  "بازار",
  "اقتصاد",
  "اقتصادی",
  "کالا",
  "واردات",
  "صادرات",
  "گرانی",
  "ارزان",
];

const WORLD_KEYWORDS = [
  "آمریکا",
  "ترامپ",
  "اسرائیل",
  "غزه",
  "فلسطین",
  "حماس",
  "لبنان",
  "اوکراین",
  "روسیه",
  "انگلیس",
  "فرانسه",
  "آلمان",
  "اروپا",
  "ناتو",
  "چین",
  "ژاپن",
  "کره",
  "هند",
  "ترکیه",
  "پاکستان",
  "افغانستان",
  "عراق",
  "سوریه",
  "یمن",
  "عربستان",
  "امارات",
  "قطر",
  "بحرین",
  "بین‌المللی",
  "بین المللی",
  "جهان",
  "سازمان ملل",
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

const JAM_KEYWORDS = [
  "جم",
  "شهر جم",
  "شهرستان جم",
  "فرمانداری جم",
  "فرماندار جم",
  "شهرداری جم",
  "شهردار جم",
  "شورای شهر جم",
  "شورای اسلامی شهر جم",
  "نماینده جم",
  "ریز",
  "بخش ریز",
  "ریز شهرستان جم",
  "انارستان",
  "بخش انارستان",
  "عسلویه",
  "شهرستان عسلویه",
  "کنگان",
  "شهرستان کنگان",
  "پارس جنوبی",
  "پتروشیمی جم",
  "مجتمع پتروشیمی جم",
  "پالایشگاه جم",
  "نفت و گاز",
  "پتروشیمی",
  "تأسیسات نفتی",
  "تاسیسات نفتی",
  "تأسیسات گازی",
  "تاسیسات گازی",
];

const JAM_BLOCKED_KEYWORDS = [
  "بوشهر",
  "بندر بوشهر",
  "برازجان",
  "دشتستان",
  "گناوه",
  "دیلم",
  "تنگستان",
  "دشتی",
  "اهرم",
  "خورموج",
  "خارک",
  "بندر خارک",
  "پتروشیمی خارک",
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
  "ورزقان",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchUrl(url, retries = 2) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; JamCityNewsBot/5.0; +https://jamapp.ir)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml;q=0.9,*/*;q=0.8",
        },
        timeout: 30000,
      },
      (res) => {
        const status = res.statusCode || 0;

        if (
          [301, 302, 303, 307, 308].includes(status) &&
          res.headers.location
        ) {
          res.resume();

          const nextUrl = new URL(res.headers.location, url).toString();

          fetchUrl(nextUrl, retries)
            .then(resolve)
            .catch(reject);

          return;
        }

        let data = "";

        res.setEncoding("utf8");

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (status >= 200 && status < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${status} for ${url}`));
          }
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error(`Timeout: ${url}`));
    });

    request.on("error", async (error) => {
      if (retries > 0) {
        console.log(`Retrying ${url}...`);
        await sleep(1500);
        fetchUrl(url, retries - 1)
          .then(resolve)
          .catch(reject);
      } else {
        reject(error);
      }
    });
  });
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[/gi, "")
    .replace(/\]\]>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      try {
        return String.fromCodePoint(parseInt(n, 16));
      } catch {
        return "";
      }
    })
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value = "") {
  return stripHtml(value)
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function containsKeyword(text, keywords) {
  const normalized = normalizeText(text);
  return keywords.some((keyword) =>
    normalized.includes(normalizeText(keyword))
  );
}

function decodeHtmlEntities(value = "") {
  return stripHtml(value);
}

function getTag(block, tagName) {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const match = block.match(
    new RegExp(
      `<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`,
      "i"
    )
  );

  if (!match) return "";

  return decodeHtmlEntities(match[1]);
}

function getAttribute(tag, attribute) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const match = tag.match(
    new RegExp(`${escaped}\\s*=\\s*["']([^"']+)["']`, "i")
  );

  return match ? decodeHtmlEntities(match[1]) : "";
}

function parseRSS(xml) {
  const items = [];

  const matches = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  for (const item of matches) {
    const title = getTag(item, "title");
    const link = getTag(item, "link");
    const description =
      getTag(item, "description") ||
      getTag(item, "content:encoded") ||
      getTag(item, "summary");

    const pubDate =
      getTag(item, "pubDate") ||
      getTag(item, "published") ||
      getTag(item, "updated");

    if (!title || !link) continue;

    items.push({
      title: stripHtml(title),
      link: stripHtml(link),
      description: stripHtml(description),
      pubDate: pubDate ? new Date(pubDate).toISOString() : null,
    });
  }

  return items;
}

function extractMeta(html, names) {
  for (const name of names) {
    const regex = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      "i"
    );

    const reverseRegex = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )}["'][^>]*>`,
      "i"
    );

    const match = html.match(regex) || html.match(reverseRegex);

    if (match && match[1]) {
      return decodeHtmlEntities(match[1]);
    }
  }

  return "";
}

function extractCanonical(html) {
  const match = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i
  );

  if (match) return decodeHtmlEntities(match[1]);

  const reverse = html.match(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i
  );

  return reverse ? decodeHtmlEntities(reverse[1]) : "";
}

function extractJsonLd(html) {
  const scripts = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
  ) || [];

  for (const script of scripts) {
    const jsonText = script
      .replace(/<script[^>]*>/i, "")
      .replace(/<\/script>/i, "")
      .trim();

    try {
      const parsed = JSON.parse(jsonText);

      const candidates = Array.isArray(parsed)
        ? parsed
        : parsed["@graph"]
        ? parsed["@graph"]
        : [parsed];

      for (const item of candidates) {
        if (!item || typeof item !== "object") continue;

        if (
          item["@type"] === "NewsArticle" ||
          item["@type"] === "Article" ||
          item.headline ||
          item.datePublished
        ) {
          return item;
        }
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  }

  return null;
}

function parseArticlePage(html, fallbackTitle, fallbackUrl) {
  const jsonLd = extractJsonLd(html);

  const title =
    (jsonLd && (jsonLd.headline || jsonLd.name)) ||
    extractMeta(html, ["og:title", "twitter:title"]) ||
    fallbackTitle;

  const description =
    (jsonLd && (jsonLd.description || jsonLd.articleBody)) ||
    extractMeta(html, [
      "description",
      "og:description",
      "twitter:description",
    ]);

  const image =
    (jsonLd &&
      jsonLd.image &&
      (typeof jsonLd.image === "string"
        ? jsonLd.image
        : jsonLd.image.url)) ||
    extractMeta(html, ["og:image", "twitter:image"]);

  const published =
    (jsonLd && (jsonLd.datePublished || jsonLd.dateCreated)) ||
    extractMeta(html, [
      "article:published_time",
      "date",
      "pubdate",
    ]);

  const canonical = extractCanonical(html) || fallbackUrl;

  let publishedAt = null;

  if (published) {
    const date = new Date(published);

    if (!Number.isNaN(date.getTime())) {
      publishedAt = date.toISOString();
    }
  }

  return {
    title: stripHtml(title).trim(),
    summary: stripHtml(description).slice(0, 1000),
    content: stripHtml(description).slice(0, 5000),
    imageUrl: image || null,
    publishedAt,
    sourceUrl: canonical,
  };
}

function extractHtmlLinks(html, baseUrl) {
  const results = [];
  const seen = new Set();

  const anchorRegex =
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const rawText = match[2];

    const title = stripHtml(rawText);

    if (!href || !title || title.length < 12) continue;

    let absoluteUrl;

    try {
      absoluteUrl = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }

    if (!absoluteUrl.startsWith("https://")) continue;

    const lowerUrl = absoluteUrl.toLowerCase();

    if (
      lowerUrl.includes("/tag/") ||
      lowerUrl.includes("/category/") ||
      lowerUrl.includes("/search") ||
      lowerUrl.includes("#")
    ) {
      continue;
    }

    const isMehrArticle =
      absoluteUrl.includes("mehrnews.com/news/");

    const isKhabarfarsiArticle =
      absoluteUrl.includes("khabarfarsi.com/u/") ||
      absoluteUrl.includes("khabarfarsi.com/ua/");

    if (!isMehrArticle && !isKhabarfarsiArticle) continue;

    if (seen.has(absoluteUrl)) continue;

    seen.add(absoluteUrl);

    results.push({
      title,
      link: absoluteUrl,
    });

    if (results.length >= 20) break;
  }

  return results;
}

async function fetchSpecialHtmlSource(source) {
  console.log(`\nFetching special source: ${source.sourceName}`);
  console.log(source.url);

  try {
    const html = await fetchUrl(source.url);

    const links = extractHtmlLinks(html, source.url);

    console.log(`Found ${links.length} candidate article links`);

    const items = [];

    for (const link of links.slice(0, 12)) {
      try {
        const articleHtml = await fetchUrl(link.link);

        const article = parseArticlePage(
          articleHtml,
          link.title,
          link.link
        );

        items.push({
          ...article,
          link: article.sourceUrl || link.link,
        });

        await sleep(300);
      } catch (error) {
        console.log(
          `Article fetch failed: ${link.link} - ${error.message}`
        );

        items.push({
          title: link.title,
          summary: "",
          content: "",
          imageUrl: null,
          publishedAt: null,
          link: link.link,
        });
      }
    }

    return items;
  } catch (error) {
    console.error(
      `Special source failed: ${source.sourceName} - ${error.message}`
    );

    return [];
  }
}

function isBlockedReligious(title, summary) {
  return containsKeyword(
    `${title} ${summary}`,
    BLOCKED_RELIGIOUS_KEYWORDS
  );
}

function isJamNews(title, summary) {
  const text = `${title} ${summary}`;

  if (isBlockedReligious(title, summary)) {
    return false;
  }

  const normalized = normalizeText(text);

  const hasJam = JAM_KEYWORDS.some((keyword) =>
    normalized.includes(normalizeText(keyword))
  );

  if (!hasJam) return false;

  const blockedOtherCity = JAM_BLOCKED_KEYWORDS.some((keyword) =>
    normalized.includes(normalizeText(keyword))
  );

  if (blockedOtherCity && !normalized.includes("جم")) {
    return false;
  }

  return true;
}

function detectSection(title, summary, defaultSection, sourceType) {
  if (isBlockedReligious(title, summary)) {
    return null;
  }

  if (containsKeyword(`${title} ${summary}`, JOB_KEYWORDS)) {
    return "jobs";
  }

  if (
    sourceType === "world" ||
    containsKeyword(`${title} ${summary}`, WORLD_KEYWORDS)
  ) {
    return "world";
  }

  if (isJamNews(title, summary)) {
    return "jam";
  }

  if (
    containsKeyword(
      `${title} ${summary}`,
      ECONOMIC_STRONG_KEYWORDS
    )
  ) {
    return "economic";
  }

  if (
    defaultSection === "economic" &&
    containsKeyword(
      `${title} ${summary}`,
      ECONOMIC_WEAK_KEYWORDS
    )
  ) {
    return null;
  }

  return null;
}

async function newsExists(sourceUrl, title) {
  const url =
    `${SUPABASE_URL}/rest/v1/jamcity_content` +
    `?select=id&or=(source_url.eq.${encodeURIComponent(
      sourceUrl
    )},title.eq.${encodeURIComponent(title)})&limit=1`;

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

async function saveNews(item, source) {
  const title = stripHtml(item.title);
  const summary = stripHtml(item.summary || "");
  const content = stripHtml(item.content || summary);

  if (!title) {
    return false;
  }

  if (isBlockedReligious(title, summary)) {
    console.log(`BLOCKED RELIGIOUS: ${title}`);
    return false;
  }

  const section = detectSection(
    title,
    summary,
    source.defaultSection || null,
    source.sourceType
  );

  if (!section || !VALID_SECTIONS.includes(section)) {
    console.log(`SKIPPED: ${title}`);
    return false;
  }

  if (section === "jam" && !isJamNews(title, summary)) {
    console.log(`SKIPPED NON-JAM: ${title}`);
    return false;
  }

  const sourceUrl = item.link;

  if (!sourceUrl) {
    return false;
  }

  try {
    const exists = await newsExists(sourceUrl, title);

    if (exists) {
      console.log(`DUPLICATE: ${title}`);
      return false;
    }
  } catch (error) {
    console.error(`Duplicate check error: ${error.message}`);
    return false;
  }

  const publishedAt =
    item.publishedAt &&
    !Number.isNaN(new Date(item.publishedAt).getTime())
      ? new Date(item.publishedAt).toISOString()
      : new Date().toISOString();

  const record = {
    section,
    title: title.slice(0, 500),
    summary: summary.slice(0, 1500),
    content: content.slice(0, 8000),
    source_name: source.sourceName,
    source_url: sourceUrl,
    image_url: item.imageUrl || null,
    symbol: null,
    sentiment: null,
    target_price: null,
    is_automatic: true,
    is_published: true,
    published_at: publishedAt,
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
      `Supabase insert failed: ${response.status} - ${errorText}`
    );

    return false;
  }

  console.log(`SAVED [${section}] ${title}`);

  return true;
}

async function processRSSFeed(feed) {
  console.log(`\nFetching RSS: ${feed.sourceName}`);

  try {
    const xml = await fetchUrl(feed.url);
    const items = parseRSS(xml);

    console.log(`Found ${items.length} RSS items`);

    let saved = 0;

    for (const item of items.slice(0, 15)) {
      const success = await saveNews(item, {
        sourceName: feed.sourceName,
        sourceType: feed.sourceType,
      });

      if (success) {
        saved++;
      }
    }

    return saved;
  } catch (error) {
    console.error(
      `RSS source failed: ${feed.sourceName} - ${error.message}`
    );

    return 0;
  }
}

async function processSpecialSource(source) {
  const items = await fetchSpecialHtmlSource(source);

  let saved = 0;

  for (const item of items) {
    let allowed = true;

    if (source.sourceType === "jam") {
      const text = `${item.title} ${item.summary}`;

      /*
       * خبر فارسی /city/71 صفحه اختصاصی شهرستان جم است.
       * بنابراین تمام خبرهای آن صفحه به عنوان خبر جم بررسی می‌شوند.
       */
      if (source.sourceName.includes("خبر فارسی")) {
        allowed = !isBlockedReligious(
          item.title,
          item.summary
        );
      } else {
        allowed = isJamNews(
          item.title,
          item.summary
        );
      }
    }

    if (!allowed) {
      console.log(`SPECIAL SKIPPED: ${item.title}`);
      continue;
    }

    const success = await saveNews(item, {
      sourceName: source.sourceName,
      sourceType: source.sourceType,
    });

    if (success) {
      saved++;
    }
  }

  return saved;
}

async function main() {
  console.log("==========================================");
  console.log("Jam City Automatic News Fetcher 5.0");
  console.log("==========================================");
  console.log(`Time: ${new Date().toISOString()}`);

  let totalSaved = 0;

  for (const feed of RSS_FEEDS) {
    totalSaved += await processRSSFeed(feed);
  }

  for (const source of SPECIAL_HTML_SOURCES) {
    totalSaved += await processSpecialSource(source);
  }

  console.log("==========================================");
  console.log(`TOTAL NEW NEWS SAVED: ${totalSaved}`);
  console.log("==========================================");
}

main().catch((error) => {
  console.error("FATAL ERROR:", error);
  process.exit(1);
});