"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type InsuranceType =
  | "car-third-party-installment"
  | "car-body"
  | "motorcycle-third-party-installment"
  | "motorcycle-body";

const OPTIONS: Array<{ type: InsuranceType; title: string; icon: string; tone: string }> = [
  { type: "car-third-party-installment", title: "شخص ثالث خودرو (اقساطی)", icon: "🚗", tone: "border-[#BFD7F2] bg-[#F3F8FF]" },
  { type: "car-body", title: "بدنه خودرو", icon: "🚘", tone: "border-[#D8B66A] bg-[#FFF9E8]" },
  { type: "motorcycle-third-party-installment", title: "شخص ثالث موتور (اقساطی)", icon: "🏍️", tone: "border-[#CBE2D1] bg-[#F2FAF4]" },
  { type: "motorcycle-body", title: "بدنه موتور", icon: "🛵", tone: "border-[#E5D0D8] bg-[#FFF5F7]" },
];

const DISCOUNTS = ["ندارم", "۵٪", "۱۰٪", "۱۵٪", "۲۰٪", "۲۵٪", "۳۰٪", "۳۵٪", "۴۰٪", "۴۵٪", "۵۰٪", "نامشخص"];

export default function InsurancePanel({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const supabase = createClient();
  const [selected, setSelected] = useState<InsuranceType | null>(null);
  const [phone, setPhone] = useState("");
  const [discount, setDiscount] = useState("");
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const needsVehicleCard = selected === "car-third-party-installment";

  async function submitRequest() {
    setError("");
    if (!userId) return setError("برای ثبت درخواست بیمه، ابتدا وارد حساب کاربری شوید.");
    if (!selected) return setError("نوع بیمه را انتخاب کنید.");
    const normalizedPhone = phone.replace(/\s/g, "");
    if (!/^09\d{9}$/.test(normalizedPhone)) return setError("شماره تماس را به‌صورت ۱۱ رقمی وارد کنید.");
    if (needsVehicleCard && !cardFile) return setError("برای شخص ثالث خودرو، عکس کارت خودرو را وارد کنید.");
    if (cardFile && (!cardFile.type.startsWith("image/") || cardFile.size > 6 * 1024 * 1024)) {
      return setError("عکس کارت خودرو باید تصویری و حداکثر ۶ مگابایت باشد.");
    }

    setLoading(true);
    let vehicleCardImagePath: string | null = null;

    try {
      if (cardFile) {
        const extension = cardFile.name.split(".").pop()?.toLowerCase() || "jpg";
        vehicleCardImagePath = userId + "/" + Date.now() + "-" + crypto.randomUUID() + "." + extension;
        const { error: uploadError } = await supabase.storage.from("insurance-documents").upload(
          vehicleCardImagePath,
          cardFile,
          { contentType: cardFile.type, cacheControl: "3600", upsert: false }
        );
        if (uploadError) throw uploadError;
      }

      const discountPercent =
        discount === "ندارم" ? 0 :
        discount && /^\d+/.test(discount) ? Number(discount.match(/^\d+/)?.[0]) : null;

      const { error: insertError } = await supabase.from("insurance_requests").insert({
        user_id: userId,
        insurance_type: selected,
        phone: normalizedPhone,
        previous_discount_percent: discountPercent,
        vehicle_card_image_path: vehicleCardImagePath,
      });

      if (insertError) {
        if (vehicleCardImagePath) await supabase.storage.from("insurance-documents").remove([vehicleCardImagePath]);
        throw insertError;
      }

      setDone(true);
    } catch (err) {
      console.error("Insurance request failed:", err);
      setError("ثبت درخواست انجام نشد. لطفاً دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#1D2B1F]/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" dir="rtl" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-t-[28px] border border-[#E3EBDE] bg-white shadow-2xl sm:rounded-[28px]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#E3EBDE] bg-[#F7FAF6] px-4 py-3">
          <div>
            <h2 className="text-sm font-black text-[#1D2B1F]">بیمه جم</h2>
            <p className="mt-0.5 text-[9px] font-bold text-[#7A887D]">نوع بیمه موردنظر را انتخاب کنید</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm shadow-sm">✕</button>
        </div>

        {done ? (
          <div className="px-5 py-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E3F3E9] text-3xl">✓</div>
            <h3 className="mt-4 text-base font-black text-[#1D2B1F]">درخواست شما ثبت شد</h3>
            <p className="mt-2 text-[10px] leading-5 text-[#66766A]">کارشناس بیمه برای پیگیری درخواست با شما تماس می‌گیرد.</p>
            <button type="button" onClick={onClose} className="mt-5 rounded-xl bg-[#147A4B] px-5 py-2.5 text-[10px] font-black text-white">بستن</button>
          </div>
        ) : (
          <div className="max-h-[78vh] overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-2">
              {OPTIONS.map((option) => (
                <button key={option.type} type="button" onClick={() => { setSelected(option.type); setError(""); }}
                  className={"rounded-2xl border p-3 text-right transition active:scale-[.98] " + option.tone + (selected === option.type ? " ring-2 ring-[#147A4B] ring-offset-1" : "")}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm">{option.icon}</span>
                  <span className="mt-2 block text-[10px] font-black leading-5 text-[#27362B]">{option.title}</span>
                </button>
              ))}
            </div>

            {selected && (
              <div className="mt-4 rounded-2xl border border-[#E3EBDE] bg-[#FAFCF9] p-3">
                <div className="mb-3 rounded-xl bg-white px-3 py-2">
                  <p className="text-[9px] font-black text-[#147A4B]">{OPTIONS.find((item) => item.type === selected)?.title}</p>
                </div>

                <label className="block text-[9px] font-black text-[#4B5A4E]">شماره تماس</label>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" maxLength={11}
                  placeholder="مثلاً ۰۹۱۲۱۲۳۴۵۶۷" className="mt-1.5 w-full rounded-xl border border-[#DCE5DE] bg-white px-3 py-2.5 text-xs outline-none focus:border-[#147A4B]" />

                {needsVehicleCard && (
                  <>
                    <label className="mt-3 block text-[9px] font-black text-[#4B5A4E]">عکس کارت خودرو</label>
                    <label className="mt-1.5 flex min-h-24 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[#C9D9CD] bg-white px-3 py-3 text-center hover:bg-[#F3F8F2]">
                      <input type="file" accept="image/*" className="hidden" onChange={(event) => setCardFile(event.target.files?.[0] ?? null)} />
                      {cardFile ? <span className="text-[9px] font-bold text-[#147A4B]">📷 {cardFile.name}</span> : <span className="text-[9px] font-bold leading-5 text-[#718077]">📷 برای بارگذاری عکس کارت خودرو کلیک کنید</span>}
                    </label>

                    <label className="mt-3 block text-[9px] font-black text-[#4B5A4E]">تخفیف بیمه‌نامه قبلی</label>
                    <select value={discount} onChange={(event) => setDiscount(event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-[#DCE5DE] bg-white px-3 py-2.5 text-xs outline-none focus:border-[#147A4B]">
                      <option value="">انتخاب کنید</option>
                      {DISCOUNTS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </>
                )}

                {error && <p className="mt-3 rounded-xl bg-[#FFF1F1] px-3 py-2 text-[9px] font-bold leading-5 text-[#C34A4A]">{error}</p>}
                <button type="button" disabled={loading} onClick={submitRequest}
                  className="mt-4 w-full rounded-xl bg-[#147A4B] px-4 py-3 text-[10px] font-black text-white shadow-sm disabled:opacity-60">
                  {loading ? "در حال ثبت درخواست..." : "ثبت درخواست بیمه"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
