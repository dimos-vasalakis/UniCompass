"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AreaMap, { type MapPoint } from "@/components/Map";
import { ProsCons } from "@/components/ProsCons";
import { ApiError, apiFetch } from "@/lib/api/client";
import { canteenLabel } from "@/lib/dailyLife";
import { FACTOR_KEYS } from "@/lib/factors";
import { useDict, useLocale } from "@/lib/i18n/client";
import { areaNames, fmt, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/en";
import type { Factor, Hub, MatchArea, MatchRequest, MatchResponse, University } from "@/types";

const PENDING_KEY = "unicompass:pending-match";
// Every slider starts at the same middle value ("Somewhat"): the student decides what matters more.
const NEUTRAL = 2;
const DEFAULT_WEIGHTS: Record<Factor, number> = {
  commute: NEUTRAL,
  rent: NEUTRAL,
  safety: NEUTRAL,
  quiet: NEUTRAL,
  nightlife: NEUTRAL,
  student_life: NEUTRAL,
  green: NEUTRAL,
  amenities: NEUTRAL,
  home: 0,
};
const RENT_LIMITS = [400, 450, 500, 550, 600, 700];
const COMMUTE_LIMITS = [20, 30, 45, 60];

type Step = 1 | 2 | 3;

export default function MatchFlow({ universities, hubs }: { universities: University[]; hubs: Hub[] }) {
  const router = useRouter();
  const locale = useLocale();
  const d = useDict();
  const [step, setStep] = useState<Step>(1);
  const [uniSlug, setUniSlug] = useState<string | null>(null);
  const [deptId, setDeptId] = useState<string>("");
  const [weights, setWeights] = useState<Record<Factor, number>>(DEFAULT_WEIGHTS);
  const [hubSlug, setHubSlug] = useState<string | null>(null);
  const [maxRent, setMaxRent] = useState<number | null>(null);
  const [maxCommute, setMaxCommute] = useState<number | null>(null);
  const [response, setResponse] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const uni = universities.find((u) => u.slug === uniSlug) ?? null;
  const dept = uni?.departments.find((d) => d.id === deptId) ?? null;
  const campus = uni?.campuses.find((c) => c.slug === dept?.campus_slug) ?? null;
  const hub = hubs.find((h) => h.slug === hubSlug) ?? null;

  const request: MatchRequest | null = deptId
    ? {
        department_id: deptId,
        weights: { ...weights, home: hubSlug ? weights.home : 0 },
        home_hub_slug: hubSlug,
        max_rent: maxRent,
        max_commute: maxCommute,
      }
    : null;

  async function runMatch(req: MatchRequest, { translate = false } = {}) {
    setLoading(true);
    setError(null);
    if (!translate) setSaved(false);
    try {
      const res = await apiFetch<MatchResponse>(`/match?lang=${locale}`, {
        method: "POST",
        body: JSON.stringify(req),
      });
      setResponse(res);
      if (!translate) {
        setStep(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setError(d.match.errorFind);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!request) return;
    try {
      await apiFetch(`/match/save?lang=${locale}`, { method: "POST", body: JSON.stringify(request) });
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // Remember the search so it can be restored after logging in.
        try {
          sessionStorage.setItem(PENDING_KEY, JSON.stringify({ uniSlug, request }));
        } catch {}
        router.push("/login?next=/match");
      } else {
        setError(d.match.errorSave);
      }
    }
  }

  // Switching language with results on screen: fetch the same results in the new language.
  const shownLocale = useRef(locale);
  useEffect(() => {
    if (shownLocale.current === locale) return;
    shownLocale.current = locale;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetches results from the API in the new language
    if (response && request) void runMatch(request, { translate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a language change should refetch
  }, [locale]);

  // Restore a search the user started before being sent to log in.
  useEffect(() => {
    let pending: { uniSlug: string; request: MatchRequest } | null = null;
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (raw) {
        sessionStorage.removeItem(PENDING_KEY);
        pending = JSON.parse(raw);
      }
    } catch {}
    if (!pending) return;
    const { request: r } = pending;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from sessionStorage */
    setUniSlug(pending.uniSlug);
    setDeptId(r.department_id);
    setWeights({ ...DEFAULT_WEIGHTS, ...r.weights });
    setHubSlug(r.home_hub_slug);
    setMaxRent(r.max_rent);
    setMaxCommute(r.max_commute);
    /* eslint-enable react-hooks/set-state-in-effect */
    void runMatch(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <Stepper labels={d.match.steps} step={step} onStep={(s) => s < step && setStep(s)} />

      {step === 1 && (
        <section className="mt-8 space-y-6">
          <h1 className="text-2xl font-semibold sm:text-3xl">{d.match.whereTitle}</h1>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {universities.map((u) => (
              <button
                key={u.slug}
                type="button"
                onClick={() => {
                  setUniSlug(u.slug);
                  setDeptId("");
                }}
                className={`rounded-lg border p-3 text-left transition ${
                  u.slug === uniSlug
                    ? "border-brand bg-brand-light ring-2 ring-brand/30"
                    : "border-border hover:border-brand"
                }`}
              >
                <div className="font-semibold">{u.short_name}</div>
                <div className="text-xs text-muted">{u.name}</div>
              </button>
            ))}
          </div>

          {uni && (
            <label className="block space-y-2">
              <span className="font-medium">{d.match.department}</span>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">{d.match.chooseDepartment}</option>
                {uni.campuses.map((c) => (
                  <optgroup key={c.slug} label={c.name}>
                    {uni.departments
                      .filter((d) => d.campus_slug === c.slug)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {campus && <span className="block text-sm text-muted">{fmt(d.match.classesAt, { campus: campus.name })}</span>}
            </label>
          )}

          <NavButtons next={{ label: d.match.nextPriorities, disabled: !deptId, onClick: () => setStep(2) }} />
        </section>
      )}

      {step === 2 && (
        <section className="mt-8 space-y-8">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">{d.match.mattersTitle}</h1>
            <p className="mt-1 text-muted">{d.match.mattersSub}</p>
          </div>

          <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
            {FACTOR_KEYS.filter((k) => k !== "home").map((k) => (
              <Slider
                key={k}
                label={d.factors[k].label}
                hint={d.factors[k].hint}
                levels={d.match.importance}
                value={weights[k]}
                onChange={(v) => setWeights({ ...weights, [k]: v })}
              />
            ))}
          </div>

          <div className="space-y-4 rounded-lg border border-border p-4">
            <div>
              <h2 className="font-semibold">{d.match.gettingHome}</h2>
              <p className="text-sm text-muted">{d.match.gettingHomeSub}</p>
            </div>
            <select
              aria-label={d.match.howYouTravelHome}
              value={hubSlug ?? ""}
              onChange={(e) => {
                const v = e.target.value || null;
                setHubSlug(v);
                if (v && weights.home === 0) setWeights({ ...weights, home: NEUTRAL });
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">{d.match.noHomeNeeded}</option>
              {hubs.map((h) => (
                <option key={h.slug} value={h.slug}>
                  {d.hubKinds[h.kind]}: {h.name} ({h.serves})
                </option>
              ))}
            </select>
            {hub && (
              <Slider
                label={fmt(d.match.closeTo, { hub: hub.name })}
                hint={d.match.closeToHint}
                levels={d.match.importance}
                value={weights.home}
                onChange={(v) => setWeights({ ...weights, home: v })}
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <LimitSelect
              label={d.match.maxRent}
              noLimit={d.match.noLimit}
              value={maxRent}
              options={RENT_LIMITS}
              format={(v) => fmt(d.match.upToRent, { n: v })}
              onChange={setMaxRent}
            />
            <LimitSelect
              label={d.match.maxCommute}
              noLimit={d.match.noLimit}
              value={maxCommute}
              options={COMMUTE_LIMITS}
              format={(v) => fmt(d.match.upToCommute, { n: v })}
              onChange={setMaxCommute}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <NavButtons
            backLabel={d.common.back}
            back={() => setStep(1)}
            next={{
              label: loading ? d.match.finding : d.match.findAreas,
              disabled: loading || !request,
              onClick: () => request && runMatch(request),
            }}
          />
        </section>
      )}

      {step === 3 && response && (
        <Results
          d={d}
          locale={locale}
          response={response}
          campusPoint={campus}
          hub={hub}
          deptName={dept?.name ?? ""}
          uniName={uni?.short_name ?? ""}
          onAdjust={() => setStep(2)}
          onSave={save}
          saved={saved}
          error={error}
        />
      )}
    </div>
  );
}

function Stepper({ labels, step, onStep }: { labels: string[]; step: Step; onStep: (s: Step) => void }) {
  return (
    <ol className="flex gap-2 text-sm">
      {labels.map((label, i) => {
        const s = (i + 1) as Step;
        const active = s === step;
        const done = s < step;
        return (
          <li key={label} className="flex-1">
            <button
              type="button"
              onClick={() => onStep(s)}
              disabled={!done}
              className={`w-full border-t-4 pt-2 text-left ${
                active ? "border-brand font-semibold" : done ? "border-brand/50 text-muted" : "border-border text-muted"
              }`}
            >
              <span className="hidden sm:inline">{i + 1}. </span>
              {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Slider({
  label,
  hint,
  levels,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  levels: string[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{label}</span>
        <span className={`text-sm ${value >= 4 ? "font-semibold text-brand" : "text-muted"}`}>
          {levels[value]}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-brand"
      />
      <span className="text-xs text-muted">{hint}</span>
    </label>
  );
}

function LimitSelect({
  label,
  noLimit,
  value,
  options,
  format,
  onChange,
}: {
  label: string;
  noLimit: string;
  value: number | null;
  options: number[];
  format: (v: number) => string;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="font-medium">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        <option value="">{noLimit}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {format(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

function NavButtons({
  back,
  backLabel,
  next,
}: {
  back?: () => void;
  backLabel?: string;
  next: { label: string; disabled?: boolean; onClick: () => void };
}) {
  return (
    <div className="flex justify-between gap-3 pt-2">
      {back ? (
        <button type="button" onClick={back} className="rounded-lg px-4 py-2.5 font-medium text-muted hover:text-foreground">
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={next.onClick}
        disabled={next.disabled}
        className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {next.label}
      </button>
    </div>
  );
}

function Results({
  d,
  locale,
  response,
  campusPoint,
  hub,
  deptName,
  uniName,
  onAdjust,
  onSave,
  saved,
  error,
}: {
  d: Dictionary;
  locale: Locale;
  response: MatchResponse;
  campusPoint: { slug: string; name: string; lat: number; lng: number } | null;
  hub: Hub | null;
  deptName: string;
  uniName: string;
  onAdjust: () => void;
  onSave: () => void;
  saved: boolean;
  error: string | null;
}) {
  const { results } = response;
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
          <h1 className="text-2xl font-semibold sm:text-3xl">{d.match.resultsTitle}</h1>
          <p className="mt-1 text-muted">
            {fmt(d.match.resultsFor, { dept: deptName, uni: uniName, n: response.considered })}
            {response.within_limits < response.considered && fmt(d.match.withinLimits, { n: response.within_limits })}.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAdjust}
            className="rounded-lg border border-brand px-4 py-2 font-medium text-brand hover:bg-brand-light"
          >
            {d.match.adjust}
          </button>
          {results.length > 0 && (
            <button
              type="button"
              onClick={onSave}
              disabled={saved}
              className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {saved ? d.match.saved : d.match.save}
            </button>
          )}
        </div>
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
