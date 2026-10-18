import type { Factor, ScoreKey } from "@/types";

// Display order of the match sliders. Labels live in lib/i18n/{en,el}.ts.
export const FACTOR_KEYS: Factor[] = [
  "commute",
  "rent",
  "safety",
  "quiet",
  "nightlife",
  "student_life",
  "green",
  "amenities",
  "home",
];

export const SCORE_KEYS: ScoreKey[] = ["safety", "quiet", "nightlife", "green", "amenities", "student_life"];

export const ZONE_KEYS = ["center", "east", "north", "south", "west", "piraeus"] as const;
