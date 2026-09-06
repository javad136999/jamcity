const https = require("https");

/*
|--------------------------------------------------------------------------
| Supabase
|--------------------------------------------------------------------------
*/

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRSAPI_KEY = process.env.BRSAPI_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BRSAPI_KEY) {
  console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or BRSAPI_KEY environment variables.");
  process.exit(1);
}

/*
|--------------------------------------------------------------------------
| نگاشت دقیق: هر آیتم دقیقاً می‌گوید در کدام آرایه‌ی پاسخ BrsApi
| (gold / currency / cryptocurrency) و با کدام symbol واقعی پیدا شود.
| این نگاشت از روی نمونه‌ی واقعی پاسخ BrsApi (که کاربر فرستاد) تایید شده.
|--------------------------------------------------------------------------
| نکته «مثقال طلا»: در پاسخ رایگان BrsApi اصلاً وجود ندارد (فقط ۱۸عیار،
| ۲۴عیار، طلای آب‌شده نقدی، و انس طلا هست). فعلاً «طلای آب‌شده نقدی»
| جایگزینش شده - اگر بعداً خواستید حذف/عوض شود همین جدول را ویرایش کنید.
|--------------------------------------------------------------------------
| نکته «نفت برنت»: در این نمونه اصلاً برنگشته (Gold_Currency فقط طلا/ارز/
| کریپتو دارد). اگر در پاسخ Commodity.php پیدا شود، یک ردیف برایش این‌جا
| با apiGroup متناسب اضافه کنید (کد پایین خودش هر آرایه‌ی موجود در پاسخ
| Commodity را هم به‌عنوان یک گروه کاندید ثبت می‌کند).
|--------------------------------------------------------------------------
*/

const WANTED_ITEMS = [
  { ourSymbol: "gold_ons", apiGroup: "gold", apiSymbol: "XAUUSD", name_fa: "انس طلا", category: "gold" },
  { ourSymbol: "gold_18", apiGroup: "gold", apiSymbol: "IR_GOLD_18K", name_fa: "طلا ۱۸ عیار", category: "gold" },
  { ourSymbol: "coin_emami", apiGroup: "gold", apiSymbol: "IR_COIN_EMAMI", name_fa: "سکه امامی", category: "gold" },
  { ourSymbol: "usd", apiGroup: "currency", apiSymbol: "USD", name_fa: "دلار", category: "currency" },
  { ourSymbol: "tether", apiGroup: "currency", apiSymbol: "USDT_IRT", name_fa: "تتر", category: "crypto" },
  { ourSymbol: "bitcoin", apiGroup: "cryptocurrency", apiSymbol: "BTC", name_fa: "بیت کوین", category: "crypto" },
  // نفت برنت: بعد از دیدن پاسخ Commodity.php این خط تکمیل می‌شود، مثلاً:
  // { ourSymbol: "brent_oil", apiGroup: "commodity", apiSymbol: "BRENT_OIL", name_fa: "نفت برنت", category: "commodity" },
];

/*
|--------------------------------------------------------------------------
| دریافت URL با Retry (JSON)
|--------------------------------------------------------------------------
*/

function fetchJson(url, retries = 2) {
  return new Promise(function (resolve, reject) {
    function attempt(number) {
      https
        .get(
          url,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JamCityMarketBot/1.0",
              Accept: "application/json",
            },
          },
          function (response) {
            let data = "";
            response.setEncoding("utf8");
            response.on("data", function (chunk) {
              data += chunk;
            });
            response.on("end", function () {
              if (response.statusCode < 200 || response.statusCode >= 400) {
                if (number < retries) {
                  console.log("Retry " + number + "/" + retries + " → " + url);
                  setTimeout(function () {
                    attempt(number + 1);
                  }, 1000);
                  return;
                }
                reject(new Error("HTTP " + response.statusCode + " for " + url));
                return;
              }
              try {
                resolve(JSON.parse(data));
              } catch (error) {
                reject(new Error("Invalid JSON from " + url + ": " + error.message));
              }
            });
          }
        )
        .on("error", function (error) {
          if (number < retries) {
            console.log("Retry " + number + "/" + retries + " → " + url);
            setTimeout(function () {
              attempt(number + 1);
            }, 1000);
            return;
          }
          reject(error);
        });
    }
    attempt(1);
  });
}

function toNumber(value) {
  if (value === undefined || value === null) return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/*
|--------------------------------------------------------------------------
| ذخیره در Supabase (upsert روی symbol)
|--------------------------------------------------------------------------
*/

async function upsertPrice(record) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/market_prices", {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("Supabase upsert failed for " + record.symbol + ": " + response.status + " " + errorText);
  }
}

/*
|--------------------------------------------------------------------------
| اجرای اصلی
|--------------------------------------------------------------------------
*/

async function main() {
  console.log("");
  console.log("========================================");
  console.log("     JAM CITY MARKET PRICES");
  console.log("========================================");
  console.log("");

  const goldCurrencyUrl = "https://Api.BrsApi.ir/Market/Gold_Currency.php?key=" + BRSAPI_KEY;
  const commodityUrl = "https://BrsApi.ir/Api/Market/Commodity.php?key=" + BRSAPI_KEY;

  const groups = {};

  try {
    const goldCurrencyData = await fetchJson(goldCurrencyUrl);
    groups.gold = goldCurrencyData.gold || [];
    groups.currency = goldCurrencyData.currency || [];
    groups.cryptocurrency = goldCurrencyData.cryptocurrency || [];
    console.log(
      "Gold_Currency OK — gold:" + groups.gold.length + " currency:" + groups.currency.length + " crypto:" + groups.cryptocurrency.length
    );
  } catch (error) {
    console.error("FAILED to fetch Gold_Currency: " + error.message);
  }

  try {
    const commodityData = await fetchJson(commodityUrl);
    // ساختار Commodity.php هنوز تایید نشده - همه‌ی کلیدهای سطح بالا را
    // به‌عنوان کاندید گروه ثبت می‌کنیم تا هرچه بود پیدا شود.
    console.log("Commodity raw response: " + JSON.stringify(commodityData).slice(0, 2000));
    for (const key of Object.keys(commodityData)) {
      if (Array.isArray(commodityData[key])) {
        groups[key] = commodityData[key];
      }
    }
  } catch (error) {
    console.error("FAILED to fetch Commodity (may need Pro plan, or different field name): " + error.message);
  }

  let saved = 0;
  let missing = 0;

  for (const wanted of WANTED_ITEMS) {
    const list = groups[wanted.apiGroup] || [];
    const match = list.find((item) => item.symbol === wanted.apiSymbol);

    if (!match) {
      console.log("NOT FOUND: " + wanted.name_fa + " (group: " + wanted.apiGroup + ", symbol: " + wanted.apiSymbol + ")");
      missing++;
      continue;
    }

    const price = toNumber(match.price);
    const changeValue = toNumber(match.change_value); // کریپتو معمولاً change_value ندارد → 0
    const changePercent = toNumber(match.change_percent);

    const record = {
      symbol: wanted.ourSymbol,
      name_fa: wanted.name_fa,
      category: wanted.category,
      unit: match.unit || null,
      price: price,
      change_value: changeValue,
      change_percent: changePercent,
      is_up: changePercent >= 0,
      updated_at: new Date().toISOString(),
    };

    try {
      await upsertPrice(record);
      console.log("SAVED: " + wanted.name_fa + " = " + price + " " + (match.unit || "") + " (" + changePercent + "%)");
      saved++;
    } catch (error) {
      console.error("SAVE FAILED for " + wanted.name_fa + ": " + error.message);
    }
  }

  console.log("");
  console.log("========================================");
  console.log("SAVED: " + saved + " / " + WANTED_ITEMS.length);
  console.log("NOT FOUND: " + missing);
  console.log("========================================");
  console.log("");
}

main().catch(function (error) {
  console.error("FATAL ERROR:", error);
  process.exit(1);
});
