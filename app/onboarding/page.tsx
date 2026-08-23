"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { ErrorState } from "@/components/Feedback";

export default function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);

    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      setError("نام کاربری باید بین ۳ تا ۲۰ حرف انگلیسی، عدد یا _ باشد.");
      return;
    }

    setLoading(true);

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", clean)
      .neq("id", user.id)
      .maybeSingle();

    if (existing) {
      setLoading(false);
      setError("این نام کاربری قبلاً استفاده شده است.");
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ username: clean, display_name: clean, onboarded: true })
      .eq("id", user.id);

    setLoading(false);

    if (updateError) {
      setError("ثبت نام کاربری با خطا مواجه شد. دوباره تلاش کنید.");
      return;
    }

    await refreshProfile();
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="fade-in mx-auto flex max-w-md flex-col gap-6 py-16">
      <div className="text-center">
        <span className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-3xl text-white shadow-soft">
          👋
        </span>
        <h1 className="text-2xl font-extrabold text-slate-800">خوش آمدید به شهر جم</h1>
        <p className="mt-1 text-sm text-slate-400">
          یک نام کاربری انتخاب کنید تا ثبت‌نام شما تکمیل شود
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl2 glass p-6 shadow-soft">
        {error && <ErrorState message={error} />}

        <div className="space-y-1">
          <label className="text-xs text-slate-500">نام کاربری (انگلیسی)</label>
          <input
            required
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            dir="ltr"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
            placeholder="ali_reza"
          />
          <p className="text-[11px] text-slate-400">
            این نام کاربری به عنوان نام نمایشی شما در دیوار شهر جم و چت‌ها استفاده می‌شود.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl2 bg-jam-green py-3 text-sm font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "در حال ثبت..." : "ورود به شهر جم"}
        </button>
      </form>
    </div>
  );
}
