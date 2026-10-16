import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProsCons } from "@/components/ProsCons";
import { ScoreBar } from "@/components/ScoreBar";
import { ApiUnavailable } from "@/components/ApiUnavailable";
import { tryGetPublic } from "@/lib/api/server";
import { HUB_KIND_LABELS, SCORE_LABELS, ZONES } from "@/lib/factors";
import type { NeighborhoodDetail, ScoreKey, TravelTime } from "@/types";

function Minutes({ t }: { t: TravelTime }) {
  return (
    <span className="shrink-0 whitespace-nowrap tabular-nums">
      {t.estimated ? "~" : ""}
      {t.minutes} min
    </span>
  );
}

async function Area({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const n = await tryGetPublic<NeighborhoodDetail>(`/neighborhoods/${slug}`);
  if (n === undefined) return <ApiUnavailable />;
  if (n === null) notFound();

  const campuses = n.travel_times.filter((t) => t.destination_type === "campus");
  const hubs = n.travel_times.filter((t) => t.destination_type === "hub");
  const anyEstimated = n.travel_times.some((t) => t.estimated);

  return (
    <article className="space-y-10">
      <header>
        <p className="text-sm font-medium text-muted">{ZONES[n.zone]}</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">
          {n.name} <span className="font-normal text-muted">· {n.name_el}</span>
        </h1>
        <p className="mt-3 max-w-3xl text-lg">{n.description}</p>
        <p className="mt-4 inline-block rounded-lg bg-brand-light px-4 py-2">
          Typical studio rent: <strong>~€{n.typical_studio_rent}/month</strong>
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Advantages and disadvantages</h2>
        <ProsCons pros={n.pros} cons={n.cons} />
      </section>

      <section className="max-w-xl space-y-2">
        <h2 className="mb-3 text-xl font-semibold">At a glance</h2>
        {(Object.keys(SCORE_LABELS) as ScoreKey[]).map((k) => (
          <ScoreBar key={k} label={SCORE_LABELS[k]} value={n.scores[k]} />
        ))}
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-semibold">To each campus</h2>
          <ul className="divide-y divide-border text-sm">
            {campuses.map((t) => (
              <li key={t.destination_slug} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{t.group}</span> · {t.destination_name}
                </span>
                <Minutes t={t} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-xl font-semibold">Getting home</h2>
          <ul className="divide-y divide-border text-sm">
            {hubs.map((t) => (
              <li key={t.destination_slug} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{HUB_KIND_LABELS[t.group]}</span> · {t.destination_name}
                </span>
                <Minutes t={t} />
              </li>
            ))}
          </ul>
        </div>
      </section>
      {anyEstimated && (
        <p className="text-sm text-muted">~ Times are estimates by public transport and may differ.</p>
      )}
    </article>
  );
}

export default function NeighborhoodPage({ params }: PageProps<"/neighborhoods/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/neighborhoods" className="text-sm font-medium text-brand hover:underline">
        ← All areas
      </Link>
      <div className="mt-4">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-brand-light" />}>
          <Area params={params} />
        </Suspense>
      </div>
      <div className="mt-12 rounded-xl bg-brand-light p-6">
        <p className="font-semibold">Not sure this is the right area for you?</p>
        <Link href="/match" className="mt-2 inline-block font-medium text-brand hover:underline">
          Get your 3 best areas based on what matters to you →
        </Link>
      </div>
    </main>
  );
}
