import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeNext } from "@/lib/redirect";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES: readonly string[] = ["email", "signup", "magiclink", "invite", "recovery", "email_change"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next")) ?? "/dashboard";

  if (supabaseConfigured && (code || tokenHash)) {
    const supabase = await createClient();
    // Email links carry a token_hash (see the email templates in the README), which
    // verifies in any browser. A PKCE `code` (OAuth, or the default email templates)
    // only exchanges in the browser that started the flow, since it needs that
    // browser's code-verifier cookie.
    const { data, error } =
      tokenHash && type && EMAIL_OTP_TYPES.includes(type)
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })
        : code
          ? await supabase.auth.exchangeCodeForSession(code)
          : { data: { user: null }, error: new Error("unsupported link") };
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
