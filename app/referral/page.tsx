"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/Feedback";
import { useAuth } from "@/lib/auth-context";

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  referral_code: string | null;
};

type Reward = {
  id: string;
  level: number;
  referral_count: number;
  amount_toman: number;
  status: "pending" | "paid";
  paid_at: string | null;
  created_at: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function formatToman(value: number) {
  return `${formatNumber(value)} تومان`;
}

function ReferralPage() {
  const supabase = createClient() as any;
  const router = useRouter();
  const searchParams = useSearchParams();

  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [referralCount, setReferralCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);

  const [message, setMessage] = useState<{
    text: string;
    type: "ok" | "err" | "info";
  } | null>(null);

  const [showLoginMessage, setShowLoginMessage] = useState(false);

  /*
   * -------------------------------------------------------
   * بارگذاری اطلاعات کاربر
   * -------------------------------------------------------
   */
  async function loadReferralData() {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id,display_name,username,referral_code")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error(
          "Failed to load profile:",
          profileError.message
        );

        setMessage({
          text: "خطا در دریافت اطلاعات حساب کاربری.",
          type: "err",
        });

        setLoading(false);
        return;
      }

      if (!profileData) {
        setMessage({
          text: "اطلاعات پروفایل شما پیدا نشد.",
          type: "err",
        });

        setLoading(false);
        return;
      }

      setProfile(profileData as Profile);

      /*
       * دریافت پاداش‌های کاربر
       */
      const {
        data: rewardData,
        error: rewardError,
      } = await supabase
        .from("referral_rewards")
        .select(
          "id,level,referral_count,amount_toman,status,paid_at,created_at"
        )
        .eq("referrer_id", user.id)
        .order("level", {
          ascending: true,
        });

      if (rewardError) {
        console.error(
          "Failed to load rewards:",
          rewardError.message
        );
      } else {
        setRewards((rewardData ?? []) as Reward[]);
      }

      /*
       * تعداد معرفی‌ها
       *
       * اگر RLS اجازه شمارش مستقیم پروفایل‌ها را بدهد،
       * count دقیق برگردانده می‌شود.
       */
      const {
        count,
        error: countError,
      } = await supabase
        .from("profiles")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("referred_by", user.id);

      if (countError) {
        console.error(
          "Failed to count referrals:",
          countError.message
        );

        setReferralCount(0);
      } else {
        setReferralCount(count ?? 0);
      }
    } catch (error) {
      console.error("Referral page error:", error);

      setMessage({
        text: "خطایی در دریافت اطلاعات ایجاد شد.",
        type: "err",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    loadReferralData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  /*
   * -------------------------------------------------------
   * اطلاعات محاسباتی
   * -------------------------------------------------------
   */

  const earnedLevels = useMemo(() => {
    return Math.floor(referralCount / 20);
  }, [referralCount]);

  const currentProgress = useMemo(() => {
    return referralCount % 20;
  }, [referralCount]);

  const remainingToReward = useMemo(() => {
    if (currentProgress === 0) {
      return 20;
    }

    return 20 - currentProgress;
  }, [currentProgress]);

  const progressPercent = useMemo(() => {
    return Math.min(
      100,
      (currentProgress / 20) * 100
    );
  }, [currentProgress]);

  const totalRewardAmount = useMemo(() => {
    return earnedLevels * 20000;
  }, [earnedLevels]);

  const paidRewardAmount = useMemo(() => {
    return rewards
      .filter((reward) => reward.status === "paid")
      .reduce(
        (sum, reward) => sum + reward.amount_toman,
        0
      );
  }, [rewards]);

  const pendingRewardAmount = useMemo(() => {
    return rewards
      .filter((reward) => reward.status === "pending")
      .reduce(
        (sum, reward) => sum + reward.amount_toman,
        0
      );
  }, [rewards]);

  const referralLink = useMemo(() => {
    if (!profile?.referral_code) {
      return "";
    }

    if (typeof window === "undefined") {
      return `https://jamapp.ir/register?ref=${profile.referral_code}`;
    }

    return `${window.location.origin}/register?ref=${profile.referral_code}`;
  }, [profile]);

  /*
   * -------------------------------------------------------
   * کپی لینک
   * -------------------------------------------------------
   */
  async function copyReferralLink() {
    if (!referralLink || copying) return;

    setCopying(true);
    setMessage(null);

    try {
      await navigator.clipboard.writeText(referralLink);

      setMessage({
        text: "لینک دعوت با موفقیت کپی شد ✅",
        type: "ok",
      });

      setTimeout(() => {
        setMessage(null);
      }, 3500);
    } catch (error) {
      console.error("Copy error:", error);

      setMessage({
        text: "کپی لینک انجام نشد. دوباره امتحان کن.",
        type: "err",
      });
    } finally {
      setCopying(false);
    }
  }

  /*
   * -------------------------------------------------------
   * ارسال لینک برای دوستان
   * -------------------------------------------------------
   */
  async function shareReferralLink() {
    if (!referralLink || sharing) return;

    setSharing(true);
    setMessage(null);

    try {
      if (navigator.share) {
        await navigator.share({
          title: "دعوت به جم‌سیتی 🎁",
          text:
            "به جم‌سیتی بیا و از امکانات اپلیکیشن شهر جم استفاده کن 👇",
          url: referralLink,
        });

        setMessage({
          text: "لینک دعوت ارسال شد ✅",
          type: "ok",
        });
      } else {
        await navigator.clipboard.writeText(
          referralLink
        );

        setMessage({
          text:
            "امکان ارسال مستقیم وجود ندارد؛ لینک دعوت کپی شد.",
          type: "ok",
        });
      }

      setTimeout(() => {
        setMessage(null);
      }, 3500);
    } catch (error: any) {
      if (error?.name === "AbortError") {
        return;
      }

      console.error("Share error:", error);

      setMessage({
        text: "ارسال لینک انجام نشد.",
        type: "err",
      });
    } finally {
      setSharing(false);
    }
  }

  /*
   * -------------------------------------------------------
   * ورود
   * -------------------------------------------------------
   */
  if (authLoading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#F7F9F4]"
      >
        <Spinner label="در حال بررسی حساب کاربری..." />
      </div>
    );
  }

  /*
   * -------------------------------------------------------
   * کاربر وارد نشده
   * -------------------------------------------------------
   */
  if (!user) {
    return (
      <div
        dir="rtl"
        className="mx-auto min-h-screen max-w-md bg-[#F7F9F4] px-4 pb-16 pt-8"
      >
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-[28px] bg-white text-4xl shadow-sm">
            🎁
          </div>

          <h1 className="text-2xl font-black text-[#1D2B1F]">
            باشگاه معرفی جم‌سیتی
          </h1>

          <p className="mt-2 text-xs leading-6 text-[#7D897F]">
            دوستانت رو به جم‌سیتی دعوت کن و
            <br />
            به ازای هر ۲۰ معرفی موفق، ۲۰ هزار تومان جایزه بگیر.
          </p>
        </div>

        <div className="rounded-[24px] border border-[#E3EBDE] bg-white p-5 text-center shadow-sm">
          <div className="text-4xl">🔐</div>

          <h2 className="mt-3 text-sm font-black text-[#1D2B1F]">
            ابتدا وارد حساب جم‌سیتی شو
          </h2>

          <p className="mt-2 text-[11px] leading-6 text-[#8A968C]">
            برای مشاهده کد معرفی و پاداش‌های خودت باید
            وارد حساب کاربری شوی.
          </p>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mt-4 w-full rounded-xl bg-[#147A4B] py-3 text-xs font-black text-white shadow-sm active:scale-[0.98]"
          >
            ورود به حساب
          </button>

          <button
            type="button"
            onClick={() => router.push("/register")}
            className="mt-2 w-full rounded-xl border border-[#DDE8DE] bg-[#F7F9F4] py-3 text-xs font-black text-[#147A4B]"
          >
            ثبت‌نام در جم‌سیتی
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
            <div className="text-xl">👥</div>
            <div className="mt-1 text-[10px] font-bold text-[#7D897F]">
              معرفی دوستان
            </div>
          </div>

          <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
            <div className="text-xl">🎁</div>
            <div className="mt-1 text-[10px] font-bold text-[#7D897F]">
              پاداش نقدی
            </div>
          </div>

          <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
            <div className="text-xl">🏆</div>
            <div className="mt-1 text-[10px] font-bold text-[#7D897F]">
              بدون قرعه‌کشی
            </div>
          </div>
        </div>
      </div>
    );
  }

  /*
   * -------------------------------------------------------
   * Loading
   * -------------------------------------------------------
   */
  if (loading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#F7F9F4]"
      >
        <Spinner label="در حال بارگذاری باشگاه معرفی..." />
      </div>
    );
  }

  /*
   * -------------------------------------------------------
   * صفحه اصلی
   * -------------------------------------------------------
   */
  return (
    <div
      dir="rtl"
      className="mx-auto min-h-screen max-w-md space-y-4 bg-[#F7F9F4] px-4 pb-16 pt-6"
    >
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-[#147A4B] to-[#0E7044] text-4xl shadow-[0_8px_25px_rgba(20,122,75,.20)]">
          🎁
        </div>

        <h1 className="text-2xl font-black text-[#1D2B1F]">
          باشگاه معرفی جم‌سیتی
        </h1>

        <p className="mt-1 text-xs leading-6 text-[#7D897F]">
          دوستات رو دعوت کن و از جم‌سیتی جایزه بگیر
        </p>
      </div>

      {/* معرفی کاربر */}
      <div className="rounded-[24px] border border-[#E3EBDE] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#8A968C]">
              کد معرفی شما
            </p>

            <p
              dir="ltr"
              className="mt-1 text-2xl font-black tracking-[4px] text-[#147A4B]"
            >
              {profile?.referral_code || "---"}
            </p>
          </div>

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF5ED] text-2xl">
            🔗
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-[#F7F9F4] p-3">
          <p className="mb-1 text-[9px] font-bold text-[#8A968C]">
            لینک اختصاصی دعوت شما
          </p>

          <p
            dir="ltr"
            className="overflow-hidden text-ellipsis whitespace-nowrap text-center text-[11px] font-bold text-[#3A4A3D]"
          >
            {referralLink || "---"}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={copyReferralLink}
            disabled={!referralLink || copying}
            className="rounded-xl border border-[#147A4B] bg-white py-3 text-xs font-black text-[#147A4B] disabled:opacity-50"
          >
            {copying ? "در حال کپی..." : "📋 کپی لینک"}
          </button>

          <button
            type="button"
            onClick={shareReferralLink}
            disabled={!referralLink || sharing}
            className="rounded-xl bg-[#147A4B] py-3 text-xs font-black text-white shadow-sm disabled:opacity-50"
          >
            {sharing ? "در حال ارسال..." : "📤 دعوت دوستان"}
          </button>
        </div>

        {message && (
          <div
            className={`mt-3 rounded-xl px-3 py-2 text-center text-[11px] font-bold ${
              message.type === "err"
                ? "bg-[#FDEDEC] text-[#D94B40]"
                : message.type === "ok"
                ? "bg-[#EAF5ED] text-[#147A4B]"
                : "bg-[#F4F1E7] text-[#8A7150]"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      {/* آمار */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[18px] border border-[#E3EBDE] bg-white p-3 text-center shadow-sm">
          <div className="text-xl">👥</div>

          <div className="mt-1 text-lg font-black text-[#1D2B1F]">
            {formatNumber(referralCount)}
          </div>

          <div className="text-[9px] font-bold text-[#8A968C]">
            معرفی موفق
          </div>
        </div>

        <div className="rounded-[18px] border border-[#E3EBDE] bg-white p-3 text-center shadow-sm">
          <div className="text-xl">🎁</div>

          <div className="mt-1 text-lg font-black text-[#147A4B]">
            {formatNumber(earnedLevels)}
          </div>

          <div className="text-[9px] font-bold text-[#8A968C]">
            پاداش کسب‌شده
          </div>
        </div>

        <div className="rounded-[18px] border border-[#E3EBDE] bg-white p-3 text-center shadow-sm">
          <div className="text-xl">💰</div>

          <div className="mt-1 text-sm font-black text-[#D98F2B]">
            {formatNumber(totalRewardAmount)}
          </div>

          <div className="text-[9px] font-bold text-[#8A968C]">
            تومان
          </div>
        </div>
      </div>

      {/* پیشرفت */}
      <div className="rounded-[24px] border border-[#F0DCB4] bg-gradient-to-l from-[#FFF7E8] to-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-[#8A7150]">
              پاداش بعدی
            </p>

            <p className="mt-1 text-xl font-black text-[#D98F2B]">
              ۲۰٬۰۰۰ تومان
            </p>
          </div>

          <div className="text-3xl">🎯</div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold">
            <span className="text-[#8A968C]">
              {formatNumber(currentProgress)} از ۲۰ نفر
            </span>

            <span className="text-[#D98F2B]">
              {formatNumber(remainingToReward)} نفر مانده
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-[#E9E2D4]">
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#D98F2B] to-[#F1B94A] transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
              }}
            />
          </div>

          {currentProgress === 0 &&
            referralCount > 0 && (
              <p className="mt-3 rounded-xl bg-[#EAF5ED] px-3 py-2 text-center text-[10px] font-black text-[#147A4B]">
                🎉 هر ۲۰ معرفی یک پاداش جدید!
              </p>
            )}
        </div>
      </div>

      {/* قوانین */}
      <div className="rounded-[22px] border border-[#E3EBDE] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black text-[#1D2B1F]">
          🎁 چطور جایزه بگیرم؟
        </h2>

        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EAF5ED] text-sm">
              ۱
            </div>

            <p className="text-[11px] leading-6 text-[#59665C]">
              لینک اختصاصی خودت را برای دوستانت ارسال کن.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EAF5ED] text-sm">
              ۲
            </div>

            <p className="text-[11px] leading-6 text-[#59665C]">
              دوستت با لینک تو وارد جم‌سیتی شود و ثبت‌نام کند.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EAF5ED] text-sm">
              ۳
            </div>

            <p className="text-[11px] leading-6 text-[#59665C]">
              به ازای هر ۲۰ ثبت‌نام موفق، یک کارت شارژ
              ۲۰٬۰۰۰ تومانی دریافت می‌کنی.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFF3DA] text-sm">
              🏆
            </div>

            <p className="text-[11px] leading-6 text-[#59665C]">
              پرداخت پاداش‌ها پس از بررسی توسط مدیریت انجام می‌شود.
            </p>
          </div>
        </div>
      </div>

      {/* خلاصه پرداخت */}
      <div className="rounded-[22px] border border-[#E3EBDE] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black text-[#1D2B1F]">
          💰 وضعیت پاداش‌ها
        </h2>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-[#F7F9F4] px-3 py-3">
            <span className="text-[10px] font-bold text-[#7D897F]">
              پرداخت‌شده
            </span>

            <span className="text-xs font-black text-[#147A4B]">
              {formatToman(paidRewardAmount)}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[#FFF8EA] px-3 py-3">
            <span className="text-[10px] font-bold text-[#8A7150]">
              در انتظار پرداخت
            </span>

            <span className="text-xs font-black text-[#D98F2B]">
              {formatToman(pendingRewardAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* تاریخچه */}
      <div className="rounded-[22px] border border-[#E3EBDE] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-black text-[#1D2B1F]">
            📋 تاریخچه پاداش‌ها
          </h2>

          <span className="text-[9px] font-bold text-[#8A968C]">
            {formatNumber(rewards.length)} مورد
          </span>
        </div>

        {rewards.length === 0 ? (
          <div className="rounded-xl bg-[#F7F9F4] px-3 py-6 text-center">
            <div className="text-3xl">🎁</div>

            <p className="mt-2 text-[11px] font-bold text-[#8A968C]">
              هنوز پاداشی کسب نکردی.
            </p>

            <p className="mt-1 text-[9px] text-[#A1AAA3]">
              دوستانت رو دعوت کن تا اولین پاداشت رو بگیری!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className="rounded-xl border border-[#EDF1EC] bg-[#FAFCF9] p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black text-[#1D2B1F]">
                      پاداش مرحله {formatNumber(reward.level)}
                    </p>

                    <p className="mt-1 text-[9px] text-[#8A968C]">
                      {formatNumber(reward.referral_count)} معرفی موفق
                    </p>
                  </div>

                  <div className="text-left">
                    <p className="text-sm font-black text-[#147A4B]">
                      {formatToman(reward.amount_toman)}
                    </p>

                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-1 text-[8px] font-black ${
                        reward.status === "paid"
                          ? "bg-[#EAF5ED] text-[#147A4B]"
                          : "bg-[#FFF3DA] text-[#B47A19]"
                      }`}
                    >
                      {reward.status === "paid"
                        ? "✅ پرداخت شده"
                        : "🕐 در انتظار پرداخت"}
                    </span>
                  </div>
                </div>

                {reward.paid_at && (
                  <p className="mt-2 border-t border-[#EDF1EC] pt-2 text-[8px] text-[#A1AAA3]">
                    تاریخ پرداخت:{" "}
                    {new Date(
                      reward.paid_at
                    ).toLocaleDateString("fa-IR")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* دعوت نهایی */}
      <div className="rounded-[24px] bg-gradient-to-br from-[#147A4B] to-[#0D633D] p-5 text-center text-white shadow-[0_10px_30px_rgba(20,122,75,.20)]">
        <div className="text-3xl">🚀</div>

        <h2 className="mt-2 text-base font-black">
          آماده‌ای جایزه بگیری؟
        </h2>

        <p className="mt-2 text-[10px] leading-5 text-white/80">
          لینک دعوتت رو برای دوستانت بفرست و
          <br />
          با هر ۲۰ معرفی یک پاداش ۲۰ هزار تومانی بگیر.
        </p>

        <button
          type="button"
          onClick={shareReferralLink}
          disabled={!referralLink || sharing}
          className="mt-4 w-full rounded-xl bg-white py-3 text-xs font-black text-[#147A4B] shadow-sm disabled:opacity-60"
        >
          {sharing
            ? "در حال ارسال..."
            : "📤 دعوت دوستان"}
        </button>
      </div>

      <p className="px-3 text-center text-[9px] leading-6 text-[#A1AAA3]">
        پاداش‌ها بر اساس ثبت‌نام‌های موفق محاسبه می‌شوند.
        <br />
        هر ۲۰ معرفی موفق = یک پاداش ۲۰٬۰۰۰ تومانی
      </p>
    </div>
  );
}

export default function ReferralRoutePage() {
  return (
    <Suspense
      fallback={
        <div
          dir="rtl"
          className="flex min-h-screen items-center justify-center bg-[#F7F9F4]"
        >
          <Spinner label="در حال بارگذاری..." />
        </div>
      }
    >
      <ReferralPage />
    </Suspense>
  );
}