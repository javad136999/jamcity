"use client";

import Link from "next/link";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  BUSINESS_CATEGORIES,
  SUBSCRIPTION_TIERS,
  SUBSCRIPTION_PLANS,
  PAYMENT_CARD_NUMBER,
  PAYMENT_CARD_HOLDER,
  formatPrice,
  type SubscriptionTierValue,
} from "@/lib/constants";
import { uploadImages, uploadSingleFile } from "@/lib/upload";
import { ErrorState, Spinner } from "@/components/Feedback";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <Spinner label="در حال بارگذاری نقشه..." />,
});

export default function BusinessRegisterPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(BUSINESS_CATEGORIES[0].slug);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [tier, setTier] = useState<SubscriptionTierValue>("gold");
  const [months, setMonths] = useState<1 | 6 | 12>(1);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTier = SUBSCRIPTION_TIERS.find((t) => t.value === tier)!;
  const selectedPlan = SUBSCRIPTION_PLANS[tier].find((p) => p.months === months)!;
  const icon = BUSINESS_CATEGORIES.find((c) => c.slug === category)?.icon ?? "🏬";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);

    if (!name.trim() || !address.trim() || !lat || !lng) {
      setError("نام، آدرس و موقعیت روی نقشه الزامی است.");
      return;
    }
    if (!receipt) {
      setError("لطفاً فیش واریزی را آپلود کنید.");
      return;
    }

    setLoading(true);
    try {
      const [image_url] = imageFile ? await uploadImages([imageFile], "business-images", user.id) : [null];
      const receipt_url = await uploadSingleFile(receipt, "receipts", user.id, receipt.name.split(".").pop());

      const { data, error: insertError } = await supabase
        .from("businesses")
        .insert({
          owner_id: user.id,
          name: name.trim(),
          category,
          icon,
          address: address.trim(),
          phone: phone.trim() || null,
          description: description.trim() || null,
          hours: hours.trim() || null,
          image_url,
          lat,
          lng,
          subscription_tier: tier,
          subscription_months: months,
          subscription_status: "pending",
          receipt_url,
        })
        .select("id")
        .single();

      if (insertError || !data) throw insertError ?? new Error("insert failed, no data returned");

      router.replace(`/business/${data.id}`);
    } catch (e) {
      console.error("business register error", e);
      const msg =
        e instanceof Error
          ? e.message
          : e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : null;
      setError(
        msg
          ? `ثبت کسب و کار با خطا مواجه شد: ${msg}`
          : "ثبت کسب و کار با خطا مواجه شد. دوباره تلاش کنید."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">ثبت کسب و کار</h1>
        <p className="text-sm text-slate-500">
          مشخصات کسب و کار خود را وارد کنید تا روی نقشه شهر جم نمایش داده شود
        </p>
      </div>

      {authLoading ? (
        <Spinner label="در حال بررسی حساب کاربری..." />
      ) : profile?.is_wall_account ? (
        <div className="space-y-3 rounded-xl2 border border-yellow-200 bg-yellow-50 p-6 text-center text-sm text-yellow-700">
          <p>
            برای ثبت کسب و کار باید با ایمیل واقعی یا حساب گوگل وارد شوید. حساب فعلی شما
            فقط برای دیوار شهر جم است.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-xl2 bg-jam-green px-5 py-2 text-sm font-bold text-white shadow-glow"
          >
            ورود با ایمیل یا گوگل
          </Link>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl2 glass p-6 shadow-soft">
        {error && <ErrorState message={error} />}

        <div className="space-y-1">
          <label className="text-xs text-slate-500">نام کسب و کار</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green" placeholder="مثلاً رستوران الف" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-500">دسته‌بندی</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green">
              {BUSINESS_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">ساعات کاری</label>
            <input value={hours} onChange={(e) => setHours(e.target.value)} className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green" placeholder="مثلاً ۹ صبح تا ۱۱ شب" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">آدرس</label>
          <input required value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green" />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">شماره تماس</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green" placeholder="09xxxxxxxxx" />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">توضیحات</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green" />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-500">تصویر کسب و کار</label>
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="w-full rounded-xl2 border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500" />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-slate-500">موقعیت روی نقشه (روی نقشه کلیک کنید)</label>
          <LocationPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} />
          {lat && lng && <p className="text-xs text-slate-400">موقعیت انتخاب شد: {lat.toFixed(5)}, {lng.toFixed(5)}</p>}
        </div>

        <div className="space-y-4 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label className="text-sm font-black text-slate-800">انتخاب اشتراک</label>
            <p className="mt-1 text-[11px] text-slate-500">مدت و نوع اشتراک را انتخاب کنید.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SUBSCRIPTION_TIERS.map((t) => {
              const plans = SUBSCRIPTION_PLANS[t.value];
              const selected = tier === t.value;

              return (
                <div
                  key={t.value}
                  className={`rounded-[24px] bg-gradient-to-br ${t.color} p-4 shadow-lg ${selected ? "ring-4 ring-jam-green/30" : "opacity-90"}`}
                >
                  <button
                    type="button"
                    onClick={() => { setTier(t.value); setMonths(1); }}
                    className="w-full text-right text-slate-900"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-base font-black">{t.name}</p>
                      {selected && <span className="rounded-full bg-white/80 px-2 py-1 text-[9px] font-black text-jam-green">انتخاب شده</span>}
                    </div>
                    <div className="mt-2 space-y-1">
                      {t.perks.map((perk) => (
                        <p key={perk} className="text-[10px] font-bold leading-5 text-slate-800">✓ {perk}</p>
                      ))}
                    </div>
                  </button>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {plans.map((p) => {
                      const active = selected && months === p.months;
                      return (
                        <button
                          key={p.months}
                          type="button"
                          onClick={() => { setTier(t.value); setMonths(p.months === 1 ? 1 : p.months === 6 ? 6 : 12); }}
                          className={`relative min-h-[86px] rounded-2xl border p-2 text-center ${active ? "border-jam-navy bg-white shadow-md ring-2 ring-jam-navy/20" : "border-white/70 bg-white/60"}`}
                        >
                          {"badge" in p && p.badge && <span className="absolute -top-2 right-1/2 translate-x-1/2 whitespace-nowrap rounded-full bg-jam-navy px-2 py-0.5 text-[8px] font-black text-white">{p.badge}</span>}
                          <span className="block text-[10px] font-black text-slate-800">{p.label}</span>
                          <span className="mt-2 block text-[13px] font-black text-slate-950">{formatPrice(p.price)}</span>
                          {p.months > 1 && <span className="mt-1 block text-[8px] font-bold text-slate-600">ماهی {formatPrice(Math.round(p.price / p.months))}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            <p>مبلغ <strong className="text-jam-navy">{formatPrice(selectedPlan.price)}</strong> بابت <strong>{selectedTier.name} — {selectedPlan.label}</strong> را به شماره کارت زیر واریز کرده و تصویر فیش واریزی را آپلود کنید.</p>
            <p dir="ltr" className="mt-2 text-center text-lg font-extrabold tracking-widest text-jam-navy">{PAYMENT_CARD_NUMBER}</p>
            <p className="text-center text-xs text-slate-500">به نام {PAYMENT_CARD_HOLDER}</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500">فیش واریزی</label>
            <input required type="file" accept="image/*" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} className="w-full rounded-xl2 border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500" />
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full rounded-xl2 bg-jam-green py-3 text-sm font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50">
          {loading ? "در حال ارسال..." : "ارسال درخواست ثبت"}
        </button>
        <p className="text-center text-xs text-slate-400">درخواست شما برای بررسی به پنل مدیریت ارسال می‌شود و پس از تایید روی نقشه نمایش داده می‌شود.</p>
      </form>
      )}
    </div>
  );
}
