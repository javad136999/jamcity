"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { uploadImages } from "@/lib/upload";
import { AVATAR_PRESETS } from "@/lib/constants";
import Avatar from "@/components/Avatar";

export default function AvatarPicker() {
  const { user, profile, refreshProfile } = useAuth();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  async function setAvatar(value: string) {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({ avatar_url: value }).eq("id", user.id);
    await refreshProfile();
    setSaving(false);
    setOpen(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setSaving(true);
    try {
      const [url] = await uploadImages([file], "avatars", user.id);
      await setAvatar(url);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl2 glass p-6 shadow-soft">
      <div className="flex items-center gap-4">
        <Avatar url={profile?.avatar_url} name={profile?.display_name} size={64} />
        <div className="flex-1">
          <p className="font-bold text-slate-800">عکس پروفایل</p>
          <p className="text-xs text-slate-400">یک عکس آپلود کنید یا یک کاراکتر انتخاب کنید</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-xl2 bg-jam-green px-4 py-2 text-xs font-bold text-white shadow-glow">
          {saving ? "در حال ذخیره..." : "📷 آپلود عکس"}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </label>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl2 border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700"
        >
          🎭 انتخاب کاراکتر
        </button>
      </div>

      {open && (
        <div className="space-y-3 rounded-xl2 border border-slate-200 bg-white p-4">
          <div>
            <p className="mb-2 text-xs font-bold text-slate-500">کاراکتر خانم</p>
            <div className="flex flex-wrap gap-2">
              {AVATAR_PRESETS.female.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatar(`emoji:${emoji}`)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-2xl transition hover:scale-110"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-slate-500">کاراکتر آقا</p>
            <div className="flex flex-wrap gap-2">
              {AVATAR_PRESETS.male.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatar(`emoji:${emoji}`)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-2xl transition hover:scale-110"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
