"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { useDict } from "@/lib/i18n/client";

export type MapPoint = {
  key: string;
  label: string;
  lat: number;
  lng: number;
  kind: "area" | "campus" | "hub" | "supermarket" | "gym" | "canteen";
  /** Shown inside the pin: the result rank for areas. */
  badge?: string;
};

// Numbered pins instead of permanent text labels: nearby areas (e.g. Zografou
// next to its campus) would otherwise hide each other's labels.
// Icons are cached: one per kind/badge, shared by every marker and rebuild.
const iconCache = new Map<string, L.DivIcon>();

function pin(p: MapPoint): L.DivIcon {
  const key = `${p.kind}:${p.badge ?? ""}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const styles = {
    area: "background:#3a7851;color:#fff;border:2px solid #fff;width:28px;height:28px;font-size:14px",
    campus: "background:#eebc50;color:#1c2b22;border:2px solid #fff;width:30px;height:30px;font-size:15px",
    hub: "background:#fff;color:#1c2b22;border:2px solid #5b6b61;width:24px;height:24px;font-size:12px",
    supermarket: "background:#fff;color:#1c2b22;border:2px solid #3a7851;width:22px;height:22px;font-size:12px",
    gym: "background:#fff;color:#1c2b22;border:2px solid #3a7851;width:22px;height:22px;font-size:12px",
    canteen: "background:#fff;color:#1c2b22;border:2px solid #eebc50;width:22px;height:22px;font-size:12px",
  }[p.kind];
  const size = { area: 28, campus: 30, hub: 24, supermarket: 22, gym: 22, canteen: 22 }[p.kind];
  const icon = L.divIcon({
    className: "",
    html: `<div style="${styles};border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.35)">${p.badge ?? ""}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  iconCache.set(key, icon);
  return icon;
}

// Leaflet treats string tooltip content as HTML; labels include third-party place names.
function tooltipText(label: string): HTMLElement {
  const span = document.createElement("span");
  span.textContent = label;
  return span;
}

const isPlace = (p: MapPoint) => p.kind === "supermarket" || p.kind === "gym" || p.kind === "canteen";

// The map is built imperatively in one effect rather than with react-leaflet's
// <MapContainer>: React re-runs effects when a hidden tree is shown again, and
// MapContainer has already removed its map by then, so the tile layer was added
// to a dead map ("Cannot read properties of undefined (reading 'appendChild')").
export default function MatchMap({ points }: { points: MapPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { zoomIn, zoomOut } = useDict().match;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const map = L.map(el, { scrollWheelZoom: false, zoomControl: false });
    L.control.zoom({ zoomInTitle: zoomIn, zoomOutTitle: zoomOut }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    for (const p of points) {
      L.marker([p.lat, p.lng], {
        icon: pin(p),
        zIndexOffset: p.kind === "area" ? 1000 : isPlace(p) ? -500 : 0,
      })
        .bindTooltip(tooltipText(p.label), { direction: "top", offset: [0, -14] })
        .addTo(map);
    }
    // Fit the map to the areas, campus and hub only: a far-away shop shouldn't zoom it out.
    const bounds = points.filter((p) => !isPlace(p)).map((p) => [p.lat, p.lng] as [number, number]);
    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    else map.setView([37.98, 23.73], 11);
    return () => {
      map.remove();
    };
  }, [points, zoomIn, zoomOut]);
  return <div ref={ref} className="h-full min-h-72 w-full rounded-lg" />;
}
