import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DeleteSavedMatch } from "@/components/DeleteSavedMatch";
import { LoadingBlock } from "@/components/Spinner";
import { getPrivate } from "@/lib/api/server";
import { areaNames, fmt, fmtDate } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { getAccessToken, getUser } from "@/lib/supabase/server";
import type { Profile, SavedMatch } from "@/types";

async function Dashboard() {
  const d = (await getDictionary()).dashboard;
  const locale = await getLocale();
  const user = await getUser();
  if (!user) redirect("/login?next=/dashboard");

  const token = await getAccessToken();
  let name = user.email ?? "";
  let saved: SavedMatch[] = [];
  let savedError = false;
  if (token) {
    try {
      saved = (await getPrivate<SavedMatch[]>(`/match/saved?lang=${locale}`, token)) ?? [];
    } catch {
      savedError = true;
    }
    try {
      const me = await getPrivate<Profile>("/users/me", token);
      name = me?.username ?? me?.full_name ?? name;
    } catch {
      // keep the email fallback
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">{fmt(d.welcome, { name })}</h1>
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
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/dashboard/saved/${m.id}`} className="font-semibold hover:text-brand">
                      {m.department} · {m.university}
                    </Link>
                    <p className="text-sm text-muted">{fmt(d.savedOn, { date: fmtDate(locale, m.created_at) })}</p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/saved/${m.id}`}
                      className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
                    >
                      {d.open}
                    </Link>
                    <DeleteSavedMatch id={m.id} />
                  </div>
                </div>
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
      <Suspense fallback={<LoadingBlock />}>
        <Dashboard />
      </Suspense>
    </main>
  );
}
