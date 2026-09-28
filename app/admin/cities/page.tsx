"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/Feedback";
import type { City } from "@/lib/cities";

type AdminUser = { id: string; display_name: string | null; username: string | null; city_id: string; is_admin: boolean; banned: boolean };
type AdminBusiness = { id: string; name: string; category: string; subscription_status: string; city_id: string; address: string; };
type AdminAd = { id: string; title: string; category: string; region: string; status: string; price: number | null; city_id: string; created_at: string };
type View = "cities" | "businesses" | "ads" | "users";

const TABS: { id: View; label: string }[] = [
  { id: "cities", label: "شهرها" },
  { id: "businesses", label: "کسب‌وکارها" },
  { id: "ads", label: "آگهی‌ها" },
  { id: "users", label: "کاربران" },
];

export default function AdminCitiesPage() {
  const { isAdmin, loading: authLoading, refreshCities } = useAuth();
  const supabase = useMemo(() => createClient() as any, []);
  const [view, setView] = useState<View>("cities");
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityId, setSelectedCityId] = useState("all");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [ads, setAds] = useState<AdminAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", slug: "", lat: "", lng: "" });

  const loadCities = useCallback(async () => {
    const { data, error: loadError } = await supabase.from("cities").select("*").order("name");
    if (loadError) {
      setError(`دریافت شهرها با خطا مواجه شد: ${loadError.message}`);
      return;
    }
    setCities((data ?? []) as City[]);
  }, [supabase]);

  useEffect(() => {
    if (isAdmin) void loadCities();
  }, [isAdmin, loadCities]);

  const filteredCityName = selectedCityId === "all" ? "همه شهرها" : cities.find((item) => item.id === selectedCityId)?.name ?? "شهر انتخاب‌شده";

  const loadRows = useCallback(async () => {
    if (!isAdmin || view === "cities") return;
    setLoading(true);
    setError("");
    const table = view === "users" ? "profiles" : view;
    const columns = view === "users"
      ? "id,display_name,username,city_id,is_admin,banned"
      : view === "businesses"
        ? "id,name,category,subscription_status,city_id,address"
        : "id,title,category,region,status,price,city_id,created_at";
    const sortColumn = view === "ads" ? "created_at" : view === "users" ? "display_name" : "name";
    let query = supabase.from(table).select(columns).order(sortColumn, { ascending: false });
    if (selectedCityId !== "all") query = query.eq("city_id", selectedCityId);
    const { data, error: queryError } = await query.limit(500);
    if (queryError) {
      setError(`دریافت اطلاعات با خطا مواجه شد: ${queryError.message}`);
      if (view === "users") setUsers([]);
      if (view === "businesses") setBusinesses([]);
      if (view === "ads") setAds([]);
    } else if (view === "users") setUsers((data ?? []) as AdminUser[]);
    else if (view === "businesses") setBusinesses((data ?? []) as AdminBusiness[]);
    else setAds((data ?? []) as AdminAd[]);
    setLoading(false);
  }, [isAdmin, view, selectedCityId, supabase]);

  useEffect(() => { void loadRows(); }, [loadRows]);

  async function createCity(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    const name = form.name.trim();
    const slug = form.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    const reservedSlugs = new Set(["api", "auth", "wall", "ad", "business", "businesses", "map", "login", "register", "reset-password", "onboarding", "profile", "settings", "chat", "discounts", "events", "news", "admin", "referral"]);
    if (!name || !slug || reservedSlugs.has(slug) || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 24 || lat > 40 || lng < 44 || lng > 64) {
      setError("نام، slug لاتین غیررزروشده و مختصات معتبر برای شهر وارد کنید.");
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from("cities").insert({
      name, slug, province: "بوشهر", is_active: true,
      center_lat: lat, center_lng: lng, zoom: 14, min_zoom: 10, max_zoom: 18,
      south_lat: lat - 0.055, north_lat: lat + 0.055,
      west_lng: lng - 0.075, east_lng: lng + 0.075,
    });
    if (insertError) setError(`افزودن شهر انجام نشد: ${insertError.message}`);
    else {
      setMessage(`شهر «${name}» اضافه شد. مسیر /${slug} فعال است.`);
      setForm({ name: "", slug: "", lat: "", lng: "" });
      await loadCities();
      await refreshCities();
    }
    setSaving(false);
  }

  async function toggleCity(city: City) {
    setError("");
    const { error: updateError } = await supabase.from("cities").update({ is_active: !city.is_active }).eq("id", city.id);
    if (updateError) setError(`تغییر وضعیت شهر انجام نشد: ${updateError.message}`);
    else {
      await loadCities();
      await refreshCities();
    }
  }

  async function changeUserCity(userId: string, cityId: string) {
    setError("");
    const { error: updateError } = await supabase.rpc("admin_set_user_city", { p_user_id: userId, p_city_id: cityId });
    if (updateError) setError(`تغییر شهر کاربر انجام نشد: ${updateError.message}`);
    else await loadRows();
  }

  if (authLoading) return <Spinner label="در حال بررسی دسترسی..." />;
  if (!isAdmin) return <div dir="rtl" className="rounded-2xl border border-red-100 bg-white p-6 text-center text-sm font-bold text-red-600">شما دسترسی مدیریت این بخش را ندارید.</div>;

  return (
    <div dir="rtl" className="fade-in space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">مدیریت شهرها و داده‌های شهری</h1>
          <p className="mt-1 text-sm text-slate-500">مدیریت افزایشی شهرهای فعال استان بوشهر</p>
        </div>
        <Link href="/admin" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600">بازگشت به پنل مدیریت</Link>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl2 glass p-2 shadow-soft">
        {TABS.map((tab) => <button key={tab.id} onClick={() => setView(tab.id)} className={`rounded-xl px-4 py-2 text-xs font-bold ${view === tab.id ? "bg-jam-green text-white" : "bg-white text-slate-600"}`}>{tab.label}</button>)}
        <label className="mr-auto flex items-center gap-2 text-xs font-bold text-slate-500">
          شهر
          <select value={selectedCityId} onChange={(event) => setSelectedCityId(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <option value="all">همه شهرها</option>
            {cities.map((city) => <option key={city.id} value={city.id}>{city.name}{!city.is_active ? " (غیرفعال)" : ""}</option>)}
          </select>
        </label>
      </div>

      {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{message}</p>}
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}

      {view === "cities" && <>
        <form onSubmit={createCity} className="grid gap-3 rounded-xl2 glass p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-5">
          <input required value={form.name} onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))} placeholder="نام شهر" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
          <input required dir="ltr" value={form.slug} onChange={(event) => setForm((old) => ({ ...old, slug: event.target.value }))} placeholder="slug (مثلاً asaluyeh)" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
          <input required type="number" step="any" dir="ltr" value={form.lat} onChange={(event) => setForm((old) => ({ ...old, lat: event.target.value }))} placeholder="عرض جغرافیایی" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
          <input required type="number" step="any" dir="ltr" value={form.lng} onChange={(event) => setForm((old) => ({ ...old, lng: event.target.value }))} placeholder="طول جغرافیایی" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
          <button disabled={saving} className="rounded-xl bg-jam-green px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "در حال ذخیره..." : "افزودن شهر"}</button>
          <p className="text-[10px] leading-5 text-slate-500 sm:col-span-2 lg:col-span-5">استان به‌صورت پیش‌فرض بوشهر است؛ مسیر و قاب نقشه با slug و مختصات ساخته می‌شود. برای دقت بهتر، مرکز مختصاتی شهر را وارد کنید.</p>
        </form>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((city) => <article key={city.id} className="rounded-xl2 glass p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-extrabold text-slate-800">{city.name}</h2><p dir="ltr" className="mt-1 text-xs text-slate-500">/{city.slug}</p><p className="mt-1 text-[10px] text-slate-400">{city.province || "بوشهر"} · {city.center_lat.toFixed(4)}, {city.center_lng.toFixed(4)}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${city.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{city.is_active ? "فعال" : "غیرفعال"}</span></div>
            <button onClick={() => void toggleCity(city)} className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600">{city.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}</button>
          </article>)}
        </div>
      </>}

      {view !== "cities" && <section className="overflow-hidden rounded-xl2 glass shadow-soft">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-extrabold text-slate-700">{view === "users" ? `کاربران · ${filteredCityName}` : view === "ads" ? `آگهی‌ها · ${filteredCityName}` : `کسب‌وکارها · ${filteredCityName}`}</div>
        {loading ? <div className="p-8"><Spinner label="در حال دریافت اطلاعات..." /></div> : view === "users" ? users.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">کاربری در این شهر یافت نشد.</p> : <div className="divide-y divide-slate-100">{users.map((user) => <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-bold text-slate-800">{user.display_name || "بدون نام"} {user.is_admin && <span className="text-[10px] text-amber-600">مدیر</span>}</p><p dir="ltr" className="text-[11px] text-slate-400">@{user.username || "—"}{user.banned ? " · مسدود" : ""}</p></div><select value={user.city_id} onChange={(event) => void changeUserCity(user.id, event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">{cities.filter((item) => item.is_active).map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></div>)}</div> : view === "businesses" ? businesses.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">کسب‌وکاری در این شهر یافت نشد.</p> : <div className="divide-y divide-slate-100">{businesses.map((business) => <div key={business.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-bold text-slate-800">{business.name}</p><p className="text-[11px] text-slate-400">{business.category} · {business.address}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px]">{business.subscription_status}</span></div>)}</div> : ads.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">آگهی‌ای در این شهر یافت نشد.</p> : <div className="divide-y divide-slate-100">{ads.map((ad) => <div key={ad.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-bold text-slate-800">{ad.title}</p><p className="text-[11px] text-slate-400">{ad.category} · {ad.region}</p></div><div className="text-left text-[11px] text-slate-500">{ad.price === null ? "بدون قیمت" : `${new Intl.NumberFormat("fa-IR").format(ad.price)} تومان`} · {ad.status}</div></div>)}</div>}
      </section>}
    </div>
  );
}
