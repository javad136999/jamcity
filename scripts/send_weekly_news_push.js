const https = require("https");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  "BOcMqNkTb9soINz1FSyni8KXg5BMACDZ_zZ2xOBTqwl26vtcuVr-JKFHJT66gI7WXnn8PSAYi2TpqeVXzOC9-kg";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PRIVATE_KEY) {
  console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or VAPID_PRIVATE_KEY");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function supabase(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${text}`);
  }

  return data;
}

async function loadNews() {
  const params = new URLSearchParams({
    select: "id,title,summary,source_name,source_url,published_at",
    section: "eq.jam",
    is_published: "eq.true",
    order: "published_at.desc",
    limit: "3",
  });

  return supabase(`jamcity_content?${params.toString()}`);
}

async function loadSubscriptions() {
  const params = new URLSearchParams({
    select: "id,endpoint,p256dh,auth",
    enabled: "eq.true",
    order: "created_at.asc",
    limit: "5000",
  });

  return supabase(`push_subscriptions?${params.toString()}`);
}

async function disableSubscription(id) {
  await supabase(`push_subscriptions?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      enabled: false,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function markSent(id) {
  await supabase(`push_subscriptions?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ last_sent_at: new Date().toISOString() }),
  });
}

function makePayload(news) {
  const first = news[0];

  const body = first
    ? `📰 ${first.title}`
    : "تازه‌ترین خبرهای شهر جم در جم‌سیتی منتشر شد.";

  return JSON.stringify({
    title: "جم‌سیتی | خبرهای شهر جم",
    body: body.length > 125 ? `${body.slice(0, 122)}…` : body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "jamcity-weekly-news",
    renotify: false,
    data: {
      url: "https://jamapp.ir/news",
      newsId: first?.id || null,
    },
  });
}

async function main() {
  console.log("==========================================");
  console.log("Jam City Weekly News Push");
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("==========================================");

  // The action installs this dependency only for the sender; the Next.js app does not need it.
  const webpush = require("web-push");

  webpush.setVapidDetails(
    "mailto:admin@jamapp.ir",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  const [news, subscriptions] = await Promise.all([
    loadNews(),
    loadSubscriptions(),
  ]);

  console.log(`News: ${news.length} | Active subscriptions: ${subscriptions.length}`);

  if (!subscriptions.length) {
    console.log("No active subscribers. Nothing to send.");
    return;
  }

  const payload = makePayload(news);
  let sent = 0;
  let removed = 0;
  let failed = 0;

  for (const row of subscriptions) {
    const subscription = {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth,
      },
    };

    try {
      await webpush.sendNotification(subscription, payload, {
        TTL: 60 * 60 * 24,
        urgency: "normal",
      });

      await markSent(row.id);
      sent++;
      console.log(`SENT: ${row.id}`);
    } catch (error) {
      const status = error?.statusCode;

      if (status === 404 || status === 410) {
        await disableSubscription(row.id);
        removed++;
        console.log(`DISABLED GONE SUBSCRIPTION: ${row.id}`);
      } else {
        failed++;
        console.error(`PUSH FAILED ${row.id}: ${status || "unknown"} ${error?.message || error}`);
      }
    }

    // Keep the action friendly to push-service rate limits.
    await sleep(80);
  }

  console.log("==========================================");
  console.log(`SENT: ${sent} | DISABLED: ${removed} | FAILED: ${failed}`);
  console.log("==========================================");
}

main().catch((error) => {
  console.error("FATAL ERROR:", error);
  process.exit(1);
});
