import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { getDictionary } from "@/lib/i18n/server";
import { supabaseConfigured } from "@/lib/supabase/config";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).meta.signUpTitle };
}

export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" configured={supabaseConfigured} />
    </Suspense>
  );
}
