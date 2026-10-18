"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AreaMap, { type MapPoint } from "@/components/Map";
import { ProsCons } from "@/components/ProsCons";
import { ApiError, apiFetch } from "@/lib/api/client";
import { canteenLabel, walkLabel } from "@/lib/dailyLife";
import { FACTOR_BY_KEY, FACTORS, HUB_KIND_LABELS } from "@/lib/factors";
import type { Factor, Hub, MatchArea, MatchRequest, MatchResponse, University } from "@/types";

const PENDING_KEY = "unicompass:pending-match";
const IMPORTANCE = ["Don't care", "A little", "Somewhat", "Important", "Very important", "Must have"];
const DEFAULT_WEIGHTS: Record<Factor, number> = {
  commute: 4,
  rent: 3,
  safety: 3,
  quiet: 2,
  nightlife: 2,
  student_life: 2,
  green: 1,
  amenities: 2,
  home: 0,
};
const RENT_LIMITS = [400, 450, 500, 550, 600, 700];
const COMMUTE_LIMITS = [20, 30, 45, 60];

type Step = 1 | 2 | 3;

export default function MatchFlow({ universities, hubs }: { universities: University[]; hubs: Hub[] }) {
  const router = useRouter();
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

  async function runMatch(req: MatchRequest) {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await apiFetch<MatchResponse>("/match", {
        method: "POST",
        body: JSON.stringify(req),
      });
      setResponse(res);
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Something went wrong while finding your areas. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!request) return;
    try {
      await apiFetch("/match/save", { method: "POST", body: JSON.stringify(request) });
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // Remember the search so it can be restored after logging in.
        try {
          sessionStorage.setItem(PENDING_KEY, JSON.stringify({ uniSlug, request }));
        } catch {}
        router.push("/login?next=/match");
      } else {
        setError("Couldn't save your results. Please try again.");
      }
    }
  }

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
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <Stepper step={step} onStep={(s) => s < step && setStep(s)} />

      {step === 1 && (
        <section className="mt-8 space-y-6">
          <h1 className="text-2xl font-semibold sm:text-3xl">Where will you study?</h1>
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
              <span className="font-medium">Department</span>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Choose your department…</option>
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
              {campus && <span className="block text-sm text-muted">Classes at: {campus.name}</span>}
            </label>
          )}

          <NavButtons next={{ label: "Next: your priorities", disabled: !deptId, onClick: () => setStep(2) }} />
        </section>
      )}

      {step === 2 && (
        <section className="mt-8 space-y-8">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">What matters to you?</h1>
            <p className="mt-1 text-muted">Every area has trade-offs. Tell us what you care about most.</p>
          </div>

          <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
            {FACTORS.filter((f) => f.key !== "home").map((f) => (
              <Slider
                key={f.key}
                label={f.label}
                hint={f.hint}
                value={weights[f.key]}
                onChange={(v) => setWeights({ ...weights, [f.key]: v })}
              />
            ))}
          </div>

          <div className="space-y-4 rounded-lg border border-border p-4">
            <div>
              <h2 className="font-semibold">Getting home</h2>
              <p className="text-sm text-muted">How do you usually travel home to your family?</p>
            </div>
            <select
              aria-label="How you travel home"
              value={hubSlug ?? ""}
              onChange={(e) => {
                const v = e.target.value || null;
                setHubSlug(v);
                if (v && weights.home === 0) setWeights({ ...weights, home: 3 });
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">I don&apos;t need this / I&apos;m from Attica</option>
              {hubs.map((h) => (
                <option key={h.slug} value={h.slug}>
                  {HUB_KIND_LABELS[h.kind]}: {h.name} ({h.serves})
                </option>
              ))}
            </select>
            {hub && (
              <Slider
                label={`Being close to ${hub.name}`}
                hint="Matters more if you go home often"
                value={weights.home}
                onChange={(v) => setWeights({ ...weights, home: v })}
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <LimitSelect
              label="Maximum rent (studio)"
              value={maxRent}
              options={RENT_LIMITS}
              format={(v) => `up to €${v}/month`}
              onChange={setMaxRent}
            />
            <LimitSelect
              label="Maximum commute"
              value={maxCommute}
              options={COMMUTE_LIMITS}
              format={(v) => `up to ${v} min`}
              onChange={setMaxCommute}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <NavButtons
            back={() => setStep(1)}
            next={{
              label: loading ? "Finding your areas…" : "Find my 3 best areas",
              disabled: loading || !request,
              onClick: () => request && runMatch(request),
            }}
          />
        </section>
      )}

      {step === 3 && response && (
        <Results
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

function Stepper({ step, onStep }: { step: Step; onStep: (s: Step) => void }) {
  const labels = ["Where you study", "Your priorities", "Your best areas"];
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
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{label}</span>
        <span className={`text-sm ${value >= 4 ? "font-semibold text-brand" : "text-muted"}`}>
          {IMPORTANCE[value]}
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
  value,
  options,
  format,
  onChange,
}: {
  label: string;
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
        <option value="">No limit</option>
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
  next,
}: {
  back?: () => void;
  next: { label: string; disabled?: boolean; onClick: () => void };
}) {
  return (
    <div className="flex justify-between gap-3 pt-2">
      {back ? (
        <button type="button" onClick={back} className="rounded-lg px-4 py-2.5 font-medium text-muted hover:text-foreground">
          ← Back
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
  response: MatchResponse;
  campusPoint: { name: string; lat: number; lng: number } | null;
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
      label: `${i + 1}. ${r.name}`,
      lat: r.lat,
      lng: r.lng,
      kind: "area",
      badge: String(i + 1),
    }));
    if (campusPoint) {
      p.push({ key: "campus", label: `Your campus: ${campusPoint.name}`, ...campusPoint, kind: "campus", badge: "🎓" });
    }
    if (hub) p.push({ key: "hub", label: hub.name, lat: hub.lat, lng: hub.lng, kind: "hub", badge: "⌂" });
    return p;
  }, [results, campusPoint, hub]);

  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Your best areas</h1>
          <p className="mt-1 text-muted">
            For {deptName} ({uniName}), out of {response.considered} areas in Athens
            {response.within_limits < response.considered && `, ${response.within_limits} within your limits`}.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAdjust}
            className="rounded-lg border border-brand px-4 py-2 font-medium text-brand hover:bg-brand-light"
          >
            Adjust priorities
          </button>
          {results.length > 0 && (
            <button
              type="button"
              onClick={onSave}
              disabled={saved}
              className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}

      {results.length === 0 ? (
        <div className="rounded-lg border border-border bg-brand-light p-6">
          <p className="font-medium">No area fits all your limits.</p>
          <p className="mt-1 text-muted">Try raising your maximum rent or commute.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <ol className="space-y-4">
            {results.map((r, i) => (
              <ResultCard key={r.slug} area={r} rank={i + 1} hub={hub} />
            ))}
          </ol>
          <div className="lg:sticky lg:top-6">
            <div className="h-80 lg:h-[520px]">
              <AreaMap points={points} />
            </div>
            <p className="mt-2 text-xs text-muted">
              1–3: your areas · 🎓 your campus{hub ? ` · ⌂ ${hub.name}` : ""}. Tap a pin for its name.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function ResultCard({ area, rank, hub }: { area: MatchArea; rank: number; hub: Hub | null }) {
  return (
    <li className="rounded-xl border border-border p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-muted">#{rank}</div>
          <h2 className="text-xl font-semibold">
            {area.name} <span className="font-normal text-muted">· {area.name_el}</span>
          </h2>
        </div>
        <div className="shrink-0 whitespace-nowrap rounded-full bg-brand px-3 py-1 text-sm font-semibold text-white">
          {area.match}% match
        </div>
      </div>

      {area.drivers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {area.drivers.map((d) => (
            <span key={d} className="rounded-full bg-accent/25 px-2.5 py-0.5 text-sm font-medium">
              {FACTOR_BY_KEY[d].driver}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 text-sm text-muted">{area.description}</p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Stat label="Studio rent" value={`~€${area.typical_studio_rent}/mo`} />
        <Stat label="To campus" value={`${area.commute_estimated ? "~" : ""}${area.commute_minutes} min`} />
        {hub && area.home_minutes != null && (
          <Stat label={`To ${hub.name}`} value={`${area.home_estimated ? "~" : ""}${area.home_minutes} min`} />
        )}
      </dl>

      {area.daily_life && (
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          {area.daily_life.nearby_loaded && (
            <>
              <Stat
                label="Nearest supermarket"
                value={area.daily_life.supermarket ? walkLabel(area.daily_life.supermarket) : "None close by"}
              />
              <Stat
                label="Nearest gym"
                value={area.daily_life.gym ? walkLabel(area.daily_life.gym) : "None close by"}
              />
            </>
          )}
          <Stat
            label="Student restaurant (λέσχη)"
            value={area.daily_life.canteen ? canteenLabel(area.daily_life.canteen) : "—"}
          />
        </dl>
      )}

      <div className="mt-4">
        <ProsCons pros={area.pros} cons={area.cons} limit={3} />
      </div>

      <Link href={`/neighborhoods/${area.slug}`} className="mt-4 inline-block font-medium text-brand hover:underline">
        Full guide to {area.name} →
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
