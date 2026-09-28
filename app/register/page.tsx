"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/Feedback";
import { createClient } from "@/lib/supabase/client";
import type { City } from "@/lib/cities";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { city: activeCity } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState("");

  useEffect(() => {
    supabase.from("cities").select("*").eq("is_active", true).order("name").then(({ data }) => {
      const rows = (data ?? []) as City[];
      setCities(rows);
      const jam = rows.find((city) => city.slug === "jam");
      const selected = rows.find((city) => city.id === activeCity.id) ?? jam;
      if (selected) setCityId(selected.id);
    });
  }, [supabase, activeCity.id]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) setReferralCode(ref.toUpperCase());
    }
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          phone,
          password,
          recoveryPhrase,
          referralCode,
          cityId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "ثبت‌نام انجام نشد.");
        return;
      }

      router.push("/login");
    } catch {
      setError("خطایی رخ داد. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
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
          ساخت حساب در جم‌سیتی
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          اطلاعات خود را برای ساخت حساب وارد کنید
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl2 glass p-6 shadow-soft"
      >
        {error && <ErrorState message={error} />}

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600">
            نام نمایشی
          </label>

          <input
            type="text"
            required
            minLength={2}
            maxLength={50}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="مثلاً علی رضایی"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green"
          />

          <p className="text-xs leading-5 text-slate-400">
            این نام در پروفایل، چت عمومی و آگهی‌های شما نمایش داده می‌شود.
          </p>
        </div>

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
          <label className="text-xs font-bold text-slate-600">شهر مورد نظر شما</label>
          <select
            required
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green"
          >
            <option value="" disabled>انتخاب شهر</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>{city.name}</option>
            ))}
          </select>
          <p className="text-xs leading-5 text-slate-400">بعد از ورود، نقشه، دیوار و کسب‌وکارهای همین شهر به‌صورت پیش‌فرض نمایش داده می‌شود.</p>
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
            placeholder="مثلاً گل آبی جم ۱۲۳۴۵۶"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green"
          />

          <p className="text-xs leading-6 text-slate-400">
            یک عبارت مخصوص خودتان انتخاب کنید و حتماً آن را به خاطر بسپارید.
            برای بازیابی رمز عبور به آن نیاز خواهید داشت.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600">کد معرفی (اختیاری)</label>
          <input
            type="text"
            dir="ltr"
            maxLength={8}
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            placeholder="مثلاً A1B2C3D4"
            className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm tracking-widest text-slate-800 outline-none transition focus:border-jam-green"
          />
          <p className="text-xs leading-5 text-slate-400">اگر کسی شما را دعوت کرده، کد او را وارد کنید تا عضویت شما برایش ثبت شود.</p>
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
