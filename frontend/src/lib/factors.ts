import type { Factor, ScoreKey } from "@/types";

export const FACTORS: { key: Factor; label: string; hint: string; driver: string }[] = [
  { key: "commute", label: "Quick trip to campus", hint: "Public transport time to your department", driver: "Shorter commute" },
  { key: "rent", label: "Low rent", hint: "Typical rent for a studio", driver: "Low rent" },
  { key: "safety", label: "Safety", hint: "How safe the area feels, day and night", driver: "Safe" },
  { key: "quiet", label: "Quiet", hint: "Calm streets, less traffic and noise", driver: "Quiet" },
  { key: "nightlife", label: "Going out", hint: "Bars, cafés and things to do at night", driver: "Great nightlife" },
  { key: "student_life", label: "Student life", hint: "Other students around you", driver: "Lots of students" },
  { key: "green", label: "Green space", hint: "Parks, hills or the sea nearby", driver: "Green" },
  { key: "amenities", label: "Everyday essentials", hint: "Supermarkets, pharmacies, shops", driver: "Everything nearby" },
  { key: "home", label: "Getting home", hint: "Trip to the bus, train, port or airport you use to go home", driver: "Quicker trip home" },
];

export const FACTOR_BY_KEY = Object.fromEntries(FACTORS.map((f) => [f.key, f])) as Record<
  Factor,
  (typeof FACTORS)[number]
>;

export const SCORE_LABELS: Record<ScoreKey, string> = {
  safety: "Safety",
  quiet: "Quiet",
  nightlife: "Going out",
  green: "Green space",
  amenities: "Essentials",
  student_life: "Student life",
};

export const ZONES: Record<string, string> = {
  center: "Central Athens",
  east: "East",
  north: "North",
  south: "South",
  west: "West",
  piraeus: "Piraeus",
};

export const HUB_KIND_LABELS: Record<string, string> = {
  ktel: "Intercity bus",
  rail: "Train",
  port: "Ferry",
  airport: "Flight",
};
