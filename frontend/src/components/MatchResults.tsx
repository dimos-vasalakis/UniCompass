"use client";

import Link from "next/link";
import { useMemo } from "react";
import AreaMap, { type MapPoint } from "@/components/Map";
import { ProsCons } from "@/components/ProsCons";
import { canteenLabel } from "@/lib/dailyLife";
import { areaNames, fmt, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/en";
import type { Hub, MatchArea } from "@/types";

/** The top-3 areas with their map: the last step of /match, and a saved search. */
export function Results({
  d,
  locale,
  results,
  campusPoint,
  hub,
  title,
  subtitle,
  actions,
  error,
}: {
  d: Dictionary;
  locale: Locale;
  results: MatchArea[];
  campusPoint: { slug: string; name: string; lat: number; lng: number } | null;
  hub: Hub | null;
  title: string;
  subtitle: React.ReactNode;
  actions: React.ReactNode;
  error?: string | null;
}) {
  const points = useMemo<MapPoint[]>(() => {
    const p: MapPoint[] = results.map((r, i) => ({
      key: r.slug,
      label: `${i + 1}. ${areaNames(locale, r)[0]}`,
      lat: r.lat,
      lng: r.lng,
      kind: "area",
      badge: String(i + 1),
    }));
    if (campusPoint) {
      p.push({ key: "campus", label: fmt(d.match.yourCampus, { name: campusPoint.name }), ...campusPoint, kind: "campus", badge: "🎓" });
    }
    if (hub) p.push({ key: "hub", label: hub.name, lat: hub.lat, lng: hub.lng, kind: "hub", badge: "⌂" });
    // Each area's nearest supermarket plus its closest gyms and canteens. Areas can share one, with
    // different travel times, so a shared pin lists the time for each area.
    const places = new Map<string, { kind: "supermarket" | "gym" | "canteen"; name: string; lat: number; lng: number; times: string[] }>();
    const addPlace = (kind: "supermarket" | "gym" | "canteen", name: string, lat: number, lng: number, rank: number, time?: string) => {
      const key = `${kind}:${lat},${lng}`;
      const entry = places.get(key) ?? { kind, name, lat, lng, times: [] };
      if (time) entry.times.push(`${rank}: ${time}`);
      places.set(key, entry);
    };
    results.forEach((r, i) => {
      const dl = r.daily_life;
      if (!dl) return;
      if (dl.supermarket) addPlace("supermarket", dl.supermarket.name, dl.supermarket.lat, dl.supermarket.lng, i + 1);
      for (const g of dl.gyms ?? []) addPlace("gym", g.name, g.lat, g.lng, i + 1);
      for (const c of dl.canteens ?? []) addPlace("canteen", areaNames(locale, c)[0], c.lat, c.lng, i + 1, canteenLabel(d, c));
    });
    for (const [key, { kind, name, lat, lng, times }] of places) {
      const badge = { supermarket: "🛒", gym: "🏋️", canteen: "🍽️" }[kind];
      p.push({ key, label: times.length ? `${name} · ${times.join(" · ")}` : name, lat, lng, kind, badge });
    }
    // One station per area, shared when areas have the same nearest one.
    const stations = new Map<string, MapPoint>();
    for (const r of results) {
      const m = r.metro;
      if (m && !stations.has(m.station.slug)) {
        stations.set(m.station.slug, {
          key: `metro:${m.station.slug}`,
          label: `${d.metro.heading}: ${m.station.name} · ${m.lines.map((l) => l.code).join(", ")}`,
          lat: m.station.lat,
          lng: m.station.lng,
          kind: "metro",
          badge: "Μ",
          metro: m,
        });
      }
    }
    p.push(...stations.values());
    return p;
  }, [results, campusPoint, hub, d, locale]);

  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          <p className="mt-1 text-muted">{subtitle}</p>
        </div>
        <div className="flex gap-2">{actions}</div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}

      {results.length === 0 ? (
        <div className="rounded-lg border border-border bg-brand-light p-6">
          <p className="font-medium">{d.match.noFitTitle}</p>
          <p className="mt-1 text-muted">{d.match.noFitHint}</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* On a phone the single column would bury the map under all the cards, so it comes first in the DOM too (focus order
             matches what you see); on desktop it moves to the right-hand column. */}
          <div className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
            <div className="h-72 lg:h-[520px]">
              <AreaMap points={points} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {d.match.legend}
              {hub ? fmt(d.match.legendHub, { hub: hub.name }) : ""}
              {points.some((p) => p.kind === "supermarket" || p.kind === "gym" || p.kind === "canteen") && d.match.legendNearby}
              {points.some((p) => p.kind === "metro") && d.match.legendMetro}
              {d.match.legendTail}
            </p>
          </div>
          <ol className="space-y-4 lg:col-start-1 lg:row-start-1">
            {results.map((r, i) => (
              <ResultCard key={r.slug} d={d} locale={locale} area={r} rank={i + 1} hub={hub} campusSlug={campusPoint?.slug ?? null} />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function ResultCard({
  d,
  locale,
  area,
  rank,
  hub,
  campusSlug,
}: {
  d: Dictionary;
  locale: Locale;
  area: MatchArea;
  rank: number;
  hub: Hub | null;
  campusSlug: string | null;
}) {
  const [name, altName] = areaNames(locale, area);
  return (
    <li className="rounded-xl border border-border p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-muted">#{rank}</div>
          <h2 className="text-xl font-semibold">
            {name} <span className="font-normal text-muted">· {altName}</span>
          </h2>
        </div>
        <div className="shrink-0 whitespace-nowrap rounded-full bg-brand px-3 py-1 text-sm font-semibold text-white">
          {fmt(d.match.matchPercent, { n: area.match })}
        </div>
      </div>

      {area.drivers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {area.drivers.map((driver) => (
            <span key={driver} className="rounded-full bg-accent/25 px-2.5 py-0.5 text-sm font-medium">
              {d.factors[driver].driver}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 text-sm text-muted">{area.description}</p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Stat label={d.match.studioRent} value={fmt(d.match.perMonth, { n: area.typical_studio_rent })} />
        <Stat
          label={d.match.toCampus}
          value={`${area.commute_estimated ? "~" : ""}${fmt(d.match.minutes, { n: area.commute_minutes })}`}
        />
        {hub && area.home_minutes != null && (
          <Stat
            label={fmt(d.match.toHub, { hub: hub.name })}
            value={`${area.home_estimated ? "~" : ""}${fmt(d.match.minutes, { n: area.home_minutes })}`}
          />
        )}
      </dl>

      {area.daily_life && (
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm ">
          <Stat
            label={d.daily.canteenTile}
            value={area.daily_life.canteen ? canteenLabel(d, area.daily_life.canteen) : "—"}
          />
        </dl>
      )}

      <div className="mt-4">
        <ProsCons pros={area.pros} cons={area.cons} limit={3} />
      </div>

      <Link href={`/neighborhoods/${area.slug}${campusSlug ? `?campus=${campusSlug}` : ""}`} className="mt-4 inline-block font-medium text-brand hover:underline">
        {fmt(d.match.fullGuide, { name })}
      </Link>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-brand-light px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
