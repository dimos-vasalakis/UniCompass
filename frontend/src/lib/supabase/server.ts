import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./config";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component; the proxy refreshes sessions.
          }
        },
      },
    },
  );
}

/**
 * The logged-in user, or null (also null when Supabase isn't configured).
 * Wrapped in React `cache()` so the header and the page share one Supabase
 * Auth round trip per request instead of each making their own.
 */
export const getUser = cache(async () => {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The current session's access token for backend calls, or null. Cached per
 * request like getUser(); call getUser() first, since getSession() alone
 * doesn't verify the cookie with Supabase Auth.
 */
export const getAccessToken = cache(async () => {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
});
