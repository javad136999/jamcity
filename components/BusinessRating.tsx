"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

export default function BusinessRating({
  businessId,
  initialAvg,
  initialCount,
}: {
  businessId: string;
  initialAvg: number;
  initialCount: number;
}) {
  const { user } = useAuth();
  const supabase = createClient();
  const [avg, setAvg] = useState(initialAvg);
  const [count, setCount] = useState(initialCount);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function submitRating(value: number) {
    if (!user || saving) return;
    setSaving(true);
    setMyRating(value);

    const { error } = await supabase
      .from("business_ratings")
      .upsert({ business_id: businessId, user_id: user.id, rating: value });

    if (!error) {
      const { data } = await supabase
        .from("businesses")
        .select("rating_avg, rating_count")
        .eq("id", businessId)
        .maybeSingle();
      if (data) {
        setAvg(data.rating_avg);
        setCount(data.rating_count);
      }
    }
    setSaving(false);
  }

  const display = hover ?? myRating ?? 0;

  return (
    <div className="space-y-2 rounded-xl2 border border-amber-100 bg-amber-50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-700">امتیاز این کسب و کار</p>
        {count > 0 && (
          <p className="text-xs text-slate-500">
            ⭐ {avg.toFixed(1)} از {count} نفر
          </p>
        )}
      </div>

      {user ? (
        <div className="flex items-center gap-1" dir="ltr">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={saving}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(null)}
              onClick={() => submitRating(n)}
              className={`text-2xl transition ${n <= display ? "text-yellow-400" : "text-slate-300"}`}
            >
              ★
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">برای ثبت امتیاز باید وارد شوید.</p>
      )}
    </div>
  );
}
