"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type L from "leaflet";

type CategoryOption = { slug: string; name: string; icon: string };

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
  return value.replace(/[&<>'\\"]/g, (character) => ({
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
  const markerRefs = useRef<L.Marker[]>([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [activeCategory, setActiveCategory] = useState("");

  useEffect(() => {
    const readCategories = () => {
      const select = document.querySelector<HTMLSelectElement>('select[aria-label="فیلتر دسته‌بندی کسب‌وکارها"]');
      if (!select) return false;
      const options = Array.from(select.options).filter((option) => option.value).map((option) => {
        const match = option.textContent?.trim().match(/^(\S+)\s+(.+)$/);
        return { slug: option.value, icon: match?.[1] ?? "🏪", name: match?.[2] ?? option.textContent?.trim() ?? option.value };
      });
      setCategoryOptions(options);
      setActiveCategory(select.value);
      return true;
    };
    if (readCategories()) return;
    const timer = window.setTimeout(readCategories, 100);
    return () => window.clearTimeout(timer);
  }, [markers.length]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCategoryOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function chooseCategory(slug: string) {
    const select = document.querySelector<HTMLSelectElement>('select[aria-label="فیلتر دسته‌بندی کسب‌وکارها"]');
    if (!select) return;
    select.value = slug;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    setActiveCategory(slug);
    setCategoryOpen(false);
    // فیلتر توسط کامپوننت والد اعمال می‌شود؛ بعد از به‌روزرسانی markers،
    // افکت نقشه روی نتایج دسته‌بندی‌شده دقیقاً مرکز و زوم می‌کند.
  }

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
      if (cancelled) { map.remove(); map = null; return; }
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      window.setTimeout(() => map?.invalidateSize({ animate: false }), 80);
    })();
    return () => {
      cancelled = true;
      const currentMap = mapRef.current;
      layerRef.current = null;
      mapRef.current = null;
      markerRefs.current = [];
      if (currentMap) {
        try { currentMap.stop(); currentMap.off(); currentMap.remove(); } catch { /* نقشه قبلاً پاک شده است. */ }
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
      markerRefs.current = [];

      const makeIcon = (marker: MapMarker) => {
        const theme = markerTheme(marker);
        const emoji = escapeHtml(marker.emoji || "📍");
        const rating = marker.rating && marker.rating > 0 ? marker.rating.toFixed(1) : "";
        return L.divIcon({
          className: "jam-fantasy-marker",
          html: `<div class="jam-marker-wrap" style="--marker-main:${theme.main};--marker-soft:${theme.soft};--marker-ring:${theme.ring};"><div class="jam-marker-pulse"></div><div class="jam-marker-body"><span>${emoji}</span></div>${rating ? `<div class="jam-marker-rating">★ ${rating}</div>` : ""}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          tooltipAnchor: [0, -15],
        });
      };

      // برای جلوگیری از روی‌هم‌افتادن آیکون‌ها در زوم‌های بالا،
      // فقط نمایش بصری آیکون‌ها کمی از هم فاصله می‌گیرد؛ مختصات واقعی
      // کسب‌وکارها تغییر نمی‌کند و با زوم بیشتر دوباره به محل دقیق برمی‌گردند.
      const spreadMarkers = () => {
        const zoom = map.getZoom();
        const markerList = markerRefs.current;

        // فاصله‌ی تصویری در زوم اصلی بیشتر است و با زوم کاربر
        // به‌صورت تدریجی کم می‌شود تا در زوم بالا آیکون دقیقاً
        // روی مختصات واقعی کسب‌وکار قرار بگیرد.
        const progress = Math.max(0, Math.min(1, (zoom - 13) / 4));
        const spreadDistance = 30 * (1 - progress);

        markerList.forEach((marker) => {
          const icon = marker.getElement();
          if (icon) icon.style.setProperty("--jam-marker-offset", "translate(0,0)");
        });

        if (markerList.length < 2 || spreadDistance <= 0) return;

        const projected = markerList.map((marker) => ({
          marker,
          point: map.latLngToLayerPoint(marker.getLatLng()),
        }));

        for (let pass = 0; pass < 4; pass++) {
          for (let i = 0; i < projected.length; i++) {
            for (let j = i + 1; j < projected.length; j++) {
              const a = projected[i];
              const b = projected[j];
              const dx = b.point.x - a.point.x;
              const dy = b.point.y - a.point.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance >= spreadDistance) continue;

              if (distance < 0.1) {
                const angle = ((i * 137.5) + (j * 31)) * Math.PI / 180;
                const push = spreadDistance * 0.45;
                a.point = a.point.add(L.point(Math.cos(angle) * push, Math.sin(angle) * push));
                b.point = b.point.subtract(L.point(Math.cos(angle) * push, Math.sin(angle) * push));
                continue;
              }

              const push = (spreadDistance - distance) / 2;
              const nx = dx / distance;
              const ny = dy / distance;

              a.point = a.point.subtract(L.point(nx * push, ny * push));
              b.point = b.point.add(L.point(nx * push, ny * push));
            }
          }
        }

        projected.forEach(({ marker, point }) => {
          const original = map.latLngToLayerPoint(marker.getLatLng());
          const offset = point.subtract(original);
          const icon = marker.getElement();
          if (icon) {
            icon.style.setProperty(
              "--jam-marker-offset",
              `translate(${offset.x.toFixed(1)}px, ${offset.y.toFixed(1)}px)`
            );
          }
        });
      };

      markers.forEach((markerData) => {
        if (cancelled || !mapRef.current || !layerRef.current) return;
        const theme = markerTheme(markerData);
        const title = escapeHtml(markerData.title);
        const subtitle = escapeHtml(markerData.subtitle || theme.label);
        const href = markerData.href ? escapeHtml(markerData.href) : "#";
        const marker = L.marker([markerData.lat, markerData.lng], { icon: makeIcon(markerData), keyboard: false, riseOnHover: true });
        const tooltipHtml = `<div class="jam-marker-tooltip" dir="rtl"><div class="jam-marker-tooltip-title">${title}</div><div class="jam-marker-tooltip-subtitle">${subtitle}</div><a class="jam-marker-more" href="${href}">بیشتر <b>←</b></a></div>`;

        marker.bindTooltip(tooltipHtml, {
          permanent: false,
          direction: "right",
          offset: [7, 0],
          opacity: 1,
          className: "jam-business-tooltip",
          interactive: Boolean(markerData.href),
        });
        marker.on("click", () => marker.openTooltip());
        marker.addTo(layer);
        markerRefs.current.push(marker);
      });

      if (markerRefs.current.length === 1) {
        // وقتی یک کسب‌وکار/نتیجه برای دسته‌بندی باقی مانده،
        // دقیقاً روی همان محل زوم و مرکز می‌شویم.
        const isMobile = window.matchMedia("(max-width: 640px)").matches;
        map.setView(
          markerRefs.current[0].getLatLng(),
          isMobile ? 15 : 17,
          { animate: false }
        );
      } else if (markerRefs.current.length > 1) {
        // در حالت دسته‌بندی، تمام نتایج انتخاب‌شده در قاب دیده شوند.
        const bounds = L.latLngBounds(markerRefs.current.map((marker) => marker.getLatLng()));
        if (bounds.isValid()) {
          const isMobile = window.matchMedia("(max-width: 640px)").matches;
          map.fitBounds(bounds, {
            animate: false,
            padding: isMobile ? [22, 22] : [35, 35],
            maxZoom: isMobile ? 13 : 15,
          });
        }
      } else {
        map.fitBounds(JAM_BOUNDS, {
          animate: false,
          padding: [18, 18],
        });
      }

      spreadMarkers();

      let syncTimer: ReturnType<typeof setTimeout> | null = null;
      let fadeTimer: ReturnType<typeof setTimeout> | null = null;
      const closeBusinessTooltips = (fade = false) => {
        markerRefs.current.forEach((marker) => {
          const tooltip = marker.getTooltip();
          const element = tooltip?.getElement();
          if (fade && element) element.classList.add("jam-tooltip-fading");
          marker.closeTooltip();
        });
      };
      const findClosestMarker = (): L.Marker | null => {
        const centerPoint = map.getSize().divideBy(2);
        let closest: L.Marker | null = null;
        let closestDistance = Number.POSITIVE_INFINITY;
        for (const marker of markerRefs.current) {
          const point = map.latLngToContainerPoint(marker.getLatLng());
          const distance = point.distanceTo(centerPoint);
          if (distance < closestDistance) { closestDistance = distance; closest = marker; }
        }
        return closest;
      };
      const showZoomedBusiness = () => {
        if (syncTimer) clearTimeout(syncTimer);
        closeBusinessTooltips();
        if ((map.getZoom() ?? 0) < 15 || markerRefs.current.length === 0) return;
        syncTimer = setTimeout(() => {
          if (cancelled) return;
          const nearest = findClosestMarker();
          if (nearest) {
            nearest.openTooltip();
            nearest.getElement()?.classList.add("jam-marker-active");
          }
        }, 80);
      };
      const handleMoveStart = () => {
        if (fadeTimer) clearTimeout(fadeTimer);
        markerRefs.current.forEach((marker) => marker.getElement()?.classList.remove("jam-marker-active"));
        closeBusinessTooltips(true);
        fadeTimer = setTimeout(() => {
          markerRefs.current.forEach((marker) => marker.getTooltip()?.getElement()?.classList.remove("jam-tooltip-fading"));
        }, 220);
      };
      map.on("zoomend", () => { spreadMarkers(); showZoomedBusiness(); });
      map.on("moveend", () => { spreadMarkers(); showZoomedBusiness(); });
      map.on("movestart", handleMoveStart);
      showZoomedBusiness();
      return () => {
        if (syncTimer) clearTimeout(syncTimer);
        if (fadeTimer) clearTimeout(fadeTimer);
        map.off("zoomend", showZoomedBusiness);
        map.off("moveend", showZoomedBusiness);
        map.off("movestart", handleMoveStart);
      };
    })();
    return () => { cancelled = true; };
  }, [markers]);

  return (
    <div className="jam-map-frame">
      <div className="jam-map-category-bar" dir="rtl"><div className="jam-map-category-wrap"><button type="button" className={`jam-map-category-button ${categoryOpen ? "is-open" : ""}`} aria-expanded={categoryOpen} aria-label="انتخاب دسته‌بندی کسب‌وکارها" onClick={() => setCategoryOpen((value) => !value)}><span className="jam-map-category-icon">✨</span><span className="jam-map-category-copy"><b>{activeCategory ? categoryOptions.find((item) => item.slug === activeCategory)?.name : "دسته‌بندی کسب‌وکارها"}</b><small>{activeCategory ? "فیلتر فعال است" : "کافه، رستوران، باشگاه و..."}</small></span><span className="jam-map-category-chevron">⌄</span></button>{categoryOpen && (<div className="jam-map-category-menu" role="listbox" aria-label="دسته‌بندی کسب‌وکارها"><button type="button" className={`jam-map-category-item ${!activeCategory ? "active" : ""}`} onClick={() => chooseCategory("")}><span>✨</span><b>همه کسب‌وکارها</b></button>{categoryOptions.map((category) => (<button key={category.slug} type="button" className={`jam-map-category-item ${activeCategory === category.slug ? "active" : ""}`} onClick={() => chooseCategory(category.slug)}><span>{category.icon}</span><b>{category.name}</b></button>))}</div>)}</div></div>
      <div ref={containerRef} className="jam-map-canvas" />
      <div className="jam-map-legend"><span><i className="legend-dot gold" /> طلایی</span><span><i className="legend-dot silver" /> نقره‌ای</span><span><i className="legend-dot green" /> سایر مکان‌ها</span><span className="legend-zoom">+ / − برای زوم</span></div>
      <style jsx global>{`
        .jam-map-frame { width:100%; max-width:100%; overflow:visible; border:1px solid #eadfd4; box-sizing:border-box; border-radius:26px; background:#fff; box-shadow:0 14px 42px rgba(91,63,38,.12); }
        .jam-map-category-bar { position:relative; z-index:1200; display:flex; justify-content:flex-start; padding:8px 10px 7px; background:linear-gradient(135deg,#fffdf8,#f7fbf5); border-bottom:1px solid #edf0e7; border-radius:26px 26px 0 0; }
        .jam-map-category-wrap { position:relative; }
        .jam-map-category-button { display:flex; align-items:center; gap:8px; min-height:42px; max-width:100%; padding:6px 9px 6px 11px; border:1px solid #dfe9dd; border-radius:16px; background:rgba(255,255,255,.96); color:#234533; box-shadow:0 5px 16px rgba(38,93,61,.09); cursor:pointer; transition:.2s ease; }
        .jam-map-category-button:hover,.jam-map-category-button.is-open { border-color:#6cb58c; box-shadow:0 7px 20px rgba(38,120,75,.15); transform:translateY(-1px); }
        .jam-map-category-icon { display:flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:11px; background:linear-gradient(145deg,#eafff2,#fff4d9); font-size:16px; box-shadow:inset 0 0 0 1px rgba(37,125,77,.08); }
        .jam-map-category-copy { display:flex; min-width:0; flex-direction:column; align-items:flex-start; line-height:1.25; }
        .jam-map-category-copy b { max-width:220px; overflow:hidden; font-size:10px; font-weight:900; text-overflow:ellipsis; white-space:nowrap; }
        .jam-map-category-copy small { margin-top:2px; color:#8b9b8f; font-size:7px; font-weight:700; }
        .jam-map-category-chevron { margin-right:3px; color:#62816d; font-size:15px; transition:transform .2s ease; }
        .jam-map-category-button.is-open .jam-map-category-chevron { transform:rotate(180deg); }
        .jam-map-category-menu { position:absolute; top:calc(100% + 6px); right:0; z-index:1300; width:min(330px,calc(100vw - 32px)); max-height:250px; overflow:auto; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px; padding:7px; border:1px solid #e2eadf; border-radius:18px; background:rgba(255,255,255,.98); box-shadow:0 16px 38px rgba(31,69,47,.18); backdrop-filter:blur(14px); }
        .jam-map-category-item { display:flex; align-items:center; gap:6px; min-width:0; min-height:38px; padding:6px 7px; border:1px solid #edf1eb; border-radius:12px; background:#fafcf9; color:#415247; cursor:pointer; text-align:right; transition:.16s ease; }
        .jam-map-category-item span { display:flex; align-items:center; justify-content:center; width:24px; height:24px; flex:0 0 24px; border-radius:8px; background:#f0f7f1; font-size:13px; }
        .jam-map-category-item b { min-width:0; overflow:hidden; font-size:8px; font-weight:800; text-overflow:ellipsis; white-space:nowrap; }
        .jam-map-category-item:hover,.jam-map-category-item.active { border-color:#9ad0ad; background:#effaf2; color:#17643d; }
        .jam-map-category-menu::-webkit-scrollbar { width:5px; }
        .jam-map-category-menu::-webkit-scrollbar-thumb { border-radius:99px; background:#c8d9cc; }
        .jam-map-canvas { width:100%; height:clamp(300px,52vw,390px); overflow:hidden; background:#e9f1e8; border-radius:0; }
        .jam-map-legend { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:10px 16px; padding:10px 12px; color:#88786d; font-family:Vazirmatn,sans-serif; font-size:9px; direction:rtl; border-radius:0 0 26px 26px; }
        .jam-map-legend span { display:inline-flex; align-items:center; gap:4px; }
        .legend-dot { display:inline-block; width:9px; height:9px; border-radius:50%; }
        .legend-dot.gold { background:#d69a36; box-shadow:0 0 0 3px #fff1c9; }
        .legend-dot.silver { background:#8795a5; box-shadow:0 0 0 3px #e2e7ec; }
        .legend-dot.green { background:#2f7657; box-shadow:0 0 0 3px #dcefe3; }
        .legend-zoom { color:#b09e8e; }
        .jam-fantasy-marker { background:transparent !important; border:0 !important; }
        .jam-fantasy-marker > .jam-marker-wrap { transform:var(--jam-marker-offset,translate(0,0)); transform-origin:center; transition:transform .18s ease; }
        .jam-marker-wrap { position:relative; width:30px; height:30px; filter:drop-shadow(0 3px 4px rgba(61,39,23,.18)); }
        .jam-marker-body { position:absolute; z-index:3; inset:3px; display:flex; align-items:center; justify-content:center; width:24px; height:24px; border:2px solid #fff; border-radius:50%; background:linear-gradient(145deg,var(--marker-soft),#fff); box-shadow:0 0 0 2px var(--marker-ring), inset 0 2px 5px rgba(255,255,255,.9); font-size:14px; }
        .jam-marker-body span { transform:translateY(-1px); font-size:12px; }
        .jam-marker-pulse { position:absolute; inset:2px; border:1px solid var(--marker-ring); border-radius:50%; opacity:.35; animation:jamMarkerPulse 2.4s ease-out infinite; }
        .jam-marker-rating { position:absolute; z-index:6; bottom:-5px; left:-8px; border:1px solid #fff; border-radius:999px; background:var(--marker-main); color:#fff; padding:1px 3px; font:900 7px Vazirmatn,sans-serif; direction:ltr; }
        .jam-fantasy-marker.jam-marker-active .jam-marker-body { transform:scale(1.08); box-shadow:0 0 0 3px var(--marker-ring), 0 5px 12px rgba(72,48,29,.22), inset 0 2px 5px rgba(255,255,255,.9); }
        @keyframes jamMarkerPulse { 0% { transform:scale(.7); opacity:.55; } 75%,100% { transform:scale(1.35); opacity:0; } }
        .jam-business-tooltip { z-index:1000 !important; padding:0 !important; border:0 !important; background:transparent !important; box-shadow:none !important; pointer-events:auto; transition:opacity .18s ease, transform .18s ease; }
        .jam-business-tooltip.jam-tooltip-fading { opacity:0 !important; transform:translateY(5px); }
        .jam-business-tooltip::before { border-top-color:#fff !important; }
        .jam-marker-tooltip { min-width:112px; max-width:150px; padding:7px 8px 6px; border:1px solid #eadfd4; border-radius:11px; background:#fff; box-shadow:0 7px 18px rgba(72,48,29,.18); color:#3e3028; font-family:Vazirmatn,sans-serif; text-align:right; transform:translateZ(0); }
        .jam-marker-tooltip-title { overflow:hidden; color:#3c2d24; font-size:10px; font-weight:900; text-overflow:ellipsis; white-space:nowrap; }
        .jam-marker-tooltip-subtitle { margin-top:1px; overflow:hidden; color:#9b8b7e; font-size:8px; text-overflow:ellipsis; white-space:nowrap; }
        .jam-marker-more { display:flex; align-items:center; justify-content:space-between; margin-top:5px; border-radius:7px; background:#2f7657; color:#fff !important; padding:4px 6px; font-size:8px; font-weight:900; text-decoration:none !important; }
        .jam-marker-more b { font-size:11px; }
        .leaflet-control-zoom { overflow:hidden; border:1px solid #eadfd4 !important; border-radius:14px !important; box-shadow:0 6px 16px rgba(72,48,29,.14) !important; }
        .leaflet-control-zoom a { width:32px !important; height:32px !important; border:0 !important; background:#fff !important; color:#6e5949 !important; line-height:32px !important; }
        .leaflet-control-zoom a:hover { background:#fff8ef !important; color:#b47735 !important; }
        .home-shell > section:has(select[aria-label="فیلتر دسته‌بندی کسب‌وکارها"]) > div:first-child { display:none !important; }
        @media (max-width:640px) {
          .jam-map-category-bar { padding:6px 8px; }
          .jam-map-category-button { min-height:40px; max-width:215px; padding:5px 8px 5px 9px; border-radius:15px; }
          .jam-map-category-icon { width:23px; height:23px; border-radius:8px; font-size:13px; }
          .jam-map-category-copy b { max-width:145px; font-size:9px; }
          .jam-map-category-copy small { font-size:6.5px; }
          .jam-map-category-menu { width:min(300px,calc(100vw - 24px)); max-height:220px; grid-template-columns:repeat(2,minmax(0,1fr)); }
          .jam-map-canvas { height:clamp(300px,72vw,360px); }
          .jam-map-legend { gap:8px 10px; }
        }
        @media (prefers-reduced-motion:reduce) { .jam-marker-pulse { animation:none; } }
      `}</style>
    </div>
  );
}
