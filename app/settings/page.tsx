"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { AD_STATUS, categoryLabel, formatPrice } from "@/lib/constants";
import { EmptyState, Spinner } from "@/components/Feedback";
import AvatarPicker from "@/components/AvatarPicker";
import type { Database } from "@/lib/supabase/types";

type Ad = Database["public"]["Tables"]["ads"]["Row"];

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [ads, setAds] = useState<Ad[] | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("ads")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setAds((data as Ad[]) ?? []));
  }, [user, supabase]);

  async function updateStatus(adId: string, status: string) {
    await supabase
      .from("ads")
      .update({ status: status as Ad["status"] })
      .eq("id", adId);
    setAds((prev) =>
      prev
        ? prev.map((a) => (a.id === adId ? { ...a, status: status as Ad["status"] } : a))
        : prev
    );
  }

  async function deleteAd(adId: string) {
    if (!confirm("آیا از حذف این آگهی مطمئن هستید؟")) return;
    await supabase.from("ads").delete().eq("id", adId);
    setAds((prev) => (prev ? prev.filter((a) => a.id !== adId) : prev));
  }

  async function changePassword() {
    setPwMessage(null);
    if (newPassword.length < 6) {
      setPwMessage("رمز عبور باید حداقل ۶ کاراکتر باشد.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwMessage(error ? "خطا در تغییر رمز عبور." : "رمز عبور با موفقیت تغییر کرد.");
    setNewPassword("");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (authLoading) return <Spinner />;

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-8 py-4">
      <h1 className="text-2xl font-extrabold text-slate-800">تنظیمات</h1>

      <AvatarPicker />

      <div className="space-y-4 rounded-xl2 glass p-6 shadow-soft">
        <h2 className="font-bold text-slate-800">تغییر رمز عبور</h2>
        {pwMessage && <p className="text-xs text-jam-green">{pwMessage}</p>}
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="رمز عبور جدید"
          className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
        />
        <button
          onClick={changePassword}
          className="w-full rounded-xl2 bg-jam-green py-3 text-sm font-bold text-slate-800 shadow-glow transition hover:brightness-110"
        >
          تغییر رمز عبور
        </button>
      </div>

      <div className="space-y-4">
        <h2 className="font-bold text-slate-800">مدیریت آگهی‌ها</h2>
        {ads === null ? (
          <Spinner />
        ) : ads.length === 0 ? (
          <EmptyState icon="📋" title="آگهی‌ای برای مدیریت وجود ندارد" />
        ) : (
          <div className="space-y-3">
            {ads.map((ad) => (
              <div key={ad.id} className="flex flex-wrap items-center gap-3 rounded-xl2 glass p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{ad.title}</p>
                  <p className="text-xs text-slate-400">
                    {categoryLabel(ad.category)} · {formatPrice(ad.price)}
                  </p>
                </div>
                <select
                  value={ad.status}
                  onChange={(e) => updateStatus(ad.id, e.target.value)}
                  className="rounded-xl2 border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                >
                  {AD_STATUS.map((s) => (
                    <option key={s.value} value={s.value} className="bg-white">
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => deleteAd(ad.id)}
                  className="rounded-xl2 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="w-full rounded-xl2 border border-red-500/30 bg-red-500/10 py-3 text-sm font-bold text-red-400 transition hover:bg-red-500/20"
      >
        خروج از حساب
      </button>
    </div>
  );
}
