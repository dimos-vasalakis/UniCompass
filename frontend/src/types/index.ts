export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: "high_school" | "university";
  is_premium: boolean;
};

export type City = {
  id: string;
  name: string;
  region: string | null;
};

export type University = {
  id: string;
  name: string;
  city_id: string;
};
