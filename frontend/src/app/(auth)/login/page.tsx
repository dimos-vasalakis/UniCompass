import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { getDictionary } from "@/lib/i18n/server";
import { supabaseConfigured } from "@/lib/supabase/config";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).meta.signInTitle };
}

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="signin" configured={supabaseConfigured} />
    </Suspense>
  );
}
