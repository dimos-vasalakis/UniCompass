import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { supabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Create account · UniCompass" };

export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" configured={supabaseConfigured} />
    </Suspense>
  );
}
