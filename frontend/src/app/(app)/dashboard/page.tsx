import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function Greeting() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <h1 className="text-2xl font-semibold">Welcome, {user.email}</h1>;
}

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <Suspense fallback={<div className="h-8 w-64 animate-pulse rounded bg-brand-light" />}>
        <Greeting />
      </Suspense>
      <p className="mt-2 text-muted">
        Your move checklist, housing and city guides will live here.
      </p>
    </main>
  );
}
