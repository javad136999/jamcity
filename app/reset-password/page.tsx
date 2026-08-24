```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [phone, setPhone] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/recover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          recoveryPhrase,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "بازیابی رمز عبور انجام نشد.");
        return;
      }

      setMessage("رمز عبور با موفقیت تغییر کرد. اکنون می‌توانید وارد شوید.");
      setPhone("");
      setRecoveryPhrase("");
      setNewPassword("");
    } catch {
      setError("خطایی رخ داد. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-in mx-auto flex max-w-md flex-col gap-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-slate-800">
          بازیابی رمز عبور
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          شماره موبایل و عبارت بازیابی خود را وارد کنید
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl2 glass p-6 shadow-soft"
      >
        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs text-slate-500">
            شماره موبایل
          </label>

          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            dir="ltr"
            placeholder="09123456789"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">
            عبارت بازیابی
          </label>

          <input
            type="text"
            required
            value={recoveryPhrase}
            onChange={(e) => setRecoveryPhrase(e.target.value)}
            placeholder="عبارت بازیابی که هنگام ثبت‌نام انتخاب کردید"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">
            رمز عبور جدید
          </label>

          <input
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="حداقل ۶ کاراکتر"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl2 bg-jam-green py-3 text-sm font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "در حال بازیابی..." : "تغییر رمز عبور"}
        </button>

        <p className="text-center text-xs text-slate-400">
          رمزتان را به خاطر آوردید؟{" "}
          <Link
            href="/login"
            className="font-bold text-jam-green hover:underline"
          >
            ورود به حساب
          </Link>
        </p>
      </form>
    </div>
  );
}
```
