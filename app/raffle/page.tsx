"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/Feedback";

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

const FREE_SPINS = 2;
const PRIZE_COLOR = "#F4C542";
const EMPTY_COLORS = ["#EAF3EC", "#DCEAE1"];

function normalizePhone(input: string) {
  let p = (input || "").replace(/[^0-9]/g, "");
  if (p.startsWith("0098")) p = p.slice(4);
  else if (p.startsWith("98")) p = p.slice(2);
  if (p.startsWith("9") && p.length === 10) p = "0" + p;
  return p;
}
function isValidPhone(p: string) {
  return /^09\d{9}$/.test(p);
}
function maskPhone(p: string) {
  return p.slice(0, 4) + "***" + p.slice(-3);
}
function generateReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

/* ---------------------------------------------------------------
   RafflePage: default export. Wraps the real content in <Suspense>
   because the inner component calls useSearchParams(), which
   Next.js requires to be inside a Suspense boundary for the page
   to be build/prerender-safe (this is what breaks `next build` /
   Vercel deploys even though `next dev` doesn't complain).
--------------------------------------------------------------- */
export default function RafflePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#F7F9F4]">
          <Spinner label="در حال بارگذاری..." />
        </div>
      }
    >
      <RafflePageContent />
    </Suspense>
  );
}

function RafflePageContent() {
  // Cast to `any` here because the raffle_* tables aren't in the generated
  // Supabase Database types yet, which otherwise makes TS infer `never` for
  // insert/update payloads and fails `next build`'s type-check step.
  const supabase = createClient() as any;
  const searchParams = useSearchParams();

  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [history, setHistory] = useState<SpinHistoryItem[]>([]);
  const [phoneInput, setPhoneInput] = useState("");
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState<{ text: string; type: "err" | "ok" | "info" } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<{ text: string; win: boolean } | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const [sharing, setSharing] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);

  async function loadSegments() {
    const { data, error } = await supabase
      .from("raffle_segments")
      .select("id,position,label,type,amount,is_available")
      .order("position", { ascending: true });
    if (error) {
      console.error("Failed to load raffle segments:", error.message);
      return;
    }
    setSegments((data ?? []) as Segment[]);
  }

  async function loadHistory() {
    const { data, error } = await supabase
      .from("raffle_spins")
      .select("id,phone,label,is_win,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      console.error("Failed to load raffle history:", error.message);
      return;
    }
    setHistory((data ?? []) as SpinHistoryItem[]);
  }

  useEffect(() => {
    loadSegments();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remaining = useMemo(() => {
    if (!participant) return 0;
    return Math.max(0, participant.spins_allowed - participant.spins_used);
  }, [participant]);



  async function verifyPhone() {
    const phone = normalizePhone(phoneInput);
    if (!isValidPhone(phone)) {
      setPhoneMsg({ text: "شماره موبایل معتبر نیست (مثلاً 09123456789)", type: "err" });
      return;
    }
    setVerifying(true);
    setPhoneMsg({ text: "در حال بررسی...", type: "info" });

    const { data: existing, error: fetchError } = await supabase
      .from("raffle_participants")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (fetchError) {
      setPhoneMsg({ text: "مشکلی پیش اومد، دوباره امتحان کن", type: "err" });
      setVerifying(false);
      return;
    }

    if (existing) {
      setParticipant(existing as Participant);
      setPhoneMsg({ text: "خوش برگشتی!", type: "ok" });
      setVerifying(false);
      return;
    }

    // New participant — create record, and credit the referrer if a ?ref= code is present
    const refCode = searchParams.get("ref");
    const referralCode = generateReferralCode();

    const { data: created, error: insertError } = await supabase
      .from("raffle_participants")
      .insert({
        phone,
        spins_used: 0,
        spins_allowed: FREE_SPINS,
        referral_code: referralCode,
        referred_by: refCode || null,
      })
      .select()
      .single();

    if (insertError || !created) {
      setPhoneMsg({ text: "مشکلی در ثبت شماره پیش اومد، دوباره امتحان کن", type: "err" });
      setVerifying(false);
      return;
    }

    if (refCode) {
      const { data: referrer } = await supabase
        .from("raffle_participants")
        .select("*")
        .eq("referral_code", refCode)
        .maybeSingle();
      if (referrer && referrer.phone !== phone) {
        await supabase
          .from("raffle_participants")
          .update({ spins_allowed: referrer.spins_allowed + 1 })
          .eq("id", referrer.id);
      }
    }

    setParticipant(created as Participant);
    setPhoneMsg({ text: "خوش اومدی! ۲ چرخش رایگان داری.", type: "ok" });
    setVerifying(false);
  }

  async function shareWithFriends() {
    if (!participant || sharing) return;

    const siteLink = "https://jamapp.ir";
    setSharing(true);
    setShareMsg("");

    try {
      if (!navigator.share) {
        setShareMsg("امکان ارسال مستقیم روی این دستگاه وجود ندارد");
        return;
      }

      await navigator.share({
        title: "جم‌سیتی",
        text: "🎉 با جم‌سیتی همراه شو!\n\nاخبار، آگهی‌ها، کسب‌وکارها و خدمات شهر جم در یکجا\n\n",
        url: siteLink,
      });

      const newSpinsAllowed = participant.spins_allowed + 1;

      const { error } = await supabase
        .from("raffle_participants")
        .update({ spins_allowed: newSpinsAllowed })
        .eq("id", participant.id);

      if (error) {
        console.error("Failed to add share spin:", error.message);
        setShareMsg("ارسال انجام شد، اما شارژ شانس انجام نشد");
        return;
      }

      setParticipant({ ...participant, spins_allowed: newSpinsAllowed });
      setShareMsg("🎉 یک چرخش اضافه شد!");
      setTimeout(() => setShareMsg(""), 3000);
    } catch (error) {
      // لغو کردن پنل Share نباید شانس اضافه کند.
      console.log("Share cancelled:", error);
    } finally {
      setSharing(false);
    }
  }

  async function doSpin() {
    if (spinning || !participant || !segments || remaining <= 0) return;
    setSpinning(true);
    setResult(null);

    const { data: freshSegments } = await supabase
      .from("raffle_segments")
      .select("id,position,label,type,amount,is_available")
      .order("position", { ascending: true });
    const currentSegments = (freshSegments ?? segments) as Segment[];
    setSegments(currentSegments);

    const n = currentSegments.length;
    const step = 360 / n;
    const targetIndex = Math.floor(Math.random() * n);
    const seg = currentSegments[targetIndex];
    const targetAngleInWheel = targetIndex * step + step / 2;
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const finalRotation = rotation + extraSpins * 360 + (360 - targetAngleInWheel) - (rotation % 360);
    setRotation(finalRotation);

    setTimeout(async () => {
      let isWin = false;
      let label = seg.type === "prize" ? seg.label : "پوچ";

      if (seg.type === "prize" && seg.is_available) {
        const { data: updated } = await supabase
          .from("raffle_segments")
          .update({ is_available: false })
          .eq("id", seg.id)
          .eq("is_available", true)
          .select();
        if (updated && updated.length > 0) {
          isWin = true;
        } else {
          label = "پوچ";
        }
      }

      setResult({ text: label, win: isWin });

      await supabase.from("raffle_spins").insert({
        participant_id: participant.id,
        phone: participant.phone,
        segment_id: seg.id,
        label,
        is_win: isWin,
        amount: isWin ? seg.amount : null,
        given: false,
      });

      const newSpinsUsed = participant.spins_used + 1;
      await supabase
        .from("raffle_participants")
        .update({ spins_used: newSpinsUsed })
        .eq("id", participant.id);
      setParticipant({ ...participant, spins_used: newSpinsUsed });

      loadSegments();
      loadHistory();
      setSpinning(false);
    }, 4300);
  }

  function polar(cx: number, cy: number, r: number, angleDeg: number) {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  const R = 150,
    CX = 160,
    CY = 160;

  return (
    <div dir="rtl" className="mx-auto max-w-md space-y-4 bg-[#F7F9F4] px-4 pb-16 pt-6">
      <div className="text-center">
        <h1 className="text-xl font-black text-[#1D2B1F]">🎡 چرخ گردون قرعه‌کشی جم</h1>
        <p className="mt-1 text-[11px] text-[#8A968C]">
          ۲ چرخش رایگان برای هر شماره + چرخش اضافه با دعوت دوستان
        </p>
      </div>

      {!participant && (
        <div className="rounded-[20px] border border-[#E3EBDE] bg-white p-4 shadow-sm">
          <label className="mb-2 block text-[12px] font-bold text-[#3A4A3D]">
            شماره موبایلت رو وارد کن
          </label>
          <div className="flex gap-2" dir="ltr">
            <input
              type="tel"
              inputMode="numeric"
              maxLength={14}
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="09xxxxxxxxx"
              className="flex-1 rounded-xl border border-[#E3EBDE] bg-[#F7F9F4] px-3 py-2.5 text-center text-sm font-bold text-[#1D2B1F] caret-[#147A4B] outline-none focus:border-[#147A4B] placeholder:text-[#A8B2AA]"
            />
            <button
              onClick={verifyPhone}
              disabled={verifying}
              className="shrink-0 rounded-xl bg-[#147A4B] px-5 py-2.5 text-xs font-black text-white disabled:opacity-50"
            >
              ورود
            </button>
          </div>
          {phoneMsg && (
            <p
              className={`mt-2 text-center text-[11px] ${
                phoneMsg.type === "err"
                  ? "text-[#E2574C]"
                  : phoneMsg.type === "ok"
                  ? "text-[#147A4B]"
                  : "text-[#8A968C]"
              }`}
            >
              {phoneMsg.text}
            </p>
          )}
        </div>
      )}

      {participant && (
        <div className="rounded-[20px] border border-[#F0DCB4] bg-gradient-to-l from-[#FBEEDA] to-white p-4 shadow-sm">
          <div className="flex justify-between border-b border-[#F0DCB4] py-1.5 text-[12px]">
            <span className="text-[#8A7150]">شماره شما</span>
            <b className="text-[#1D2B1F]" dir="ltr">
              {participant.phone}
            </b>
          </div>
          <div className="flex justify-between border-b border-[#F0DCB4] py-1.5 text-[12px]">
            <span className="text-[#8A7150]">چرخش باقی‌مانده</span>
            <b className="text-[#D98F2B]">{remaining}</b>
          </div>
          <div className="mt-2">
            <label className="mb-1 block text-[11px] text-[#8A7150]">
              دوستانت رو دعوت کن؛ هر بار ارسال = یک چرخش اضافه 🎁
            </label>

            <button
              onClick={shareWithFriends}
              disabled={sharing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D98F2B] px-4 py-3 text-[12px] font-black text-white shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="text-base">📤</span>
              {sharing ? "در حال ارسال..." : "ارسال به دوستان"}
            </button>

            {shareMsg && (
              <p className="mt-1 text-center text-[11px] text-[#147A4B]">
                {shareMsg}
              </p>
            )}
          </div>
        </div>
      )}

      {!segments ? (
        <div className="flex h-72 items-center justify-center">
          <Spinner label="در حال بارگذاری چرخ..." />
        </div>
      ) : (
        <>
          <div className="relative mx-auto h-[290px] w-[290px]">
            <div
              className="absolute -top-3 left-1/2 z-10 h-0 w-0 -translate-x-1/2"
              style={{
                borderLeft: "16px solid transparent",
                borderRight: "16px solid transparent",
                borderTop: "24px solid #147A4B",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,.25))",
              }}
            />
            <svg
              ref={svgRef}
              viewBox="0 0 320 320"
              className="h-full w-full"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? "transform 4.2s cubic-bezier(0.17,0.67,0.12,0.99)" : "none",
                filter: "drop-shadow(0 6px 16px rgba(20,60,40,.18))",
              }}
            >
              {segments.map((seg, i) => {
                const n = segments.length;
                const step = 360 / n;
                const startAngle = i * step;
                const endAngle = startAngle + step;
                const p1 = polar(CX, CY, R, startAngle);
                const p2 = polar(CX, CY, R, endAngle);
                const largeArc = step > 180 ? 1 : 0;
                const showAsPrize = seg.type === "prize" && seg.is_available;
                const fill = showAsPrize ? PRIZE_COLOR : EMPTY_COLORS[i % 2];
                const midAngle = startAngle + step / 2;
                const labelPos = polar(CX, CY, R * 0.6, midAngle);
                const lines = showAsPrize ? seg.label.split(" ") : ["پوچ"];
                return (
                  <g key={seg.id}>
                    <path
                      d={`M${CX},${CY} L${p1.x},${p1.y} A${R},${R} 0 ${largeArc} 1 ${p2.x},${p2.y} Z`}
                      fill={fill}
                      stroke="#F7F9F4"
                      strokeWidth={2}
                    />
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={isPrize ? 10 : 12}
                      fontWeight={isPrize ? 700 : 500}
                      fill={isPrize ? "#5c4200" : "#8A968C"}
                      transform={`rotate(${midAngle}, ${labelPos.x}, ${labelPos.y})`}
                    >
                      {lines.map((line, li) => (
                        <tspan key={li} x={labelPos.x} dy={li === 0 ? 0 : "1.1em"}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div
              className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: "radial-gradient(circle at 35% 30%, #fff, #F4C542 60%, #D98F2B)",
                boxShadow: "0 0 0 4px #F7F9F4, 0 4px 10px rgba(0,0,0,.25)",
              }}
            />
          </div>

          <button
            onClick={doSpin}
            disabled={!participant || spinning || remaining <= 0}
            className="w-full rounded-full bg-gradient-to-l from-[#147A4B] to-[#0f9a56] py-3 text-sm font-black text-white shadow-[0_0_20px_rgba(57,255,143,.35)] disabled:opacity-40"
          >
            {!participant
              ? "ابتدا شماره‌ات رو وارد کن"
              : spinning
              ? "در حال چرخش..."
              : remaining <= 0
              ? "چرخش‌هات تموم شده — دوستاتو دعوت کن!"
              : `بچرخون 🎉 (${remaining} چرخش باقی‌مانده)`}
          </button>

          {result && (
            <p
              className={`text-center text-sm font-black ${
                result.win ? "text-[#147A4B]" : "text-[#8A968C]"
              }`}
            >
              {result.win ? `🎊 تبریک! برنده ${result.text} شدی` : "پوچ! شانس این دور همین بود 🙂"}
            </p>
          )}
        </>
      )}

      <div className="rounded-[18px] border border-[#E3EBDE] bg-white p-4">
        <h3 className="mb-2 text-[12px] font-black text-[#1D2B1F]">تاریخچه چرخش‌ها (همه)</h3>
        <ul className="max-h-44 space-y-1 overflow-y-auto">
          {history.length === 0 && (
            <li className="text-center text-[11px] text-[#8A968C]">هنوز چرخشی ثبت نشده</li>
          )}
          {history.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between border-b border-[#F3F6F1] py-1.5 text-[11px]"
            >
              <span className="text-[#3A4A3D]">{h.label}</span>
              <span className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    h.is_win ? "bg-[#E3F3E9] text-[#147A4B]" : "bg-[#F3F6F1] text-[#8A968C]"
                  }`}
                >
                  {h.is_win ? "برنده" : "پوچ"}
                </span>
                <span className="text-[#B0BAB1]" dir="ltr">
                  {maskPhone(h.phone)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center text-[10px] leading-6 text-[#B0BAB1]">
        توجه: شماره موبایل و نتیجه‌ی چرخش‌ها روی سرور مشترک ذخیره می‌شه تا از چرخش بیشتر از حد مجاز
        هر شماره جلوگیری بشه. تاریخچه با شماره‌ی نصفه‌مخفی به همه نمایش داده می‌شه.
      </p>
    </div>
  );
}
