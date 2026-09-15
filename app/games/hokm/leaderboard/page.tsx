"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type StatRow = {
  user_id: string;
  total_games: number;
  wins: number;
  losses: number;
  rating: number;
  current_streak: number;
  best_streak: number;
};

type ProfileRow = { id: string; display_name: string | null };
type RankingRow = StatRow & { display_name: string };

const medals = ["🥇", "🥈", "🥉"];

export default function HokmLeaderboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRanking() {
      setLoading(true);
      setError("");

      const { data: stats, error: statsError } = await supabase
        .from("hokm_player_stats")
        .select("user_id,total_games,wins,losses,rating,current_streak,best_streak")
        .gt("total_games", 0)
        .order("rating", { ascending: false })
        .order("wins", { ascending: false })
        .limit(50);

      if (statsError) {
        setError("دریافت جدول قهرمانان با خطا روبه‌رو شد.");
        setLoading(false);
        return;
      }

      const statRows = (stats ?? []) as StatRow[];
      const ids = statRows.map((row) => row.user_id);
      const profiles = ids.length
        ? await supabase.from("profiles").select("id,display_name").in("id", ids)
        : { data: [], error: null };

      if (profiles.error) {
        setError("نام بازیکنان دریافت نشد.");
        setLoading(false);
        return;
      }

      const names = new Map(
        ((profiles.data ?? []) as ProfileRow[]).map((profile) => [
          profile.id,
          profile.display_name?.trim() || "بازیکن جم",
        ])
      );

      setRows(
        statRows.map((row) => ({
          ...row,
          display_name: names.get(row.user_id) || "بازیکن جم",
        }))
      );
      setLoading(false);
    }

    loadRanking();
  }, [supabase]);

  return (
    <main dir="rtl" className="min-h-screen bg-[linear-gradient(180deg,#FFF9F1_0%,#F4FAF5_100%)] px-3 py-6 text-[#3A2920] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/games/hokm" className="text-xs font-bold text-[#1E8151]">← بازگشت به بازی حکم</Link>

        <header className="mt-5 rounded-[28px] border border-[#EACD96] bg-gradient-to-l from-[#FFF0D0] to-white p-6 text-center shadow-[0_12px_30px_rgba(201,121,32,.12)]">
          <div className="text-5xl">🏆</div>
          <h1 className="mt-2 text-2xl font-black">قهرمانان حکم</h1>
          <p className="mt-2 text-xs text-[#6E5D52]">برترین بازیکنان جم بر اساس امتیاز و تعداد برد</p>
        </header>

        {error && <p className="mt-4 rounded-2xl bg-[#FFE6E0] p-3 text-center text-xs font-bold text-[#B43E35]">{error}</p>}

        <section className="mt-4 overflow-hidden rounded-[24px] border border-[#E9DED0] bg-white shadow-sm">
          <div className="grid grid-cols-[42px_1fr_62px_62px] gap-2 border-b border-[#E9DED0] bg-[#FFF8EF] px-3 py-3 text-[10px] font-black text-[#8C7B6D] sm:grid-cols-[60px_1fr_90px_90px]">
            <span>رتبه</span><span>بازیکن</span><span className="text-center">برد</span><span className="text-center">امتیاز</span>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-[#8C7B6D]">در حال دریافت قهرمانان...</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#8C7B6D]">هنوز آماری برای نمایش وجود ندارد.</div>
          ) : (
            <div>
              {rows.map((row, index) => {
                const winRate = row.total_games ? Math.round((row.wins / row.total_games) * 100) : 0;
                return (
                  <div key={row.user_id} className={`grid grid-cols-[42px_1fr_62px_62px] items-center gap-2 border-b border-[#F1EAE3] px-3 py-3 last:border-b-0 sm:grid-cols-[60px_1fr_90px_90px] ${index < 3 ? "bg-[#FFFDF8]" : ""}`}>
                    <span className="text-center text-lg">{medals[index] || <span className="text-xs font-black text-[#8C7B6D]">{index + 1}</span>}</span>
                    <div className="min-w-0"><p className="truncate text-xs font-black sm:text-sm">{row.display_name}</p><p className="mt-1 text-[9px] text-[#8C7B6D]">{row.total_games} بازی · برد {winRate}٪</p></div>
                    <span className="text-center text-sm font-black text-[#1E8151]">{row.wins}</span>
                    <span className="text-center text-sm font-black text-[#C97920]">{row.rating}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
