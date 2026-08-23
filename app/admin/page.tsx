"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { businessCategoryLabel, tierMeta, formatPrice } from "@/lib/constants";
import { Spinner, EmptyState } from "@/components/Feedback";
import type { Database } from "@/lib/supabase/types";

type Business = Database["public"]["Tables"]["businesses"]["Row"] & {
  profiles?: { display_name: string; username: string } | null;
};

const TABS = [
  { value: "pending", label: "در انتظار" },
  { value: "approved", label: "فعال" },
  { value: "suspended", label: "معلق / منقضی" },
  { value: "rejected", label: "رد شده" },
  { value: "all", label: "همه" },
] as const;

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "در انتظار تایید", color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "فعال", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "رد شده", color: "bg-red-100 text-red-700" },
  suspended: { label: "معلق / منقضی", color: "bg-slate-200 text-slate-600" },
};

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("pending");
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.replace("/");
    }
  }, [authLoading, user, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let builder = supabase
      .from("businesses")
      .select("*, profiles(display_name, username)")
      .order("submitted_at", { ascending: false });
    if (tab !== "all") builder = builder.eq("subscription_status", tab);
    builder.then(({ data }) => setBusinesses((data as unknown as Business[]) ?? []));
  }, [tab, isAdmin, supabase]);

  async function approve(id: string) {
    setBusyId(id);
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("businesses")
      .update({
        subscription_status: "approved",
        reviewed_at: new Date().toISOString(),
        expires_at,
      })
      .eq("id", id);
    setBusinesses((prev) =>
      (prev ?? []).map((b) =>
        b.id === id
          ? { ...b, subscription_status: "approved", expires_at }
          : b
      )
    );
    setBusyId(null);
  }

  async function setStatus(id: string, status: "rejected" | "suspended") {
    setBusyId(id);
    await supabase
      .from("businesses")
      .update({ subscription_status: status, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    setBusinesses((prev) =>
      (prev ?? []).map((b) => (b.id === id ? { ...b, subscription_status: status } : b))
    );
    setBusyId(null);
  }

  async function remove(id: string) {
    if (!confirm("آیا از حذف کامل این کسب و کار مطمئن هستید؟")) return;
    setBusyId(id);
    await supabase.from("businesses").delete().eq("id", id);
    setBusinesses((prev) => (prev ?? []).filter((b) => b.id !== id));
    setBusyId(null);
  }

  if (authLoading || !isAdmin) return <Spinner label="در حال بررسی دسترسی..." />;

  return (
    <div className="fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">پنل مدیریت</h1>
        <p className="text-sm text-slate-500">بررسی، تایید و مدیریت کسب و کارهای شهر جم</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              tab === t.value ? "bg-jam-navy text-white" : "bg-black/5 text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {businesses === null ? (
        <Spinner label="در حال بارگذاری..." />
      ) : businesses.length === 0 ? (
        <EmptyState icon="✅" title="موردی در این بخش وجود ندارد" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {businesses.map((b) => {
            const tier = tierMeta(b.subscription_tier);
            const st = STATUS_META[b.subscription_status] ?? STATUS_META.pending;
            return (
              <div key={b.id} className="space-y-3 rounded-xl2 glass p-4 shadow-soft">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl shadow">
                    {b.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-800">{b.name}</p>
                    <p className="truncate text-xs text-slate-400">
                      {businessCategoryLabel(b.category)} · {b.profiles?.display_name || "ناشناس"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.color}`}>
                    {st.label}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-500">
                  <p>📍 {b.address}</p>
                  {b.phone && (
                    <p dir="ltr" className="text-right">
                      ☎️ {b.phone}
                    </p>
                  )}
                  {b.expires_at && (
                    <p>
                      ⏳ انقضا: {new Date(b.expires_at).toLocaleDateString("fa-IR")}
                    </p>
                  )}
                </div>

                {tier && (
                  <p className="text-xs font-bold text-amber-700">
                    {tier.name} — {formatPrice(tier.price)}
                  </p>
                )}

                {b.receipt_url && (
                  <a href={b.receipt_url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={b.receipt_url}
                      alt="فیش واریزی"
                      className="h-40 w-full rounded-xl2 border border-slate-200 object-cover"
                    />
                  </a>
                )}

                <div className="flex flex-wrap gap-2">
                  {(b.subscription_status === "pending" || b.subscription_status === "suspended") && (
                    <button
                      disabled={busyId === b.id}
                      onClick={() => approve(b.id)}
                      className="flex-1 rounded-xl2 bg-jam-green py-2 text-sm font-bold text-white shadow-glow disabled:opacity-50"
                    >
                      ✅ تایید
                    </button>
                  )}
                  {b.subscription_status === "pending" && (
                    <button
                      disabled={busyId === b.id}
                      onClick={() => setStatus(b.id, "rejected")}
                      className="flex-1 rounded-xl2 bg-red-500 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      ❌ رد
                    </button>
                  )}
                  {b.subscription_status === "approved" && (
                    <button
                      disabled={busyId === b.id}
                      onClick={() => setStatus(b.id, "suspended")}
                      className="flex-1 rounded-xl2 bg-slate-500 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      ⏸️ تعلیق
                    </button>
                  )}
                  <button
                    disabled={busyId === b.id}
                    onClick={() => remove(b.id)}
                    className="rounded-xl2 border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-500 disabled:opacity-50"
                  >
                    🗑️ حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
