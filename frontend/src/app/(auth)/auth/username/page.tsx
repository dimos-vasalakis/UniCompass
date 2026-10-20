import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UsernameForm } from "@/components/UsernameForm";
import { getDictionary } from "@/lib/i18n/server";
import { getUser } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.username.title };
}

async function UsernameStep() {
  if (!(await getUser())) redirect("/login?next=/auth/username");
  return <UsernameForm />;
}

export default function UsernamePage() {
  return (
    <Suspense>
      <UsernameStep />
    </Suspense>
  );
}
