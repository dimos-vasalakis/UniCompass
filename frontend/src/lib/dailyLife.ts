import { fmt } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/en";
import type { Canteen } from "@/types";

// Canteen times are always estimates, hence the "~".
export function canteenLabel(d: Dictionary, c: Canteen): string {
  return fmt(c.mode === "walk" ? d.daily.walkEstimate : d.daily.transit, { n: c.minutes });
}

// Coordinates only: adding the name makes Google search for every branch of that chain in the country.
export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
