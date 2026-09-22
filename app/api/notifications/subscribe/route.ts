import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
    const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
    const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
    }

    if (!endpoint.startsWith("https://")) {
      return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?on_conflict=endpoint`,
      {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          endpoint,
          p256dh,
          auth,
          user_agent: request.headers.get("user-agent") || null,
          enabled: true,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    if (!response.ok) {
      const details = await response.text();
      console.error("Push subscription save failed:", response.status, details);
      return NextResponse.json({ error: "Could not save subscription" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push subscription route failed:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
