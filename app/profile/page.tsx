"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { uploadImages } from "@/lib/upload";
import AdCard from "@/components/AdCard";
import Avatar from "@/components/Avatar";
import { EmptyState, Spinner } from "@/components/Feedback";
import type { Database } from "@/lib/supabase/types";

type Ad = Database["public"]["Tables"]["ads"]["Row"];

export default function ProfilePage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const supabase = createClient();

  const [ads, setAds] = useState<Ad[] | null>(null);
  const [deletingAdId, setDeletingAdId] = useState<string | null>(null);


  useEffect(() => {
    if (!user) return;
    supabase
      .from("ads")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setAds((data as Ad[]) ?? []));
  }, [user, supabase]);

  async function handleDeleteAd(adId: string) {
    if (!user || deletingAdId) return;
    if (!window.confirm("آیا از حذف این آگهی مطمئن هستید؟")) return;

    setDeletingAdId(adId);
    const { error } = await supabase
      .from("ads")
      .delete()
      .eq("id", adId)
      .eq("user_id", user.id);

    if (!error) {
      setAds((current) => (current ?? []).filter((ad) => ad.id !== adId));
    }
    setDeletingAdId(null);
  }

  if (authLoading || !profile) return <Spinner label="در حال بارگذاری پروفایل..." />;

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-6 py-4">
      <div className="flex items-center justify-between rounded-xl2 glass p-5 shadow-soft">
        <div>
          <h1 className="text-xl font-black text-slate-800">آگهی‌های من</h1>
          <p className="mt-1 text-xs text-slate-400">مدیریت و حذف آگهی‌های ثبت‌شده شما</p>
        </div>
        <Link
          href="/ad/create"
          className="rounded-xl2 bg-jam-green px-4 py-2.5 text-xs font-bold text-white shadow-glow transition hover:brightness-110"
        >
          + ثبت آگهی
        </Link>
      </div>

      {ads === null ? (
        <Spinner />
      ) : ads.length === 0 ? (
        <EmptyState icon="📋" title="هنوز آگهی ثبت نکرده‌اید" />
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => (
            <div key={ad.id} className="relative overflow-hidden rounded-xl2 glass p-3 shadow-soft">
              <div className="pr-0">
                <AdCard ad={ad} />
              </div>
              <button
                type="button"
                onClick={() => handleDeleteAd(ad.id)}
                disabled={deletingAdId === ad.id}
                className="absolute left-3 top-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600 ring-1 ring-red-100 transition hover:bg-red-100 disabled:opacity-50"
              >
                {deletingAdId === ad.id ? "در حال حذف..." : "🗑 حذف"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
