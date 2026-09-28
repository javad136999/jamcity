"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorState } from "@/components/Feedback";
import { useAuth } from "@/lib/auth-context";

function normalizePhone(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/D/g, "");
}

function LoginForm() {
  const { city } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanPhone = normalizePhone(phone);

    if (!/^09d{9}$/.test(cleanPhone)) {
      setLoading(false);
      setError("شماره موبایل صحیح نیست.");
      return;
    }

    const resolveResponse = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanPhone }),
    });

    const resolveData = await resolveResponse.json().catch(() => ({}));

    if (!resolveResponse.ok || !resolveData.email) {
      setLoading(false);
      setError(resolveData.error || "حساب کاربری پیدا نشد.");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: resolveData.email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("شماره موبایل یا رمز عبور اشتباه است.");
      return;
    }

    const redirect = params.get("redirect") || "/";
    router.replace(redirect);
    router.refresh();
  }

  return (
    <div className="fade-in mx-auto flex max-w-md flex-col gap-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-slate-800">
          ورود به شهر {city.name}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          برای ورود، شماره موبایل و رمز عبور خود را وارد کنید
        </p>
      </div>

      <div className="space-y-4 rounded-xl2 glass p-6 shadow-soft">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorState message={error} />}

          <div className="space-y-1">
            <label className="text-xs text-slate-500">شماره موبایل</label>
            <input type="tel" required value={phone}
              onChange={(e) => setPhone(e.target.value)} dir="ltr"
              inputMode="numeric"
              className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green"
              placeholder="09123456789" />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500">رمز عبور</label>
            <input type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)} dir="ltr"
              className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green"
              placeholder="••••••••" />
          </div>

          <div className="flex justify-end">
            <Link href="/reset-password" className="text-xs text-jam-green hover:underline">
              رمز عبور را فراموش کرده‌اید؟
            </Link>
          </div>

          <button type="submit" disabled={loading}
            className="w-full rounded-xl2 bg-jam-green py-3 text-sm font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50">
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
