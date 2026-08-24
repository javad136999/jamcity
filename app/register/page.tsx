"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/Feedback";

export default function RegisterPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setLoading(true);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone,
        password,
        recoveryPhrase,
      }),
    });

    const data = await response.json();

    setLoading(false);

    if (!response.ok) {
      setError(data.error || "ثبت‌نام انجام نشد.");
      return;
    }

    router.push("/login");
  }

  return (
    <div
      dir="rtl"
      className="fade-in mx-auto flex max-w-md flex-col gap-6 py-10"
    >
      <div className="text-center">
        <span className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-jam-green to-jam-darkgreen text-3xl font-bold text-white shadow-glow">
          ج
        </span>

        <h1 className="text-2xl font-extrabold text-slate-800">
          ساخت حساب در شهر جم
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          با شماره موبایل خود حساب بسازید
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl2 glass p-6 shadow-soft"
      >
        {error && <ErrorState message={error} />}

        <div className="space-y-1">
          <label className="text-xs text-slate-500">
            شماره موبایل
          </label>

          <input
            type="tel"
            required
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09123456789"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">
            رمز عبور
          </label>

          <input
            type="password"
            required
            minLength={6}
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="حداقل ۶ کاراکتر"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600">
            عبارت بازیابی
          </label>

          <input
            type="text"
            required
            minLength={6}
            value={recoveryPhrase}
            onChange={(e) => setRecoveryPhrase(e.target.value)}
            placeholder="مثلاً: گل آبی جم 1405"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green"
          />

          <p className="text-xs leading-6 text-slate-400">
            یک عبارت مخصوص خودتان انتخاب کنید و حتماً آن را به خاطر بسپارید.
            برای بازیابی رمز عبور به آن نیاز خواهید داشت.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl2 bg-jam-green py-3 text-sm font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "در حال ساخت حساب..." : "ساخت حساب"}
        </button>
      </form>

      <p className="text-center text-xs text-slate-400">
        قبلاً ثبت‌نام کرده‌اید؟{" "}
        <Link
          href="/login"
          className="font-bold text-jam-green hover:underline"
        >
          وارد شوید
        </Link>
      </p>
    </div>
  );
}