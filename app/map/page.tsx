"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { businessCategoryLabel, categoryLabel } from "@/lib/constants";
import { Spinner } from "@/components/Feedback";
import type { MapMarker } from "@/components/LeafletMap";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => <Spinner label="در حال بارگذاری نقشه..." />,
});

export default function MapPage() {
  const supabase = createClient();
  const [markers, setMarkers] = useState<MapMarker[] | null>(null);

  useEffect(() => {
    async function load() {
      const { data: businesses } = await supabase
        .from("businesses")
        .select("id, name, category, lat, lng")
        .not("lat", "is", null)
        .not("lng", "is", null);

      const { data: ads } = await supabase
        .from("ads")
        .select("id, title, category, lat, lng")
        .eq("status", "active")
        .not("lat", "is", null)
        .not("lng", "is", null);

      const businessMarkers: MapMarker[] = (businesses ?? []).map((b) => ({
        id: `b-${b.id}`,
        lat: b.lat as number,
        lng: b.lng as number,
        title: b.name,
        subtitle: businessCategoryLabel(b.category),
        href: `/business/${b.id}`,
      }));

      const adMarkers: MapMarker[] = (ads ?? []).map((a) => ({
        id: `a-${a.id}`,
        lat: a.lat as number,
        lng: a.lng as number,
        title: a.title,
        subtitle: categoryLabel(a.category),
        href: `/ad/${a.id}`,
      }));

      setMarkers([...businessMarkers, ...adMarkers]);
    }
    load();
  }, [supabase]);

  return (
    <div className="fade-in space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">نقشه جم</h1>
        <p className="text-sm text-slate-400">
          کسب‌وکارها، خدمات و آگهی‌های دارای موقعیت روی نقشه
        </p>
      </div>
      {markers === null ? (
        <Spinner label="در حال بارگذاری موقعیت‌ها..." />
      ) : (
        <LeafletMap markers={markers} />
      )}
    </div>
  );
}
