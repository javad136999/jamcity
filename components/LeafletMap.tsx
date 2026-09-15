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
  if (marker.tier === "gold") {
    return { main: "#c58a28", soft: "#fff3ca", ring: "#e5b84f", label: "کسب‌وکار طلایی" };
  }
  if (marker.tier === "silver") {
    return { main: "#718092", soft: "#eef2f6", ring: "#aeb9c7", label: "کسب‌وکار نقره‌ای" };
  }
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
            <div class="jam-marker-body"><span>${emoji}</span></div>
            ${marker.tier === "gold" ? '<div class="jam-marker-badge">★</div>' : ""}
            ${rating ? `<div class="jam-marker-rating">★ ${rating}</div>` : ""}
          </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          tooltipAnchor: [0, -21],
        });
      };

      markers.forEach((markerData) => {
        if (cancelled || !mapRef.current || !layerRef.current) return;
        const theme = markerTheme(markerData);
        const title = escapeHtml(markerData.title);
        const subtitle = escapeHtml(markerData.subtitle || theme.label);
        const href = markerData.href ? escapeHtml(markerData.href) : "#";
        const marker = L.marker([markerData.lat, markerData.lng], {
          icon: makeIcon(markerData),
          keyboard: false,
        });

        const tooltipHtml = `<div class="jam-marker-tooltip" dir="rtl">
          <div class="jam-marker-tooltip-title">${title}</div>
          <div class="jam-marker-tooltip-subtitle">${subtitle}</div>
          <a class="jam-marker-more" href="${href}">بیشتر <b>←</b></a>
        </div>`;

        marker.bindTooltip(tooltipHtml, {
          permanent: false,
          direction: "top",
          offset: [0, -7],
          opacity: 1,
          className: "jam-business-tooltip",
          interactive: Boolean(markerData.href),
        });

        marker.on("click", () => marker.openTooltip());
        marker.addTo(layer);
      });

      const syncTooltips = () => {
        const zoomedIn = (map.getZoom() ?? 0) >= 16;
        layer.eachLayer((item) => {
          const marker = item as L.Marker;
          if (zoomedIn) marker.openTooltip();
          else marker.closeTooltip();
        });
      };
      map.on("zoomend", syncTooltips);
      syncTooltips();

      return () => map.off("zoomend", syncTooltips);
    })();
    return () => { cancelled = true; };
  }, [markers]);

  return (
    <div className="jam-map-frame">
      <div className="jam-map-heading"><div><b>کشف کسب‌وکارهای جم</b><span>با زوم بیشتر، نام و گزینهٔ «بیشتر» نمایش داده می‌شود</span></div><span className="jam-map-badge">{markers.length} مکان</span></div>
      <div ref={containerRef} className="jam-map-canvas" />
      <div className="jam-map-legend"><span><i className="legend-dot gold" /> طلایی</span><span><i className="legend-dot silver" /> نقره‌ای</span><span><i className="legend-dot green" /> سایر مکان‌ها</span><span className="legend-zoom">+ / − برای زوم</span></div>
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
        .legend-dot.silver { background:#8795a5; box-shadow:0 0 0 3px #e2e7ec; }
        .legend-dot.green { background:#2f7657; box-shadow:0 0 0 3px #dcefe3; }
        .legend-zoom { color:#b09e8e; }
        .jam-fantasy-marker { background:transparent !important; border:0 !important; }
        .jam-marker-wrap { position:relative; width:36px; height:36px; filter:drop-shadow(0 3px 4px rgba(61,39,23,.18)); }
        .jam-marker-body { position:absolute; z-index:3; inset:4px; display:flex; align-items:center; justify-content:center; width:28px; height:28px; border:2px solid #fff; border-radius:50%; background:linear-gradient(145deg,var(--marker-soft),#fff); box-shadow:0 0 0 2px var(--marker-ring), inset 0 2px 5px rgba(255,255,255,.9); font-size:14px; }
        .jam-marker-body span { transform:translateY(-1px); }
        .jam-marker-pulse { position:absolute; inset:2px; border:1px solid var(--marker-ring); border-radius:50%; opacity:.35; animation:jamMarkerPulse 2.4s ease-out infinite; }
        .jam-marker-badge { position:absolute; z-index:5; top:-4px; right:-4px; display:flex; align-items:center; justify-content:center; width:14px; height:14px; border:1px solid #fff; border-radius:50%; background:#d79a35; color:#fff; font:900 8px Arial; }
        .jam-marker-rating { position:absolute; z-index:6; bottom:-5px; left:-8px; border:1px solid #fff; border-radius:999px; background:var(--marker-main); color:#fff; padding:1px 3px; font:900 7px Vazirmatn,sans-serif; direction:ltr; }
        @keyframes jamMarkerPulse { 0% { transform:scale(.7); opacity:.55; } 75%,100% { transform:scale(1.35); opacity:0; } }
        .jam-business-tooltip { padding:0 !important; border:0 !important; background:transparent !important; box-shadow:none !important; }
        .jam-business-tooltip::before { border-top-color:#fff !important; }
        .jam-marker-tooltip { min-width:112px; max-width:150px; padding:7px 8px 6px; border:1px solid #eadfd4; border-radius:11px; background:#fff; box-shadow:0 7px 18px rgba(72,48,29,.18); color:#3e3028; font-family:Vazirmatn,sans-serif; text-align:right; }
        .jam-marker-tooltip-title { overflow:hidden; color:#3c2d24; font-size:10px; font-weight:900; text-overflow:ellipsis; white-space:nowrap; }
        .jam-marker-tooltip-subtitle { margin-top:1px; overflow:hidden; color:#9b8b7e; font-size:8px; text-overflow:ellipsis; white-space:nowrap; }
        .jam-marker-more { display:flex; align-items:center; justify-content:space-between; margin-top:5px; border-radius:7px; background:#2f7657; color:#fff !important; padding:4px 6px; font-size:8px; font-weight:900; text-decoration:none !important; }
        .jam-marker-more b { font-size:11px; }
        .leaflet-control-zoom { overflow:hidden; border:1px solid #eadfd4 !important; border-radius:14px !important; box-shadow:0 6px 16px rgba(72,48,29,.14) !important; }
        .leaflet-control-zoom a { width:32px !important; height:32px !important; border:0 !important; background:#fff !important; color:#6e5949 !important; line-height:32px !important; }
        .leaflet-control-zoom a:hover { background:#fff8ef !important; color:#b47735 !important; }
        @media (max-width:640px) { .jam-map-canvas { height:300px; } .jam-map-heading { padding:12px; } .jam-map-heading b { font-size:12px; } .jam-map-legend { gap:8px 10px; } }
        @media (prefers-reduced-motion:reduce) { .jam-marker-pulse { animation:none; } }
      `}</style>
    </div>
  );
}
