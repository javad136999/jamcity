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

  return null;
}
