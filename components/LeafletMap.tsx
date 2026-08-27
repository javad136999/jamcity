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

      // جلوگیری از ساخته شدن دوباره نقشه روی همان DOM
      if ((container as HTMLDivElement & { _leaflet_id?: number })._leaflet_id) {
        return;
      }

      map = L.map(container, {
        center: JAM_CENTER,
        zoom: 14,
        minZoom: 13,
        maxZoom: 18,
        zoomControl: true,
        maxBounds: JAM_BOUNDS,
        maxBoundsViscosity: 1.0,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
      });

      if (cancelled) {
        map.remove();
        map = null;
        return;
      }

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      map.fitBounds(JAM_BOUNDS, {
        animate: false,
      });

      map.on("movestart", () => {
        if (!map || cancelled) return;
        map.closePopup();
      });

      map.on("move", () => {
        if (!map || cancelled || !layerRef.current) return;

        try {
          const layer = layerRef.current;
          const center = map.getSize().divideBy(2);

          let closest: L.Marker | null = null;
          let closestDist = 42;

          layer.eachLayer((l) => {
            if (!(l instanceof L.Marker)) return;

            const marker = l as L.Marker;

            if (!marker.getElement()) return;

            const pt = map!.latLngToContainerPoint(marker.getLatLng());
            const d = pt.distanceTo(center);

            if (d < closestDist) {
              closestDist = d;
              closest = marker;
            }
          });

          layer.eachLayer((l) => {
            if (!(l instanceof L.Marker)) return;

            const marker = l as L.Marker;

            if (!marker.getElement()) return;

            if (closest && marker === closest) {
              if (!marker.isPopupOpen()) {
                marker.openPopup();
              }
            } else if (marker.isPopupOpen()) {
              marker.closePopup();
            }
          });
        } catch {
          // Leaflet ممکن است در زمان تغییر DOM در حال transition باشد.
          // در این حالت فقط آن event را نادیده می‌گیریم.
        }
      });

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
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
          // نقشه ممکن است قبلاً توسط Leaflet پاک شده باشد.
        }
      }

      map = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;

      if (cancelled) return;

      const map = mapRef.current;
      const layer = layerRef.current;

if (!map || !layer || !map.getContainer()) return;
      try {
        layer.clearLayers();
      } catch {
        return;
      }

      const makeIcon = (
        emoji: string,
        isGold: boolean,
        rating: number | null | undefined
      ) =>
        L.divIcon({
          className: "jam-marker",
          html: `
            <div style="position:relative;width:36px;height:36px;">
              <div style="
                background:#fff;
                color:#000;
                font-weight:bold;
                border-radius:9999px;
                width:36px;
                height:36px;
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:18px;
                box-shadow:0 4px 14px rgba(0,0,0,0.25);
                border:2px solid ${isGold ? "#eab308" : "#f97316"};
              ">${emoji}</div>

              ${
                isGold
                  ? '<div style="position:absolute;top:-6px;right:-6px;font-size:14px;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.4));">⭐</div>'
                  : ""
              }

              ${
                rating
                  ? `<div style="
                    position:absolute;
                    bottom:-4px;
                    left:-4px;
                    background:#0b6e4f;
                    color:#fff;
                    font-size:9px;
                    font-weight:bold;
                    border-radius:9999px;
                    min-width:16px;
                    height:16px;
                    padding:0 3px;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    border:1.5px solid #fff;
                  ">${rating.toFixed(1)}</div>`
                  : ""
              }
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        });

      markers.forEach((m) => {
        if (cancelled || !mapRef.current || !layerRef.current) return;

        const marker = L.marker([m.lat, m.lng], {
          icon: makeIcon(
            m.emoji || "📍",
            m.tier === "gold",
            m.rating
          ),
        });

        const popupHtml = `
          <div style="
            font-family: Vazirmatn, sans-serif;
            direction: rtl;
            text-align: right;
            min-width:100px;
            max-width:150px;
          ">
            <strong style="font-size:12px;">${m.title}</strong>

            ${
              m.subtitle
                ? `<div style="font-size:10px;color:#666;margin-top:1px;">
                    ${m.subtitle}
                  </div>`
                : ""
            }

            ${
              m.href
                ? `<a href="${m.href}" style="
                    display:block;
                    font-size:10px;
                    color:#0b6e4f;
                    font-weight:bold;
                    margin-top:4px;
                  ">جزئیات ›</a>`
                : ""
            }
          </div>
        `;

        marker.bindPopup(popupHtml, {
          closeButton: true,
          autoPan: false,
          offset: [0, -8],
          minWidth: 90,
          maxWidth: 160,
        });

        marker.on("mouseover", () => {
          if (!cancelled && mapRef.current) {
            marker.openPopup();
          }
        });

        try {
          marker.addTo(layerRef.current);
        } catch {
          marker.remove();
        }
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