import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getPrivate } from "@/lib/api/server";
import { createClient, getUser } from "@/lib/supabase/server";
import type { SavedMatch } from "@/types";

async function Dashboard() {
  const user = await getUser();
  if (!user) redirect("/login?next=/dashboard");

  const {
    data: { session },
  } = await (await createClient()).auth.getSession();
  let saved: SavedMatch[] = [];
  let savedError = false;
  if (session) {
    try {
      saved = await getPrivate<SavedMatch[]>("/match/saved", session.access_token);
    } catch {
      savedError = true;
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Welcome, {user.email}</h1>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Your saved searches</h2>
        {savedError ? (
          <p className="mt-2 text-muted">Couldn&apos;t load your saved searches. Please try again later.</p>
        ) : saved.length === 0 ? (
          <p className="mt-2 text-muted">
            Nothing saved yet.{" "}
            <Link href="/match" className="font-medium text-brand hover:underline">
              Find your best areas →
            </Link>
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {saved.map((m) => (
              <li key={m.id} className="rounded-lg border border-border p-4">
                <ol className="flex flex-wrap gap-x-6 gap-y-1">
                  {m.results.map((r, i) => (
                    <li key={r.slug}>
                      <Link href={`/neighborhoods/${r.slug}`} className="hover:text-brand">
                        <span className="text-muted">{i + 1}.</span> <span className="font-medium">{r.name}</span>{" "}
                        <span className="text-sm text-muted">{r.match}%</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <Suspense fallback={<div className="h-8 w-64 animate-pulse rounded bg-brand-light" />}>
        <Dashboard />
      </Suspense>
    </main>
  );
}
