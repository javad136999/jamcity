"use client";

import { useEffect, useRef } from "react";
import type L from "leaflet";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  href?: string;
  emoji?: string;
  tier?: "gold" | "silver" | "bronze" | null;
  rating?: number | null;
};

const JAM_CENTER: [number, number] = [27.8194, 52.3242];
// Tighter bounding box around just the city core of Jam (not the
// whole county) — the user pans by hand within this box to explore.
const JAM_BOUNDS: [[number, number], [number, number]] = [
  [27.78, 52.27],
  [27.87, 52.38],
];

export default function LeafletMap({ markers }: { markers: MapMarker[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Create the map exactly once.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;

      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: JAM_CENTER,
        zoom: 14,
        minZoom: 13,
        maxZoom: 18,
        zoomControl: true,
        maxBounds: JAM_BOUNDS,
        maxBoundsViscosity: 1.0,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      map.fitBounds(JAM_BOUNDS);

      // Fade the info popup away as soon as the map is panned/zoomed
      // to somewhere else.
      map.on("movestart", () => map.closePopup());

      // Mobile has no mouse hover — so as the user drags/zooms the map,
      // whichever marker ends up nearest the map's center automatically
      // shows its preview popup, and it swaps to the next one as they
      // keep panning past it.
      map.on("move", () => {
        const layer = layerRef.current;
        if (!layer) return;
        const center = map.getSize().divideBy(2);
        let closest: L.Marker | null = null;
        let closestDist = 42; // px threshold to "catch" a marker
        layer.eachLayer((l) => {
          const marker = l as L.Marker;
          const pt = map.latLngToContainerPoint(marker.getLatLng());
          const d = pt.distanceTo(center);
          if (d < closestDist) {
            closestDist = d;
            closest = marker;
          }
        });
        layer.eachLayer((l) => {
          const marker = l as L.Marker;
          if (closest && marker === closest) {
            if (!marker.isPopupOpen()) marker.openPopup();
          } else if (marker.isPopupOpen()) {
            marker.closePopup();
          }
        });
      });

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      layerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update only the markers layer whenever the list changes —
  // never touch/recreate the map instance itself.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current || !layerRef.current) return;

      layerRef.current.clearLayers();

      const makeIcon = (emoji: string, isGold: boolean, rating: number | null | undefined) =>
        L.divIcon({
          className: "jam-marker",
          html: `
            <div style="position:relative;width:36px;height:36px;">
              <div style="background:#fff;color:#000;font-weight:bold;border-radius:9999px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 14px rgba(0,0,0,0.25);border:2px solid ${
                isGold ? "#eab308" : "#f97316"
              };">${emoji}</div>
              ${
                isGold
                  ? '<div style="position:absolute;top:-6px;right:-6px;font-size:14px;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.4));">⭐</div>'
                  : ""
              }
              ${
                rating
                  ? `<div style="position:absolute;bottom:-4px;left:-4px;background:#0b6e4f;color:#fff;font-size:9px;font-weight:bold;border-radius:9999px;min-width:16px;height:16px;padding:0 3px;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;">${rating.toFixed(
                      1
                    )}</div>`
                  : ""
              }
            </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        });

      markers.forEach((m) => {
        const marker = L.marker([m.lat, m.lng], {
          icon: makeIcon(m.emoji || "📍", m.tier === "gold", m.rating),
        });
        const popupHtml = `
          <div style="font-family: Vazirmatn, sans-serif; direction: rtl; text-align: right; min-width:100px; max-width:150px;">
            <strong style="font-size:12px;">${m.title}</strong>
            ${m.subtitle ? `<div style="font-size:10px;color:#666;margin-top:1px;">${m.subtitle}</div>` : ""}
            ${
              m.href
                ? `<a href="${m.href}" style="display:block;font-size:10px;color:#0b6e4f;font-weight:bold;margin-top:4px;">جزئیات ›</a>`
                : ""
            }
          </div>`;
        // Tapping/clicking the marker opens this popup (works on both
        // touch and mouse). Hovering on desktop also previews it.
        marker.bindPopup(popupHtml, { closeButton: true, autoPan: false, offset: [0, -8], minWidth: 90, maxWidth: 160 });
        marker.on("mouseover", () => marker.openPopup());

        marker.addTo(layerRef.current!);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [markers]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full overflow-hidden rounded-xl2 shadow-soft sm:h-80 md:h-96"
    />
  );
}
