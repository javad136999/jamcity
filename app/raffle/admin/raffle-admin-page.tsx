"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/Feedback";

// NOTE: this assumes `profile.role === "admin"` marks an admin user.
// Adjust this check to match whatever field you actually use to flag
// admins in your `profiles` table.

type Winner = {
  id: string;
  phone: string;
  label: string;
  amount: number | null;
  given: boolean;
  created_at: string;
};

export default function RaffleAdminPage() {
  const supabase = createClient();
  const { user, profile, loading: authLoading } = useAuth() as any;

  const [loading, setLoading] = useState(true);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [totalSpins, setTotalSpins] = useState(0);
  const [prizesLeft, setPrizesLeft] = useState(0);
  const [winners, setWinners] = useState<Winner[]>([]);

  const isAdmin = !!profile && profile.role === "admin";

  async function loadStats() {
    setLoading(true);

    const { count: participantsCount } = await supabase
      .from("raffle_participants")
      .select("id", { count: "exact", head: true });
    setTotalParticipants(participantsCount ?? 0);

    const { count: spinsCount } = await supabase
      .from("raffle_spins")
      .select("id", { count: "exact", head: true });
    setTotalSpins(spinsCount ?? 0);

    const { count: prizesLeftCount } = await supabase
      .from("raffle_segments")
      .select("id", { count: "exact", head: true })
      .eq("type", "prize")
      .eq("is_available", true);
    setPrizesLeft(prizesLeftCount ?? 0);

    const { data: winnersData, error } = await supabase
      .from("raffle_spins")
      .select("id,phone,label,amount,given,created_at")
      .eq("is_win", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load winners:", error.message);
    }
    setWinners((winnersData ?? []) as Winner[]);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function toggleGiven(id: string, given: boolean) {
    setWinners((prev) => prev.map((w) => (w.id === id ? { ...w, given } : w)));
const { error } = await supabase
  .from("raffle_spins")
  .update({ given } as never)
  .eq("id", id);
    if (error) {
      console.error("Failed to update given status:", error.message);
      // revert on failure
      setWinners((prev) => prev.map((w) => (w.id === id ? { ...w, given: !given } : w)));
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="در حال بررسی دسترسی..." />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div dir="rtl" className="mx-auto max-w-md p-8 text-center">
        <p className="text-sm font-bold text-[#1D2B1F]">
          این صفحه فقط برای مدیران سایته.
        </p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-2xl space-y-4 bg-[#F7F9F4] px-4 py-8">
      <h1 className="text-xl font-black text-[#1D2B1F]">پنل آمار قرعه‌کشی</h1>

      <div className="grid grid-cols-3 gap-3">
        <StatBox label="شرکت‌کننده‌ها" value={totalParticipants} />
        <StatBox label="چرخش‌های انجام‌شده" value={totalSpins} />
        <StatBox label="جوایز باقی‌مانده" value={prizesLeft} />
      </div>

      <div className="rounded-[20px] border border-[#E3EBDE] bg-white p-4">
        <h2 className="mb-3 text-[13px] font-black text-[#1D2B1F]">برندگان</h2>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner label="در حال بارگذاری..." />
          </div>
        ) : winners.length === 0 ? (
          <p className="text-center text-[12px] text-[#8A968C]">هنوز برنده‌ای نداریم</p>
        ) : (
          <ul className="divide-y divide-[#F3F6F1]">
            {winners.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-bold text-[#1D2B1F]" dir="ltr">
                    {w.phone}
                  </p>
                  <p className="text-[11px] text-[#D98F2B]">
                    {w.label}
                    {w.amount ? ` (${new Intl.NumberFormat("fa-IR").format(w.amount)} تومان)` : ""}
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={w.given}
                    onChange={(e) => toggleGiven(w.id, e.target.checked)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  <span className={w.given ? "text-[#147A4B]" : "text-[#8A968C]"}>
                    {w.given ? "هدیه داده شد" : "هدیه داده نشد"}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#E3EBDE] bg-white p-3 text-center">
      <p className="text-lg font-black text-[#1D2B1F]">
        {new Intl.NumberFormat("fa-IR").format(value)}
      </p>
      <p className="text-[10px] text-[#8A968C]">{label}</p>
    </div>
  );
}
