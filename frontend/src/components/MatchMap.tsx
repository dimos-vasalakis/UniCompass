"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";

export type MapPoint = {
  key: string;
  label: string;
  lat: number;
  lng: number;
  kind: "area" | "campus" | "hub";
  /** Shown inside the pin: the result rank for areas. */
  badge?: string;
};

// Numbered pins instead of permanent text labels: nearby areas (e.g. Zografou
// next to its campus) would otherwise hide each other's labels.
// Icons are cached: a new L.divIcon each render makes react-leaflet rebuild the
// marker DOM, which flickers and closes any open tooltip.
const iconCache = new Map<string, L.DivIcon>();

function pin(p: MapPoint): L.DivIcon {
  const key = `${p.kind}:${p.badge ?? ""}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const styles = {
    area: "background:#3a7851;color:#fff;border:2px solid #fff;width:28px;height:28px;font-size:14px",
    campus: "background:#eebc50;color:#1c2b22;border:2px solid #fff;width:30px;height:30px;font-size:15px",
    hub: "background:#fff;color:#1c2b22;border:2px solid #5b6b61;width:24px;height:24px;font-size:12px",
  }[p.kind];
  const size = { area: 28, campus: 30, hub: 24 }[p.kind];
  const icon = L.divIcon({
    className: "",
    html: `<div style="${styles};border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.35)">${p.badge ?? ""}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  iconCache.set(key, icon);
  return icon;
}

export default function MatchMap({ points }: { points: MapPoint[] }) {
  const bounds = points.map((p) => [p.lat, p.lng] as [number, number]);
  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [40, 40], maxZoom: 14 }}
      scrollWheelZoom={false}
      className="h-full min-h-72 w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p) => (
        <Marker
          key={p.key}
          position={[p.lat, p.lng]}
          icon={pin(p)}
          zIndexOffset={p.kind === "area" ? 1000 : 0}
        >
          <Tooltip direction="top" offset={[0, -14]}>
            {p.label}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
