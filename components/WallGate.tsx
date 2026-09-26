"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorState } from "@/components/Feedback";

function sanitizeUsername(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export default function WallGate() {
  const supabase = createClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const clean = sanitizeUsername(username);
    if (clean.length < 3) {
      setError("نام کاربری باید حداقل ۳ حرف انگلیسی/عدد باشد.");
      return;
    }
    if (password.length < 6) {
      setError("رمز عبور باید حداقل ۶ کاراکتر باشد.");
      return;
    }

    setLoading(true);
    const email = `${clean}@wall.jamcity.local`;

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError) {
      setLoading(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: clean, account_source: "wall" } },
    });

    setLoading(false);

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes("already")) {
        setError("این نام کاربری قبلاً ثبت شده. رمز عبور را درست وارد کنید.");
      } else {
        setError("ورود با خطا مواجه شد. دوباره تلاش کنید.");
      }
    }
  }

  return (
    <div className="fade-in flex min-h-[80vh] items-center justify-center bg-[#F4F7F2] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-[0_10px_30px_rgba(20,122,75,.15)] ring-1 ring-[#E3EBDE]">
            💬
          </span>
          <h1 className="text-xl font-black text-[#1D2B1F]">دیوار شهر جم</h1>
          <p className="mt-1.5 text-[12px] leading-6 text-[#8A968C]">
            یک نام کاربری و رمز عبور انتخاب کنید تا وارد گفتگو شوید
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-[22px] border border-[#E3EBDE] bg-white p-5 shadow-[0_10px_30px_rgba(20,60,40,.06)]"
        >
          {error && <ErrorState message={error} />}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#66766A]">نام کاربری</label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              dir="ltr"
              className="w-full rounded-xl border border-[#E3EBDE] bg-[#F7F9F4] px-4 py-3 text-sm text-[#1D2B1F] outline-none transition focus:border-[#147A4B] focus:bg-white"
              placeholder="ali_reza"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#66766A]">رمز عبور</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[#E3EBDE] bg-[#F7F9F4] px-4 py-3 text-sm text-[#1D2B1F] outline-none transition focus:border-[#147A4B] focus:bg-white"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#147A4B] py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(20,122,75,.3)] transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "در حال ورود..." : "ورود به دیوار"}
          </button>

          <p className="text-center text-[10px] leading-5 text-[#B0BAB1]">
            دفعه بعد با همین نام کاربری و رمز عبور وارد شوید. این حساب برای ثبت کسب و کار استفاده نمی‌شود.
          </p>
        </form>
      </div>
    </div>
  );
}
