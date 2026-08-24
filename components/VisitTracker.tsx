"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    // One row per browser tab session (not per page navigation) so the
    // counter reflects visits, not clicks.
    const KEY = "jamcity_visit_logged";
    if (typeof window !== "undefined" && sessionStorage.getItem(KEY)) return;

    supabase
      .from("site_visits")
      .insert({ path: pathname })
      .then(() => {
        if (typeof window !== "undefined") sessionStorage.setItem(KEY, "1");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PWA auto-update: as soon as a new service worker (from a fresh
  // deploy) takes control of the page, reload once so installed-app
  // users automatically get the latest version without manually
  // clearing their cache.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // Also proactively ask the active service worker to check for an
    // update whenever the page becomes visible again.
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      const check = () => reg.update().catch(() => {});
      check();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
