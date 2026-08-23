"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorState } from "@/components/Feedback";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setGoogleLoading(true);
    const redirect = params.get("redirect") || "/";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("ایمیل یا رمز عبور اشتباه است.");
      return;
    }
    const redirect = params.get("redirect") || "/";
    router.replace(redirect);
    router.refresh();
  }

  return (
    <div className="fade-in mx-auto flex max-w-md flex-col gap-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-slate-800">ورود به شهر جم</h1>
        <p className="mt-1 text-sm text-slate-400">
          برای ثبت آگهی و گفتگو، وارد حساب خود شوید
        </p>
      </div>

      <div className="space-y-4 rounded-xl2 glass p-6 shadow-soft">
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
          {googleLoading ? "در حال اتصال به گوگل..." : "ورود با گوگل"}
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          یا با ایمیل
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorState message={error} />}

          <div className="space-y-1">
            <label className="text-xs text-slate-500">ایمیل</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500">رمز عبور</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green"
              placeholder="••••••••"
            />
          </div>

          <div className="flex justify-end">
            <Link href="/reset-password" className="text-xs text-jam-green hover:underline">
              رمز عبور را فراموش کرده‌اید؟
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl2 bg-jam-green py-3 text-sm font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "در حال ورود..." : "ورود"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          حساب ندارید؟{" "}
          <Link href="/register" className="font-bold text-jam-green hover:underline">
            ثبت‌نام کنید
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginForm;
