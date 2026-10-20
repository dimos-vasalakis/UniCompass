export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
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

export type NearbyPlace = { name: string; lat: number; lng: number; walk_minutes: number };

export type Canteen = {
  slug: string;
  name: string;
  name_el: string;
  university: string;
  address: string | null;
  lat: number;
  lng: number;
  approximate: boolean;
  mode: "walk" | "transit";
  minutes: number;
};

export type DailyLife = {
  nearby_loaded: boolean;
  supermarket: NearbyPlace | null;
  gym: NearbyPlace | null;
  canteen: Canteen | null;
  // Missing on matches saved before these existed.
  gyms?: NearbyPlace[];
  canteens?: Canteen[];
};

export type MetroLine = {
  slug: string;
  code: string;
  color: "green" | "red" | "blue";
  hex: string;
  name: string;
  from_station: string;
  to_station: string;
  /** [lat, lng] of every station on the line, in order. */
  path: [number, number][];
};

export type Metro = {
  station: { slug: string; name: string; lat: number; lng: number };
  lines: MetroLine[];
  distance_m: number;
  walk_minutes: number;
  in_area: boolean;
};

export type RouteStep = {
  kind: "walk" | "ride" | "transfer" | "transit";
  minutes: number;
  to: string | null;
  to_kind: "station" | "campus" | null;
  meters: number | null;
  line_code: string | null;
  line_color: string | null;
  line_hex: string | null;
  line_name: string | null;
  from_station: string | null;
  to_station: string | null;
  direction: string | null;
  stops: number | null;
  station: string | null;
  from_line_code: string | null;
  from_line_color: string | null;
  from_line_hex: string | null;
};

export type RouteOption = {
  mode: "walk" | "metro" | "transit";
  minutes: number;
  estimated: boolean;
  steps: RouteStep[];
};

export type RouteGuide = {
  campus: { slug: string; name: string; lat: number; lng: number };
  options: RouteOption[];
};

export type NeighborhoodDetail = NeighborhoodSummary & {
  description: string;
  pros: Point[];
  cons: Point[];
  sources: string[];
  metro: Metro | null;
  travel_times: TravelTime[];
  nearby_loaded: boolean;
  supermarkets: NearbyPlace[];
  gyms: NearbyPlace[];
  canteens: Canteen[];
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
  // Missing on matches saved before this existed.
  daily_life?: DailyLife | null;
  metro?: Metro | null;
};

export type MatchResponse = {
  results: MatchArea[];
  considered: number;
  within_limits: number;
};

export type SavedMatch = {
  id: string;
  department_id: string;
  department: string;
  university: string; // short name
  created_at: string;
  preferences: MatchRequest;
  results: MatchArea[];
};
