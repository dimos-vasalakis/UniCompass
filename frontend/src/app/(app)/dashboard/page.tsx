import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getPrivate } from "@/lib/api/server";
import { areaNames, fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { getAccessToken, getUser } from "@/lib/supabase/server";
import type { SavedMatch } from "@/types";

async function Dashboard() {
  const d = (await getDictionary()).dashboard;
  const locale = await getLocale();
  const user = await getUser();
  if (!user) redirect("/login?next=/dashboard");

  const token = await getAccessToken();
  let saved: SavedMatch[] = [];
  let savedError = false;
  if (token) {
    try {
      saved = await getPrivate<SavedMatch[]>("/match/saved", token);
    } catch {
      savedError = true;
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">{fmt(d.welcome, { email: user.email ?? "" })}</h1>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">{d.saved}</h2>
        {savedError ? (
          <p className="mt-2 text-muted">{d.loadError}</p>
        ) : saved.length === 0 ? (
          <p className="mt-2 text-muted">
            {d.nothingSaved}
            <Link href="/match" className="font-medium text-brand hover:underline">
              {d.findAreas}
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
                        <span className="text-muted">{i + 1}.</span> <span className="font-medium">{areaNames(locale, r)[0]}</span>{" "}
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
