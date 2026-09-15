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
const JAM_BOUNDS: [[number, number], [number, number]] = [
  [27.78, 52.27],
  [27.87, 52.38],
];

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function markerTheme(marker: MapMarker) {
  if (marker.tier === "gold") return { main: "#c98a2e", soft: "#fff4d6", ring: "#f0c86b", label: "طلایی" };
  const value = `${marker.title} ${marker.subtitle ?? ""}`;
  if (/کافه|رستوران|غذا|قهوه/i.test(value)) return { main: "#c46a40", soft: "#fff0e7", ring: "#e9a27d", label: "خوراکی" };
  if (/خودرو|اتو|تعمیرگاه|بار/i.test(value)) return { main: "#4777a8", soft: "#eaf4ff", ring: "#9fc5e6", label: "خودرو" };
  if (/ورزش|باشگاه/i.test(value)) return { main: "#7a62a7", soft: "#f3edff", ring: "#c5b6e7", label: "ورزشی" };
  if (/پزشک|درمان|دارو/i.test(value)) return { main: "#2f8d7d", soft: "#e7f8f3", ring: "#94d6c8", label: "سلامت" };
  return { main: "#2f7657", soft: "#e8f5ed", ring: "#99cdb0", label: "کسب‌وکار" };
}

export default function LeafletMap({ markers }: { markers: MapMarker[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: L.Map | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      const container = containerRef.current;
      if ((container as HTMLDivElement & { _leaflet_id?: number })._leaflet_id) return;

      map = L.map(container, {
        center: JAM_CENTER,
        zoom: 14,
        minZoom: 13,
        maxZoom: 18,
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: false,
        doubleClickZoom: true,
        touchZoom: true,
        boxZoom: false,
        keyboard: false,
        maxBounds: JAM_BOUNDS,
        maxBoundsViscosity: 1,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
      });

      if (cancelled) {
        map.remove();
        map = null;
        return;
      }

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      map.fitBounds(JAM_BOUNDS, { animate: false, padding: [18, 18] });
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      window.setTimeout(() => map?.invalidateSize({ animate: false }), 80);
    })();

    return () => {
      cancelled = true;
      const currentMap = mapRef.current;
      layerRef.current = null;
      mapRef.current = null;
      if (currentMap) {
        try {
          currentMap.stop();
          currentMap.off();
          currentMap.remove();
        } catch {
          // نقشه قبلاً پاک شده است.
        }
      }
      map = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      const layer = layerRef.current;
      if (cancelled || !map || !layer) return;
      layer.clearLayers();

      const makeIcon = (marker: MapMarker) => {
        const theme = markerTheme(marker);
        const emoji = escapeHtml(marker.emoji || "📍");
        const rating = marker.rating && marker.rating > 0 ? marker.rating.toFixed(1) : "";
        return L.divIcon({
          className: "jam-fantasy-marker",
          html: `<div class="jam-marker-wrap" style="--marker-main:${theme.main};--marker-soft:${theme.soft};--marker-ring:${theme.ring};">
            <div class="jam-marker-pulse"></div>
            <div class="jam-marker-shadow"></div>
            <div class="jam-marker-body"><span>${emoji}</span></div>
            <div class="jam-marker-tail"></div>
            ${marker.tier === "gold" ? '<div class="jam-marker-crown">♛</div>' : ""}
            ${rating ? `<div class="jam-marker-rating">★ ${rating}</div>` : ""}
          </div>`,
          iconSize: [46, 60],
          iconAnchor: [23, 52],
          popupAnchor: [0, -48],
        });
      };

      markers.forEach((markerData) => {
        if (cancelled || !mapRef.current || !layerRef.current) return;
        const theme = markerTheme(markerData);
        const title = escapeHtml(markerData.title);
        const subtitle = escapeHtml(markerData.subtitle || theme.label);
        const href = markerData.href ? escapeHtml(markerData.href) : "";
        const rating = markerData.rating && markerData.rating > 0 ? markerData.rating.toFixed(1) : null;
        const marker = L.marker([markerData.lat, markerData.lng], { icon: makeIcon(markerData), keyboard: false });
        const popupHtml = `<article class="jam-map-popup" dir="rtl">
          <div class="jam-popup-top" style="--popup-main:${theme.main};--popup-soft:${theme.soft};">
            <div class="jam-popup-icon">${escapeHtml(markerData.emoji || "📍")}</div>
            <div class="jam-popup-heading"><strong>${title}</strong><span>${subtitle}</span></div>
            ${markerData.tier === "gold" ? '<span class="jam-popup-gold">★ طلایی</span>' : ""}
          </div>
          <div class="jam-popup-meta"><span>📍 شهر جم</span>${rating ? `<span>★ ${rating}</span>` : ""}</div>
          ${href ? `<a class="jam-popup-link" href="${href}">مشاهدهٔ جزئیات کسب‌وکار <b>←</b></a>` : ""}
        </article>`;

        marker.bindPopup(popupHtml, {
          closeButton: true,
          autoPan: true,
          autoPanPadding: [24, 24],
          offset: [0, -8],
          minWidth: 245,
          maxWidth: 280,
          className: "jam-light-popup",
        });
        marker.on("click", () => marker.openPopup());
        marker.addTo(layer);
      });
    })();
    return () => { cancelled = true; };
  }, [markers]);

  return (
    <div className="jam-map-frame">
      <div className="jam-map-heading"><div><b>کشف کسب‌وکارهای جم</b><span>روی هر نشان بزنید تا اطلاعات کامل را ببینید</span></div><span className="jam-map-badge">{markers.length} مکان</span></div>
      <div ref={containerRef} className="jam-map-canvas" />
      <div className="jam-map-legend"><span><i className="legend-dot gold" /> کسب‌وکار طلایی</span><span><i className="legend-dot green" /> سایر مکان‌ها</span><span className="legend-zoom">+ / − برای زوم</span></div>
      <style jsx global>{`
        .jam-map-frame { overflow:hidden; border:1px solid #eadfd4; border-radius:26px; background:#fff; box-shadow:0 14px 42px rgba(91,63,38,.12); }
        .jam-map-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; background:linear-gradient(100deg,#fffaf3,#fff); border-bottom:1px solid #f0e7de; font-family:Vazirmatn,sans-serif; direction:rtl; }
        .jam-map-heading b { display:block; color:#3c2d24; font-size:14px; font-weight:900; }
        .jam-map-heading span:not(.jam-map-badge) { display:block; margin-top:3px; color:#9b8b7e; font-size:10px; }
        .jam-map-badge { flex-shrink:0; border:1px solid #f0d9ad; border-radius:999px; background:#fff8e9; color:#aa7029; padding:6px 10px; font-size:10px; font-weight:900; }
        .jam-map-canvas { height:390px; width:100%; overflow:hidden; background:#e9f1e8; }
        .jam-map-legend { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:10px 16px; padding:10px 12px; color:#88786d; font-family:Vazirmatn,sans-serif; font-size:9px; direction:rtl; }
        .jam-map-legend span { display:inline-flex; align-items:center; gap:4px; }
        .legend-dot { display:inline-block; width:9px; height:9px; border-radius:50%; }
        .legend-dot.gold { background:#d69a36; box-shadow:0 0 0 3px #fff1c9; }
        .legend-dot.green { background:#2f7657; box-shadow:0 0 0 3px #dcefe3; }
        .legend-zoom { color:#b09e8e; }
        .jam-fantasy-marker { background:transparent !important; border:0 !important; }
        .jam-marker-wrap { position:relative; width:46px; height:60px; filter:drop-shadow(0 5px 5px rgba(61,39,23,.18)); }
        .jam-marker-body { position:absolute; z-index:3; top:3px; left:6px; display:flex; align-items:center; justify-content:center; width:34px; height:34px; border:2px solid #fff; border-radius:50%; background:linear-gradient(145deg,var(--marker-soft),#fff); box-shadow:0 0 0 2px var(--marker-ring), inset 0 2px 6px rgba(255,255,255,.9); font-size:18px; }
        .jam-marker-body span { transform:translateY(-1px); }
        .jam-marker-tail { position:absolute; z-index:2; top:30px; left:17px; width:14px; height:14px; transform:rotate(45deg); border-right:2px solid #fff; border-bottom:2px solid #fff; background:var(--marker-main); }
        .jam-marker-shadow { position:absolute; z-index:1; top:34px; left:14px; width:20px; height:15px; transform:rotate(45deg); background:var(--marker-main); }
        .jam-marker-pulse { position:absolute; top:0; left:3px; width:40px; height:40px; border:1px solid var(--marker-ring); border-radius:50%; opacity:.35; animation:jamMarkerPulse 2.4s ease-out infinite; }
        .jam-marker-crown { position:absolute; z-index:5; top:-8px; right:-2px; display:flex; align-items:center; justify-content:center; width:18px; height:18px; border:1px solid #fff; border-radius:50%; background:#d79a35; color:#fff; font-size:10px; }
        .jam-marker-rating { position:absolute; z-index:6; bottom:7px; left:-5px; border:1px solid #fff; border-radius:999px; background:#2f7657; color:#fff; padding:1px 3px; font:900 7px Vazirmatn,sans-serif; direction:ltr; }
        @keyframes jamMarkerPulse { 0% { transform:scale(.7); opacity:.55; } 75%,100% { transform:scale(1.35); opacity:0; } }
        .jam-light-popup .leaflet-popup-content-wrapper { padding:0; overflow:hidden; border:1px solid #eadfd4; border-radius:20px; background:#fff; box-shadow:0 14px 38px rgba(72,48,29,.18); }
        .jam-light-popup .leaflet-popup-content { margin:0; min-width:245px; }
        .jam-light-popup .leaflet-popup-tip { background:#fff; box-shadow:2px 2px 3px rgba(72,48,29,.06); }
        .jam-light-popup .leaflet-popup-close-button { z-index:4; top:7px !important; left:8px !important; right:auto !important; width:26px !important; height:26px !important; border-radius:50%; background:#f8f0e7; color:#93745d !important; font-size:18px !important; line-height:24px !important; text-align:center; }
        .jam-map-popup { overflow:hidden; width:100%; color:#3e3028; font-family:Vazirmatn,sans-serif; }
        .jam-popup-top { display:flex; align-items:center; gap:9px; padding:14px 12px 11px; background:linear-gradient(135deg,var(--popup-soft),#fff); }
        .jam-popup-icon { display:flex; align-items:center; justify-content:center; width:40px; height:40px; flex-shrink:0; border:2px solid #fff; border-radius:14px; background:#fff; box-shadow:0 4px 12px rgba(79,53,31,.12); font-size:21px; }
        .jam-popup-heading { min-width:0; flex:1; padding-right:2px; }
        .jam-popup-heading strong { display:block; overflow:hidden; color:#3c2d24; font-size:12px; font-weight:900; text-overflow:ellipsis; white-space:nowrap; }
        .jam-popup-heading span { display:block; margin-top:3px; color:#8e7c6e; font-size:9px; }
        .jam-popup-gold { flex-shrink:0; border-radius:999px; background:#fff1c9; color:#a86d25; padding:4px 6px; font-size:8px; font-weight:900; }
        .jam-popup-meta { display:flex; justify-content:space-between; padding:9px 12px; border-bottom:1px solid #f3ebe3; color:#9c8c80; font-size:9px; }
        .jam-popup-link { display:flex; align-items:center; justify-content:space-between; margin:9px 12px 12px; border-radius:12px; background:#2f7657; color:#fff !important; padding:9px 11px; font-size:9px; font-weight:900; text-decoration:none !important; }
        .jam-popup-link b { font-size:14px; }
        .leaflet-control-zoom { overflow:hidden; border:1px solid #eadfd4 !important; border-radius:14px !important; box-shadow:0 6px 16px rgba(72,48,29,.14) !important; }
        .leaflet-control-zoom a { width:32px !important; height:32px !important; border:0 !important; background:#fff !important; color:#6e5949 !important; line-height:32px !important; }
        .leaflet-control-zoom a:hover { background:#fff8ef !important; color:#b47735 !important; }
        @media (max-width:640px) { .jam-map-canvas { height:300px; } .jam-map-heading { padding:12px; } .jam-map-heading b { font-size:12px; } .jam-map-legend { gap:8px 10px; } }
        @media (prefers-reduced-motion:reduce) { .jam-marker-pulse { animation:none; } }
      `}</style>
    </div>
  );
}
