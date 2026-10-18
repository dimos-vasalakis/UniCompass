import { fmt } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/en";
import type { Canteen, NearbyPlace } from "@/types";

export function walkLabel(d: Dictionary, p: NearbyPlace): string {
  return fmt(d.daily.walk, { n: p.walk_minutes });
}

// Canteen times are always estimates, hence the "~".
export function canteenLabel(d: Dictionary, c: Canteen): string {
  return fmt(c.mode === "walk" ? d.daily.walkEstimate : d.daily.transit, { n: c.minutes });
}

export function mapsUrl(lat: number, lng: number, name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}%20${lat},${lng}`;
}
