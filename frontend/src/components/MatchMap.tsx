"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";

export type MapPoint = {
  key: string;
  label: string;
  lat: number;
  lng: number;
  kind: "area" | "campus" | "hub";
};

const STYLE = {
  area: { color: "#2f6344", fillColor: "#3a7851", radius: 11 },
  campus: { color: "#b8862a", fillColor: "#eebc50", radius: 9 },
  hub: { color: "#5b6b61", fillColor: "#d5e2d9", radius: 7 },
} as const;

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
        <CircleMarker
          key={p.key}
          center={[p.lat, p.lng]}
          radius={STYLE[p.kind].radius}
          pathOptions={{ ...STYLE[p.kind], weight: 2, fillOpacity: 0.9 }}
        >
          <Tooltip direction="top" permanent={p.kind !== "hub"} offset={[0, -8]}>
            {p.label}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
