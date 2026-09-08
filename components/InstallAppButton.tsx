"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

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
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowButton(true);
    }

    function handleAppInstalled() {
      setAlreadyInstalled(true);
      setShowButton(false);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // آیفون/سافاری هیچ‌وقت beforeinstallprompt نمی‌فرستد؛
    // پس دکمه را نشان بده و راهنمای دستی «افزودن به صفحه اصلی» را نمایش بده
    if (isIOS()) {
      setShowButton(true);
    }

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
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted" || outcome === "dismissed") {
      setDeferredPrompt(null);
      setShowButton(false);
    }
  }

  if (alreadyInstalled || !showButton) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="fixed bottom-20 left-3 z-30 flex items-center gap-1.5 rounded-full bg-[#147A4B] px-4 py-2.5 text-[12px] font-black text-white shadow-[0_8px_20px_rgba(20,122,75,.35)] transition hover:brightness-110 md:bottom-6"
      >
        📲 نصب اپلیکیشن
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
    </>
  );
}
