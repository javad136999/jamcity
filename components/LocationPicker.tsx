"use client";

import { useEffect, useRef } from "react";
import type L from "leaflet";

const JAM_CENTER: [number, number] = [27.8194, 52.3242];
const JAM_BOUNDS: [[number, number], [number, number]] = [
  [27.72, 52.19],
  [27.92, 52.46],
];

export default function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const start: [number, number] = lat && lng ? [lat, lng] : JAM_CENTER;
      const map = L.map(containerRef.current, {
        center: start,
        zoom: 14,
        minZoom: 12,
        maxZoom: 18,
        maxBounds: JAM_BOUNDS,
        maxBoundsViscosity: 1.0,
      });
      const bounds = L.latLngBounds(JAM_BOUNDS);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: "jam-marker",
        html: `<div style="background:#f97316;color:#fff;border-radius:9999px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.35);border:2px solid white;">📍</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      if (lat && lng) {
        markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
        markerRef.current.on("dragend", () => {
          const p = markerRef.current!.getLatLng();
          onChange(p.lat, p.lng);
        });
      }

      map.on("click", (e: L.LeafletMouseEvent) => {
        if (!bounds.contains(e.latlng)) return;
        const { lat: clickLat, lng: clickLng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([clickLat, clickLng]);
        } else {
          markerRef.current = L.marker([clickLat, clickLng], { icon, draggable: true }).addTo(map);
          markerRef.current.on("dragend", () => {
            const p = markerRef.current!.getLatLng();
            onChange(p.lat, p.lng);
          });
        }
        onChange(clickLat, clickLng);
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full overflow-hidden rounded-xl2 border border-slate-200 shadow-soft"
    />
  );
}
