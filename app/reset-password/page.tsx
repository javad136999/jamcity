"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ErrorState } from "@/components/Feedback";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/settings`
          : undefined,
    });
    setLoading(false);
    if (error) {
      setError("خطا در ارسال ایمیل. دوباره تلاش کنید.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="fade-in mx-auto max-w-md py-16 text-center">
        <p className="text-2xl">📨</p>
        <h1 className="mt-4 text-xl font-bold text-slate-800">ایمیل ارسال شد</h1>
        <p className="mt-2 text-sm text-slate-400">
          لینک بازیابی رمز عبور برای ایمیل شما ارسال شد.
        </p>
        <Link href="/login" className="mt-6 inline-block text-jam-green hover:underline">
          بازگشت به ورود
        </Link>
      </div>
    );
  }

  return (
    <div className="fade-in mx-auto flex max-w-md flex-col gap-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-slate-800">بازیابی رمز عبور</h1>
        <p className="mt-1 text-sm text-slate-400">
          ایمیل خود را وارد کنید تا لینک بازیابی برایتان ارسال شود
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl2 glass p-6 shadow-soft">
        {error && <ErrorState message={error} />}
        <div className="space-y-1">
          <label className="text-xs text-slate-500">ایمیل</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl2 bg-jam-green py-3 text-sm font-bold text-slate-800 shadow-glow transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "در حال ارسال..." : "ارسال لینک بازیابی"}
        </button>
      </form>
    </div>
  );
}
