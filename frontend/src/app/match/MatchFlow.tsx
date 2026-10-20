"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Results } from "@/components/MatchResults";
import { Spinner } from "@/components/Spinner";
import { ApiError, apiFetch } from "@/lib/api/client";
import { FACTOR_KEYS } from "@/lib/factors";
import { useDict, useLocale } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { storePendingMatch, takePendingMatch } from "@/lib/pendingMatch";
import type { Factor, Hub, MatchRequest, MatchResponse, SavedMatch, University } from "@/types";

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
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  // One key per result set: a double-click or retry of Save stores a single row server-side.
  const saveKey = useRef<string | null>(null);

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
    if (!translate) {
      setSavedId(null);
      saveKey.current = crypto.randomUUID();
    }
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
    if (!request || saving || savedId) return;
    setSaving(true);
    setError(null);
    saveKey.current ??= crypto.randomUUID();
    try {
      const saved = await apiFetch<SavedMatch>(`/match/save?lang=${locale}`, {
        method: "POST",
        body: JSON.stringify(request),
        headers: { "Idempotency-Key": saveKey.current },
      });
      setSavedId(saved.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // Remember the search so it can be restored after logging in.
        if (uniSlug) storePendingMatch({ uniSlug, request });
        router.push("/login?next=/match");
      } else {
        setError(d.match.errorSave);
      }
    } finally {
      setSaving(false);
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

  // Restore a search started before being sent to log in, or reopened from a saved search.
  useEffect(() => {
    const pending = takePendingMatch();
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
              busy: loading,
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
          results={response.results}
          campusPoint={campus}
          hub={hub}
          title={d.match.resultsTitle}
          subtitle={
            <>
              {fmt(d.match.resultsFor, { dept: dept?.name ?? "", uni: uni?.short_name ?? "", n: response.considered })}
              {response.within_limits < response.considered && fmt(d.match.withinLimits, { n: response.within_limits })}.
            </>
          }
          actions={
            <>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-brand px-4 py-2 font-medium text-brand hover:bg-brand-light"
              >
                {d.match.adjust}
              </button>
              {response.results.length > 0 &&
                (savedId ? (
                  <Link
                    href={`/dashboard/saved/${savedId}`}
                    className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark"
                  >
                    {d.match.viewSaved}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    aria-busy={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
                  >
                    {saving && <Spinner size={16} className="text-white" decorative />}
                    {saving ? d.match.saving : d.match.save}
                  </button>
                ))}
            </>
          }
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
  next: { label: string; busy?: boolean; disabled?: boolean; onClick: () => void };
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
        aria-busy={next.busy}
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {next.busy && <Spinner size={16} className="text-white" decorative />}
        {next.label}
      </button>
    </div>
  );
}
