const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

async function callRpc() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/publish_next_gold_wall_ad`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_actor: process.env.PROMO_ACTOR_ID || null }),
  });

  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase RPC ${response.status}: ${body}`);
  return body ? JSON.parse(body) : null;
}

const result = await callRpc();
if (!result) {
  console.log("No approved gold business is available; nothing was published.");
} else {
  console.log(`Published gold business ad: ${result.business_id} / ${result.id}`);
}
