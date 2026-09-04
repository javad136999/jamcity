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
| منابع خبری - فقط همین ۴ منبع، هرکدوم مخصوص یک دسته
|--------------------------------------------------------------------------
| نکته: هر ۴ آدرس همون‌هایی هستن که خودت دادی. برای jonoubostan.ir حدس زدم
| که چون وردپرسه، /feed/ کار کنه (وردپرس تقریباً همیشه این مسیر رو داره).
| برای بقیه، اگه صفحه واقعا RSS نباشه، پارسر خودش می‌افته روی حالت
| HTML-scraping (پایین‌تر توضیح داده شده). بعد از اولین اجرا (workflow_dispatch)
| لاگ رو چک کن: اگه یه منبع "Found 0 items" داد یا "SOURCE FAILED" داد،
| بگو تا دقیق‌ترش کنیم.
|--------------------------------------------------------------------------
*/

const FEEDS = [
  {
    name: "جنوب استان (jonoubostan)",
    url: "https://jonoubostan.ir/feed/",
    section: "jam",
    fetchLimit: 30, // چون فیلتر جم سخت‌گیرانه‌ست، تعداد بیشتری کاندید لازم داریم
  },
  {
    name: "پارسیک - اقتصادی",
    url: "https://www.parseek.com/Economic/",
    section: "economic",
    fetchLimit: 15,
  },
  {
    name: "شهرخبر - جهان",
    url: "https://www.shahrekhabar.com/اخبار-جهان",
    section: "world",
    fetchLimit: 15,
  },
  {
    name: "بازارکار",
    url: "https://bazarekar.ir/",
    section: "jobs",
    fetchLimit: 15,
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
| بلاک‌های CDATA قبل از حذف تگ‌ها باز می‌شوند، وگرنه regex عمومی حذف تگ
| کل بلاک <![CDATA[متن خبر]]> را - چون تا اولین ">" را می‌بلعد - با متن
| خبر یکجا پاک می‌کند و عنوان/خلاصه خالی می‌شود.
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
| تشخیص XML بودن محتوا
|--------------------------------------------------------------------------
*/

function looksLikeXML(raw) {
  const head = raw.slice(0, 500);

  return /<\?xml|<rss[\s>]|<feed[\s>]/i.test(head);
}

/*
|--------------------------------------------------------------------------
| Fallback: استخراج خبر از صفحه HTML ساده (وقتی RSS نیست)
|--------------------------------------------------------------------------
| این تابع لینک‌های داخل صفحه رو پیدا می‌کند و آن‌هایی را که متن‌شان به
| اندازه‌ی یک تیتر خبر است (نه یک آیتم منو کوتاه) نگه می‌دارد. برای
| صفحاتی مثل پارسیک/بازارکار/شهرخبر که خودشان RSS ندارند استفاده می‌شود.
|--------------------------------------------------------------------------
*/

function parseHTMLLinks(html, feed) {
  const items = [];
  const seen = new Set();

  const anchorRegex = /<a\b[^>]*href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  let baseOrigin = null;

  try {
    baseOrigin = new URL(feed.url).origin;
  } catch (error) {
    baseOrigin = null;
  }

  while ((match = anchorRegex.exec(html)) !== null) {
    const rawHref = match[1];
    const text = stripHtml(match[2]);

    if (!text || text.length < 15 || text.length > 220) {
      continue;
    }

    if (/^(javascript:|mailto:|tel:)/i.test(rawHref)) {
      continue;
    }

    if (/\/(tag|category|author|login|register|about|contact|rss|feed)s?(\/|$|\?)/i.test(rawHref)) {
      continue;
    }

    let absoluteUrl = rawHref;

    if (absoluteUrl.startsWith("//")) {
      absoluteUrl = "https:" + absoluteUrl;
    } else if (absoluteUrl.startsWith("/")) {
      if (!baseOrigin) {
        continue;
      }

      absoluteUrl = baseOrigin + absoluteUrl;
    } else if (!/^https?:\/\//i.test(absoluteUrl)) {
      continue;
    }

    if (seen.has(absoluteUrl)) {
      continue;
    }

    seen.add(absoluteUrl);

    items.push({
      title: text,
      summary: null,
      source_url: absoluteUrl,
      published_at: new Date().toISOString(),
    });
  }

  return items;
}

/*
|--------------------------------------------------------------------------
| انتخاب پارسر مناسب (RSS یا HTML)
|--------------------------------------------------------------------------
*/

function parseFeed(raw, feed) {
  if (looksLikeXML(raw)) {
    const rssItems = parseRSS(raw);

    if (rssItems.length > 0) {
      return { items: rssItems, mode: "rss" };
    }
  }

  return { items: parseHTMLLinks(raw, feed), mode: "html" };
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
| 🚫 اخبار کاملاً ممنوع (امام جمعه) - روی هر ۴ منبع اعمال می‌شود
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

function isBlockedNews(title, summary) {
  const text = normalizeText(String(title || "") + " " + String(summary || ""));

  return containsKeyword(text, BLOCKED_RELIGIOUS_NEWS);
}

/*
|--------------------------------------------------------------------------
| کلمات سیاسی - فقط برای فیلتر منبع «جم» استفاده می‌شود
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
| JAM Keywords - فقط اسم‌های مکانیِ واقعی منطقه (نه کلمات عمومی صنعتی)
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

const jamBlockedKeywords = [
  // شهرهای دیگه استان بوشهر (چون jonoubostan کل جنوب رو پوشش می‌ده)
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

  // استان‌های دیگه / شهرهای صنعتی خارج از منطقه جم
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
  "آبادان",
  "ماهشهر",
  "بندرماهشهر",
  "اهواز",
  "خوزستان",
];

function isJamNews(title, summary) {
  const titleText = normalizeText(String(title || ""));
  const summaryText = normalizeText(String(summary || ""));
  const fullText = titleText + " " + summaryText;

  if (containsKeyword(fullText, jamBlockedKeywords)) {
    return false;
  }

  if (!containsKeyword(fullText, jamStrongKeywords)) {
    return false;
  }

  if (containsKeyword(fullText, politicalKeywords)) {
    return false;
  }

  return true;
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
| چون هر فید مخصوص یک دسته‌ی مشخص است، دیگر نیازی به حدس‌زدن دسته از
| روی کلیدواژه نیست - همان feed.section مستقیم استفاده می‌شود. فقط برای
| «جم» چون منبعش کل جنوب کشور را پوشش می‌دهد، فیلتر مکانی سخت‌گیرانه
| (isJamNews) هنوز روی آن اجرا می‌شود.
|--------------------------------------------------------------------------
*/

async function saveNews(item, feed) {
  if (isBlockedNews(item.title, item.summary)) {
    console.log("SKIP religious: " + item.title);
    return false;
  }

  if (!VALID_SECTIONS.includes(feed.section)) {
    console.error("INVALID SECTION on feed → " + feed.section + " | " + feed.name);
    return false;
  }

  if (feed.section === "jam" && !isJamNews(item.title, item.summary)) {
    console.log("SKIP not jam-specific: " + item.title);
    return false;
  }

  const exists = await newsExists(item.source_url, item.title);

  if (exists) {
    console.log("SKIP duplicate: " + item.title);
    return false;
  }

  const record = {
    section: feed.section,
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

  console.log("ADDED [" + feed.section + "] " + feed.name + " | " + item.title);

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
  console.log("       JAM CITY DAILY NEWS (v2)");
  console.log("========================================");
  console.log("");
  console.log("۴ منبع اختصاصی: jam=jonoubostan | economic=parseek | world=shahrekhabar | jobs=bazarekar");
  console.log("🚫 اخبار امام جمعه/نماز جمعه: حذف می‌شود");
  console.log("");

  let total = 0;
  let added = 0;
  let skipped = 0;
  let failedSources = 0;

  for (const feed of FEEDS) {
    console.log("");
    console.log("SOURCE: " + feed.name + " [" + feed.section + "]");
    console.log("URL: " + feed.url);

    try {
      const raw = await fetchUrl(feed.url);
      const parsed = parseFeed(raw, feed);

      console.log("Parse mode: " + parsed.mode + " | Found " + parsed.items.length + " candidate items");

      if (parsed.items.length === 0) {
        console.log("⚠️  هیچ آیتمی پیدا نشد - ممکنه ساختار صفحه با پارسر عمومی سازگار نباشه، این منبع را باید دستی بررسی کرد.");
      }

      const limit = feed.fetchLimit || 10;

      for (const item of parsed.items.slice(0, limit)) {
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