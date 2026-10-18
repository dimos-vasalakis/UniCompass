import type { Canteen, NearbyPlace } from "@/types";

export function walkLabel(p: NearbyPlace): string {
  return `${p.walk_minutes} min walk`;
}

// Canteen times are always estimates, hence the "~".
export function canteenLabel(c: Canteen): string {
  return c.mode === "walk" ? `~${c.minutes} min walk` : `~${c.minutes} min by transit`;
}

export function mapsUrl(lat: number, lng: number, name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}%20${lat},${lng}`;
}
