export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: "high_school" | "university";
  is_premium: boolean;
};

export type Factor =
  | "safety"
  | "commute"
  | "rent"
  | "quiet"
  | "nightlife"
  | "green"
  | "amenities"
  | "student_life"
  | "home";

export type ScoreKey = "safety" | "quiet" | "nightlife" | "green" | "amenities" | "student_life";
export type Scores = Record<ScoreKey, number>;

export type Point = { text: string; factor: string | null };

export type Campus = { slug: string; name: string; lat: number; lng: number };
export type Department = { id: string; name: string; campus_slug: string };
export type University = {
  slug: string;
  name: string;
  short_name: string;
  campuses: Campus[];
  departments: Department[];
};

export type Hub = {
  slug: string;
  name: string;
  kind: "ktel" | "airport" | "port" | "rail";
  serves: string;
  lat: number;
  lng: number;
};

export type NeighborhoodSummary = {
  slug: string;
  name: string;
  name_el: string;
  zone: string;
  lat: number;
  lng: number;
  typical_studio_rent: number;
  scores: Scores;
};

export type TravelTime = {
  destination_slug: string;
  destination_name: string;
  destination_type: "campus" | "hub";
  group: string;
  minutes: number;
  estimated: boolean;
};

export type NeighborhoodDetail = NeighborhoodSummary & {
  description: string;
  pros: Point[];
  cons: Point[];
  sources: string[];
  travel_times: TravelTime[];
};

export type MatchRequest = {
  department_id: string;
  weights: Partial<Record<Factor, number>>;
  home_hub_slug: string | null;
  max_rent: number | null;
  max_commute: number | null;
};

export type MatchArea = {
  slug: string;
  name: string;
  name_el: string;
  zone: string;
  lat: number;
  lng: number;
  description: string;
  match: number;
  drivers: Factor[];
  factor_scores: Partial<Record<Factor, number>>;
  typical_studio_rent: number;
  commute_minutes: number;
  commute_estimated: boolean;
  home_minutes: number | null;
  home_estimated: boolean | null;
  pros: Point[];
  cons: Point[];
};

export type MatchResponse = {
  results: MatchArea[];
  considered: number;
  within_limits: number;
};

export type SavedMatch = {
  id: string;
  department_id: string;
  results: MatchArea[];
};
