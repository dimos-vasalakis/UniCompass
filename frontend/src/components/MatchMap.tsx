"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { useDict } from "@/lib/i18n/client";
import type { Metro } from "@/types";

export type MapPoint = {
  key: string;
  label: string;
  lat: number;
  lng: number;
  kind: "area" | "campus" | "hub" | "supermarket" | "gym" | "canteen" | "metro";
  /** Metro stations: clicking one draws the lines serving it. */
  metro?: Metro;
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
    metro: "background:#fff;color:#1c2b22;border:2px solid #0072bc;width:24px;height:24px;font-size:13px",
  }[p.kind];
  const size = { area: 28, campus: 30, hub: 24, supermarket: 22, gym: 22, canteen: 22, metro: 24 }[p.kind];
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

const isPlace = (p: MapPoint) => p.kind === "supermarket" || p.kind === "gym" || p.kind === "canteen" || p.kind === "metro";

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
    const lineLayer = L.layerGroup().addTo(map);
    let selected: string | null = null;
    let viewBefore: { center: L.LatLng; zoom: number } | null = null;
    const hideLines = () => {
      lineLayer.clearLayers();
      selected = null;
      // Undo the zoom-to-lines so the areas are back in view.
      if (viewBefore) map.setView(viewBefore.center, viewBefore.zoom);
      viewBefore = null;
    };
    // Click a station to draw the lines through it (white casing under the colour so
    // they stay readable on the map); click it again, or the map, to hide them.
    const showLines = (p: MapPoint) => {
      if (!p.metro || selected === p.key) {
        hideLines();
        return;
      }
      lineLayer.clearLayers();
      viewBefore ??= { center: map.getCenter(), zoom: map.getZoom() };
      selected = p.key;
      for (const l of p.metro.lines) {
        L.polyline(l.path, { color: "#fff", weight: 9, opacity: 0.9, interactive: false }).addTo(lineLayer);
        L.polyline(l.path, { color: l.hex, weight: 5, opacity: 0.95 })
          .bindTooltip(tooltipText(`${l.code} · ${l.name}: ${l.from_station} – ${l.to_station}`), { sticky: true })
          .addTo(lineLayer);
      }
      const all = p.metro.lines.flatMap((l) => l.path);
      if (all.length) map.fitBounds(all, { padding: [30, 30] });
    };
    map.on("click", hideLines);
    for (const p of points) {
      const marker = L.marker([p.lat, p.lng], {
        icon: pin(p),
        zIndexOffset: p.kind === "area" ? 1000 : isPlace(p) ? -500 : 0,
      })
        .bindTooltip(tooltipText(p.label), { direction: "top", offset: [0, -14] })
        .addTo(map);
      if (p.kind === "metro") marker.on("click", () => showLines(p));
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
