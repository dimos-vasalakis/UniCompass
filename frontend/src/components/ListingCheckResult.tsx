"use client";

import { useState, type ReactNode } from "react";
import { useDict, useLocale } from "@/lib/i18n/client";
import { areaNames, fmt } from "@/lib/i18n/config";
import type { ListingCheckResult as Result, ListingVerdict } from "@/types";

// Theme tokens only: the dark theme is a data-theme attribute, not Tailwind's dark: variant.
const VERDICT_STYLE: Record<ListingVerdict, { badge: string; edge: string; icon: string }> = {
  good: { badge: "bg-brand text-white", edge: "border-l-brand", icon: "✓" },
  fair: { badge: "bg-brand-light text-brand ring-1 ring-brand/30", edge: "border-l-brand", icon: "≈" },
  overpriced: { badge: "bg-accent text-[#1c2b22]", edge: "border-l-accent", icon: "↑" },
  suspicious: { badge: "bg-danger text-white", edge: "border-l-danger", icon: "!" },
  not_a_listing: { badge: "border border-border text-muted", edge: "border-l-border", icon: "?" },
};

function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg bg-background p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold leading-tight ${tone ?? ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Points({ title, items, mark, markClass }: { title: string; items: string[]; mark: string; markClass: string }) {
  if (!items.length) return null;
  return (
    <section className="rounded-lg border border-border p-4">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 space-y-2 text-sm">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${markClass}`}>
              {mark}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CopyButton({ text }: { text: string }) {
  const d = useDict().assistant;
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          return; // clipboard blocked (permissions, insecure context): the text stays selectable
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
    >
      {copied ? `✓ ${d.copied}` : d.copy}
    </button>
  );
}

/** Follows the current UI language: the answer is stored in both. */
export function ListingCheckResult({ result }: { result: Result }) {
  const d = useDict().assistant;
  const lang = useLocale();
  const { details, area } = result;
  const texts = result[lang];
  const verdict = VERDICT_STYLE[result.verdict];
  const euros = (n: number) => `${n.toLocaleString(lang === "el" ? "el-GR" : "en-GB")}€`;

  const yesNo = (v: boolean | null) => (v === null ? null : v ? d.yes : d.no);
  const rows: [string, string | null][] = [
    [d.size, details.size_m2 !== null ? `${details.size_m2} m²` : null],
    [d.floor, details.floor],
    [d.heating, details.heating],
    [d.furnished, yesNo(details.furnished)],
    [d.bills, yesNo(details.bills_included)],
    [d.deposit, details.deposit_months !== null ? fmt(d.depositMonths, { n: details.deposit_months }) : null],
  ];

  const pct = area?.price_vs_area_pct ?? null;
  // Over +15%: worth a second look; under −5%: cheaper than usual.
  const pctTone = pct === null ? "" : pct > 15 ? "text-danger" : pct < -5 ? "text-brand" : "";

  return (
    <article className="space-y-4">
      {/* Verdict */}
      <header className={`rounded-lg border border-l-4 border-border p-4 sm:p-5 ${verdict.edge}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold ${verdict.badge}`}>
            <span aria-hidden>{verdict.icon}</span>
            {d.verdicts[result.verdict]}
          </span>
          {result.is_listing && details.rent_eur !== null && (
            <div className="text-right">
              <span className="text-2xl font-bold">{euros(details.rent_eur)}</span>
              <span className="text-sm text-muted">{d.perMonth}</span>
            </div>
          )}
        </div>
        <p className="mt-3 leading-relaxed">{texts.summary}</p>
      </header>

      {/* Our numbers */}
      {area && (
        <section className="rounded-lg bg-brand-light p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="font-semibold">{fmt(d.areaTitle, { area: areaNames(lang, area)[0] })}</h3>
            <span className="text-xs text-muted">{d.areaSource}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={d.typicalRent} value={euros(area.typical_studio_rent)} />
            {pct !== null && <Stat label={d.vsArea} value={`${pct > 0 ? "+" : ""}${pct}%`} tone={pctTone} />}
            {area.commute_minutes !== null && (
              <Stat
                label={d.commute}
                value={fmt(d.minutes, { minutes: area.commute_minutes })}
                sub={area.commute_estimated ? d.estimated : undefined}
              />
            )}
            {area.metro && (
              <Stat
                label={d.metro}
                value={area.metro.station.name}
                sub={fmt(d.walkMinutes, { minutes: area.metro.walk_minutes })}
              />
            )}
            {area.canteen && (
              <Stat
                label={d.canteen}
                value={areaNames(lang, area.canteen)[0]}
                sub={fmt(d.minutes, { minutes: area.canteen.minutes })}
              />
            )}
          </div>
        </section>
      )}

      {/* What the listing says */}
      {result.is_listing && (
        <section className="rounded-lg border border-border p-4">
          <h3 className="font-semibold">{d.details}</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className={value === null ? "italic text-muted" : "font-medium"}>{value ?? d.unknown}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {texts.red_flags.length > 0 && (
        <section className="rounded-lg border border-danger/40 bg-danger/10 p-4">
          <h3 className="font-semibold text-danger">⚠ {d.redFlags}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {texts.red_flags.map((flag, i) => (
              <li key={i}>{flag}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Points title={d.pros} items={texts.pros} mark="✓" markClass="bg-brand-light text-brand" />
        <Points title={d.cons} items={texts.cons} mark="✕" markClass="bg-danger/10 text-danger" />
      </div>

      {texts.questions_for_landlord.length > 0 && (
        <section className="rounded-lg border border-border p-4">
          <h3 className="font-semibold">{d.questions}</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm marker:font-semibold marker:text-brand">
            {texts.questions_for_landlord.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </section>
      )}

      {result.is_listing && result.landlord_message_el && (
        <section className="overflow-hidden rounded-lg border border-brand/40">
          <div className="flex items-center justify-between gap-3 bg-brand-light px-4 py-2.5">
            <h3 className="font-semibold">{d.message}</h3>
            <CopyButton text={result.landlord_message_el} />
          </div>
          <p lang="el" className="select-all whitespace-pre-line p-4 text-sm leading-relaxed">
            {result.landlord_message_el}
          </p>
        </section>
      )}

      <p className="text-xs text-muted">{d.disclaimer}</p>
    </article>
  );
}
