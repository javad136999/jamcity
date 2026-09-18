"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  BUSINESS_CATEGORIES,
  businessCategoryLabel,
  tierMeta,
  formatPrice,
} from "@/lib/constants";
import { Spinner, EmptyState } from "@/components/Feedback";
import type { Database } from "@/lib/supabase/types";

type Business = Database["public"]["Tables"]["businesses"]["Row"] & {
  profiles?: { display_name: string; username: string } | null;
};

type Report = Database["public"]["Tables"]["reports"]["Row"] & {
  reporter?: {
    display_name: string;
    username: string;
  } | null;
  reported?: {
    display_name: string;
    username: string;
    banned: boolean;
  } | null;
};

type ReportProfile = {
  id: string;
  display_name: string;
  username: string;
  banned: boolean;
};

type Referrer = {
  id: string;
  display_name: string | null;
  username: string | null;
  referral_code: string | null;
  referral_count: number;
  reward_count: number;
  total_reward: number;
  pending_reward: number;
  paid_reward: number;
};

type WallAdminMessage = {
  id: string; content: string | null; image_url: string | null; is_promo: boolean;
  is_pinned: boolean; pinned_at: string | null; created_at: string;
  profiles?: { display_name: string; avatar_url: string | null } | null;
};

type Reward = {
  id: string;
  referrer_id: string;
  level: number;
  referral_count: number;
  amount_toman: number;
  status: "pending" | "paid";
  paid_at: string | null;
  created_at: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function formatToman(value: number) {
  return `${formatNumber(value)} تومان`;
}

function maskPhone(phone: string | null) {
  if (!phone) return "---";
  return phone.length >= 7 ? `${phone.slice(0, 4)}***${phone.slice(-3)}` : phone;
}


type CityEvent = {
  id: string; title: string; description: string | null; image_url: string | null;
  category: string | null; event_date: string | null; event_time: string | null;
  location: string | null; is_published: boolean; is_featured: boolean;
  created_at: string; updated_at: string;
};

type EventForm = {
  title: string; description: string; image_url: string; category: string;
  event_date: string; event_time: string; location: string;
  is_published: boolean; is_featured: boolean;
};

const EMPTY_EVENT_FORM: EventForm = {
  title: "", description: "", image_url: "", category: "general",
  event_date: "", event_time: "", location: "", is_published: false, is_featured: false,
};

const EVENT_CATEGORIES = [
  ["general", "عمومی"], ["cultural", "فرهنگی"], ["sport", "ورزشی"],
  ["religious", "مذهبی"], ["educational", "آموزشی"], ["business", "اقتصادی"],
  ["entertainment", "تفریحی"], ["government", "اداری"],
] as const;


const TABS = [
  { value: "pending", label: "در انتظار" },
  { value: "approved", label: "فعال" },
  { value: "suspended", label: "معلق / منقضی" },
  { value: "rejected", label: "رد شده" },
  { value: "all", label: "همه" },
] as const;

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: {
    label: "در انتظار تایید",
    color: "bg-yellow-100 text-yellow-700",
  },
  approved: {
    label: "فعال",
    color: "bg-emerald-100 text-emerald-700",
  },
  rejected: {
    label: "رد شده",
    color: "bg-red-100 text-red-700",
  },
  suspended: {
    label: "معلق / منقضی",
    color: "bg-slate-200 text-slate-600",
  },
};

export default function AdminPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  // برخی جداول جدید در Database تایپ نشده‌اند؛ این cast مانع خطای never می‌شود.
  const supabase = useMemo(() => createClient() as any, []);

  const [view, setView] = useState<
    "businesses" | "stats" | "reports" | "referrals" | "events"
  >("businesses");

  const [tab, setTab] =
    useState<(typeof TABS)[number]["value"]>("pending");

  const [businesses, setBusinesses] =
    useState<Business[] | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [visitCounts, setVisitCounts] = useState<{
    today: number;
    month: number;
    year: number;
  } | null>(null);

  const [reports, setReports] = useState<Report[] | null>(null);
  const [reportFilter, setReportFilter] =
    useState<"open" | "resolved">("open");

  const [autoAdsActive, setAutoAdsActive] = useState(true);
  const [autoAdBusy, setAutoAdBusy] = useState(false);

  const [referralLoading, setReferralLoading] = useState(true);
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [selectedReferrer, setSelectedReferrer] = useState<Referrer | null>(null);
  const [selectedRewards, setSelectedRewards] = useState<Reward[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [referralSearch, setReferralSearch] = useState("");
  const [referralStatusFilter, setReferralStatusFilter] = useState<"all" | "pending" | "paid">("all");
  const [referralMessage, setReferralMessage] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [referralActionLoading, setReferralActionLoading] = useState<string | null>(null);

  const [events, setEvents] = useState<CityEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventSaving, setEventSaving] = useState(false);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState<EventForm>(EMPTY_EVENT_FORM);
  const [eventMessage, setEventMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    if (!isAdmin || view !== "stats") return;

    async function loadVisits() {
      const { data, error } = await (supabase as any).rpc(
        "get_site_visit_stats"
      );

      if (error) {
        console.error("VISIT STATS ERROR:", error);
        return;
      }

      const stats = Array.isArray(data) ? data[0] : data;

      setVisitCounts({
        today: Number(stats?.today ?? 0),
        month: Number(stats?.month ?? 0),
        year: Number(stats?.year ?? 0),
      });
    }

    loadVisits();
  }, [isAdmin, view, supabase]);

  useEffect(() => {
    if (!isAdmin || view !== "businesses") return;

    let builder = supabase
      .from("businesses")
      .select(
        "*, profiles!businesses_owner_id_fkey(display_name, username)"
      )
      .order("submitted_at", { ascending: false });

    if (tab !== "all") {
      builder = builder.eq("subscription_status", tab);
    }

    builder.then(({
      data,
      error,
    }: {
      data: unknown;
      error: { message: string } | null;
    }) => {
      if (error) {
        console.error("ADMIN BUSINESSES ERROR:", error);
        setBusinesses([]);
        return;
      }

      setBusinesses((data as unknown as Business[]) ?? []);
    });
  }, [tab, isAdmin, view, supabase]);

  useEffect(() => {
    if (!isAdmin || view !== "reports") return;

    async function loadReports() {
      const { data: rawReports, error } = await supabase
        .from("reports")
        .select("*")
        .eq("resolved", reportFilter === "resolved")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("REPORTS ERROR:", error);
        setReports([]);
        return;
      }

      const rows = (rawReports as Report[]) ?? [];

      if (rows.length > 0) {
        const ids = Array.from(
          new Set(
            [
              ...rows.map((r) => r.reporter_id),
              ...rows.map((r) => r.reported_user_id),
            ].filter((id): id is string => Boolean(id))
          )
        );

        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, username, banned")
          .in("id", ids);

        const map = new Map<string, ReportProfile>(
          (profilesData ?? []).map(
            (p: ReportProfile) => [p.id, p]
          )
        );

        rows.forEach((r) => {
          r.reporter = map.get(r.reporter_id) ?? null;
          r.reported = map.get(r.reported_user_id) ?? null;
        });
      }

      setReports(rows);
    }

    loadReports();
  }, [isAdmin, view, reportFilter, supabase]);

  async function loadReferrers() {
    setReferralLoading(true);

    try {
      const {
        data: profiles,
        error: profilesError,
      } = await supabase
        .from("profiles")
        .select(
          "id,display_name,username,referral_code,referred_by"
        );

      if (profilesError) {
        console.error(
          "Failed to load profiles:",
          profilesError.message
        );

        setReferralMessage({
          text: "خطا در دریافت کاربران.",
          type: "err",
        });

        setReferralLoading(false);
        return;
      }

      const {
        data: rewards,
        error: rewardsError,
      } = await supabase
        .from("referral_rewards")
        .select(
          "id,referrer_id,level,referral_count,amount_toman,status,paid_at,created_at"
        )
        .order("created_at", {
          ascending: false,
        });

      if (rewardsError) {
        console.error(
          "Failed to load rewards:",
          rewardsError.message
        );
      }

      const rewardRows = (rewards ?? []) as Reward[];
      const profileRows = profiles ?? [];

      const result: Referrer[] = profileRows
        .map((profile: any) => {
          const referralCount = profileRows.filter(
            (child: any) =>
              child.referred_by === profile.id
          ).length;

          const userRewards = rewardRows.filter(
            (reward) =>
              reward.referrer_id === profile.id
          );

          const totalReward = userRewards.reduce(
            (sum, reward) =>
              sum + reward.amount_toman,
            0
          );

          const pendingReward = userRewards
            .filter(
              (reward) => reward.status === "pending"
            )
            .reduce(
              (sum, reward) =>
                sum + reward.amount_toman,
              0
            );

          const paidReward = userRewards
            .filter(
              (reward) => reward.status === "paid"
            )
            .reduce(
              (sum, reward) =>
                sum + reward.amount_toman,
              0
            );

          return {
            id: profile.id,
            display_name: profile.display_name,
            username: profile.username,
            referral_code: profile.referral_code,
            referral_count: referralCount,
            reward_count: userRewards.length,
            total_reward: totalReward,
            pending_reward: pendingReward,
            paid_reward: paidReward,
          };
        })
        .filter(
  (item: Referrer) =>
    item.referral_count > 0 ||
    item.reward_count > 0
)
     .sort(
  (a: Referrer, b: Referrer) =>
    b.referral_count -
    a.referral_count
);   
      setReferrers(result);

      /*
       * اگر معرف انتخاب شده قبلاً وجود داشته،
       * اطلاعات آن را به‌روز می‌کنیم.
       */
      if (selectedReferrer) {
        const updated = result.find(
          (item) =>
            item.id === selectedReferrer.id
        );

        if (updated) {
          setSelectedReferrer(updated);
        }
      }
    } catch (error) {
      console.error(
        "Referral admin error:",
        error
      );

      setReferralMessage({
        text: "خطایی در دریافت اطلاعات رخ داد.",
        type: "err",
      });
    } finally {
      setReferralLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin || view !== "referrals") return;
    loadReferrers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, view]);


  async function loadEvents() {
    setEventsLoading(true);
    const { data, error } = await (supabase as any).from("events")
      .select("id,title,description,image_url,category,event_date,event_time,location,is_published,is_featured,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("EVENTS LOAD ERROR:", error);
      setEventMessage({ text: "دریافت رویدادها با خطا مواجه شد: " + error.message, error: true });
      setEvents([]);
    } else setEvents((data ?? []) as CityEvent[]);
    setEventsLoading(false);
  }

  useEffect(() => {
    if (isAdmin && view === "events") loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, view]);

  function openEventForm(event?: CityEvent) {
    setEventMessage(null);
    if (event) {
      setEditingEventId(event.id);
      setEventForm({ title: event.title ?? "", description: event.description ?? "", image_url: event.image_url ?? "", category: event.category ?? "general", event_date: event.event_date?.slice(0, 10) ?? "", event_time: event.event_time ?? "", location: event.location ?? "", is_published: Boolean(event.is_published), is_featured: Boolean(event.is_featured) });
    } else { setEditingEventId(null); setEventForm(EMPTY_EVENT_FORM); }
    setEventFormOpen(true);
  }

  async function saveEvent() {
    if (!eventForm.title.trim()) { setEventMessage({ text: "عنوان رویداد را وارد کنید.", error: true }); return; }
    setEventSaving(true); setEventMessage(null);
    const payload = { title: eventForm.title.trim(), description: eventForm.description.trim() || null, image_url: eventForm.image_url.trim() || null, category: eventForm.category || "general", event_date: eventForm.event_date ? new Date(`${eventForm.event_date}T00:00:00`).toISOString() : null, event_time: eventForm.event_time.trim() || null, location: eventForm.location.trim() || null, is_published: eventForm.is_published, is_featured: eventForm.is_featured, updated_at: new Date().toISOString() };
    const result = editingEventId ? await (supabase as any).from("events").update(payload).eq("id", editingEventId) : await (supabase as any).from("events").insert({ ...payload, created_at: new Date().toISOString() });
    if (result.error) setEventMessage({ text: "ذخیره رویداد ناموفق بود: " + result.error.message, error: true });
    else { setEventMessage({ text: editingEventId ? "رویداد ویرایش شد." : "رویداد ثبت شد." }); setEventFormOpen(false); setEditingEventId(null); setEventForm(EMPTY_EVENT_FORM); await loadEvents(); }
    setEventSaving(false);
  }

  async function updateEvent(id: string, patch: Partial<CityEvent>, success: string) {
    const { error } = await (supabase as any).from("events").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) setEventMessage({ text: error.message, error: true }); else { setEventMessage({ text: success }); await loadEvents(); }
  }

  async function deleteEvent(event: CityEvent) {
    if (!confirm(`آیا از حذف رویداد «${event.title}» مطمئن هستید؟\n\nاین عملیات قابل بازگشت نیست.`)) return;
    const { error } = await (supabase as any).from("events").delete().eq("id", event.id);
    if (error) setEventMessage({ text: "حذف رویداد ناموفق بود: " + error.message, error: true }); else { setEventMessage({ text: "رویداد حذف شد." }); await loadEvents(); }
  }

  async function publishAutoAdNow() {
    if (autoAdBusy) return;

    setAutoAdBusy(true);

    try {
      const { error } = await (supabase as any).rpc(
        "publish_jamcity_auto_ad"
      );

      if (error) {
        console.error("PUBLISH AUTO AD ERROR:", error);
        alert("❌ خطا در انتشار آگهی:\n" + error.message);
        return;
      }

      alert("✅ آگهی با موفقیت منتشر شد.");
    } catch (error) {
      console.error("PUBLISH AUTO AD ERROR:", error);
      alert("❌ خطای غیرمنتظره هنگام انتشار آگهی.");
    } finally {
      setAutoAdBusy(false);
    }
  }

  async function toggleAutoAds() {
    if (autoAdBusy) return;

    const nextState = !autoAdsActive;
    setAutoAdBusy(true);

    try {
      const { error } = await (supabase as any).rpc(
        "toggle_jamcity_auto_ads",
        { p_active: nextState }
      );

      if (error) {
        console.error("TOGGLE AUTO ADS ERROR:", error);
        alert("❌ خطا در تغییر وضعیت انتشار خودکار:\n" + error.message);
        return;
      }

      setAutoAdsActive(nextState);

      alert(
        nextState
          ? "▶️ انتشار خودکار آگهی‌ها فعال شد."
          : "⏸️ انتشار خودکار آگهی‌ها متوقف شد."
      );
    } catch (error) {
      console.error("TOGGLE AUTO ADS ERROR:", error);
      alert("❌ خطای غیرمنتظره هنگام تغییر وضعیت.");
    } finally {
      setAutoAdBusy(false);
    }
  }

  async function banUser(userId: string) {
    if (!confirm("این کاربر از دیوار شهر جم مسدود شود؟")) return;

    setBusyId(userId);

    const { error } = await supabase
      .from("profiles")
      .update({ banned: true })
      .eq("id", userId);

    if (error) {
      alert("❌ مسدودسازی انجام نشد:\n" + error.message);
      setBusyId(null);
      return;
    }

    setReports((prev) =>
      (prev ?? []).map((r) =>
        r.reported_user_id === userId
          ? {
              ...r,
              reported: r.reported
                ? { ...r.reported, banned: true }
                : null,
            }
          : r
      )
    );

    setBusyId(null);
  }

  async function unbanUser(userId: string) {
    setBusyId(userId);

    const { error } = await supabase
      .from("profiles")
      .update({ banned: false })
      .eq("id", userId);

    if (error) {
      alert("❌ رفع مسدودیت انجام نشد:\n" + error.message);
      setBusyId(null);
      return;
    }

    setReports((prev) =>
      (prev ?? []).map((r) =>
        r.reported_user_id === userId
          ? {
              ...r,
              reported: r.reported
                ? { ...r.reported, banned: false }
                : null,
            }
          : r
      )
    );

    setBusyId(null);
  }

  async function resolveReport(id: string) {
    setBusyId(id);

    const { error } = await supabase
      .from("reports")
      .update({ resolved: true })
      .eq("id", id);

    if (error) {
      console.error("RESOLVE REPORT ERROR:", error);
      alert("❌ بستن گزارش انجام نشد:\n" + error.message);
      setBusyId(null);
      return;
    }

    setReports((prev) => (prev ?? []).filter((r) => r.id !== id));
    setBusyId(null);
  }

  async function approve(id: string) {
    setBusyId(id);

    try {
      const { error } = await (supabase as any).rpc(
        "admin_approve_business",
        { p_business_id: id }
      );

      if (error) {
        console.error("APPROVE BUSINESS ERROR:", error);
        alert("❌ تایید انجام نشد:\n" + error.message);
        return;
      }

      const reviewed_at = new Date().toISOString();
      const expires_at = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      setBusinesses((prev) =>
        (prev ?? []).map((b) =>
          b.id === id
            ? {
                ...b,
                subscription_status: "approved",
                reviewed_at,
                expires_at,
              }
            : b
        )
      );

      alert("✅ کسب‌وکار با موفقیت تایید شد.");
    } catch (error) {
      console.error("APPROVE BUSINESS UNEXPECTED ERROR:", error);
      alert("❌ خطای غیرمنتظره هنگام تایید کسب‌وکار.");
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(
    id: string,
    status: "rejected" | "suspended"
  ) {
    if (busyId === id) return;

    setBusyId(id);

    try {
      const { error } = await (supabase as any).rpc(
        "admin_set_business_status",
        {
          p_business_id: id,
          p_status: status,
        }
      );

      if (error) {
        console.error("SET BUSINESS STATUS ERROR:", error);
        alert("❌ تغییر وضعیت انجام نشد:\n" + error.message);
        return;
      }

      setBusinesses((prev) =>
        (prev ?? []).map((b) =>
          b.id === id
            ? {
                ...b,
                subscription_status: status,
                reviewed_at: new Date().toISOString(),
              }
            : b
        )
      );

      alert(
        status === "rejected"
          ? "✅ درخواست کسب‌وکار رد شد."
          : "✅ کسب‌وکار تعلیق شد."
      );
    } catch (error: any) {
      console.error("SET BUSINESS STATUS UNEXPECTED ERROR:", error);
      alert(
        "❌ خطای غیرمنتظره هنگام تغییر وضعیت:\n" +
          (error?.message || "خطای نامشخص")
      );
    } finally {
      setBusyId(null);
    }
  }

  async function updateBusinessCategory(
    id: string,
    category: string,
    icon: string
  ) {
    setBusyId(id);

    try {
      const { error } = await supabase
        .from("businesses")
        .update({ category, icon })
        .eq("id", id);

      if (error) {
        console.error("UPDATE BUSINESS CATEGORY ERROR:", error);
        alert("❌ ذخیره انجام نشد:\n" + error.message);
        return;
      }

      setBusinesses((prev) =>
        (prev ?? []).map((b) =>
          b.id === id ? { ...b, category, icon } : b
        )
      );

      alert("✅ دسته‌بندی و آیکون ذخیره شد.");
    } catch (error) {
      console.error(
        "UPDATE BUSINESS CATEGORY UNEXPECTED ERROR:",
        error
      );
      alert("❌ خطای غیرمنتظره هنگام ذخیره.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (busyId === id) return;

    if (
      !confirm(
        "⚠️ آیا از حذف کامل این کسب‌وکار مطمئن هستید؟\n\nاین عملیات قابل بازگشت نیست."
      )
    ) {
      return;
    }

    setBusyId(id);

    try {
      const { error } = await (supabase as any).rpc(
        "admin_delete_business",
        { p_business_id: id }
      );

      if (error) {
        console.error("DELETE BUSINESS ERROR:", error);
        alert("❌ حذف انجام نشد:\n" + error.message);
        return;
      }

      setBusinesses((prev) =>
        (prev ?? []).filter((b) => b.id !== id)
      );

      alert("✅ کسب‌وکار با موفقیت حذف شد.");
    } catch (error: any) {
      console.error("DELETE BUSINESS UNEXPECTED ERROR:", error);
      alert(
        "❌ خطای غیرمنتظره هنگام حذف:\n" +
          (error?.message || "خطای نامشخص")
      );
    } finally {
      setBusyId(null);
    }
  }

  async function openReferrer(referrer: Referrer) {
    setSelectedReferrer(referrer);
    setSelectedRewards([]);
    setRewardsLoading(true);

    const {
      data,
      error,
    } = await supabase
      .from("referral_rewards")
      .select(
        "id,referrer_id,level,referral_count,amount_toman,status,paid_at,created_at"
      )
      .eq("referrer_id", referrer.id)
      .order("level", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Failed to load rewards:",
        error.message
      );

      setReferralMessage({
        text: "خطا در دریافت پاداش‌های این کاربر.",
        type: "err",
      });
    } else {
      setSelectedRewards(
        (data ?? []) as Reward[]
      );
    }

    setRewardsLoading(false);
  }

  /*
   * -------------------------------------------------------
   * تغییر وضعیت پرداخت
   * -------------------------------------------------------
   */
  async function toggleRewardStatus(
    reward: Reward
  ) {
    if (referralActionLoading) return;

    setReferralActionLoading(reward.id);
    setReferralMessage(null);

    const newStatus =
      reward.status === "paid"
        ? "pending"
        : "paid";

    const newPaidAt =
      newStatus === "paid"
        ? new Date().toISOString()
        : null;

    const {
      error,
    } = await supabase
      .from("referral_rewards")
      .update({
        status: newStatus,
        paid_at: newPaidAt,
      })
      .eq("id", reward.id);

    if (error) {
      console.error(
        "Failed to update reward:",
        error.message
      );

      setReferralMessage({
        text: "تغییر وضعیت پرداخت انجام نشد.",
        type: "err",
      });

      setReferralActionLoading(null);
      return;
    }

    setSelectedRewards((prev) =>
      prev.map((item) =>
        item.id === reward.id
          ? {
              ...item,
              status: newStatus,
              paid_at: newPaidAt,
            }
          : item
      )
    );

    setReferralMessage({
      text:
        newStatus === "paid"
          ? "پاداش به عنوان پرداخت‌شده ثبت شد ✅"
          : "وضعیت پاداش به در انتظار پرداخت تغییر کرد.",
      type: "ok",
    });

    await loadReferrers();

    setReferralActionLoading(null);
  }


  const filteredReferrers = useMemo(() => {
    const query = referralSearch.trim().toLowerCase();
    return referrers.filter((referrer) => {
      const matchesSearch = !query ||
        (referrer.display_name ?? "").toLowerCase().includes(query) ||
        (referrer.username ?? "").toLowerCase().includes(query) ||
        (referrer.referral_code ?? "").toLowerCase().includes(query);
      const matchesStatus = referralStatusFilter === "all" ||
        (referralStatusFilter === "pending" ? referrer.pending_reward > 0 : referrer.paid_reward > 0);
      return matchesSearch && matchesStatus;
    });
  }, [referrers, referralSearch, referralStatusFilter]);

  const totalReferrals = useMemo(() => referrers.reduce((sum, item) => sum + item.referral_count, 0), [referrers]);
  const totalRewards = useMemo(() => referrers.reduce((sum, item) => sum + item.reward_count, 0), [referrers]);
  const totalRewardAmount = useMemo(() => referrers.reduce((sum, item) => sum + item.total_reward, 0), [referrers]);
  const totalPending = useMemo(() => referrers.reduce((sum, item) => sum + item.pending_reward, 0), [referrers]);
  const totalPaid = useMemo(() => referrers.reduce((sum, item) => sum + item.paid_reward, 0), [referrers]);


  if (authLoading || !isAdmin) {
    return <Spinner label="در حال بررسی دسترسی..." />;
  }

  return (
    <div dir="rtl" className="fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">
          پنل مدیریت
        </h1>
        <p className="text-sm text-slate-500">
          بررسی، تایید و مدیریت بخش‌های شهر جم
        </p>
      </div>

      <div className="rounded-xl2 glass p-4 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-extrabold text-slate-800">
              📢 مدیریت آگهی‌های خودکار
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              انتشار روزانه ۱۰ آگهی از بین ۱۰۰۰ آگهی موجود
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              autoAdsActive
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-600"
            }`}
          >
            {autoAdsActive ? "● فعال" : "● متوقف"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={publishAutoAdNow}
            disabled={autoAdBusy}
            className="rounded-xl2 bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-glow transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {autoAdBusy ? "در حال انجام..." : "📢 انتشار فوری آگهی"}
          </button>

          <button
            onClick={toggleAutoAds}
            disabled={autoAdBusy}
            className={`rounded-xl2 px-4 py-2.5 text-sm font-bold text-white shadow-glow transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 ${
              autoAdsActive ? "bg-red-500" : "bg-jam-green"
            }`}
          >
            {autoAdsActive
              ? "⏸️ توقف انتشار خودکار"
              : "▶️ فعال کردن انتشار خودکار"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setView("businesses")}
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${
            view === "businesses"
              ? "bg-jam-green text-white shadow-glow"
              : "bg-black/5 text-slate-500"
          }`}
        >
          🏬 کسب‌وکارها
        </button>

        <button
          onClick={() => setView("stats")}
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${
            view === "stats"
              ? "bg-jam-green text-white shadow-glow"
              : "bg-black/5 text-slate-500"
          }`}
        >
          📊 آمار بازدید
        </button>

        <button
          onClick={() => setView("reports")}
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${
            view === "reports"
              ? "bg-red-500 text-white shadow-glow"
              : "bg-black/5 text-slate-500"
          }`}
        >
          🚩 گزارش‌ها
        </button>

        <button type="button" onClick={() => setView("events")} className={`rounded-full px-4 py-2 text-sm font-bold transition ${view === "events" ? "bg-jam-green text-white shadow-glow" : "bg-black/5 text-slate-500 hover:bg-jam-green hover:text-white"}`}>
          📅 مدیریت رویدادها
        </button>

        <button
          type="button"
          onClick={() => setView("pinned")}
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${view === "pinned" ? "bg-jam-green text-white shadow-glow" : "bg-black/5 text-slate-500 hover:bg-jam-green hover:text-white"}`}
        >
          📌 پین آگهی
        </button>

        <button
          type="button"
          onClick={() => setView("referrals")}
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${
            view === "referrals"
              ? "bg-jam-green text-white shadow-glow"
              : "bg-black/5 text-slate-500 hover:bg-jam-green hover:text-white"
          }`}
        >
          🎁 مدیریت معرفی‌ها
        </button>
      </div>

      {view === "events" ? (
        <div className="space-y-4">
          <div className="rounded-xl2 glass p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-extrabold text-slate-800">📅 مدیریت رویدادها</h2><p className="mt-1 text-xs text-slate-500">افزودن، ویرایش و انتشار رویدادهای شهر جم</p></div>
              <button type="button" onClick={() => openEventForm()} className="rounded-xl bg-jam-green px-4 py-2 text-xs font-bold text-white shadow-glow">+ افزودن رویداد</button>
            </div>
            {eventMessage && <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${eventMessage.error ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>{eventMessage.error ? "⚠️ " : "✅ "}{eventMessage.text}</p>}
          </div>
          {eventFormOpen && <div className="rounded-xl2 glass p-5 shadow-soft"><h3 className="mb-3 font-extrabold text-slate-800">{editingEventId ? "ویرایش رویداد" : "رویداد جدید"}</h3><div className="grid gap-3 sm:grid-cols-2">
            <input value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} placeholder="عنوان رویداد *" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700" />
            <input value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} placeholder="مکان برگزاری" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700" />
            <input type="date" value={eventForm.event_date} onChange={e => setEventForm(f => ({ ...f, event_date: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" />
            <input type="time" value={eventForm.event_time} onChange={e => setEventForm(f => ({ ...f, event_time: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" />
            <select value={eventForm.category} onChange={e => setEventForm(f => ({ ...f, category: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">{EVENT_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <input value={eventForm.image_url} onChange={e => setEventForm(f => ({ ...f, image_url: e.target.value }))} placeholder="لینک تصویر" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" />
            <textarea value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} placeholder="توضیحات رویداد" rows={3} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 sm:col-span-2" />
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={eventForm.is_published} onChange={e => setEventForm(f => ({ ...f, is_published: e.target.checked }))} /> انتشار</label><label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={eventForm.is_featured} onChange={e => setEventForm(f => ({ ...f, is_featured: e.target.checked }))} /> ویژه</label>
          </div><div className="mt-4 flex gap-2"><button type="button" disabled={eventSaving} onClick={saveEvent} className="rounded-xl bg-jam-green px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{eventSaving ? "در حال ذخیره..." : "💾 ذخیره"}</button><button type="button" disabled={eventSaving} onClick={() => setEventFormOpen(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600">انصراف</button></div></div>}
          {eventsLoading ? <Spinner label="در حال بارگذاری رویدادها..." /> : events.length === 0 ? <EmptyState icon="📅" title="هنوز رویدادی ثبت نشده است" /> : <div className="grid gap-3 sm:grid-cols-2">{events.map(event => <div key={event.id} className="space-y-3 rounded-xl2 glass p-4 shadow-soft">{event.image_url && <img src={event.image_url} alt={event.title} className="h-40 w-full rounded-xl object-cover" />}<div className="flex items-start justify-between gap-2"><div><h3 className="font-extrabold text-slate-800">{event.title}</h3><p className="mt-1 text-xs text-slate-500">{event.location || "بدون مکان"} {event.event_date ? `· ${new Date(event.event_date).toLocaleDateString("fa-IR")}` : ""}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${event.is_published ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}`}>{event.is_published ? "منتشرشده" : "پیش‌نویس"}</span></div>{event.description && <p className="text-xs leading-6 text-slate-600">{event.description}</p>}<div className="flex flex-wrap gap-2"><button type="button" onClick={() => openEventForm(event)} className="rounded-xl bg-jam-navy px-3 py-2 text-xs font-bold text-white">ویرایش</button><button type="button" onClick={() => updateEvent(event.id, { is_published: !event.is_published }, event.is_published ? "رویداد از انتشار خارج شد." : "رویداد منتشر شد.")} className="rounded-xl bg-jam-green px-3 py-2 text-xs font-bold text-white">{event.is_published ? "لغو انتشار" : "انتشار"}</button><button type="button" onClick={() => updateEvent(event.id, { is_featured: !event.is_featured }, event.is_featured ? "رویداد از حالت ویژه خارج شد." : "رویداد ویژه شد.")} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">{event.is_featured ? "★ ویژه" : "☆ ویژه کردن"}</button><button type="button" onClick={() => deleteEvent(event)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-500">🗑 حذف</button></div></div>)}</div>}
        </div>
      ) : view === "referrals" ? (
        <div className="space-y-4">
      {/* Message */}
      {referralMessage && (
        <div
          className={`rounded-xl px-4 py-3 text-center text-xs font-bold ${
            referralMessage.type === "ok"
              ? "bg-[#EAF5ED] text-[#147A4B]"
              : "bg-[#FDEDEC] text-[#D94B40]"
          }`}
        >
          {referralMessage.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatBox
          icon="👥"
          label="معرف‌ها"
          value={referrers.length}
        />

        <StatBox
          icon="🧑‍🤝‍🧑"
          label="معرفی موفق"
          value={totalReferrals}
        />

        <StatBox
          icon="🎁"
          label="پاداش‌ها"
          value={totalRewards}
        />

        <StatBox
          icon="🕐"
          label="در انتظار پرداخت"
          value={totalPending}
          toman
        />

        <StatBox
          icon="✅"
          label="پرداخت‌شده"
          value={totalPaid}
          toman
        />
      </div>

      {/* Total reward */}
      <div className="rounded-[22px] border border-[#F0DCB4] bg-gradient-to-l from-[#FFF3DA] to-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#8A7150]">
              مجموع تعهد پاداش‌ها
            </p>

            <p className="mt-1 text-2xl font-black text-[#D98F2B]">
              {formatToman(
                totalRewardAmount
              )}
            </p>
          </div>

          <div className="text-4xl">💰</div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="rounded-[22px] border border-[#E3EBDE] bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={referralSearch}
            onChange={(e) =>
              setReferralSearch(e.target.value)
            }
            placeholder="جست‌وجو نام، شماره یا کد معرفی..."
            className="w-full rounded-xl border border-[#E3EBDE] bg-[#F7F9F4] px-4 py-3 text-xs font-bold text-[#1D2B1F] outline-none focus:border-[#147A4B]"
          />

          <div className="flex gap-2">
            <FilterButton
              active={
                referralStatusFilter === "all"
              }
              onClick={() =>
                setReferralStatusFilter("all")
              }
            >
              همه
            </FilterButton>

            <FilterButton
              active={
                referralStatusFilter === "pending"
              }
              onClick={() =>
                setReferralStatusFilter("pending")
              }
            >
              در انتظار
            </FilterButton>

            <FilterButton
              active={
                referralStatusFilter === "paid"
              }
              onClick={() =>
                setReferralStatusFilter("paid")
              }
            >
              پرداخت‌شده
            </FilterButton>
          </div>
        </div>
      </div>

      {/* Referrers table */}
      <div className="overflow-hidden rounded-[22px] border border-[#E3EBDE] bg-white shadow-sm">
        <div className="border-b border-[#EDF1EC] px-4 py-4">
          <h2 className="text-sm font-black text-[#1D2B1F]">
            👥 کاربران معرف
          </h2>

          <p className="mt-1 text-[10px] text-[#8A968C]">
            {formatNumber(
              filteredReferrers.length
            )}{" "}
            معرف نمایش داده می‌شود.
          </p>
        </div>

        {referralLoading ? (
          <div className="flex justify-center py-12">
            <Spinner label="در حال بارگذاری..." />
          </div>
        ) : filteredReferrers.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="text-4xl">🔎</div>

            <p className="mt-3 text-xs font-bold text-[#8A968C]">
              کاربری مطابق جست‌وجوی شما پیدا نشد.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-[#F7F9F4] text-[10px] text-[#8A968C]">
                    <th className="px-4 py-3">
                      کاربر
                    </th>

                    <th className="px-4 py-3">
                      کد معرفی
                    </th>

                    <th className="px-4 py-3">
                      معرفی موفق
                    </th>

                    <th className="px-4 py-3">
                      پاداش
                    </th>

                    <th className="px-4 py-3">
                      در انتظار
                    </th>

                    <th className="px-4 py-3">
                      پرداخت‌شده
                    </th>

                    <th className="px-4 py-3">
                      عملیات
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#F1F4EF]">
                  {filteredReferrers.map(
                    (referrer) => (
                      <tr
                        key={referrer.id}
                        className="hover:bg-[#FAFCF9]"
                      >
                        <td className="px-4 py-4">
                          <p className="text-xs font-black text-[#1D2B1F]">
                            {referrer.display_name ||
                              "بدون نام"}
                          </p>

                          <p
                            dir="ltr"
                            className="mt-1 text-[9px] text-[#8A968C]"
                          >
                            {maskPhone(
                              referrer.username
                            )}
                          </p>
                        </td>

                        <td
                          dir="ltr"
                          className="px-4 py-4 text-xs font-black tracking-wider text-[#147A4B]"
                        >
                          {referrer.referral_code ||
                            "---"}
                        </td>

                        <td className="px-4 py-4 text-sm font-black text-[#1D2B1F]">
                          {formatNumber(
                            referrer.referral_count
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span className="rounded-full bg-[#EAF5ED] px-2.5 py-1 text-[9px] font-black text-[#147A4B]">
                            {formatNumber(
                              referrer.reward_count
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-xs font-black text-[#D98F2B]">
                          {formatToman(
                            referrer.pending_reward
                          )}
                        </td>

                        <td className="px-4 py-4 text-xs font-black text-[#147A4B]">
                          {formatToman(
                            referrer.paid_reward
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              openReferrer(
                                referrer
                              )
                            }
                            className="rounded-xl bg-[#147A4B] px-3 py-2 text-[10px] font-black text-white"
                          >
                            مشاهده
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="space-y-2 p-3 md:hidden">
              {filteredReferrers.map(
                (referrer) => (
                  <div
                    key={referrer.id}
                    className="rounded-[18px] border border-[#EDF1EC] bg-[#FAFCF9] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-[#1D2B1F]">
                          {referrer.display_name ||
                            "بدون نام"}
                        </p>

                        <p
                          dir="ltr"
                          className="mt-1 text-[9px] text-[#8A968C]"
                        >
                          {maskPhone(
                            referrer.username
                          )}
                        </p>
                      </div>

                      <span
                        dir="ltr"
                        className="rounded-lg bg-[#EAF5ED] px-2 py-1 text-[9px] font-black text-[#147A4B]"
                      >
                        {referrer.referral_code ||
                          "---"}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <MiniStat
                        label="معرفی موفق"
                        value={formatNumber(
                          referrer.referral_count
                        )}
                      />

                      <MiniStat
                        label="پاداش"
                        value={formatNumber(
                          referrer.reward_count
                        )}
                      />

                      <MiniStat
                        label="در انتظار"
                        value={formatToman(
                          referrer.pending_reward
                        )}
                      />

                      <MiniStat
                        label="پرداخت‌شده"
                        value={formatToman(
                          referrer.paid_reward
                        )}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openReferrer(
                          referrer
                        )
                      }
                      className="mt-3 w-full rounded-xl bg-[#147A4B] py-2.5 text-[10px] font-black text-white"
                    >
                      مشاهده پاداش‌ها
                    </button>
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>

      {/* Selected referrer */}
      {selectedReferrer && (
        <div className="rounded-[24px] border border-[#E3EBDE] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-black text-[#1D2B1F]">
                🎁 پاداش‌های{" "}
                {selectedReferrer.display_name ||
                  "کاربر"}
              </p>

              <p
                dir="ltr"
                className="mt-1 text-[10px] text-[#8A968C]"
              >
                {selectedReferrer.referral_code ||
                  "---"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedReferrer(null);
                setSelectedRewards([]);
              }}
              className="rounded-xl border border-[#E3EBDE] bg-[#F7F9F4] px-3 py-2 text-[10px] font-black text-[#59665C]"
            >
              بستن
            </button>
          </div>

          {rewardsLoading ? (
            <div className="flex justify-center py-10">
              <Spinner label="در حال دریافت پاداش‌ها..." />
            </div>
          ) : selectedRewards.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-[#8A968C]">
              هنوز پاداشی برای این کاربر ایجاد نشده است.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {selectedRewards.map(
                (reward) => (
                  <div
                    key={reward.id}
                    className="rounded-[18px] border border-[#EDF1EC] bg-[#FAFCF9] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-[#1D2B1F]">
                          پاداش مرحله{" "}
                          {formatNumber(
                            reward.level
                          )}
                        </p>

                        <p className="mt-1 text-[9px] text-[#8A968C]">
                          رسیدن به{" "}
                          {formatNumber(
                            reward.referral_count
                          )}{" "}
                          معرفی موفق
                        </p>

                        <p className="mt-1 text-sm font-black text-[#147A4B]">
                          {formatToman(
                            reward.amount_toman
                          )}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[9px] font-black ${
                            reward.status ===
                            "paid"
                              ? "bg-[#EAF5ED] text-[#147A4B]"
                              : "bg-[#FFF3DA] text-[#B47A19]"
                          }`}
                        >
                          {reward.status ===
                          "paid"
                            ? "✅ پرداخت شده"
                            : "🕐 در انتظار پرداخت"}
                        </span>

                        <button
                          type="button"
                          disabled={
                            referralActionLoading ===
                            reward.id
                          }
                          onClick={() =>
                            toggleRewardStatus(
                              reward
                            )
                          }
                          className={`rounded-xl px-3 py-2 text-[9px] font-black text-white disabled:opacity-50 ${
                            reward.status ===
                            "paid"
                              ? "bg-[#8A968C]"
                              : "bg-[#147A4B]"
                          }`}
                        >
                          {referralActionLoading ===
                          reward.id
                            ? "در حال ثبت..."
                            : reward.status ===
                              "paid"
                            ? "برگشت به انتظار پرداخت"
                            : "ثبت پرداخت"}
                        </button>
                      </div>
                    </div>

                    {reward.paid_at && (
                      <p className="mt-3 border-t border-[#EDF1EC] pt-2 text-[8px] text-[#A1AAA3]">
                        تاریخ پرداخت:{" "}
                        {new Date(
                          reward.paid_at
                        ).toLocaleString(
                          "fa-IR"
                        )}
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
        </div>
      ) : view === "reports" ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setReportFilter("open")}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                reportFilter === "open"
                  ? "bg-jam-navy text-white"
                  : "bg-black/5 text-slate-500"
              }`}
            >
              بازبررسی‌نشده
            </button>

            <button
              onClick={() => setReportFilter("resolved")}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                reportFilter === "resolved"
                  ? "bg-jam-navy text-white"
                  : "bg-black/5 text-slate-500"
              }`}
            >
              بررسی‌شده
            </button>
          </div>

          {reports === null ? (
            <Spinner label="در حال بارگذاری..." />
          ) : reports.length === 0 ? (
            <EmptyState
              icon="✅"
              title="گزارشی در این بخش وجود ندارد"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="space-y-2 rounded-xl2 glass p-4 shadow-soft"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      گزارش‌دهنده:{" "}
                      {r.reporter?.display_name ?? "ناشناس"}
                    </span>

                    <span className="rounded-full bg-black/5 px-2 py-0.5 font-bold text-slate-600">
                      {r.context === "wall"
                        ? "دیوار شهر جم"
                        : "چت خصوصی"}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-slate-800">
                    کاربر گزارش‌شده:{" "}
                    {r.reported?.display_name ?? "ناشناس"}

                    {r.reported?.banned && (
                      <span className="mr-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                        مسدود
                      </span>
                    )}
                  </p>

                  {r.message_content && (
                    <p className="rounded-xl bg-black/5 p-2 text-xs text-slate-600">
                      {r.message_content}
                    </p>
                  )}

                  {r.reason && (
                    <p className="text-xs text-slate-500">
                      دلیل: {r.reason}
                    </p>
                  )}

                  <p className="text-[10px] text-slate-400">
                    {new Date(r.created_at).toLocaleString("fa-IR")}
                  </p>

                  <div className="flex flex-wrap gap-2 border-t border-black/5 pt-2">
                    {r.reported?.banned ? (
                      <button
                        disabled={busyId === r.reported_user_id}
                        onClick={() =>
                          unbanUser(r.reported_user_id)
                        }
                        className="rounded-xl2 bg-jam-green px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        ✅ رفع مسدودیت
                      </button>
                    ) : (
                      <button
                        disabled={busyId === r.reported_user_id}
                        onClick={() =>
                          banUser(r.reported_user_id)
                        }
                        className="rounded-xl2 bg-red-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        🚫 مسدود کردن کاربر
                      </button>
                    )}

                    {!r.resolved && (
                      <button
                        disabled={busyId === r.id}
                        onClick={() => resolveReport(r.id)}
                        className="rounded-xl2 border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-50"
                      >
                        بستن گزارش
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : view === "stats" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl2 glass p-6 text-center shadow-soft">
            <p className="text-3xl font-extrabold text-jam-green">
              {visitCounts
                ? visitCounts.today.toLocaleString("fa-IR")
                : "…"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              بازدید امروز
            </p>
          </div>

          <div className="rounded-xl2 glass p-6 text-center shadow-soft">
            <p className="text-3xl font-extrabold text-jam-green">
              {visitCounts
                ? visitCounts.month.toLocaleString("fa-IR")
                : "…"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              بازدید این ماه
            </p>
          </div>

          <div className="rounded-xl2 glass p-6 text-center shadow-soft">
            <p className="text-3xl font-extrabold text-jam-green">
              {visitCounts
                ? visitCounts.year.toLocaleString("fa-IR")
                : "…"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              بازدید امسال
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  tab === t.value
                    ? "bg-jam-navy text-white"
                    : "bg-black/5 text-slate-500"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {businesses === null ? (
            <Spinner label="در حال بارگذاری..." />
          ) : businesses.length === 0 ? (
            <EmptyState
              icon="✅"
              title="موردی در این بخش وجود ندارد"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {businesses.map((b) => {
                const tier = tierMeta(b.subscription_tier);
                const st =
                  STATUS_META[b.subscription_status] ??
                  STATUS_META.pending;

                return (
                  <div
                    key={b.id}
                    className="space-y-3 rounded-xl2 glass p-4 shadow-soft"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl shadow">
                        {b.icon}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-slate-800">
                          {b.name}
                        </p>

                        <p className="truncate text-xs text-slate-400">
                          {businessCategoryLabel(b.category)} ·{" "}
                          {b.profiles?.display_name || "ناشناس"}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.color}`}
                      >
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
                          ⏳ انقضا:{" "}
                          {new Date(b.expires_at).toLocaleDateString(
                            "fa-IR"
                          )}
                        </p>
                      )}
                    </div>

                    {tier && (
                      <p className="text-xs font-bold text-amber-700">
                        {tier.name} — {formatPrice(tier.price)}
                      </p>
                    )}

                    {b.receipt_url && (
                      <a
                        href={b.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={b.receipt_url}
                          alt="فیش واریزی"
                          className="h-40 w-full rounded-xl2 border border-slate-200 object-cover"
                        />
                      </a>
                    )}

                    <div className="space-y-2 rounded-xl2 border border-slate-200 bg-white/70 p-3">
                      <p className="text-xs font-bold text-slate-600">
                        ویرایش دسته‌بندی و آیکون
                      </p>

                      <div className="flex gap-2">
                        <select
                          value={b.category}
                          onChange={(e) => {
                            const selected =
                              BUSINESS_CATEGORIES.find(
                                (c) => c.slug === e.target.value
                              );

                            if (!selected) return;

                            setBusinesses((prev) =>
                              (prev ?? []).map((item) =>
                                item.id === b.id
                                  ? {
                                      ...item,
                                      category: selected.slug,
                                      icon: selected.icon,
                                    }
                                  : item
                              )
                            );
                          }}
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                        >
                          {BUSINESS_CATEGORIES.map((category) => (
                            <option
                              key={category.slug}
                              value={category.slug}
                            >
                              {category.icon} {category.name}
                            </option>
                          ))}
                        </select>

                        <button
                          disabled={busyId === b.id}
                          onClick={() => {
                            const selected =
                              BUSINESS_CATEGORIES.find(
                                (c) => c.slug === b.category
                              );

                            if (!selected) return;

                            updateBusinessCategory(
                              b.id,
                              selected.slug,
                              selected.icon
                            );
                          }}
                          className="rounded-xl bg-jam-navy px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                        >
                          💾 ذخیره
                        </button>
                      </div>

                      <div className="text-xs text-slate-400">
                        آیکون:{" "}
                        <span className="text-lg">{b.icon}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(b.subscription_status === "pending" ||
                        b.subscription_status === "suspended") && (
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
                          onClick={() =>
                            setStatus(b.id, "rejected")
                          }
                          className="flex-1 rounded-xl2 bg-red-500 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                          ❌ رد
                        </button>
                      )}

                      {b.subscription_status === "approved" && (
                        <button
                          disabled={busyId === b.id}
                          onClick={() =>
                            setStatus(b.id, "suspended")
                          }
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
        </>
      )}
    </div>
  );
}

function StatBox({ icon, label, value, toman = false }: { icon: string; label: string; value: number; toman?: boolean }) {
  return <div className="rounded-xl2 glass p-3 text-center shadow-soft"><div className="text-xl">{icon}</div><p className="mt-1 text-base font-black text-slate-800">{toman ? formatToman(value) : formatNumber(value)}</p><p className="mt-1 text-[9px] font-bold text-slate-500">{label}</p></div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white p-2 text-center"><p className="text-[8px] text-slate-500">{label}</p><p className="mt-1 text-[10px] font-black text-slate-800">{value}</p></div>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-xl px-3 py-2 text-[9px] font-black transition ${active ? "bg-jam-green text-white" : "bg-black/5 text-slate-500"}`}>{children}</button>;
}
