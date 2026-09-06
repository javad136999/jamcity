"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("JamCity Service Worker registered:", registration.scope);
        })
        .catch((error) => {
          console.error("JamCity Service Worker registration failed:", error);
        });
    }
  }, []);

  return null;
}
