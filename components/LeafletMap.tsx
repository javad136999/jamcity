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
};

const JAM_CENTER: [number, number] = [27.8194, 52.3242];
// Rough bounding box around the city of Jam so the map can't be
// panned/zoomed out past the city limits.
const JAM_BOUNDS: [[number, number], [number, number]] = [
  [27.72, 52.19],
  [27.92, 52.46],
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
        zoom: 13,
        minZoom: 12,
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

      const makeIcon = (emoji: string) =>
        L.divIcon({
          className: "jam-marker",
          html: `<div style="background:#fff;color:#000;font-weight:bold;border-radius:9999px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 14px rgba(0,0,0,0.25);border:2px solid #f97316;">${emoji}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        });

      markers.forEach((m) => {
        const marker = L.marker([m.lat, m.lng], {
          icon: makeIcon(m.emoji || "📍"),
        });
        const popupHtml = `
          <div style="font-family: Vazirmatn, sans-serif; direction: rtl; text-align: right; min-width:150px;">
            <strong>${m.title}</strong>
            ${m.subtitle ? `<div style="font-size:12px;color:#666;margin-top:2px;">${m.subtitle}</div>` : ""}
            ${
              m.href
                ? `<a href="${m.href}" style="display:block;font-size:12px;color:#0b6e4f;font-weight:bold;margin-top:6px;">مشاهده جزئیات ›</a>`
                : ""
            }
          </div>`;
        // Tapping/clicking the marker opens this popup (works on both
        // touch and mouse). Hovering on desktop also previews it.
        marker.bindPopup(popupHtml, { closeButton: true, autoPan: false, offset: [0, -8] });
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
      className="h-[70vh] w-full overflow-hidden rounded-xl2 shadow-soft"
    />
  );
}
