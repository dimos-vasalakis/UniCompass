import { NextResponse } from "next/server";
import { safeNext } from "@/lib/redirect";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next")) ?? "/dashboard";

  if (code && supabaseConfigured) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Google/GitHub sign-ins pick a username once, right after the first login.
      const oauth = data.user?.app_metadata?.provider !== "email";
      if (oauth && data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profile && !profile.username) {
          return NextResponse.redirect(`${origin}/auth/username?next=${encodeURIComponent(next)}`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
