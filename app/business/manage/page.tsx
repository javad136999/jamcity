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
      return;
    }
    setRenewOpen(false);
    setRenewReceipt(null);
    setRenewError(null);
    supabase
      .from("business_products")
      .select("*")
      .eq("business_id", activeId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setProducts((data as Product[]) ?? []));
  }, [activeId, supabase]);

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

  if (businesses === null) return <Spinner label="در حال بارگذاری..." />;

  const active = businesses.find((b) => b.id === activeId);

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">پنل کسب و کار</h1>
          <p className="text-sm text-slate-500">مدیریت کسب‌وکارها و منوی محصولات</p>
        </div>
        <Link
          href="/business/register"
          className="rounded-xl2 bg-jam-green px-4 py-2 text-sm font-bold text-white shadow-glow"
        >
          + ثبت کسب و کار جدید
        </Link>
      </div>

      {businesses.length === 0 ? (
        <EmptyState
          icon="🏬"
          title="هنوز کسب و کاری ثبت نکرده‌اید"
          description="با ثبت کسب و کار، آن را روی نقشه شهر جم نمایش دهید"
          action={
            <Link href="/business/register" className="rounded-xl2 bg-jam-green px-5 py-2 text-sm font-bold text-white">
              ثبت کسب و کار
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {businesses.map((b) => {
            const st = STATUS_META[b.subscription_status];
            const tier = tierMeta(b.subscription_tier);
            return (
              <button
                key={b.id}
                onClick={() => setActiveId(b.id)}
                className={`rounded-xl2 glass p-4 text-right shadow-soft transition ${
                  activeId === b.id ? "ring-2 ring-jam-green" : ""
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-2xl">{b.icon}</span>
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
        <p className="rounded-xl2 border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
          این کسب و کار هنوز توسط مدیریت تایید نشده است. پس از تایید می‌توانید منو را کامل کنید.
        </p>
      )}

      {active && active.subscription_status === "rejected" && (
        <p className="rounded-xl2 border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          درخواست ثبت این کسب و کار رد شده است. برای اطلاعات بیشتر با مدیر تماس بگیرید.
        </p>
      )}

      {active && active.subscription_status === "approved" && active.expires_at && (
        <div className="space-y-3 rounded-xl2 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
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
              className="rounded-xl2 bg-jam-green px-5 py-2 text-sm font-bold text-white shadow-glow"
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
        <div className="space-y-3 rounded-xl2 border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-600">
            مدت اشتراک این کسب و کار به پایان رسیده و از نقشه حذف شده است (کسب و کار حذف نشده،
            فقط غیرفعال است). برای فعال‌سازی مجدد، اشتراک را تمدید کنید.
          </p>
          {!renewOpen ? (
            <button
              onClick={() => setRenewOpen(true)}
              className="rounded-xl2 bg-jam-green px-5 py-2 text-sm font-bold text-white shadow-glow"
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

      {active && (
        <div className="space-y-4 rounded-xl2 glass p-6 shadow-soft">
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
              className="rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
            />
            <input
              type="number"
              value={pPrice}
              onChange={(e) => setPPrice(e.target.value)}
              placeholder="قیمت (تومان)"
              className="rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green"
            />
            <input
              value={pDesc}
              onChange={(e) => setPDesc(e.target.value)}
              placeholder="توضیح کوتاه (اختیاری)"
              className="rounded-xl2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-jam-green sm:col-span-2"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPImage(e.target.files?.[0] ?? null)}
              className="rounded-xl2 border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500 sm:col-span-2"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl2 bg-jam-green py-3 text-sm font-bold text-white shadow-glow disabled:opacity-50 sm:col-span-2"
            >
              {saving ? "در حال افزودن..." : "+ افزودن محصول"}
            </button>
          </form>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {products.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl2 border border-slate-200 bg-white">
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} className="h-32 w-full object-cover" loading="lazy" decoding="async" />
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
                      className="mr-auto rounded-lg bg-red-500 px-2 py-1 text-[10px] font-bold text-white"
                    >
                      ذخیره
                    </button>
                  </div>

                  <button
                    onClick={() => deleteProduct(p.id)}
                    className="text-xs font-bold text-red-500"
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
            className={`rounded-xl2 bg-gradient-to-l ${t.color} p-3 text-right text-white shadow-soft transition ${
              renewTier === t.value ? "ring-4 ring-jam-green" : "opacity-80"
            }`}
          >
            <p className="text-sm font-extrabold">{t.name}</p>
            <p className="text-xs">{formatPrice(t.price)} در ماه</p>
          </button>
        ))}
      </div>
      <div className="rounded-xl2 bg-white p-4 text-sm text-slate-700">
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
        className="w-full rounded-xl2 bg-jam-green py-3 text-sm font-bold text-white shadow-glow disabled:opacity-50"
      >
        {renewSaving ? "در حال ارسال..." : "ارسال درخواست تمدید"}
      </button>
    </div>
  );
}
