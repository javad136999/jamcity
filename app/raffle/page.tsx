"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/Feedback";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

type Segment = {
  id: string;
  position: number;
  label: string;
  type: "prize" | "empty";
  amount: number | null;
  is_available: boolean;
};

type Participant = {
  id: string;
  phone: string;
  spins_used: number;
  spins_allowed: number;
  referral_code: string;
  referred_by: string | null;
};

type SpinHistoryItem = {
  id: string;
  phone: string;
  label: string;
  is_win: boolean;
  created_at: string;
};

const FREE_SPINS = 3;

/**
 * شانس برد دیگر یک درصد ثابت نیست.
 * تصمیم برد/باخت هر چرخش با تابع دیتابیسی
 * raffle_register_spin() گرفته می‌شود که یک
 * شمارنده سراسری (بین همه کاربران) نگه می‌دارد
 * و به‌طور تصادفی هر ۱۰ تا ۱۲ چرخش (و گاهی تا ۱۵ چرخش)
 * یک برد تضمینی صادر می‌کند.
 */

const PRIZE_COLOR = "#F4C542";
const EMPTY_COLORS = ["#EAF3EC", "#DCEAE1"];

function tomanLabel(amountRial: number | null) {
  if (!amountRial) return "جایزه";

  const toman = Math.round(amountRial / 10);
  const thousand = Math.round(toman / 1000);

  if (thousand >= 1) {
    return `کارت شارژ ${thousand.toLocaleString("fa-IR")} هزارتومانی`;
  }

  return `کارت شارژ ${toman.toLocaleString("fa-IR")} تومانی`;
}

function normalizePhone(phone: string) {
  let value = String(phone || "").trim();

  value = value.replace(/[^\d+]/g, "");

  if (value.startsWith("+98")) {
    value = "0" + value.slice(3);
  }

  if (value.startsWith("0098")) {
    value = "0" + value.slice(4);
  }

  if (value.startsWith("98") && value.length === 12) {
    value = "0" + value.slice(2);
  }

  if (!value.startsWith("0") && value.length === 10) {
    value = "0" + value;
  }

  return value;
}

function isValidIranianPhone(phone: string) {
  return /^09\d{9}$/.test(normalizePhone(phone));
}

function generateReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

function prepareSegments(loaded: Segment[]) {
  const normalized = loaded
    .map((segment) => ({
      ...segment,
      label:
        segment.type === "prize"
          ? segment.amount
            ? tomanLabel(segment.amount)
            : segment.label || "جایزه"
          : "پوچ",
    }))
    .sort((a, b) => a.position - b.position);

  if (normalized.length <= 2) {
    return normalized;
  }

  const result = [...normalized];

  for (let i = 0; i < result.length; i++) {
    const current = result[i];
    const next = result[(i + 1) % result.length];

    if (
      current.type === "prize" &&
      next.type === "prize"
    ) {
      const swapIndex = result.findIndex(
        (item, index) =>
          index !== i &&
          index !== (i + 1) % result.length &&
          item.type === "empty"
      );

      if (swapIndex !== -1) {
        [result[(i + 1) % result.length], result[swapIndex]] = [
          result[swapIndex],
          result[(i + 1) % result.length],
        ];
      }
    }
  }

  return result;
}

function maskPhone(phone: string) {
  const normalized = normalizePhone(phone);

  if (normalized.length !== 11) {
    return phone;
  }

  return `${normalized.slice(0, 4)}****${normalized.slice(-3)}`;
}

function RafflePageContent() {
  // Cast to `any` here (same as raffle-admin-page.tsx) because the
  // raffle_* tables and RPC functions aren't in the generated Supabase
  // Database types, which otherwise makes TS infer `never` for
  // insert/update payloads and fails `next build`'s type-check step.
  const supabase = createClient() as any;
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [segments, setSegments] = useState<Segment[]>([]);
  const [participant, setParticipant] =
    useState<Participant | null>(null);

  const [referralCode, setReferralCode] = useState("");

  const [history, setHistory] = useState<SpinHistoryItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [sharing, setSharing] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [result, setResult] = useState<{
    label: string;
    isWin: boolean;
  } | null>(null);

  const [rotation, setRotation] = useState(0);

  const spinTimerRef = useRef<NodeJS.Timeout | null>(null);

  const remaining = useMemo(() => {
    if (!participant) return 0;

    return Math.max(
      0,
      participant.spins_allowed - participant.spins_used
    );
  }, [participant]);

  useEffect(() => {
    const ref = searchParams.get("ref");

    if (ref) {
      setReferralCode(ref.toUpperCase());
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();

    return () => {
      if (spinTimerRef.current) {
        clearTimeout(spinTimerRef.current);
      }
    };
  }, []);

  /**
   * چون اطلاعات کاربر (user) به‌صورت async از AuthProvider
   * لود می‌شود، ممکن است در اولین اجرای loadData هنوز آماده نباشد.
   * به‌محض این‌که کاربر لاگین مشخص شد و هنوز شرکت‌کننده‌ای
   * ثبت نشده، خودکار ثبت‌نامش را انجام می‌دهیم - بدون فرم شماره موبایل.
   */
  useEffect(() => {
    if (user?.id && !participant && !loading) {
      ensureParticipant();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        segmentsResponse,
        historyResponse,
      ] = await Promise.all([
        supabase
          .from("raffle_segments")
          .select(
            "id,position,label,type,amount,is_available"
          )
          .order("position", { ascending: true }),

        supabase
          .from("raffle_spins")
          .select(
            "id,phone,label,is_win,created_at"
          )
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (segmentsResponse.error) {
        throw segmentsResponse.error;
      }

      if (historyResponse.error) {
        throw historyResponse.error;
      }

      const prepared = prepareSegments(
        (segmentsResponse.data || []) as Segment[]
      );

      setSegments(prepared);

      setHistory(
        (historyResponse.data || []) as SpinHistoryItem[]
      );

      if (user?.id) {
        await ensureParticipant();
      }
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "خطا در دریافت اطلاعات قرعه‌کشی"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadParticipant() {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("raffle_participants")
        .select(
          "id,phone,spins_used,spins_allowed,referral_code,referred_by"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        setParticipant(data as Participant);
      }
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * قبلاً کاربر باید شماره موبایلش را دستی وارد می‌کرد.
   * حالا چون ورود به سایت با شماره موبایل انجام می‌شود،
   * شماره را خودکار از حساب کاربری (پروفایل) می‌خوانیم
   * و نیازی به فرم/تایید جدا نیست.
   */
  async function ensureParticipant() {
    if (!user?.id) return;

    try {
      setError("");

      /**
       * اگر شرکت‌کننده قبلاً وجود دارد، همان را نشان بده.
       */
      const { data: existing, error: existingError } =
        await supabase
          .from("raffle_participants")
          .select(
            "id,phone,spins_used,spins_allowed,referral_code,referred_by"
          )
          .eq("user_id", user.id)
          .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existing) {
        setParticipant(existing as Participant);
        return;
      }

      /**
       * شماره موبایل از پروفایل کاربر (نام کاربری ورود) گرفته می‌شود.
       */
      const { data: profileRow, error: profileError } =
        await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const rawUsername = profileRow?.username || "";
      const normalizedPhone = isValidIranianPhone(
        rawUsername
      )
        ? normalizePhone(rawUsername)
        : rawUsername;

      /**
       * ساخت کد دعوت
       */
      const newReferralCode = generateReferralCode();

      let referredBy: string | null = null;

      const urlReferral =
        referralCode || searchParams.get("ref") || "";

      if (urlReferral) {
        const { data: referrer } = await supabase
          .from("raffle_participants")
          .select("id")
          .eq(
            "referral_code",
            urlReferral.toUpperCase()
          )
          .maybeSingle();

        if (referrer && referrer.id) {
          referredBy = referrer.id;

          /**
           * سقفی برای شانس‌های دریافتی از اشتراک‌گذاری وجود ندارد.
           */
          await supabase.rpc(
            "raffle_increment_spins_allowed",
            { p_participant_id: referrer.id, p_amount: 1 }
          );
        }
      }

      /**
       * ثبت شرکت‌کننده جدید - بدون فرم، خودکار
       */
      const { data: created, error: createError } =
        await supabase
          .from("raffle_participants")
          .insert({
            user_id: user.id,
            phone: normalizedPhone,
            spins_used: 0,
            spins_allowed: FREE_SPINS,
            referral_code: newReferralCode,
            referred_by: referredBy,
          })
          .select(
            "id,phone,spins_used,spins_allowed,referral_code,referred_by"
          )
          .single();

      if (createError) {
        throw createError;
      }

      setParticipant(created as Participant);

      setMessage(
        `${FREE_SPINS} شانس رایگان برای شما فعال شد.`
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message || "ثبت اطلاعات انجام نشد."
      );
    }
  }

  async function shareWithFriends() {
    if (!participant) {
      setError(
        "ابتدا وارد حساب کاربری خود شوید."
      );
      return;
    }

    if (sharing) return;

    try {
      setSharing(true);
      setError("");
      setMessage("");

      const shareUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/raffle?ref=${participant.referral_code}`
          : "";

      const shareText =
        "در قرعه‌کشی شهر جم شرکت کن و شانس برنده شدن جایزه بگیر 🎁";

      if (
        typeof navigator !== "undefined" &&
        navigator.share
      ) {
        await navigator.share({
          title: "قرعه‌کشی شهر جم",
          text: shareText,
          url: shareUrl,
        });

        /**
         * بعد از اشتراک موفق: یک شانس اضافه.
         * سقفی برای تعداد اشتراک‌گذاری/شانس‌ها وجود ندارد؛
         * هر بار اشتراک‌گذاری موفق، یک شانس جدید اضافه می‌شود.
         */
        const newAllowed = participant.spins_allowed + 1;

        const { data, error } = await supabase
          .from("raffle_participants")
          .update({
            spins_allowed: newAllowed,
          })
          .eq("id", participant.id)
          .select(
            "id,phone,spins_used,spins_allowed,referral_code,referred_by"
          )
          .single();

        if (error) {
          throw error;
        }

        setParticipant(data as Participant);

        setMessage(
          "اشتراک‌گذاری موفق بود و یک شانس اضافه گرفتید 🎁"
        );
      } else {
        await navigator.clipboard.writeText(
          shareUrl
        );

        const newAllowed = participant.spins_allowed + 1;

        const { data, error } = await supabase
          .from("raffle_participants")
          .update({
            spins_allowed: newAllowed,
          })
          .eq("id", participant.id)
          .select(
            "id,phone,spins_used,spins_allowed,referral_code,referred_by"
          )
          .single();

        if (error) {
          throw error;
        }

        setParticipant(data as Participant);

        setMessage(
          "لینک قرعه‌کشی کپی شد و یک شانس اضافه گرفتید."
        );
      }
    } catch (err: any) {
      /**
       * اگر کاربر پنجره Share را بست،
       * چیزی به شانس‌ها اضافه نمی‌کنیم.
       */
      if (
        err?.name === "AbortError"
      ) {
        return;
      }

      console.error(err);

      setError(
        err?.message ||
          "اشتراک‌گذاری انجام نشد."
      );
    } finally {
      setSharing(false);
    }
  }

  async function refreshSegments() {
    const { data, error } = await supabase
      .from("raffle_segments")
      .select(
        "id,position,label,type,amount,is_available"
      )
      .order("position", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    const prepared = prepareSegments(
      (data || []) as Segment[]
    );

    setSegments(prepared);

    return prepared;
  }

  async function refreshHistory() {
    const { data, error } = await supabase
      .from("raffle_spins")
      .select(
        "id,phone,label,is_win,created_at"
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(50);

    if (error) {
      console.error(error);
      return;
    }

    setHistory(
      (data || []) as SpinHistoryItem[]
    );
  }

  async function doSpin() {
    if (spinning) return;

    if (!participant) {
      setError(
        "ابتدا وارد حساب کاربری خود شوید."
      );
      return;
    }

    if (remaining <= 0) {
      setError(
        "شانس شما برای شرکت در قرعه‌کشی تمام شده است."
      );
      return;
    }

    if (!segments.length) {
      setError(
        "بخش‌های قرعه‌کشی هنوز بارگذاری نشده‌اند."
      );
      return;
    }

    setError("");
    setMessage("");
    setResult(null);
    setSpinning(true);

    try {
      /**
       * ابتدا آخرین وضعیت جایزه‌ها را از دیتابیس می‌گیریم
       * تا جایزه‌ای که قبلاً برده شده دوباره انتخاب نشود.
       */
      const currentSegments =
        await refreshSegments();

      const availablePrizeIndexes =
        currentSegments
          .map((segment, index) =>
            segment.type === "prize" &&
            segment.is_available
              ? index
              : -1
          )
          .filter((index) => index !== -1);

      const emptyIndexes =
        currentSegments
          .map((segment, index) =>
            segment.type === "empty"
              ? index
              : -1
          )
          .filter((index) => index !== -1);

      /**
       * اگر جایزه‌ای باقی نمانده:
       * نتیجه حتماً پوچ است.
       */
      let shouldWin = false;

      if (
        availablePrizeIndexes.length > 0 &&
        emptyIndexes.length > 0
      ) {
        /**
         * تصمیم برد/باخت اینجا دیگر با یک درصد ثابت
         * روی مرورگر گرفته نمی‌شود (قابل دستکاری بود).
         * به‌جایش تابع دیتابیسی raffle_register_spin()
         * را صدا می‌زنیم که یک شمارنده سراسری (بین همه
         * کاربران سایت) نگه می‌دارد و هر ۱۰ تا ۱۲ چرخش
         * (و گاهی تا ۱۵ چرخش) یک برد تضمینی صادر می‌کند.
         */
        const { data: winDecision, error: winError } =
          await supabase.rpc("raffle_register_spin");

        if (winError) {
          console.error(winError);
        } else {
          shouldWin = Boolean(winDecision);
        }
      }

      let targetIndex: number;

      /**
       * انتخاب خانه مقصد
       */
      if (
        shouldWin &&
        availablePrizeIndexes.length > 0
      ) {
        const randomPrizeIndex =
          Math.floor(
            Math.random() *
              availablePrizeIndexes.length
          );

        targetIndex =
          availablePrizeIndexes[
            randomPrizeIndex
          ];
      } else if (
        emptyIndexes.length > 0
      ) {
        const randomEmptyIndex =
          Math.floor(
            Math.random() *
              emptyIndexes.length
          );

        targetIndex =
          emptyIndexes[randomEmptyIndex];
      } else if (
        availablePrizeIndexes.length > 0
      ) {
        /**
         * حالت غیرعادی:
         * هیچ خانه پوچی وجود ندارد.
         *
         * برای اینکه چرخ بتواند نمایش داده شود،
         * یک جایزه انتخاب می‌کنیم.
         *
         * بهتر است در پنل همیشه حداقل یک خانه
         * پوچ روی چرخ وجود داشته باشد.
         */
        const randomPrizeIndex =
          Math.floor(
            Math.random() *
              availablePrizeIndexes.length
          );

        targetIndex =
          availablePrizeIndexes[
            randomPrizeIndex
          ];

        shouldWin = true;
      } else {
        throw new Error(
          "هیچ بخش قابل انتخابی برای قرعه‌کشی وجود ندارد."
        );
      }

      const selectedSegment =
        currentSegments[targetIndex];

      /**
       * محاسبه چرخش
       */
      const segmentCount =
        currentSegments.length;

      const anglePerSegment =
        360 / segmentCount;

      /**
       * چند دور کامل برای انیمیشن
       */
      const extraTurns =
        5 +
        Math.floor(
          Math.random() * 3
        );

      /**
       * زاویه‌ای که خانه انتخاب‌شده
       * زیر فلش قرار بگیرد.
       */
      const targetAngle =
        360 -
        targetIndex * anglePerSegment -
        anglePerSegment / 2;

      const currentNormalized =
        ((rotation % 360) + 360) % 360;

      let delta =
        targetAngle -
        currentNormalized;

      if (delta < 0) {
        delta += 360;
      }

      const finalRotation =
        rotation +
        extraTurns * 360 +
        delta;

      setRotation(finalRotation);

      /**
       * مدت انیمیشن چرخ
       */
      await new Promise<void>(
        (resolve) => {
          spinTimerRef.current =
            setTimeout(
              resolve,
              4300
            );
        }
      );

      /**
       * اگر جایزه انتخاب شده بود،
       * آن را به‌صورت اتمیک رزرو می‌کنیم.
       *
       * شرط is_available=true مهم است
       * تا جایزه‌ای که قبلاً برده شده دوباره
       * قابل دریافت نباشد.
       */
      let finalIsWin = false;
      let finalLabel = "پوچ";

      if (
        selectedSegment.type === "prize" &&
        shouldWin
      ) {
        const { data: reservedPrize, error: reserveError } =
          await supabase
            .from("raffle_segments")
            .update({
              is_available: false,
            })
            .eq(
              "id",
              selectedSegment.id
            )
            .eq(
              "type",
              "prize"
            )
            .eq(
              "is_available",
              true
            )
            .select(
              "id,position,label,type,amount,is_available"
            )
            .maybeSingle();

        if (reserveError) {
          console.error(
            reserveError
          );
        }

        if (reservedPrize) {
          finalIsWin = true;

          finalLabel =
            reservedPrize.amount
              ? tomanLabel(
                  reservedPrize.amount
                )
              : reservedPrize.label ||
                "جایزه";
        } else {
          /**
           * اگر همزمان شخص دیگری جایزه را گرفته باشد،
           * این چرخش پوچ محسوب می‌شود.
           */
          finalIsWin = false;
          finalLabel = "پوچ";
        }
      } else {
        finalIsWin = false;
        finalLabel = "پوچ";
      }

      /**
       * ثبت تاریخچه
       */
      const { error: historyError } =
        await supabase
          .from("raffle_spins")
          .insert({
            participant_id:
              participant.id,
            phone:
              participant.phone,
            label:
              finalLabel,
            is_win:
              finalIsWin,
          });

      if (historyError) {
        console.error(
          historyError
        );
      }

      /**
       * مصرف یک شانس
       */
      const newUsed =
        participant.spins_used + 1;

      const { data: updatedParticipant, error: participantError } =
        await supabase
          .from("raffle_participants")
          .update({
            spins_used: newUsed,
          })
          .eq(
            "id",
            participant.id
          )
          .eq(
            "spins_used",
            participant.spins_used
          )
          .select(
            "id,phone,spins_used,spins_allowed,referral_code,referred_by"
          )
          .maybeSingle();

      if (participantError) {
        console.error(
          participantError
        );
      }

      if (updatedParticipant) {
        setParticipant(
          updatedParticipant as Participant
        );
      } else {
        /**
         * اگر آپدیت همزمانی داشت،
         * اطلاعات را دوباره می‌خوانیم.
         */
        await loadParticipant();
      }

      setResult({
        label: finalLabel,
        isWin: finalIsWin,
      });

      if (finalIsWin) {
        setMessage(
          `🎉 تبریک! شما برنده ${finalLabel} شدید.`
        );
      } else {
        setMessage(
          "این بار پوچ شد؛ برای دفعه بعد دوباره شانس خود را امتحان کنید."
        );
      }

      await refreshSegments();
      await refreshHistory();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "در اجرای قرعه‌کشی خطایی رخ داد."
      );
    } finally {
      setSpinning(false);
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-[#f5faf7] flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-4">
          <Spinner />
          <p className="text-gray-600">
            در حال آماده‌سازی قرعه‌کشی...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f5faf7] pb-16"
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        {/* Header */}
        <section className="rounded-3xl bg-gradient-to-l from-[#0b6e4f] to-[#15966b] p-6 text-white shadow-lg">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 text-sm opacity-80">
                جم‌سیتی
              </div>

              <h1 className="text-2xl font-black md:text-3xl">
                قرعه‌کشی شهر جم 🎁
              </h1>

              <p className="mt-2 text-sm leading-7 opacity-90">
                شانس خودت را امتحان کن و برنده جایزه شو!
              </p>
            </div>

            <div className="rounded-2xl bg-white/15 px-5 py-4 text-center backdrop-blur">
              <div className="text-xs opacity-80">
                شانس باقی‌مانده
              </div>

              <div className="mt-1 text-3xl font-black">
                {remaining}
              </div>
            </div>
          </div>
        </section>

        {/* Win Window Banner */}
        <section className="mt-4 rounded-2xl border border-[#F4C542]/40 bg-[#fffdf2] p-4 text-center shadow-sm">
          <div className="text-lg font-black text-[#876b00]">
            🎯 هر ۱۰ تا ۱۲ چرخش، یک نفر برنده می‌شود
          </div>

          <div className="mt-1 text-sm text-gray-600">
            بین همه شرکت‌کنندگان سایت، معمولاً هر ۱۰ تا ۱۲ چرخش (و گاهی تا ۱۵ چرخش) یک برد قطعی وجود دارد.
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Message */}
        {message && (
          <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        )}

        {/* Auto sign-up state - no phone form needed anymore */}
        {!participant && (
          <section className="mt-6 rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
            {!user?.id ? (
              <>
                <h2 className="text-lg font-black text-gray-900">
                  شروع قرعه‌کشی
                </h2>

                <p className="mt-2 text-sm leading-7 text-gray-500">
                  برای شرکت در قرعه‌کشی و دریافت {FREE_SPINS} شانس رایگان، ابتدا وارد حساب کاربری خود شوید.
                </p>

                <Link
                  href="/onboarding"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0b6e4f] px-5 py-4 font-black text-white shadow-lg transition hover:bg-[#095c42]"
                >
                  ورود / ثبت‌نام
                </Link>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6">
                <Spinner />
                <p className="text-sm text-gray-500">
                  در حال فعال‌سازی {FREE_SPINS} شانس رایگان شما...
                </p>
              </div>
            )}
          </section>
        )}

        {/* Participant Info */}
        {participant && (
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="text-xs text-gray-400">
                شماره شرکت‌کننده
              </div>

              <div
                dir="ltr"
                className="mt-2 text-lg font-black text-gray-900"
              >
                {maskPhone(
                  participant.phone
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="text-xs text-gray-400">
                شانس باقی‌مانده
              </div>

              <div className="mt-2 text-2xl font-black text-[#0b6e4f]">
                {remaining}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="text-xs text-gray-400">
                کد دعوت شما
              </div>

              <div
                dir="ltr"
                className="mt-2 text-xl font-black tracking-widest text-[#876b00]"
              >
                {participant.referral_code}
              </div>
            </div>
          </section>
        )}

        {/* Wheel */}
        {participant && (
          <section className="mt-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 md:p-7">
            <div className="mb-6 text-center">
              <h2 className="text-xl font-black text-gray-900">
                چرخ را بچرخان 🎡
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                هر بار چرخش یک شانس مصرف می‌کند.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-[430px]">
              {/* Pointer */}
              <div className="absolute left-1/2 top-[-8px] z-20 -translate-x-1/2">
                <div
                  className="h-0 w-0"
                  style={{
                    borderLeft:
                      "16px solid transparent",
                    borderRight:
                      "16px solid transparent",
                    borderTop:
                      "30px solid #111827",
                  }}
                />
              </div>

              <div
                className="relative aspect-square w-full overflow-hidden rounded-full"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning
                    ? "transform 4.3s cubic-bezier(0.12, 0.72, 0.15, 1)"
                    : "none",
                }}
              >
                <svg
                  viewBox="0 0 100 100"
                  className="h-full w-full drop-shadow-xl"
                >
                  {segments.map(
                    (segment, index) => {
                      const count =
                        segments.length;

                      const angle =
                        360 / count;

                      const startAngle =
                        index * angle - 90;

                      const endAngle =
                        startAngle + angle;

                      const radius = 49;

                      const x1 =
                        50 +
                        radius *
                          Math.cos(
                            (startAngle *
                              Math.PI) /
                              180
                          );

                      const y1 =
                        50 +
                        radius *
                          Math.sin(
                            (startAngle *
                              Math.PI) /
                              180
                          );

                      const x2 =
                        50 +
                        radius *
                          Math.cos(
                            (endAngle *
                              Math.PI) /
                              180
                          );

                      const y2 =
                        50 +
                        radius *
                          Math.sin(
                            (endAngle *
                              Math.PI) /
                              180
                          );

                      const largeArcFlag =
                        angle > 180
                          ? 1
                          : 0;

                      const path = `
                        M 50 50
                        L ${x1} ${y1}
                        A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
                        Z
                      `;

                      const fill =
                        segment.type ===
                        "prize"
                          ? PRIZE_COLOR
                          : EMPTY_COLORS[
                              index %
                                EMPTY_COLORS.length
                            ];

                      const midAngle =
                        startAngle +
                        angle / 2;

                      const textRadius =
                        31;

                      const textX =
                        50 +
                        textRadius *
                          Math.cos(
                            (midAngle *
                              Math.PI) /
                              180
                          );

                      const textY =
                        50 +
                        textRadius *
                          Math.sin(
                            (midAngle *
                              Math.PI) /
                              180
                          );

                      return (
                        <g
                          key={segment.id}
                        >
                          <path
                            d={path}
                            fill={fill}
                            stroke="#ffffff"
                            strokeWidth="0.8"
                          />

                          <text
                            x={textX}
                            y={textY}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={
                              count >= 10
                                ? "2.6"
                                : "3.2"
                            }
                            fontWeight="800"
                            fill="#1f2937"
                            transform={`rotate(${midAngle + 90} ${textX} ${textY})`}
                          >
                            {segment.type ===
                            "prize"
                              ? "🎁"
                              : "پوچ"}
                          </text>
                        </g>
                      );
                    }
                  )}

                  {/* Center circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="12"
                    fill="#ffffff"
                    stroke="#0b6e4f"
                    strokeWidth="1.5"
                  />

                  <circle
                    cx="50"
                    cy="50"
                    r="9"
                    fill="#0b6e4f"
                  />

                  <text
                    x="50"
                    y="50"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="3.4"
                    fontWeight="900"
                    fill="#ffffff"
                  >
                    {spinning
                      ? "..."
                      : "بچرخان"}
                  </text>
                </svg>
              </div>

              {/* Spin Button */}
              <button
                type="button"
                onClick={doSpin}
                disabled={
                  spinning ||
                  remaining <= 0
                }
                className="mx-auto mt-6 flex min-w-[220px] items-center justify-center gap-2 rounded-2xl bg-[#0b6e4f] px-7 py-4 text-lg font-black text-white shadow-xl transition hover:bg-[#095c42] active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {spinning ? (
                  <>
                    <Spinner />
                    در حال چرخش...
                  </>
                ) : remaining > 0 ? (
                  <>
                    🎡 چرخاندن
                  </>
                ) : (
                  "شانس شما تمام شده"
                )}
              </button>
            </div>
          </section>
        )}

        {/* Result */}
        {result && (
          <section
            className={`mt-6 rounded-3xl p-6 text-center shadow-sm ${
              result.isWin
                ? "border border-[#F4C542]/50 bg-[#fffbea]"
                : "border border-gray-200 bg-white"
            }`}
          >
            {result.isWin ? (
              <>
                <div className="text-5xl">
                  🎉
                </div>

                <h2 className="mt-3 text-2xl font-black text-[#8a6b00]">
                  تبریک!
                </h2>

                <p className="mt-2 text-gray-700">
                  شما برنده شدید
                </p>

                <div className="mt-4 rounded-2xl bg-[#F4C542]/20 px-5 py-4 text-xl font-black text-[#715800]">
                  {result.label}
                </div>
              </>
            ) : (
              <>
                <div className="text-5xl">
                  😅
                </div>

                <h2 className="mt-3 text-xl font-black text-gray-800">
                  این بار پوچ شد
                </h2>

                <p className="mt-2 text-sm text-gray-500">
                  دفعه بعد دوباره شانس خودت را امتحان کن.
                </p>
              </>
            )}
          </section>
        )}

        {/* Share */}
        {participant && (
          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="text-center">
              <div className="text-3xl">
                👥
              </div>

              <h2 className="mt-2 text-lg font-black">
                شانس بیشتری می‌خواهی؟
              </h2>

              <p className="mt-2 text-sm leading-7 text-gray-500">
                لینک قرعه‌کشی را برای دوستانت بفرست؛ به ازای هر اشتراک‌گذاری موفق یک شانس اضافه می‌گیری، بدون هیچ سقفی.
              </p>

              <div
                dir="ltr"
                className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-center font-bold tracking-widest text-[#0b6e4f]"
              >
                {participant.referral_code}
              </div>

              <button
                type="button"
                onClick={shareWithFriends}
                disabled={sharing}
                className="mt-4 w-full rounded-2xl bg-[#F4C542] px-5 py-4 font-black text-gray-900 shadow-md transition hover:bg-[#e9ba32] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sharing
                  ? "در حال اشتراک‌گذاری..."
                  : "اشتراک‌گذاری و دریافت شانس 🎁"}
              </button>
            </div>
          </section>
        )}

        {/* History */}
        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-gray-900">
              نتایج قرعه‌کشی
            </h2>

            <span className="text-xs text-gray-400">
              آخرین نتایج
            </span>
          </div>

          {history.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              هنوز نتیجه‌ای ثبت نشده است.
            </div>
          ) : (
            <div className="mt-4 divide-y divide-gray-100">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-4"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-gray-800">
                      {item.is_win
                        ? "🎁 برنده شد"
                        : "😅 پوچ"}
                    </div>

                    <div className="mt-1 text-xs text-gray-400">
                      {maskPhone(
                        item.phone
                      )}
                    </div>
                  </div>

                  <div className="text-left">
                    <div
                      className={`text-sm font-black ${
                        item.is_win
                          ? "text-[#8a6b00]"
                          : "text-gray-500"
                      }`}
                    >
                      {item.label}
                    </div>

                    <div className="mt-1 text-xs text-gray-400">
                      {new Date(
                        item.created_at
                      ).toLocaleDateString(
                        "fa-IR"
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Rules */}
        <section className="mt-6 rounded-3xl bg-[#0b6e4f] p-5 text-white">
          <h2 className="text-lg font-black">
            قوانین قرعه‌کشی
          </h2>

          <ul className="mt-4 space-y-3 text-sm leading-7 text-white/90">
            <li>
              • هر شرکت‌کننده در شروع {FREE_SPINS} شانس رایگان دارد.
            </li>

            <li>
              • بعد از اتمام شانس‌ها، با ارسال لینک قرعه‌کشی برای دوستان می‌توانید دوباره شانس بگیرید.
            </li>

            <li>
              • سقفی برای تعداد ارسال لینک و دریافت شانس اضافه وجود ندارد.
            </li>

            <li>
              • به‌طور میانگین هر ۱۰ تا ۱۲ چرخش (و گاهی تا ۱۵ چرخش) یک نفر برنده می‌شود.
            </li>

            <li>
              • هر جایزه فقط یک بار قابل برنده شدن است.
            </li>

            <li>
              • پس از اتمام موجودی یک جایزه، آن جایزه دیگر قابل انتخاب نیست.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}

export default function RafflePage() {
  return (
    <Suspense
      fallback={
        <main
          dir="rtl"
          className="min-h-screen bg-[#f5faf7] flex items-center justify-center"
        >
          <div className="flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-gray-600">
              در حال بارگذاری...
            </p>
          </div>
        </main>
      }
    >
      <RafflePageContent />
    </Suspense>
  );
}