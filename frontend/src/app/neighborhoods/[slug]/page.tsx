import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProsCons } from "@/components/ProsCons";
import { ScoreBar } from "@/components/ScoreBar";
import { ApiUnavailable } from "@/components/ApiUnavailable";
import { tryGetPublic } from "@/lib/api/server";
import { canteenLabel, mapsUrl, walkLabel } from "@/lib/dailyLife";
import { SCORE_KEYS } from "@/lib/factors";
import { areaNames, fmt } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/en";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import type { NearbyPlace, NeighborhoodDetail, TravelTime } from "@/types";

function Minutes({ d, t }: { d: Dictionary; t: TravelTime }) {
  return (
    <span className="shrink-0 whitespace-nowrap tabular-nums">
      {t.estimated ? "~" : ""}
      {fmt(d.match.minutes, { n: t.minutes })}
    </span>
  );
}

function PlaceList({ d, title, places, empty }: { d: Dictionary; title: string; places: NearbyPlace[]; empty: string }) {
  return (
    <div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      {places.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {places.map((p) => (
            <li key={`${p.lat},${p.lng}`} className="flex justify-between gap-3 py-2">
              <a href={mapsUrl(p.lat, p.lng)} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                {p.name}
              </a>
              <span className="shrink-0 whitespace-nowrap tabular-nums">{walkLabel(d, p)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function Area({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  const d = await getDictionary();
  const n = await tryGetPublic<NeighborhoodDetail>(`/neighborhoods/${slug}?lang=${locale}`);
  if (n === undefined) return <ApiUnavailable />;
  if (n === null) notFound();

  const campuses = n.travel_times.filter((t) => t.destination_type === "campus");
  const hubs = n.travel_times.filter((t) => t.destination_type === "hub");
  const anyEstimated = n.travel_times.some((t) => t.estimated);

  return (
    <article className="space-y-10">
      <header>
        <p className="text-sm font-medium text-muted">{d.zones[n.zone as keyof Dictionary["zones"]]}</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">
          {areaNames(locale, n)[0]} <span className="font-normal text-muted">· {areaNames(locale, n)[1]}</span>
        </h1>
        <p className="mt-3 max-w-3xl text-lg">{n.description}</p>
        <p className="mt-4 inline-block rounded-lg bg-brand-light px-4 py-2">
          {d.area.typicalRent}<strong>{fmt(d.area.rentValue, { n: n.typical_studio_rent })}</strong>
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-xl font-semibold">{d.area.prosCons}</h2>
        <ProsCons pros={n.pros} cons={n.cons} />
      </section>

      <section className="max-w-xl space-y-2">
        <h2 className="mb-3 text-xl font-semibold">{d.area.atAGlance}</h2>
        {SCORE_KEYS.map((k) => (
          <ScoreBar key={k} label={d.scores[k]} value={n.scores[k]} />
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">{d.daily.heading}</h2>
        <div className={`grid gap-8 ${n.nearby_loaded ? "md:grid-cols-3" : ""}`}>
          {n.nearby_loaded && (
            <>
              <PlaceList d={d} title={d.daily.supermarkets} places={n.supermarkets} empty={d.daily.noSupermarkets} />
              <PlaceList d={d} title={d.daily.gyms} places={n.gyms} empty={d.daily.noGyms} />
            </>
          )}
          <div>
            <h3 className="mb-2 font-semibold">{d.daily.canteens}</h3>
            <ul className="divide-y divide-border text-sm">
              {n.canteens.map((c) => (
                <li key={c.slug} className="py-2">
                  <div className="flex justify-between gap-3">
                    <a href={mapsUrl(c.lat, c.lng)} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                      <span className="font-medium">{c.university}</span> · {areaNames(locale, c)[0]}
                    </a>
                    <span className="shrink-0 whitespace-nowrap tabular-nums">{canteenLabel(d, c)}</span>
                  </div>
                  {(c.address || c.approximate) && (
                    <p className="text-xs text-muted">
                      {c.address ?? d.daily.insideCampus}
                      {c.approximate ? ` · ${d.daily.approximatePin}` : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          {n.nearby_loaded && d.daily.osmNote}
          {d.daily.estimates}
        </p>
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-semibold">{d.area.toEachCampus}</h2>
          <ul className="divide-y divide-border text-sm">
            {campuses.map((t) => (
              <li key={t.destination_slug} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{t.group}</span> · {t.destination_name}
                </span>
                <Minutes d={d} t={t} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-xl font-semibold">{d.area.gettingHome}</h2>
          <ul className="divide-y divide-border text-sm">
            {hubs.map((t) => (
              <li key={t.destination_slug} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{d.hubKinds[t.group as keyof Dictionary["hubKinds"]]}</span> · {t.destination_name}
                </span>
                <Minutes d={d} t={t} />
              </li>
            ))}
          </ul>
        </div>
      </section>
      {anyEstimated && (
        <p className="text-sm text-muted">{d.area.estimateNote}</p>
      )}
    </article>
  );
}

async function PageShell({ params }: { params: Promise<{ slug: string }> }) {
  const d = (await getDictionary()).area;
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/neighborhoods" className="text-sm font-medium text-brand hover:underline">
        {d.back}
      </Link>
      <div className="mt-4">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-brand-light" />}>
          <Area params={params} />
        </Suspense>
      </div>
      <div className="mt-12 rounded-xl bg-brand-light p-6">
        <p className="font-semibold">{d.notSure}</p>
        <Link href="/match" className="mt-2 inline-block font-medium text-brand hover:underline">
          {d.notSureLink}
        </Link>
      </div>
    </main>
  );
}

export default function NeighborhoodPage({ params }: PageProps<"/neighborhoods/[slug]">) {
  return <PageShell params={params} />;
}
