"use client";

import { useEffect, useState } from "react";

const SPLASH_KEY = "jamcity:splash-shown";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SPLASH_KEY) === "true") {
        setVisible(false);
        return;
      }
      window.sessionStorage.setItem(SPLASH_KEY, "true");
    } catch {
      // Keep the splash visible briefly even if storage is unavailable.
    }

    const timer = window.setTimeout(() => setVisible(false), 1100);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black"
    >
      <img
        src="/icons/jamcity-icon.svg"
        alt=""
        className="h-auto w-[82vw] max-w-[560px] object-contain"
        draggable={false}
      />
    </div>
  );
}
