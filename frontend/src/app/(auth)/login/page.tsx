import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { supabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Sign in · UniCompass" };

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="signin" configured={supabaseConfigured} />
    </Suspense>
  );
}
