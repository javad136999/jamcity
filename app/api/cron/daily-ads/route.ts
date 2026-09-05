import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DAILY_PICK_COUNT = 10;
const LOOKBACK_DAYS = 14;
const AVOID_REPEAT_DAYS = 7;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

export async function GET(req: NextRequest) {
  // بررسی امنیت Cron
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    );
  }

  // بررسی متغیرهای Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "missing supabase env vars" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const today = new Date().toISOString().slice(0, 10);

  // آگهی‌های ۱۴ روز اخیر
  const sinceIso = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: candidates, error: candidatesError } = await supabase
    .from("wall_messages")
    .select("id")
    .not("image_url", "is", null)
    .not("content", "is", null)
    .gte("created_at", sinceIso);

  if (candidatesError) {
    return NextResponse.json(
      { error: candidatesError.message },
      { status: 500 }
    );
  }

  // آگهی‌هایی که در ۷ روز اخیر انتخاب شده‌اند
  const recentSince = new Date(
    Date.now() - AVOID_REPEAT_DAYS * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);

  const { data: recentlyPicked, error: recentError } = await supabase
    .from("wall_daily_picks")
    .select("message_id")
    .gte("picked_date", recentSince);

  if (recentError) {
    return NextResponse.json(
      { error: recentError.message },
      { status: 500 }
    );
  }

  const excludeIds = new Set(
    (recentlyPicked ?? []).map((row) => row.message_id)
  );

  let pool = (candidates ?? []).filter(
    (candidate) => !excludeIds.has(candidate.id)
  );

  // اگر آگهی کافی نبود، محدودیت تکرار را موقتاً کنار می‌گذاریم
  if (pool.length < DAILY_PICK_COUNT) {
    pool = candidates ?? [];
  }

  // انتخاب تصادفی ۱۰ آگهی
  const picks = shuffle(pool).slice(0, DAILY_PICK_COUNT);

  if (picks.length === 0) {
    return NextResponse.json({
      picked: 0,
      message: "no eligible ads found",
    });
  }

  const rows = picks.map((pick) => ({
    message_id: pick.id,
    picked_date: today,
  }));

  const { error: insertError } = await supabase
    .from("wall_daily_picks")
    .upsert(rows, {
      onConflict: "message_id,picked_date",
      ignoreDuplicates: true,
    });

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    picked: rows.length,
    date: today,
  });
}