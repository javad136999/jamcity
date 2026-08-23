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

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ads, setAds] = useState<Ad[] | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setUsername(profile.username);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("ads")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setAds((data as Ad[]) ?? []));
  }, [user, supabase]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !e.target.files?.[0]) return;
    const [url] = await uploadImages([e.target.files[0]], "avatars", user.id);
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    await refreshProfile();
  }

  async function handleSave() {
    if (!user) return;
    setMessage(null);
    setSaving(true);

    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      setMessage("نام کاربری نامعتبر است.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim(), username: cleanUsername })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      setMessage("این نام کاربری قبلاً استفاده شده یا خطایی رخ داد.");
    } else {
      setMessage("تغییرات ذخیره شد.");
      await refreshProfile();
    }
  }

  if (authLoading || !profile) return <Spinner label="در حال بارگذاری پروفایل..." />;

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-8 py-4">
      <div className="flex flex-col items-center gap-4 rounded-xl2 glass p-6 shadow-soft">
        <div className="relative">
          <span className="flex h-24 w-24 overflow-hidden rounded-full bg-jam-darkgreen">
            <Avatar url={profile.avatar_url} name={profile.display_name} size={96} />
          </span>
          <label className="absolute bottom-0 left-0 cursor-pointer rounded-full bg-jam-green p-2 text-xs shadow-glow">
            📷
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
        </div>
        <Link href="/settings" className="text-xs font-bold text-jam-green hover:underline">
          🎭 انتخاب کاراکتر پروفایل
        </Link>
        <div className="text-center">
          <p className="text-lg font-bold text-slate-800">{profile.display_name}</p>
          <p className="text-xs text-slate-400" dir="ltr">@{profile.username}</p>
          <p className="mt-1 text-xs text-slate-800/30">
            عضویت از{" "}
            {new Date(profile.created_at).toLocaleDateString("fa-IR")}
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-xl2 glass p-6 shadow-soft">
        <h2 className="font-bold text-slate-800">ویرایش پروفایل</h2>
        {message && <p className="text-xs text-jam-green">{message}</p>}
        <div className="space-y-1">
          <label className="text-xs text-slate-500">نام نمایشی</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">نام کاربری</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            dir="ltr"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl2 bg-jam-green py-3 text-sm font-bold text-slate-800 shadow-glow transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-800">آگهی‌های من</h2>
          <Link href="/ad/create" className="text-xs font-bold text-jam-green hover:underline">
            + ثبت آگهی جدید
          </Link>
        </div>
        {ads === null ? (
          <Spinner />
        ) : ads.length === 0 ? (
          <EmptyState icon="📋" title="هنوز آگهی ثبت نکرده‌اید" />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
