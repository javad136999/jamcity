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

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showButton, setShowButton] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setAlreadyInstalled(true);
      return;
    }

    // اندروید/کروم/دسکتاپ: مرورگر رویداد beforeinstallprompt را می‌فرستد
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();

      // اگر نصب قبلاً ثبت شده، حتی در صورت ارسال مجدد رویداد هم دکمه نمایش داده نشود.
      if (isStandalone()) {
        setAlreadyInstalled(true);
        return;
      }

      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowButton(true);
    }

    function handleAppInstalled() {
      saveInstallState();
      setAlreadyInstalled(true);
      setShowButton(false);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // دکمه نصب در هدر همیشه برای مرورگرهای غیر Standalone قابل مشاهده باشد.
    // در اندروید، اگر beforeinstallprompt موجود باشد با همان رویداد نصب انجام می‌شود.
    // در آیفون، راهنمای دستی باز می‌شود.

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
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
        className="jam-install-glow flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3 py-2 text-[11px] font-black text-[#0f9a56] ring-2 ring-emerald-400/80 sm:gap-2 sm:px-7 sm:py-3 sm:text-base"
      >
        <span className="text-sm sm:text-2xl">📲</span>
        <span className="sm:hidden">نصب</span>
        <span className="hidden sm:inline">نصب اپلیکیشن</span>
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
