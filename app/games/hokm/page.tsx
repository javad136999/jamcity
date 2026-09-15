"use client";

import Link from "next/link";
import HokmGame from "@/components/HokmGame";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/Feedback";

export default function HokmPage() {
  const { user, profile, loading } = useAuth();

  if (loading) return <Spinner label="در حال آماده‌سازی بازی..." />;

  if (!user) {
    return (
      <main dir="rtl" className="mx-auto max-w-md p-6 text-center">
        <div className="rounded-3xl border border-[#E9DED0] bg-[#FFF9F1] p-6">
          <div className="text-5xl">🃏</div>
          <h1 className="mt-3 text-xl font-black text-[#3A2920]">برای بازی وارد شوید</h1>
          <p className="mt-2 text-sm text-[#6E5D52]">برای ورود به میز حکم و گفت‌وگوی بازی، ابتدا وارد حساب کاربری شوید.</p>
          <Link href="/login" className="mt-5 inline-flex rounded-2xl bg-[#E2664C] px-6 py-3 text-sm font-black text-white">ورود به حساب ←</Link>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#F4FAF5] px-3 py-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="mb-4 inline-flex text-xs font-bold text-[#1E8151]">← بازگشت به جم‌سیتی</Link>
        <HokmGame userId={user.id} displayName={profile?.display_name} />
      </div>
    </main>
  );
}
