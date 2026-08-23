"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ErrorState } from "@/components/Feedback";

export default function RegisterPage() {
  const supabase = createClient();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setGoogleLoading(false);
      setError("اتصال به گوگل با خطا مواجه شد. دوباره تلاش کنید.");
    }
  }

  return (
    <div className="fade-in mx-auto flex max-w-md flex-col gap-6 py-16">
      <div className="text-center">
        <span className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-jam-green to-jam-darkgreen text-3xl font-bold text-white shadow-glow">
          ج
        </span>
        <h1 className="text-2xl font-extrabold text-slate-800">ساخت حساب در شهر جم</h1>
        <p className="mt-1 text-sm text-slate-400">
          فقط با یک کلیک، با حساب گوگل خود ثبت‌نام کنید
        </p>
      </div>

      <div className="space-y-4 rounded-xl2 glass p-6 shadow-soft">
        {error && <ErrorState message={error} />}

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="flex w-full items-center justify-center gap-3 rounded-xl2 border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 shadow-soft transition hover:bg-slate-50 disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z"/>
          </svg>
          {googleLoading ? "در حال اتصال به گوگل..." : "ثبت‌نام با گوگل"}
        </button>

        <p className="text-center text-xs text-slate-400">
          بعد از ورود با گوگل، یک نام کاربری برای خودتان انتخاب می‌کنید و بلافاصله وارد شهر جم می‌شوید.
        </p>

        <p className="text-center text-xs text-slate-400">
          قبلاً ثبت‌نام کرده‌اید؟{" "}
          <Link href="/login" className="font-bold text-jam-green hover:underline">
            وارد شوید
          </Link>
        </p>
      </div>
    </div>
  );
}
