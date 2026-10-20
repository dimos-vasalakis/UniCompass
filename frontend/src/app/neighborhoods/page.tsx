import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/Spinner";
import { ApiUnavailable, NoAreaData } from "@/components/ApiUnavailable";
import { tryGetPublic } from "@/lib/api/server";
import { SCORE_KEYS, ZONE_KEYS } from "@/lib/factors";
import { areaNames } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import type { NeighborhoodSummary, ScoreKey } from "@/types";

export async function generateMetadata(): Promise<Metadata> {
  const d = (await getDictionary()).meta;
  return { title: d.neighborhoodsTitle, description: d.neighborhoodsDescription };
}

function bestAt(n: NeighborhoodSummary): ScoreKey[] {
  return SCORE_KEYS.map((k) => [k, n.scores[k]] as [ScoreKey, number])
    .filter(([, v]) => v >= 4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);
}

async function AreaList() {
  await connection();
  const d = await getDictionary();
  const locale = await getLocale();
  const hoods = await tryGetPublic<NeighborhoodSummary[]>("/neighborhoods");
  if (!hoods) return <ApiUnavailable />;
  if (!hoods.length) return <NoAreaData />;
  const byZone = ZONE_KEYS.map((zone) => ({
    zone,
    areas: hoods.filter((h) => h.zone === zone),
  }));

  return (
    <div className="space-y-10">
      {byZone
        .filter((z) => z.areas.length)
        .map(({ zone, areas }) => (
          <section key={zone}>
            <h2 className="mb-3 text-xl font-semibold">{d.zones[zone]}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {areas.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/neighborhoods/${a.slug}`}
                    className="block h-full rounded-lg border border-border p-4 transition hover:border-brand hover:bg-brand-light"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{areaNames(locale, a)[0]}</span>
                      <span className="text-sm text-muted">~€{a.typical_studio_rent}</span>
                    </div>
                    <div className="text-sm text-muted">{areaNames(locale, a)[1]}</div>
                    {bestAt(a).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {bestAt(a).map((b) => (
                          <span key={b} className="rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand-dark">
                            {d.scores[b]}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

async function Heading() {
  const d = (await getDictionary()).neighborhoods;
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold">{d.heading}</h1>
        <p className="mt-1 text-muted">{d.sub}</p>
      </div>
      <Link href="/match" className="rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark">
        {d.cta}
      </Link>
    </div>
  );
}

export default function NeighborhoodsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <Heading />
      <Suspense fallback={<LoadingBlock className="min-h-96" />}>
        <AreaList />
      </Suspense>
    </main>
  );
}
