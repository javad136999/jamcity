"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/Feedback";
import { useAuth } from "@/lib/auth-context";

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
  spins_allowed: number;
  spins_used: number;
};

type SpinHistoryItem = {
  id: string;
  label: string;
  amount: number | null;
  is_win: boolean;
  created_at: string;
};

const FREE_SPINS = 2;

const PRIZE_10K = {
  amount: 100000,
  label: "کارت شارژ ۱۰ هزارتومانی",
};

const PRIZE_5K = {
  amount: 50000,
  label: "کارت شارژ ۵ هزارتومانی",
};

function normalizePhone(value: string) {
  let phone = String(value || "").trim();

  phone = phone.replace(/[۰-۹]/g, (d) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))
  );

  phone = phone.replace(/[٠-٩]/g, (d) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(d))
  );

  phone = phone.replace(/\s+/g, "");

  if (phone.startsWith("+98")) {
    phone = "0" + phone.slice(3);
  }

  if (phone.startsWith("98") && phone.length === 12) {
    phone = "0" + phone.slice(2);
  }

  return phone;
}

function isValidPhone(value: string) {
  return /^09\d{9}$/.test(normalizePhone(value));
}

function maskPhone(phone: string) {
  const p = normalizePhone(phone);

  if (p.length !== 11) return p;

  return `${p.slice(0, 4)}****${p.slice(-3)}`;
}

function generateReferralCode(phone: string) {
  const clean = normalizePhone(phone);
  return `JAM-${clean.slice(-6)}`;
}

/**
 * این تابع چرخ را طوری می‌چیند که:
 * - فقط دو جایزه واقعی داشته باشیم.
 * - اگر جایزه‌های بیشتری در DB باشند، به پوچ تبدیل شوند.
 * - دو جایزه کنار هم قرار نگیرند.
 *
 * رکوردهای DB حذف نمی‌شوند تا سوابق قبلی raffle_spins خراب نشود.
 */
function prepareSegments(rows: Segment[]): Segment[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.position !== b.position) {
      return a.position - b.position;
    }

    return a.id.localeCompare(b.id);
  });

  if (sorted.length === 0) return [];

  const prizeRows = sorted.filter((s) => s.type === "prize");

  // حداکثر دو جایزه واقعی
  const firstPrize = prizeRows[0];
  const secondPrize = prizeRows[1];

  const chosenPrizes: Segment[] = [];

  if (firstPrize) {
    chosenPrizes.push({
      ...firstPrize,
      amount: PRIZE_10K.amount,
      label: PRIZE_10K.label,
      type: "prize",
      is_available: firstPrize.is_available,
    });
  }

  if (secondPrize) {
    chosenPrizes.push({
      ...secondPrize,
      amount: PRIZE_5K.amount,
      label: PRIZE_5K.label,
      type: "prize",
      is_available: secondPrize.is_available,
    });
  }

  const result = sorted.map((segment) => {
    const isChosenPrize = chosenPrizes.some((p) => p.id === segment.id);

    if (!isChosenPrize) {
      return {
        ...segment,
        type: "empty" as const,
        amount: null,
        label: "پوچ",
        is_available: true,
      };
    }

    return chosenPrizes.find((p) => p.id === segment.id)!;
  });

  if (result.length < 3 || chosenPrizes.length < 2) {
    return result;
  }

  /*
   * جایزه‌ها را در دو موقعیت غیرمجاور قرار می‌دهیم.
   *
   * اگر تعداد خانه‌ها N باشد، فاصله حداقل یک خانه پوچ
   * بین دو جایزه قرار می‌گیرد.
   */
  const prizeIds = chosenPrizes.map((p) => p.id);

  const firstIndex = result.findIndex((s) => s.id === prizeIds[0]);
  const secondIndex = result.findIndex((s) => s.id === prizeIds[1]);

  if (firstIndex === -1 || secondIndex === -1) {
    return result;
  }

  const n = result.length;

  const circularDistance = Math.min(
    Math.abs(firstIndex - secondIndex),
    n - Math.abs(firstIndex - secondIndex)
  );

  // اگر مجاور هستند، جایزه دوم را به یک موقعیت مناسب منتقل می‌کنیم.
  if (circularDistance <= 1) {
    const targetCandidates: number[] = [];

    for (let i = 0; i < n; i++) {
      if (i === firstIndex) continue;

      const distance = Math.min(
        Math.abs(i - firstIndex),
        n - Math.abs(i - firstIndex)
      );

      if (distance >= 2) {
        targetCandidates.push(i);
      }
    }

    if (targetCandidates.length > 0) {
      const target = targetCandidates[0];

      const copy = [...result];

      const prize = copy[secondIndex];
      const targetSegment = copy[target];

      copy[target] = prize;
      copy[secondIndex] = {
        ...targetSegment,
        type: "empty",
        amount: null,
        label: "پوچ",
        is_available: true,
      };

      return copy.map((segment, index) => ({
        ...segment,
        position: index,
      }));
    }
  }

  return result.map((segment, index) => ({
    ...segment,
    position: index,
  }));
}

function RafflePageContent() {
  const supabase = createClient() as any;
  const router = useRouter();
  const searchParams = useSearchParams();

  const { user, profile, loading: authLoading } = useAuth() as any;

  const [segments, setSegments] = useState<Segment[]>([]);
  const [history, setHistory] = useState<SpinHistoryItem[]>([]);
  const [phoneInput, setPhoneInput] = useState("");
  const [participant, setParticipant] = useState<Participant | null>(null);

  const [verifying, setVerifying] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState<{
    text: string;
    type: "err" | "ok" | "info";
    register?: boolean;
  } | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinHistoryItem | null>(null);

  const [shareMsg, setShareMsg] = useState("");
  const [sharing, setSharing] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const referralCode = useMemo(() => {
    if (!participant?.phone) return "";
    return generateReferralCode(participant.phone);
  }, [participant?.phone]);

  /**
   * تعداد خانه‌ها
   */
  const segmentCount = segments.length;

  /**
   * زاویه هر خانه
   */
  const segmentAngle =
    segmentCount > 0 ? 360 / segmentCount : 45;

  /**
   * بارگذاری خانه‌های چرخ
   */
  async function loadSegments() {
    const { data, error } = await supabase
      .from("raffle_segments")
      .select(
        "id,position,label,type,amount,is_available"
      )
      .order("position", { ascending: true });

    if (error) {
      console.error("Failed to load raffle segments:", error.message);
      return;
    }

    const prepared = prepareSegments(
      (data ?? []) as Segment[]
    );

    setSegments(prepared);

    /**
     * همگام‌سازی دو جایزه اصلی در DB.
     *
     * دو رکورد اول جایزه:
     * 1) 100000
     * 2) 50000
     *
     * بقیه به پوچ تبدیل می‌شوند.
     */
    const originalPrizeRows = ((data ?? []) as Segment[])
      .filter((s) => s.type === "prize")
      .sort((a, b) => a.position - b.position);

    if (originalPrizeRows.length > 0) {
      const first = originalPrizeRows[0];

      await supabase
        .from("raffle_segments")
        .update({
          amount: PRIZE_10K.amount,
          label: PRIZE_10K.label,
          type: "prize",
        })
        .eq("id", first.id);
    }

    if (originalPrizeRows.length > 1) {
      const second = originalPrizeRows[1];

      await supabase
        .from("raffle_segments")
        .update({
          amount: PRIZE_5K.amount,
          label: PRIZE_5K.label,
          type: "prize",
        })
        .eq("id", second.id);
    }

    if (originalPrizeRows.length > 2) {
      const extraIds = originalPrizeRows
        .slice(2)
        .map((s) => s.id);

      await supabase
        .from("raffle_segments")
        .update({
          type: "empty",
          amount: null,
          label: "پوچ",
          is_available: true,
        })
        .in("id", extraIds);
    }
  }

  async function loadHistory(phone: string) {
    if (!phone) return;

    const cleanPhone = normalizePhone(phone);

    const { data, error } = await supabase
      .from("raffle_spins")
      .select(
        "id,label,amount,is_win,created_at"
      )
      .eq("phone", cleanPhone)
      .order("created_at", {
        ascending: false,
      })
      .limit(20);

    if (error) {
      console.error(
        "Failed to load raffle history:",
        error.message
      );
      return;
    }

    setHistory(
      (data ?? []) as SpinHistoryItem[]
    );
  }

  async function loadParticipant(phone: string) {
    const cleanPhone = normalizePhone(phone);

    const { data, error } = await supabase
      .from("raffle_participants")
      .select(
        "id,phone,spins_allowed,spins_used"
      )
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (error) {
      console.error(
        "Failed to load participant:",
        error.message
      );
      return null;
    }

    if (!data) return null;

    return data as Participant;
  }

  useEffect(() => {
    loadSegments();
  }, []);

  /**
   * اگر کاربر از قبل لاگین است، شماره حسابش را
   * برای راحتی داخل فیلد قرار می‌دهیم.
   */
  useEffect(() => {
    if (!user || !profile) return;

    const accountPhone =
      normalizePhone(
        profile?.username ??
          profile?.phone ??
          ""
      );

    if (isValidPhone(accountPhone)) {
      setPhoneInput(accountPhone);
    }
  }, [user, profile]);

  /**
   * اگر participant موجود است، تاریخچه را بخوان.
   */
  useEffect(() => {
    if (participant?.phone) {
      loadHistory(participant.phone);
    }
  }, [participant?.phone]);

  /**
   * بررسی شماره موبایل
   */
  async function verifyPhone() {
    setPhoneMsg(null);
    setResult(null);

    if (!user) {
      setPhoneMsg({
        text: "ابتدا وارد حساب کاربری خود شوید.",
        type: "err",
      });
      return;
    }

    const phone = normalizePhone(phoneInput);

    if (!isValidPhone(phone)) {
      setPhoneMsg({
        text: "شماره موبایل معتبر وارد کنید.",
        type: "err",
      });
      return;
    }

    setVerifying(true);

    try {
      const { data: accountProfile, error } =
        await supabase
          .from("profiles")
          .select("id,username,phone")
          .eq("id", user.id)
          .maybeSingle();

      if (error) {
        console.error(
          "Profile error:",
          error.message
        );

        setPhoneMsg({
          text: "خطا در بررسی حساب کاربری.",
          type: "err",
        });

        return;
      }

      const accountPhone = normalizePhone(
        accountProfile?.phone ??
          accountProfile?.username ??
          ""
      );

      if (!accountPhone || phone !== accountPhone) {
        setParticipant(null);

        setPhoneMsg({
          text: "این شماره با حساب کاربری شما مطابقت ندارد.",
          type: "err",
          register: true,
        });

        return;
      }

      let existing =
        await loadParticipant(phone);

      /**
       * اگر اولین بار است وارد قرعه‌کشی می‌شود،
       * دو شانس رایگان ایجاد می‌کنیم.
       */
      if (!existing) {
        const { data: created, error: createError } =
          await supabase
            .from("raffle_participants")
            .insert({
              phone,
              spins_allowed: FREE_SPINS,
              spins_used: 0,
            })
            .select(
              "id,phone,spins_allowed,spins_used"
            )
            .single();

        if (createError) {
          console.error(
            "Failed to create participant:",
            createError.message
          );

          setPhoneMsg({
            text: "ثبت اطلاعات قرعه‌کشی انجام نشد.",
            type: "err",
          });

          return;
        }

        existing = created as Participant;
      }

      setParticipant(existing);

      setPhoneMsg({
        text: "شماره با حساب شما تأیید شد.",
        type: "ok",
      });

      await loadHistory(phone);
    } finally {
      setVerifying(false);
    }
  }

  /**
   * اشتراک‌گذاری سایت
   */
  async function shareWithFriends() {
    if (!participant) return;

    setSharing(true);
    setShareMsg("");

    try {
      if (!navigator.share) {
        setShareMsg(
          "اشتراک‌گذاری مستقیم روی این مرورگر پشتیبانی نمی‌شود."
        );
        return;
      }

      await navigator.share({
        title: "جم‌سیتی",
        text: "در قرعه‌کشی شهر جم شرکت کن 🎁",
        url: "https://jamapp.ir",
      });

      /**
       * فقط در صورت موفقیت share شانس اضافه می‌شود.
       */
      const nextAllowed =
        Number(participant.spins_allowed ?? 0) + 1;

      const { error } = await supabase
        .from("raffle_participants")
        .update({
          spins_allowed: nextAllowed,
        })
        .eq("id", participant.id);

      if (error) {
        console.error(
          "Failed to add share spin:",
          error.message
        );

        setShareMsg(
          "اشتراک انجام شد اما افزودن شانس با خطا مواجه شد."
        );

        return;
      }

      setParticipant({
        ...participant,
        spins_allowed: nextAllowed,
      });

      setShareMsg(
        "اشتراک موفق بود؛ یک شانس اضافه شد 🎉"
      );
    } catch (error: any) {
      if (
        error?.name === "AbortError" ||
        error?.name === "NotAllowedError"
      ) {
        setShareMsg("اشتراک‌گذاری لغو شد.");
      } else {
        console.error(error);
        setShareMsg("اشتراک‌گذاری انجام نشد.");
      }
    } finally {
      setSharing(false);
    }
  }

  /**
   * اجرای چرخ
   */
  async function doSpin() {
    if (!participant || spinning) return;

    const allowed =
      Number(participant.spins_allowed ?? 0);

    const used =
      Number(participant.spins_used ?? 0);

    if (used >= allowed) {
      setResult({
        id: `no-spin-${Date.now()}`,
        label: "شانس شما تمام شده است.",
        amount: null,
        is_win: false,
        created_at: new Date().toISOString(),
      });

      return;
    }

    /**
     * قبل از چرخش، اطلاعات را دوباره از DB می‌گیریم.
     */
    const { data, error } = await supabase
      .from("raffle_segments")
      .select(
        "id,position,label,type,amount,is_available"
      )
      .order("position", {
        ascending: true,
      });

    if (error || !data?.length) {
      setResult({
        id: `error-${Date.now()}`,
        label: "خطا در بارگذاری چرخ.",
        amount: null,
        is_win: false,
        created_at: new Date().toISOString(),
      });

      return;
    }

    const currentSegments = prepareSegments(
      data as Segment[]
    );

    setSegments(currentSegments);

    /**
     * فقط خانه‌های زیر مجاز به انتخاب هستند:
     * - پوچ
     * - جایزه‌ای که هنوز موجود است
     */
    const eligibleIndexes =
      currentSegments
        .map((seg, index) => ({
          seg,
          index,
        }))
        .filter(
          ({ seg }) =>
            seg.type === "empty" ||
            (seg.type === "prize" &&
              seg.is_available)
        )
        .map(({ index }) => index);

    if (eligibleIndexes.length === 0) {
      setResult({
        id: `empty-${Date.now()}`,
        label: "جوایز به پایان رسیده‌اند.",
        amount: null,
        is_win: false,
        created_at: new Date().toISOString(),
      });

      return;
    }

    const randomIndex =
      eligibleIndexes[
        Math.floor(
          Math.random() *
            eligibleIndexes.length
        )
      ];

    const selected =
      currentSegments[randomIndex];

    /**
     * چرخش طوری تنظیم می‌شود که خانه انتخاب‌شده
     * در بالای چرخ قرار بگیرد.
     */
    const targetAngle =
      360 -
      (randomIndex * segmentAngle +
        segmentAngle / 2);

    const extraRotations =
      360 * 6;

    const newRotation =
      rotation +
      extraRotations +
      targetAngle -
      (rotation % 360);

    setSpinning(true);
    setResult(null);

    setRotation(newRotation);

    /**
     * زمان انیمیشن
     */
    await new Promise((resolve) =>
      setTimeout(resolve, 4300)
    );

    let isWin = false;
    let wonAmount: number | null = null;
    let finalLabel = "پوچ";

    /**
     * اگر جایزه بود، آن را رزرو می‌کنیم.
     *
     * شرط is_available=true باعث می‌شود
     * جایزه قبلاً مصرف‌شده دوباره برده نشود.
     */
    if (
      selected.type === "prize" &&
      selected.is_available
    ) {
      const { data: reservedPrize, error: reserveError } =
        await supabase
          .from("raffle_segments")
          .update({
            is_available: false,
          })
          .eq("id", selected.id)
          .eq("type", "prize")
          .eq("is_available", true)
          .select(
            "id,label,amount,is_available"
          )
          .maybeSingle();

      if (
        !reserveError &&
        reservedPrize
      ) {
        isWin = true;
        wonAmount =
          reservedPrize.amount ?? null;
        finalLabel =
          reservedPrize.label ||
          selected.label;
      }
    }

    /**
     * ثبت نتیجه چرخش
     */
    const { error: spinError } =
      await supabase
        .from("raffle_spins")
        .insert({
          phone: normalizePhone(
            participant.phone
          ),
          segment_id: selected.id,
          label: finalLabel,
          amount: wonAmount,
          is_win: isWin,
          given: false,
        });

    if (spinError) {
      console.error(
        "Failed to insert raffle spin:",
        spinError.message
      );
    }

    /**
     * مصرف یک شانس
     */
    const newUsed = used + 1;

    const { error: participantError } =
      await supabase
        .from("raffle_participants")
        .update({
          spins_used: newUsed,
        })
        .eq("id", participant.id);

    if (participantError) {
      console.error(
        "Failed to update participant:",
        participantError.message
      );
    }

    setParticipant({
      ...participant,
      spins_used: newUsed,
    });

    const spinResult: SpinHistoryItem = {
      id: `result-${Date.now()}`,
      label: finalLabel,
      amount: wonAmount,
      is_win: isWin,
      created_at: new Date().toISOString(),
    };

    setResult(spinResult);

    /**
     * تاریخچه را دوباره بخوان
     */
    await loadHistory(participant.phone);

    /**
     * وضعیت چرخ را دوباره از DB بخوان.
     */
    await loadSegments();

    setSpinning(false);
  }

  const remainingSpins = participant
    ? Math.max(
        0,
        Number(participant.spins_allowed ?? 0) -
          Number(participant.spins_used ?? 0)
      )
    : 0;

  if (authLoading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[70vh] items-center justify-center"
      >
        <Spinner />
      </div>
    );
  }

  /**
   * کاربر وارد نشده
   */
  if (!user) {
    return (
      <main
        dir="rtl"
        className="mx-auto max-w-md px-4 py-10"
      >
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#147A4B] text-3xl font-black text-white">
            ج
          </div>

          <h1 className="text-xl font-black text-slate-800">
            قرعه‌کشی جم‌سیتی
          </h1>

          <p className="mt-2 text-sm leading-7 text-slate-500">
            برای شرکت در قرعه‌کشی ابتدا وارد حساب
            کاربری خود شوید.
          </p>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mt-5 w-full rounded-2xl bg-[#147A4B] py-3 text-sm font-black text-white shadow-sm transition active:scale-[0.98]"
          >
            ورود به حساب
          </button>

          <button
            type="button"
            onClick={() =>
              router.push("/register")
            }
            className="mt-3 w-full rounded-2xl border border-[#147A4B] py-3 text-sm font-black text-[#147A4B] transition active:scale-[0.98]"
          >
            ثبت‌نام
          </button>
        </div>
      </main>
    );
  }

  /**
   * شماره هنوز تأیید نشده
   */
  if (!participant) {
    return (
      <main
        dir="rtl"
        className="mx-auto max-w-md px-4 py-8"
      >
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-[#147A4B] to-[#0B4F32] px-6 py-8 text-center text-white">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-3xl font-black">
              🎁
            </div>

            <h1 className="text-2xl font-black">
              قرعه‌کشی جم‌سیتی
            </h1>

            <p className="mt-2 text-sm leading-6 text-white/80">
              شانس خودت را امتحان کن!
            </p>
          </div>

          <div className="p-6">
            <label className="block text-xs font-black text-slate-600">
              شماره موبایل حساب کاربری
            </label>

            <input
              type="tel"
              inputMode="numeric"
              dir="ltr"
              value={phoneInput}
              onChange={(e) =>
                setPhoneInput(
                  e.target.value
                )
              }
              placeholder="09123456789"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black tracking-wide text-[#1D2B1F] caret-[#147A4B] outline-none transition focus:border-[#147A4B] focus:ring-2 focus:ring-[#147A4B]/10 placeholder:text-[#A8B2AA]"
            />

            {phoneMsg && (
              <div
                className={`mt-3 flex items-center justify-center gap-2 text-[11px] ${
                  phoneMsg.type === "err"
                    ? "text-[#E2574C]"
                    : phoneMsg.type === "ok"
                    ? "text-[#147A4B]"
                    : "text-[#8A968C]"
                }`}
              >
                <span>
                  {phoneMsg.text}
                </span>

                {phoneMsg.register && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push("/register")
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-[#147A4B] px-3 py-1.5 text-[10px] font-black text-white shadow-sm transition hover:brightness-110 active:scale-95"
                  >
                    <span>👤</span>
                    ثبت‌نام
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={verifying}
              onClick={verifyPhone}
              className="mt-4 w-full rounded-2xl bg-[#147A4B] py-3 text-sm font-black text-white shadow-sm transition hover:brightness-110 disabled:opacity-50 active:scale-[0.98]"
            >
              {verifying
                ? "در حال بررسی..."
                : "تأیید شماره و ورود به قرعه‌کشی"}
            </button>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-center">
              <p className="text-xs leading-6 text-slate-500">
                شماره‌ای که وارد می‌کنید باید با
                شماره ثبت‌شده در حساب کاربری شما
                یکسان باشد.
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push("/register")
                }
                className="mt-2 text-xs font-black text-[#147A4B] hover:underline"
              >
                هنوز حساب ندارم؛ ثبت‌نام کنم
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /**
   * صفحه اصلی قرعه‌کشی
   */
  return (
    <main
      dir="rtl"
      className="mx-auto max-w-xl px-3 py-5 sm:px-5"
    >
      <div className="mb-4 text-center">
        <h1 className="text-2xl font-black text-slate-800">
          🎁 قرعه‌کشی جم‌سیتی
        </h1>

        <p className="mt-1 text-xs text-slate-400">
          {maskPhone(participant.phone)}
        </p>
      </div>

      {/* وضعیت شانس */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <div className="text-2xl font-black text-[#147A4B]">
            {remainingSpins}
          </div>

          <div className="mt-1 text-[11px] text-slate-400">
            شانس باقی‌مانده
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <div className="text-2xl font-black text-[#147A4B]">
            {history.filter(
              (item) => item.is_win
            ).length}
          </div>

          <div className="mt-1 text-[11px] text-slate-400">
            تعداد بردها
          </div>
        </div>
      </div>

      {/* چرخ */}
      <div className="relative mx-auto aspect-square w-full max-w-[390px]">
        <div className="absolute left-1/2 top-[-4px] z-20 -translate-x-1/2">
          <div
            className="h-0 w-0 border-l-[14px] border-r-[14px] border-t-[30px] border-l-transparent border-r-transparent border-t-[#E2574C] drop-shadow-md"
          />
        </div>

        <div
          className="absolute inset-2 rounded-full bg-white p-2 shadow-[0_10px_40px_rgba(0,0,0,0.15)]"
        >
          <div
            className="relative h-full w-full overflow-hidden rounded-full border-[6px] border-[#147A4B]"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning
                ? "transform 4.3s cubic-bezier(0.12, 0.72, 0.18, 1)"
                : "none",
            }}
          >
            {segments.map((seg, index) => {
              const angle =
                segmentCount > 0
                  ? 360 / segmentCount
                  : 45;

              const rotate =
                index * angle;

              const isPrize =
                seg.type === "prize";

              const showAsPrize =
                isPrize &&
                seg.is_available;

              const textLines = showAsPrize
                ? seg.label.split(" ")
                : ["پوچ"];

              return (
                <div
                  key={seg.id}
                  className="absolute left-1/2 top-1/2 h-full w-1/2 origin-left"
                  style={{
                    transform: `rotate(${rotate}deg) skewY(${
                      -(90 - angle)
                    }deg)`,
                  }}
                >
                  <div
                    className={`absolute left-0 top-0 h-full w-full origin-left ${
                      showAsPrize
                        ? "bg-[#F3C969]"
                        : "bg-slate-100"
                    }`}
                    style={{
                      clipPath: `polygon(0 0, 100% ${
                        (100 *
                          angle) /
                        180
                      }%, 0 100%)`,
                    }}
                  />

                  <div
                    className="absolute left-[18%] top-1/2 z-10 flex -translate-y-1/2 -rotate-[0deg] items-center justify-center"
                    style={{
                      transform: `translateY(-50%) rotate(${
                        -angle / 2
                      }deg)`,
                    }}
                  >
                    <div
                      className={`w-[92px] text-center text-[9px] font-black leading-4 sm:w-[105px] ${
                        showAsPrize
                          ? "text-[#5B4610]"
                          : "text-slate-500"
                      }`}
                    >
                      {textLines.map(
                        (line, i) => (
                          <div key={i}>
                            {line}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* مرکز چرخ */}
        <div className="absolute left-1/2 top-1/2 z-30 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-[#147A4B] shadow-xl">
          <span className="text-2xl font-black text-white">
            ج
          </span>
        </div>
      </div>

      {/* دکمه چرخاندن */}
      <button
        type="button"
        disabled={
          spinning ||
          remainingSpins <= 0 ||
          segments.length === 0
        }
        onClick={doSpin}
        className="mx-auto mt-5 block w-full max-w-[330px] rounded-2xl bg-[#147A4B] py-4 text-base font-black text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {spinning
          ? "در حال چرخش..."
          : remainingSpins > 0
          ? "🎯 چرخاندن چرخ"
          : "شانس شما تمام شده است"}
      </button>

      {/* نتیجه */}
      {result && (
        <div
          className={`mt-5 rounded-3xl border p-5 text-center ${
            result.is_win
              ? "border-[#E8C866] bg-[#FFF9E8]"
              : "border-slate-200 bg-white"
          }`}
        >
          {result.is_win ? (
            <>
              <div className="text-3xl">
                🎉
              </div>

              <h2 className="mt-2 text-lg font-black text-[#147A4B]">
                تبریک! شما برنده شدید
              </h2>

              <p className="mt-2 text-sm font-black text-slate-700">
                {result.label}
              </p>

              {result.amount && (
                <p className="mt-1 text-xs text-slate-500">
                  مبلغ جایزه:{" "}
                  {result.amount.toLocaleString(
                    "fa-IR"
                  )}{" "}
                  تومان
                </p>
              )}

              <p className="mt-3 text-[11px] text-slate-400">
                جایزه شما توسط مدیریت بررسی و
                تحویل خواهد شد.
              </p>
            </>
          ) : (
            <>
              <div className="text-3xl">
                😅
              </div>

              <h2 className="mt-2 text-base font-black text-slate-600">
                پوچ
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                این بار شانست نگرفت؛ دوباره امتحان کن.
              </p>
            </>
          )}
        </div>
      )}

      {/* اشتراک‌گذاری */}
      <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-center">
          <div className="text-2xl">
            📤
          </div>

          <h3 className="mt-2 text-sm font-black text-slate-700">
            یک شانس دیگر می‌خواهی؟
          </h3>

          <p className="mt-1 text-xs leading-6 text-slate-400">
            جم‌سیتی را با دوستانت به اشتراک بگذار
            و یک شانس اضافه دریافت کن.
          </p>

          <button
            type="button"
            disabled={sharing}
            onClick={shareWithFriends}
            className="mt-3 w-full rounded-2xl bg-[#147A4B] py-3 text-xs font-black text-white shadow-sm transition hover:brightness-110 disabled:opacity-50 active:scale-[0.98]"
          >
            {sharing
              ? "در حال اشتراک‌گذاری..."
              : "ارسال به دوستان"}
          </button>

          {shareMsg && (
            <p className="mt-2 text-[11px] text-[#147A4B]">
              {shareMsg}
            </p>
          )}

          {referralCode && (
            <p className="mt-3 text-[10px] text-slate-300">
              کد قرعه‌کشی: {referralCode}
            </p>
          )}
        </div>
      </div>

      {/* تاریخچه */}
      {history.length > 0 && (
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-black text-slate-700">
            سوابق قرعه‌کشی
          </h3>

          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between rounded-2xl px-3 py-3 ${
                  item.is_win
                    ? "bg-[#FFF9E8]"
                    : "bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>
                    {item.is_win
                      ? "🎁"
                      : "⭕"}
                  </span>

                  <span
                    className={`text-xs font-bold ${
                      item.is_win
                        ? "text-[#147A4B]"
                        : "text-slate-500"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>

                {item.amount && (
                  <span className="text-[10px] font-black text-slate-500">
                    {item.amount.toLocaleString(
                      "fa-IR"
                    )}{" "}
                    تومان
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 pb-8 text-center">
        <p className="text-[10px] leading-5 text-slate-300">
          قرعه‌کشی جم‌سیتی
        </p>
      </div>
    </main>
  );
}

export default function RafflePage() {
  return (
    <Suspense
      fallback={
        <div
          dir="rtl"
          className="flex min-h-[70vh] items-center justify-center"
        >
          <Spinner />
        </div>
      }
    >
      <RafflePageContent />
    </Suspense>
  );
}