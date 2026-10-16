export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * False until real keys are in .env.local. The site still works without
 * Supabase (matching and area guides need no account); only sign-in is off.
 */
export function isSupabaseConfigured(url: string, key: string): boolean {
  return /^https?:\/\//.test(url) && !url.includes("your-project") && key.trim().length > 0;
}

export const supabaseConfigured = isSupabaseConfigured(SUPABASE_URL, SUPABASE_ANON_KEY);
