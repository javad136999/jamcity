"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CityEvent = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  is_published: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

type EventForm = {
  title: string;
  description: string;
  image_url: string;
  category: string;
  event_date: string;
  event_time: string;
  location: string;
  is_published: boolean;
  is_featured: boolean;
};

const emptyForm: EventForm = {
  title: "",
  description: "",
  image_url: "",
  category: "general",
  event_date: "",
  event_time: "",
  location: "",
  is_published: false,
  is_featured: false,
};

export default function EventsAdminPage() {
  const supabase = createClient() as any;

  const [events, setEvents] = useState<CityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingUser, setCheckingUser] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    setCheckingUser(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setIsAdmin(false);
        setErrorMessage(
          "برای ورود به پنل مدیریت ابتدا باید وارد حساب کاربری شوید."
        );
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error(profileError);
        setIsAdmin(false);
        setErrorMessage("خطا در بررسی دسترسی مدیریت.");
        return;
      }

      if (!profile?.is_admin) {
        setIsAdmin(false);
        setErrorMessage("شما دسترسی مدیریت این بخش را ندارید.");
        return;
      }

      setIsAdmin(true);
      await loadEvents();
    } catch (error) {
      console.error(error);
      setIsAdmin(false);
      setErrorMessage("خطایی در بررسی دسترسی رخ داد.");
    } finally {
      setCheckingUser(false);
      setLoading(false);
    }
  }

  async function loadEvents() {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("events")
      .select(
        "id,title,description,image_url,category,event_date,event_time,location,is_published,is_featured,created_at,updated_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setEvents([]);
      setErrorMessage(`دریافت رویدادها با خطا مواجه شد: ${error.message}`);
    } else {
      setEvents((data ?? []) as CityEvent[]);
    }

    setLoading(false);
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setErrorMessage("");
    setShowForm(true);
  }

  function openEditForm(event: CityEvent) {
    setEditingId(event.id);
    setForm({
      title: event.title ?? "",
      description: event.description ?? "",
      image_url: event.image_url ?? "",
      category: event.category ?? "general",
      event_date: event.event_date
        ? event.event_date.substring(0, 10)
        : "",
      event_time: event.event_time ?? "",
      location: event.location ?? "",
      is_published: Boolean(event.is_published),
      is_featured: Boolean(event.is_featured),
    });
    setMessage("");
    setErrorMessage("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function updateForm<K extends keyof EventForm>(
    key: K,
    value: EventForm[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  async function saveEvent() {
    setMessage("");
    setErrorMessage("");

    if (!form.title.trim()) {
      setErrorMessage("عنوان رویداد را وارد کنید.");
      return;
    }

    setSaving(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      category: form.category || "general",
      event_date: form.event_date
        ? new Date(`${form.event_date}T00:00:00`).toISOString()
        : null,
      event_time: form.event_time.trim() || null,
      location: form.location.trim() || null,
      is_published: form.is_published,
      is_featured: form.is_featured,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from("events")
          .update(payload)
          .eq("id", editingId);

        if (error) {
          console.error(error);
          setErrorMessage(`خطا در ویرایش رویداد: ${error.message}`);
          return;
        }

        setMessage("رویداد با موفقیت ویرایش شد.");
      } else {
        const { error } = await supabase.from("events").insert({
          ...payload,
          created_at: new Date().toISOString(),
        });

        if (error) {
          console.error(error);
          setErrorMessage(`خطا در ثبت رویداد: ${error.message}`);
          return;
        }

        setMessage("رویداد با موفقیت ثبت شد.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadEvents();
    } catch (error) {
      console.error(error);
      setErrorMessage("خطای غیرمنتظره‌ای هنگام ذخیره رویداد رخ داد.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(event: CityEvent) {
    setMessage("");
    setErrorMessage("");

    const { error } = await supabase
      .from("events")
      .update({
        is_published: !event.is_published,
        updated_at: new Date().toISOString(),
      })
      .eq("id", event.id);

    if (error) {
      console.error(error);
      setErrorMessage(`خطا در تغییر وضعیت انتشار: ${error.message}`);
      return;
    }

    setMessage(
      event.is_published
        ? "رویداد از حالت انتشار خارج شد."
        : "رویداد منتشر شد."
    );

    await loadEvents();
  }

  async function toggleFeatured(event: CityEvent) {
    setMessage("");
    setErrorMessage("");

    const { error } = await supabase
      .from("events")
      .update({
        is_featured: !event.is_featured,
        updated_at: new Date().toISOString(),
      })
      .eq("id", event.id);

    if (error) {
      console.error(error);
      setErrorMessage(`خطا در تغییر وضعیت ویژه: ${error.message}`);
      return;
    }

    setMessage(
      event.is_featured
        ? "رویداد از حالت ویژه خارج شد."
        : "رویداد به عنوان ویژه انتخاب شد."
    );

    await loadEvents();
  }

  async function deleteEvent(event: CityEvent) {
    const confirmed = window.confirm(
      `آیا از حذف رویداد «${event.title}» مطمئن هستید؟\n\nاین عملیات قابل بازگشت نیست.`
    );

    if (!confirmed) return;

    setMessage("");
    setErrorMessage("");

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", event.id);

    if (error) {
      console.error(error);
      setErrorMessage(`خطا در حذف رویداد: ${error.message}`);
      return;
    }

    setMessage("رویداد با موفقیت حذف شد.");
    await loadEvents();
  }

  function formatDate(date: string | null) {
    if (!date) return "بدون تاریخ";

    try {
      return new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(date));
    } catch {
      return date;
    }
  }

  function categoryLabel(category: string | null) {
    switch (category) {
      case "cultural":
        return "فرهنگی";
      case "sport":
        return "ورزشی";
      case "religious":
        return "مذهبی";
      case "educational":
        return "آموزشی";
      case "business":
        return "اقتصادی";
      case "entertainment":
        return "تفریحی";
      case "government":
        return "اداری";
      default:
        return "عمومی";
    }
  }

  if (checkingUser) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-[#F5FAF6] px-4 py-10 text-[#1D2B1F]"
      >
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-[#D9EBDD] bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#D9EBDD] border-t-[#2E8B57]" />
            <p className="text-sm font-bold">
              در حال بررسی دسترسی مدیریت...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-[#F5FAF6] px-4 py-10 text-[#1D2B1F]"
      >
        <div className="mx-auto max-w-xl">
          <div className="rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <div className="mb-4 text-5xl">🔒</div>
            <h1 className="mb-3 text-xl font-black">
              دسترسی به پنل مدیریت
            </h1>
            <p className="text-sm leading-7 text-[#66756A]">
              {errorMessage ||
                "شما اجازه دسترسی به پنل مدیریت رویدادها را ندارید."}
            </p>
            <a
              href="/"
              className="mt-6 inline-flex rounded-2xl bg-[#2E8B57] px-5 py-3 text-sm font-black text-white transition hover:bg-[#247047]"
            >
              بازگشت به صفحه اصلی
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#F5FAF6] px-4 py-6 text-[#1D2B1F]"
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-3xl border border-[#D9EBDD] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-2xl">📅</span>
                <h1 className="text-xl font-black">
                  مدیریت رویدادهای جم
                </h1>
              </div>
              <p className="text-xs text-[#6A786E]">
                افزودن و مدیریت رویدادهای محلی شهر جم
              </p>
            </div>

            <div className="flex gap-2">
              <a
                href="/events"
                className="rounded-2xl border border-[#D5E4D8] bg-white px-4 py-3 text-xs font-black text-[#356044] transition hover:bg-[#F4FAF5]"
              >
                مشاهده رویدادها
              </a>
              <button
                type="button"
                onClick={openAddForm}
                className="rounded-2xl bg-[#2E8B57] px-5 py-3 text-xs font-black text-white shadow-sm transition hover:bg-[#247047]"
              >
                + افزودن رویداد
              </button>
            </div>
          </div>
        </header>

        {message && (
          <div className="mb-4 rounded-2xl border border-[#BFE5CB] bg-[#ECFFF2] px-4 py-3 text-sm font-bold text-[#18713D]">
            ✅ {message}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            ⚠️ {errorMessage}
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-3xl border border-[#D9EBDD] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold text-[#718078]">
              کل رویدادها
            </p>
            <p className="mt-1 text-2xl font-black">
              {events.length}
            </p>
          </div>

          <div className="rounded-3xl border border-[#D9EBDD] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold text-[#718078]">
              منتشر شده
            </p>
            <p className="mt-1 text-2xl font-black text-[#16834A]">
              {events.filter((event) => event.is_published).length}
            </p>
          </div>

          <div className="rounded-3xl border border-[#D9EBDD] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold text-[#718078]">
              در انتظار انتشار
            </p>
            <p className="mt-1 text-2xl font-black text-[#C47A12]">
              {events.filter((event) => !event.is_published).length}
            </p>
          </div>

          <div className="rounded-3xl border border-[#D9EBDD] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold text-[#718078]">
              رویداد ویژه
            </p>
            <p className="mt-1 text-2xl font-black text-[#8B6914]">
              {events.filter((event) => event.is_featured).length}
            </p>
          </div>
        </section>

        {showForm && (
          <section className="mb-6 rounded-3xl border border-[#CFE4D4] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">
                  {editingId
                    ? "ویرایش رویداد"
                    : "افزودن رویداد جدید"}
                </h2>
                <p className="mt-1 text-[11px] text-[#718078]">
                  اطلاعات رویداد را وارد کنید.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl bg-[#F3F6F3] px-3 py-2 text-sm font-black text-[#536158]"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs font-black">
                  عنوان رویداد *
                </label>
                <input
                  value={form.title}
                  onChange={(e) =>
                    updateForm("title", e.target.value)
                  }
                  placeholder="مثلاً جشنواره خرما در شهر جم"
                  className="w-full rounded-2xl border border-[#D8E5DA] bg-[#FBFDFC] px-4 py-3 text-sm text-black placeholder:text-gray-500 outline-none transition focus:border-[#2E8B57]"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black">
                  دسته‌بندی
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    updateForm("category", e.target.value)
                  }
                  className="w-full rounded-2xl border border-[#D8E5DA] bg-[#FBFDFC] px-4 py-3 text-sm text-black outline-none focus:border-[#2E8B57]"
                >
                  <option value="general">عمومی</option>
                  <option value="cultural">فرهنگی</option>
                  <option value="sport">ورزشی</option>
                  <option value="religious">مذهبی</option>
                  <option value="educational">آموزشی</option>
                  <option value="business">اقتصادی</option>
                  <option value="entertainment">تفریحی</option>
                  <option value="government">اداری</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black">
                  مکان
                </label>
                <input
                  value={form.location}
                  onChange={(e) =>
                    updateForm("location", e.target.value)
                  }
                  placeholder="مثلاً فرهنگسرای شهر جم"
                  className="w-full rounded-2xl border border-[#D8E5DA] bg-[#FBFDFC] px-4 py-3 text-sm text-black placeholder:text-gray-500 outline-none focus:border-[#2E8B57]"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black">
                  تاریخ
                </label>
                <input
                  type="date"
                  value={form.event_date}
                  onChange={(e) =>
                    updateForm("event_date", e.target.value)
                  }
                  className="w-full rounded-2xl border border-[#D8E5DA] bg-[#FBFDFC] px-4 py-3 text-sm text-black outline-none focus:border-[#2E8B57]"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black">
                  ساعت
                </label>
                <input
                  type="time"
                  value={form.event_time}
                  onChange={(e) =>
                    updateForm("event_time", e.target.value)
                  }
                  className="w-full rounded-2xl border border-[#D8E5DA] bg-[#FBFDFC] px-4 py-3 text-sm text-black outline-none focus:border-[#2E8B57]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs font-black">
                  آدرس تصویر
                </label>
                <input
                  value={form.image_url}
                  onChange={(e) =>
                    updateForm("image_url", e.target.value)
                  }
                  placeholder="https://..."
                  dir="ltr"
                  className="w-full rounded-2xl border border-[#D8E5DA] bg-[#FBFDFC] px-4 py-3 text-left text-sm text-black placeholder:text-gray-500 outline-none focus:border-[#2E8B57]"
                />

                {form.image_url && (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-[#DDE9DF]">
                    <img
                      src={form.image_url}
                      alt="پیش‌نمایش تصویر رویداد"
                      className="h-44 w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs font-black">
                  توضیحات
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    updateForm("description", e.target.value)
                  }
                  rows={5}
                  placeholder="توضیحات کامل رویداد..."
                  className="w-full resize-none rounded-2xl border border-[#D8E5DA] bg-[#FBFDFC] px-4 py-3 text-sm text-black placeholder:text-gray-500 outline-none focus:border-[#2E8B57]"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-[#F7FAF7] p-4">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) =>
                    updateForm("is_published", e.target.checked)
                  }
                  className="h-5 w-5 accent-[#2E8B57]"
                />
                <span>
                  <span className="block text-xs font-black">
                    انتشار رویداد
                  </span>
                  <span className="text-[10px] text-[#718078]">
                    رویداد در سایت و نوار رویدادها نمایش داده شود.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-[#FFF9E9] p-4">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) =>
                    updateForm("is_featured", e.target.checked)
                  }
                  className="h-5 w-5 accent-[#C08A17]"
                />
                <span>
                  <span className="block text-xs font-black">
                    ⭐ رویداد ویژه
                  </span>
                  <span className="text-[10px] text-[#887548]">
                    برای نمایش برجسته‌تر در بخش رویدادها.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-2xl border border-[#D8E5DA] px-5 py-3 text-xs font-black text-[#56645A] disabled:opacity-50"
              >
                انصراف
              </button>

              <button
                type="button"
                onClick={saveEvent}
                disabled={saving}
                className="rounded-2xl bg-[#2E8B57] px-6 py-3 text-xs font-black text-white shadow-sm transition hover:bg-[#247047] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "در حال ذخیره..."
                  : editingId
                  ? "ذخیره تغییرات"
                  : "ثبت رویداد"}
              </button>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-[#D9EBDD] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black">
                فهرست رویدادها
              </h2>
              <p className="mt-1 text-[10px] text-[#718078]">
                تمام رویدادهای ثبت‌شده در سامانه
              </p>
            </div>

            <button
              type="button"
              onClick={loadEvents}
              className="rounded-xl bg-[#F0F8F2] px-3 py-2 text-[10px] font-black text-[#2E8B57]"
            >
              ↻ بروزرسانی
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm font-bold text-[#6D7B71]">
              در حال دریافت رویدادها...
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#CFE0D2] bg-[#FBFDFC] px-5 py-12 text-center">
              <div className="mb-3 text-5xl">📅</div>
              <h3 className="text-base font-black">
                هنوز رویدادی ثبت نشده
              </h3>
              <p className="mt-2 text-xs text-[#718078]">
                اولین رویداد شهر جم را اضافه کنید.
              </p>
              <button
                type="button"
                onClick={openAddForm}
                className="mt-5 rounded-2xl bg-[#2E8B57] px-5 py-3 text-xs font-black text-white"
              >
                + افزودن اولین رویداد
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <article
                  key={event.id}
                  className="overflow-hidden rounded-3xl border border-[#E0E9E1] bg-[#FBFDFC]"
                >
                  <div className="flex flex-col gap-4 p-4 sm:flex-row">
                    <div className="h-32 w-full shrink-0 overflow-hidden rounded-2xl bg-[#EAF3EC] sm:w-48">
                      {event.image_url ? (
                        <img
                          src={event.image_url}
                          alt={event.title}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl">
                          📅
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[9px] font-black ${
                            event.is_published
                              ? "bg-[#E8F8ED] text-[#18713D]"
                              : "bg-[#FFF4DC] text-[#9A6710]"
                          }`}
                        >
                          {event.is_published
                            ? "● منتشر شده"
                            : "● پیش‌نویس"}
                        </span>

                        {event.is_featured && (
                          <span className="rounded-full bg-[#FFF5D7] px-2.5 py-1 text-[9px] font-black text-[#8B6914]">
                            ⭐ ویژه
                          </span>
                        )}

                        <span className="rounded-full bg-[#EEF5EF] px-2.5 py-1 text-[9px] font-black text-[#5D7163]">
                          {categoryLabel(event.category)}
                        </span>
                      </div>

                      <h3 className="text-base font-black">
                        {event.title}
                      </h3>

                      {event.description && (
                        <p className="mt-2 line-clamp-2 text-xs leading-6 text-[#6B786F]">
                          {event.description}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-bold text-[#65736A]">
                        {event.event_date && (
                          <span>
                            📅 {formatDate(event.event_date)}
                          </span>
                        )}
                        {event.event_time && (
                          <span>⏰ {event.event_time}</span>
                        )}
                        {event.location && (
                          <span>📍 {event.location}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-row flex-wrap items-center gap-2 sm:w-32 sm:flex-col sm:items-stretch sm:justify-center">
                      <button
                        type="button"
                        onClick={() => openEditForm(event)}
                        className="flex-1 rounded-xl border border-[#D6E4D8] bg-white px-3 py-2 text-[10px] font-black text-[#41604B] transition hover:bg-[#F2F8F3] sm:flex-none"
                      >
                        ✏️ ویرایش
                      </button>

                      <button
                        type="button"
                        onClick={() => togglePublished(event)}
                        className={`flex-1 rounded-xl px-3 py-2 text-[10px] font-black transition sm:flex-none ${
                          event.is_published
                            ? "bg-[#FFF0F0] text-[#B04A4A]"
                            : "bg-[#EAF8EE] text-[#18713D]"
                        }`}
                      >
                        {event.is_published
                          ? "عدم انتشار"
                          : "انتشار"}
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleFeatured(event)}
                        className="flex-1 rounded-xl bg-[#FFF8E5] px-3 py-2 text-[10px] font-black text-[#8B6914] sm:flex-none"
                      >
                        {event.is_featured
                          ? "حذف ویژه"
                          : "⭐ ویژه"}
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteEvent(event)}
                        className="flex-1 rounded-xl bg-[#FFF0F0] px-3 py-2 text-[10px] font-black text-[#B04444] sm:flex-none"
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
