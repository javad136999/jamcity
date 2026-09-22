"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY =
  "BOcMqNkTb9soINz1FSyni8KXg5BMACDZ_zZ2xOBTqwl26vtcuVr-JKFHJT66gI7WXnn8PSAYi2TpqeVXzOC9-kg";

const DISMISSED_KEY = "jamcity:weekly-news-prompt-dismissed";
const SUBSCRIBED_KEY = "jamcity:weekly-news-subscribed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export default function WeeklyNewsNotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const shouldShow = () => {
      if (!isStandalone()) return false;
      try {
        if (localStorage.getItem(DISMISSED_KEY) === "true") return false;
        if (localStorage.getItem(SUBSCRIBED_KEY) === "true") return false;
      } catch {
        // Continue; notification permission is the real source of truth.
      }
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        return false;
      }
      return true;
    };

    const showIfNeeded = () => {
      if (shouldShow()) {
        timer = setTimeout(() => setVisible(true), 1200);
      }
    };

    // Already installed: show on the next app visit.
    showIfNeeded();

    // Fresh installation: show immediately after the browser reports the PWA is installed.
    const handleInstalled = () => {
      try {
        localStorage.removeItem(DISMISSED_KEY);
      } catch {}
      setTimeout(() => setVisible(true), 900);
    };

    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {}
    setVisible(false);
  }

  async function enableNotifications() {
    if (busy) return;
    setBusy(true);

    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        alert("این دستگاه از اعلان‌های جم‌سیتی پشتیبانی نمی‌کند.");
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        dismiss();
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        throw new Error("subscription-save-failed");
      }

      try {
        localStorage.setItem(SUBSCRIBED_KEY, "true");
        localStorage.removeItem(DISMISSED_KEY);
      } catch {}

      setVisible(false);
    } catch (error) {
      console.error("JamCity weekly notification setup failed:", error);
      alert("فعال‌سازی اعلان انجام نشد. لطفاً یک بار دیگر امتحان کنید.");
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-label="فعال‌سازی اعلان‌های جم‌سیتی"
      className="fixed inset-x-3 top-3 z-[10000] mx-auto max-w-sm"
    >
      <div className="overflow-hidden rounded-[20px] border border-white/70 bg-white/95 shadow-[0_18px_60px_rgba(15,23,42,.28)] backdrop-blur-xl">
        <div className="bg-gradient-to-l from-[#087443] via-[#0b8f58] to-[#16a064] px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-xl shadow-inner">
              🔔
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-black">خبرهای جم‌سیتی را از دست نده!</div>
              <div className="mt-0.5 text-[11px] font-medium text-white/90">
                فقط هفته‌ای یک اعلان، شنبه ساعت ۱۰ صبح
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3">
          <p className="text-[13px] leading-6 text-slate-600">
            دوست داری هر هفته خلاصه‌ای از تازه‌ترین خبرهای شهر جم و اطراف را روی گوشی‌ات دریافت کنی؟
          </p>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={enableNotifications}
              disabled={busy}
              className="flex-1 rounded-2xl bg-[#0b7d4b] px-3 py-2.5 text-[12px] font-black text-white shadow-lg shadow-emerald-900/15 transition active:scale-[.98] disabled:opacity-60"
            >
              {busy ? "در حال فعال‌سازی…" : "🔔 بله، فعالش کن"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              disabled={busy}
              className="rounded-2xl bg-slate-100 px-3 py-2.5 text-[11px] font-bold text-slate-600 transition active:scale-[.98]"
            >
              فعلاً نه
            </button>
          </div>

          <div className="mt-3 text-center text-[10px] text-slate-400">
            هر زمان بخواهی می‌توانی اعلان‌ها را از تنظیمات گوشی خاموش کنی.
          </div>
        </div>
      </div>
    </div>
  );
}
