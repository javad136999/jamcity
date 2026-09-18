"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALL_STATE_KEY = "jamcity:pwa-installed";

function isIOS() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function hasSavedInstallState() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(INSTALL_STATE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveInstallState() {
  try {
    window.localStorage.setItem(INSTALL_STATE_KEY, "true");
  } catch {
    // Ignore storage errors; standalone/appinstalled checks still protect the UI.
  }
}

export default function InstallAppButton({ placement = "header" }: { placement?: "header" | "home" }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showButton, setShowButton] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setAlreadyInstalled(true);
      return;
    }
    // نصب بودن PWA در خود صفحهٔ مرورگر همیشه با display-mode=standalone
    // قابل تشخیص نیست؛ بنابراین فلگ localStorage را تا زمان دریافت
    // سیگنال واقعیِ beforeinstallprompt نگه می‌داریم.
    const savedInstallState = hasSavedInstallState();

    // در صفحه اصلی، اگر قبلاً نصب ثبت شده، ابتدا دکمه مخفی می‌ماند.
    // بعد از حذف PWA، مرورگر دوباره beforeinstallprompt را می‌فرستد و
    // همان‌جا فلگ قدیمی پاک و دکمه دوباره نمایش داده می‌شود.
    if (placement === "home" && !savedInstallState) setShowButton(true);

    // اندروید/کروم/دسکتاپ: مرورگر رویداد beforeinstallprompt را می‌فرستد
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();

      if (isStandalone()) {
        setAlreadyInstalled(true);
        return;
      }

      // اگر beforeinstallprompt دوباره صادر شده، مرورگر عملاً اعلام کرده
      // که PWA دوباره قابل نصب است (مثلاً بعد از حذف از گوشی).
      try {
        window.localStorage.removeItem(INSTALL_STATE_KEY);
      } catch {}

      setAlreadyInstalled(false);
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowButton(true);
    }

    function handleAppInstalled() {
      saveInstallState();
      setAlreadyInstalled(true);
      setShowButton(false);
      setDeferredPrompt(null);
    }

    function handleVisibilityChange() {
      if (isStandalone()) {
        saveInstallState();
        setAlreadyInstalled(true);
        setShowButton(false);
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    document.addEventListener("visibilitychange", handleVisibilityChange);


    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  async function handleClick() {
    if (isIOS()) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) {
      if (typeof window !== "undefined") {
        window.alert("برای نصب جم‌سیتی، از منوی مرورگر گزینه «افزودن به صفحه اصلی» یا «Install app» را انتخاب کنید.");
      }
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    // بعد از تأیید نصب، وضعیت را دائمی ذخیره می‌کنیم تا با رفرش دوباره دکمه برنگردد.
    if (outcome === "accepted") {
      saveInstallState();
      setAlreadyInstalled(true);
    }

    setDeferredPrompt(null);
    setShowButton(false);
  }

  if (alreadyInstalled || !showButton) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={placement === "home"
          ? "jam-install-home fixed left-1/2 top-[156px] z-[9999] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-[22px] border-2 border-red-300 bg-gradient-to-l from-white via-[#fff4f4] to-[#ffe8e8] px-8 py-5 text-lg font-black text-red-600 shadow-[0_12px_40px_rgba(220,38,38,.30),0_0_0_5px_rgba(255,255,255,.78)] sm:top-[170px] sm:px-12 sm:py-5 sm:text-xl"
          : "jam-install-glow flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3 py-2 text-[11px] font-black text-[#0f9a56] ring-2 ring-emerald-400/80 sm:gap-2 sm:px-7 sm:py-3 sm:text-base"}
      >
        <span className={placement === "home" ? "text-3xl sm:text-4xl" : "text-sm sm:text-2xl"}>📲</span>
        <span className={placement === "home" ? "text-lg sm:text-xl" : "sm:hidden"}>نصب اپلیکیشن جم‌سیتی</span>
        {placement !== "home" && <span className="hidden sm:inline">نصب اپلیکیشن</span>}
      </button>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-3 rounded-[22px] bg-white p-5 shadow-xl"
          >
            <h3 className="text-center text-[14px] font-black text-[#1D2B1F]">
              نصب جم‌سیتی روی آیفون
            </h3>
            <ol className="space-y-2 text-[13px] leading-6 text-[#4A564C]">
              <li>۱. در نوار پایین سافاری روی دکمهٔ اشتراک‌گذاری بزنید (مربع با فلش رو به بالا ⬆️)</li>
              <li>۲. گزینهٔ «Add to Home Screen» / «افزودن به صفحه اصلی» را انتخاب کنید</li>
              <li>۳. روی «Add» بزنید — آیکون جم‌سیتی روی صفحه اصلی گوشی اضافه می‌شود</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full rounded-xl bg-[#147A4B] py-2.5 text-[13px] font-bold text-white"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .jam-install-home { animation: jamInstallHome 2.2s ease-in-out infinite; }
        @keyframes jamInstallHome {
          0%, 100% { transform: translateX(-50%) scale(1); box-shadow: 0 12px 40px rgba(220,38,38,.30), 0 0 0 5px rgba(255,255,255,.78); }
          50% { transform: translateX(-50%) scale(1.045); box-shadow: 0 16px 48px rgba(220,38,38,.46), 0 0 0 7px rgba(255,255,255,.86), 0 0 28px rgba(255,70,70,.55); }
        }
        @media (max-width: 640px) {
          .jam-install-home { top: 156px; max-width: calc(100vw - 28px); padding: 15px 24px; border-radius: 20px; }
        }
        @media (prefers-reduced-motion: reduce) { .jam-install-home { animation: none; } }

        @keyframes jamInstallGlow {
          0%,
          100% {
            box-shadow: 0 0 10px 2px rgba(16, 185, 129, 0.5),
              0 0 0 1px rgba(16, 185, 129, 0.35);
          }
          50% {
            box-shadow: 0 0 24px 8px rgba(16, 185, 129, 0.85),
              0 0 0 1px rgba(16, 185, 129, 0.6);
          }
        }
        .jam-install-glow {
          animation: jamInstallGlow 2.1s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
