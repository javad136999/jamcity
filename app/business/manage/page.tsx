"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  businessCategoryLabel,
  formatPrice,
  tierMeta,
  SUBSCRIPTION_TIERS,
  PAYMENT_CARD_NUMBER,
  PAYMENT_CARD_HOLDER,
  type SubscriptionTierValue,
} from "@/lib/constants";
import { uploadImages, uploadSingleFile } from "@/lib/upload";
import { Spinner, EmptyState, ErrorState } from "@/components/Feedback";

const CAR_DEALER_CATEGORY = "car_dealer";

type Business = {
  id: string;
  name: string;
  icon: string;
  category: string;
  subscription_tier: "bronze" | "silver" | "gold" | null;
  subscription_status: "pending" | "approved" | "rejected" | "suspended";
  expires_at: string | null;
};

type Product = {
  id: string;
  business_id: string;
  name: string;
  price: number | null;
  description: string | null;
  image_url: string | null;
  discount_percent: number | null;
};

type Vehicle = {
  id: string;
  business_id: string;
  brand: string;
  model: string;
  year: number | null;
  mileage_km: number | null;
  price: number | null;
  color: string | null;
  image_url: string | null;
  is_sold: boolean;
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "در انتظار تایید", color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "فعال", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "رد شده", color: "bg-red-100 text-red-700" },
  suspended: { label: "منقضی / معلق", color: "bg-slate-200 text-slate-600" },
};

export default function BusinessManagePage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [pName, setPName] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pImage, setPImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // پنل تخصصی اتوگالری
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vBrand, setVBrand] = useState("");
  const [vModel, setVModel] = useState("");
  const [vYear, setVYear] = useState("");
  const [vMileage, setVMileage] = useState("");
  const [vPrice, setVPrice] = useState("");
  const [vColor, setVColor] = useState("");
  const [vImage, setVImage] = useState<File | null>(null);
  const [vSaving, setVSaving] = useState(false);
  const [vError, setVError] = useState<string | null>(null);

  const [renewOpen, setRenewOpen] = useState(false);
  const [renewTier, setRenewTier] = useState<SubscriptionTierValue>("gold");
  const [renewReceipt, setRenewReceipt] = useState<File | null>(null);
  const [renewSaving, setRenewSaving] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("businesses")
      .select("id, name, icon, category, subscription_tier, subscription_status, expires_at")
      .eq("owner_id", user.id)
      .order("submitted_at", { ascending: false })
      .then(({ data }) => setBusinesses((data as Business[]) ?? []));
  }, [user, supabase]);

  useEffect(() => {
    if (!activeId) {
      setProducts([]);
      setVehicles([]);
      return;
    }
    setRenewOpen(false);
    setRenewReceipt(null);
    setRenewError(null);

    const activeBusiness = businesses?.find((b) => b.id === activeId);

    if (activeBusiness?.category === CAR_DEALER_CATEGORY) {
      supabase
        .from("vehicle_listings")
        .select("*")
        .eq("business_id", activeId)
        .order("created_at", { ascending: false })
        .then(({ data }) => setVehicles((data as Vehicle[]) ?? []));
    } else {
      supabase
        .from("business_products")
        .select("*")
        .eq("business_id", activeId)
        .order("created_at", { ascending: false })
        .then(({ data }) => setProducts((data as Product[]) ?? []));
    }
  }, [activeId, supabase, businesses]);

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeId || !pName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let image_url: string | null = null;
      if (pImage) {
        const [url] = await uploadImages([pImage], "product-images", user.id);
        image_url = url;
      }
      const { data, error: insertError } = await supabase
        .from("business_products")
        .insert({
          business_id: activeId,
          name: pName.trim(),
          price: pPrice ? Number(pPrice) : null,
          description: pDesc.trim() || null,
          image_url,
        })
        .select("*")
        .single();
      if (insertError || !data) throw insertError;
      setProducts((prev) => [data as Product, ...prev]);
      setPName("");
      setPPrice("");
      setPDesc("");
      setPImage(null);
    } catch {
      setError("افزودن محصول با خطا مواجه شد.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(id: string) {
    await supabase.from("business_products").delete().eq("id", id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  async function saveDiscount(id: string, discount_percent: number | null) {
    await supabase.from("business_products").update({ discount_percent }).eq("id", id);
  }

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeId || !vBrand.trim() || !vModel.trim()) return;
    setVSaving(true);
    setVError(null);
    try {
      let image_url: string | null = null;
      if (vImage) {
        const [url] = await uploadImages([vImage], "product-images", user.id);
        image_url = url;
      }
      const { data, error: insertError } = await supabase
        .from("vehicle_listings")
        .insert({
          business_id: activeId,
          brand: vBrand.trim(),
          model: vModel.trim(),
          year: vYear ? Number(vYear) : null,
          mileage_km: vMileage ? Number(vMileage) : null,
          price: vPrice ? Number(vPrice) : null,
          color: vColor.trim() || null,
          image_url,
        })
        .select("*")
        .single();
      if (insertError || !data) throw insertError;
      setVehicles((prev) => [data as Vehicle, ...prev]);
      setVBrand("");
      setVModel("");
      setVYear("");
      setVMileage("");
      setVPrice("");
      setVColor("");
      setVImage(null);
    } catch {
      setVError("افزودن ماشین با خطا مواجه شد.");
    } finally {
      setVSaving(false);
    }
  }

  async function deleteVehicle(id: string) {
    await supabase.from("vehicle_listings").delete().eq("id", id);
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  }

  async function toggleVehicleSold(id: string, is_sold: boolean) {
    await supabase.from("vehicle_listings").update({ is_sold }).eq("id", id);
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, is_sold } : v)));
  }

  async function submitRenewal() {
    if (!user || !activeId) return;
    if (!renewReceipt) {
      setRenewError("لطفاً فیش واریزی را آپلود کنید.");
      return;
    }
    setRenewSaving(true);
    setRenewError(null);
    try {
      const receipt_url = await uploadSingleFile(
        renewReceipt,
        "receipts",
        user.id,
        renewReceipt.name.split(".").pop()
      );
      const { error: updateError } = await supabase
        .from("businesses")
        .update({
          subscription_tier: renewTier,
          subscription_status: "pending",
          receipt_url,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", activeId);
      if (updateError) throw updateError;
      setBusinesses((prev) =>
        (prev ?? []).map((b) =>
          b.id === activeId
            ? { ...b, subscription_status: "pending", subscription_tier: renewTier }
            : b
        )
      );
      setRenewOpen(false);
      setRenewReceipt(null);
    } catch {
      setRenewError("ارسال درخواست تمدید با خطا مواجه شد.");
    } finally {
      setRenewSaving(false);
    }
  }

  if (businesses === null)
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
        <Spinner label="در حال بارگذاری..." />
      </div>
    );

  const active = businesses.find((b) => b.id === activeId);
  const isCarDealer = active?.category === CAR_DEALER_CATEGORY;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-slate-50">
      <div className="fade-in mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/80 p-5 shadow-[0_8px_30px_-12px_rgba(16,185,129,0.25)] ring-1 ring-emerald-100 backdrop-blur">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">پنل کسب و کار</h1>
            <p className="text-sm text-slate-500">مدیریت کسب‌وکارها و منوی محصولات</p>
          </div>
          <Link
            href="/business/register"
            className="rounded-xl2 bg-gradient-to-l from-jam-green to-emerald-400 px-5 py-2.5 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            + ثبت کسب و کار جدید
          </Link>
        </div>

        {businesses.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 shadow-[0_8px_30px_-12px_rgba(16,185,129,0.2)] ring-1 ring-emerald-100">
            <EmptyState
              icon="🏬"
              title="هنوز کسب و کاری ثبت نکرده‌اید"
              description="با ثبت کسب و کار، آن را روی نقشه شهر جم نمایش دهید"
              action={
                <Link
                  href="/business/register"
                  className="rounded-xl2 bg-gradient-to-l from-jam-green to-emerald-400 px-5 py-2.5 text-sm font-bold text-white shadow-glow"
                >
                  ثبت کسب و کار
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {businesses.map((b) => {
              const st = STATUS_META[b.subscription_status];
              const tier = tierMeta(b.subscription_tier);
              return (
                <button
                  key={b.id}
                  onClick={() => setActiveId(b.id)}
                  className={`rounded-2xl bg-white p-4 text-right shadow-[0_6px_20px_-10px_rgba(15,23,42,0.15)] ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-10px_rgba(16,185,129,0.35)] ${
                    activeId === b.id ? "ring-2 ring-jam-green" : ""
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-2xl">
                      {b.icon}
                    </span>
                    <div>
                      <p className="font-bold text-slate-800">{b.name}</p>
                      <p className="text-xs text-slate-400">{businessCategoryLabel(b.category)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.color}`}>
                      {st.label}
                    </span>
                    {tier && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                        {tier.name}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {active && active.subscription_status === "pending" && (
          <p className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700 shadow-sm">
            این کسب و کار هنوز توسط مدیریت تایید نشده است. پس از تایید می‌توانید منو را کامل کنید.
          </p>
        )}

        {active && active.subscription_status === "rejected" && (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 shadow-sm">
            درخواست ثبت این کسب و کار رد شده است. برای اطلاعات بیشتر با مدیر تماس بگیرید.
          </p>
        )}

        {active && active.subscription_status === "approved" && active.expires_at && (
          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-sm">
            <p>
              {(() => {
                const daysLeft = Math.ceil(
                  (new Date(active.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                return daysLeft > 0
                  ? `${daysLeft} روز دیگر از اشتراک این کسب و کار باقی مانده (تا ${new Date(
                      active.expires_at
                    ).toLocaleDateString("fa-IR")})`
                  : "اشتراک این کسب و کار به‌زودی منقضی می‌شود.";
              })()}
            </p>
            {!renewOpen ? (
              <button
                onClick={() => setRenewOpen(true)}
                className="rounded-xl2 bg-gradient-to-l from-jam-green to-emerald-400 px-5 py-2.5 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5"
              >
                🔄 تمدید زودهنگام
              </button>
            ) : (
              <RenewalForm
                renewTier={renewTier}
                setRenewTier={setRenewTier}
                renewReceipt={renewReceipt}
                setRenewReceipt={setRenewReceipt}
                renewError={renewError}
                renewSaving={renewSaving}
                onSubmit={submitRenewal}
              />
            )}
          </div>
        )}

        {active && active.subscription_status === "suspended" && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">
              مدت اشتراک این کسب و کار به پایان رسیده و از نقشه حذف شده است (کسب و کار حذف نشده،
              فقط غیرفعال است). برای فعال‌سازی مجدد، اشتراک را تمدید کنید.
            </p>
            {!renewOpen ? (
              <button
                onClick={() => setRenewOpen(true)}
                className="rounded-xl2 bg-gradient-to-l from-jam-green to-emerald-400 px-5 py-2.5 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5"
              >
                🔄 تمدید اشتراک
              </button>
            ) : (
              <RenewalForm
                renewTier={renewTier}
                setRenewTier={setRenewTier}
                renewReceipt={renewReceipt}
                setRenewReceipt={setRenewReceipt}
                renewError={renewError}
                renewSaving={renewSaving}
                onSubmit={submitRenewal}
              />
            )}
          </div>
        )}

        {/* ===================== پنل تخصصی اتوگالری ===================== */}
        {active && isCarDealer && (
          <div className="space-y-5 rounded-[26px] border border-[#E7D9B8] bg-gradient-to-b from-white to-[#FBF7EE] p-6 shadow-[0_10px_30px_-14px_rgba(184,114,30,0.35)]">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2b2f36] to-[#3d434d] text-xl shadow-[0_0_16px_rgba(0,0,0,0.25)]">
                🚗
              </span>
              <div>
                <h2 className="text-lg font-black text-[#1D2B1F]">نمایشگاه {active.name}</h2>
                <p className="text-[11px] text-[#8A7150]">
                  ماشین‌های نمایشگاه خود را با مشخصات کامل ثبت کنید
                </p>
              </div>
            </div>

            {vehicles.length === 0 && (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                هنوز ماشینی به نمایشگاه خود اضافه نکرده‌اید.
              </p>
            )}

            <form
              onSubmit={addVehicle}
              className="grid gap-3 rounded-2xl border border-[#E3EBDE] bg-white p-4 sm:grid-cols-2"
            >
              {vError && (
                <div className="sm:col-span-2">
                  <ErrorState message={vError} />
                </div>
              )}

              <input
                required
                value={vBrand}
                onChange={(e) => setVBrand(e.target.value)}
                placeholder="برند (مثلاً پژو، سمند، هیوندای)"
                className="rounded-xl2 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#D98F2B] focus:bg-white"
              />
              <input
                required
                value={vModel}
                onChange={(e) => setVModel(e.target.value)}
                placeholder="مدل (مثلاً ۲۰۶ تیپ ۵)"
                className="rounded-xl2 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#D98F2B] focus:bg-white"
              />
              <input
                type="number"
                value={vYear}
                onChange={(e) => setVYear(e.target.value)}
                placeholder="سال ساخت"
                className="rounded-xl2 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#D98F2B] focus:bg-white"
              />
              <input
                type="number"
                value={vMileage}
                onChange={(e) => setVMileage(e.target.value)}
                placeholder="کارکرد (کیلومتر)"
                className="rounded-xl2 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#D98F2B] focus:bg-white"
              />
              <input
                value={vColor}
                onChange={(e) => setVColor(e.target.value)}
                placeholder="رنگ"
                className="rounded-xl2 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#D98F2B] focus:bg-white"
              />
              <input
                type="number"
                value={vPrice}
                onChange={(e) => setVPrice(e.target.value)}
                placeholder="قیمت (تومان)"
                className="rounded-xl2 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#D98F2B] focus:bg-white"
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setVImage(e.target.files?.[0] ?? null)}
                className="rounded-xl2 border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 sm:col-span-2"
              />
              <button
                type="submit"
                disabled={vSaving}
                className="rounded-xl2 bg-gradient-to-l from-[#D98F2B] to-[#B8721E] py-3 text-sm font-bold text-white shadow-[0_0_16px_rgba(255,183,77,.35)] transition hover:-translate-y-0.5 disabled:opacity-50 sm:col-span-2"
              >
                {vSaving ? "در حال افزودن..." : "+ افزودن ماشین"}
              </button>
            </form>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className={`overflow-hidden rounded-[20px] border bg-white shadow-[0_4px_16px_-8px_rgba(15,23,42,0.15)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-10px_rgba(184,114,30,0.3)] ${
                    v.is_sold ? "border-slate-200 opacity-60" : "border-[#E3EBDE]"
                  }`}
                >
                  <div className="relative h-36 w-full bg-[#F3F6F1]">
                    {v.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.image_url}
                        alt={`${v.brand} ${v.model}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl">
                        🚗
                      </div>
                    )}
                    {v.is_sold && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-black text-white">
                        فروخته شد
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 p-3">
                    <p className="text-[13px] font-black text-[#1D2B1F]">
                      {v.brand} {v.model}
                    </p>
                    <div className="flex flex-wrap gap-1 text-[10px] text-[#66766A]">
                      {v.year && <span className="rounded-full bg-[#F3F6F1] px-2 py-0.5">📅 {v.year}</span>}
                      {v.mileage_km !== null && (
                        <span className="rounded-full bg-[#F3F6F1] px-2 py-0.5">
                          🛣️ {new Intl.NumberFormat("fa-IR").format(v.mileage_km)} کیلومتر
                        </span>
                      )}
                      {v.color && <span className="rounded-full bg-[#F3F6F1] px-2 py-0.5">🎨 {v.color}</span>}
                    </div>
                    {v.price !== null && (
                      <p className="text-[12px] font-black text-[#147A4B]">{formatPrice(v.price)}</p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => toggleVehicleSold(v.id, !v.is_sold)}
                        className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                          v.is_sold
                            ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {v.is_sold ? "علامت‌گذاری به‌عنوان موجود" : "علامت‌گذاری به‌عنوان فروخته‌شده"}
                      </button>
                      <button
                        onClick={() => deleteVehicle(v.id)}
                        className="mr-auto text-[10px] font-bold text-red-500 transition hover:text-red-600"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================== منوی عمومی محصولات (کسب‌وکارهای غیر اتوگالری) ===================== */}
        {active && !isCarDealer && (
          <div className="space-y-4 rounded-2xl bg-white p-6 shadow-[0_8px_30px_-12px_rgba(16,185,129,0.2)] ring-1 ring-emerald-100">
            <h2 className="text-lg font-extrabold text-slate-800">منوی {active.name}</h2>
            {products.length === 0 && (
              <p className="rounded-xl2 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                لطفاً حداقل چند محصول یا خدمت به منوی کسب و کار خود اضافه کنید تا مشتریان قیمت‌ها را ببینند.
              </p>
            )}

            <form onSubmit={addProduct} className="grid gap-3 sm:grid-cols-2">
              {error && (
                <div className="sm:col-span-2">
                  <ErrorState message={error} />
                </div>
              )}
              <input
                required
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                placeholder="نام محصول"
                className="rounded-xl2 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green focus:bg-white"
              />
              <input
                type="number"
                value={pPrice}
                onChange={(e) => setPPrice(e.target.value)}
                placeholder="قیمت (تومان)"
                className="rounded-xl2 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green focus:bg-white"
              />
              <input
                value={pDesc}
                onChange={(e) => setPDesc(e.target.value)}
                placeholder="توضیح کوتاه (اختیاری)"
                className="rounded-xl2 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-jam-green focus:bg-white sm:col-span-2"
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPImage(e.target.files?.[0] ?? null)}
                className="rounded-xl2 border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 sm:col-span-2"
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl2 bg-gradient-to-l from-jam-green to-emerald-400 py-3 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-50 sm:col-span-2"
              >
                {saving ? "در حال افزودن..." : "+ افزودن محصول"}
              </button>
            </form>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_16px_-8px_rgba(15,23,42,0.15)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-10px_rgba(16,185,129,0.3)]"
                >
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-32 w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <div className="space-y-2 p-3">
                    <p className="font-bold text-slate-800">{p.name}</p>
                    {p.price !== null && <p className="text-sm text-jam-darkgreen">{formatPrice(p.price)}</p>}
                    {p.description && <p className="text-xs text-slate-500">{p.description}</p>}

                    <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-2">
                      <span className="text-xs font-bold text-red-500">🏷️ تخفیف</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={p.discount_percent ?? ""}
                        onChange={(e) =>
                          setProducts((prev) =>
                            prev.map((x) =>
                              x.id === p.id
                                ? { ...x, discount_percent: e.target.value === "" ? null : Number(e.target.value) }
                                : x
                            )
                          )
                        }
                        placeholder="٪"
                        className="w-14 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none"
                      />
                      <span className="text-[10px] text-slate-400">درصد</span>
                      <button
                        onClick={() => saveDiscount(p.id, p.discount_percent)}
                        className="mr-auto rounded-lg bg-red-500 px-2 py-1 text-[10px] font-bold text-white transition hover:bg-red-600"
                      >
                        ذخیره
                      </button>
                    </div>

                    <button
                      onClick={() => deleteProduct(p.id)}
                      className="text-xs font-bold text-red-500 transition hover:text-red-600"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RenewalForm({
  renewTier,
  setRenewTier,
  renewReceipt,
  setRenewReceipt,
  renewError,
  renewSaving,
  onSubmit,
}: {
  renewTier: SubscriptionTierValue;
  setRenewTier: (v: SubscriptionTierValue) => void;
  renewReceipt: File | null;
  setRenewReceipt: (f: File | null) => void;
  renewError: string | null;
  renewSaving: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3">
      {renewError && <ErrorState message={renewError} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SUBSCRIPTION_TIERS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setRenewTier(t.value)}
            className={`rounded-2xl bg-gradient-to-l ${t.color} p-3 text-right text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 ${
              renewTier === t.value ? "ring-4 ring-jam-green" : "opacity-80"
            }`}
          >
            <p className="text-sm font-extrabold">{t.name}</p>
            <p className="text-xs">{formatPrice(t.price)} در ماه</p>
          </button>
        ))}
      </div>
      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-100">
        <p>مبلغ را به شماره کارت زیر واریز کرده و فیش را آپلود کنید:</p>
        <p dir="ltr" className="mt-2 text-center text-lg font-extrabold tracking-widest text-jam-navy">
          {PAYMENT_CARD_NUMBER}
        </p>
        <p className="text-center text-xs text-slate-500">به نام {PAYMENT_CARD_HOLDER}</p>
      </div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setRenewReceipt(e.target.files?.[0] ?? null)}
        className="w-full rounded-xl2 border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500"
      />
      <button
        onClick={onSubmit}
        disabled={renewSaving}
        className="w-full rounded-xl2 bg-gradient-to-l from-jam-green to-emerald-400 py-3 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-50"
      >
        {renewSaving ? "در حال ارسال..." : "ارسال درخواست تمدید"}
      </button>
    </div>
  );
}
