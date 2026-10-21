"use client";

import { useState } from "react";
import { useDict } from "@/lib/i18n/client";
import { areaNames, fmt, type Locale } from "@/lib/i18n/config";
import type { ListingCheckResult as Result, ListingVerdict } from "@/types";

// Theme tokens only: the dark theme is a data-theme attribute, not Tailwind's dark: variant.
const VERDICT_STYLE: Record<ListingVerdict, string> = {
  good: "bg-brand text-white",
  fair: "bg-brand-light text-brand ring-1 ring-brand/30",
  overpriced: "bg-accent text-[#1c2b22]",
  suspicious: "bg-danger text-white",
  not_a_listing: "border border-border text-muted",
};

function List({ title, items, tone }: { title: string; items: string[]; tone?: "warn" }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className={`font-semibold ${tone === "warn" ? "text-danger" : ""}`}>{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
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
      className="rounded-lg border border-border px-3 py-1 text-sm font-medium hover:border-brand hover:text-brand"
    >
      {copied ? d.copied : d.copy}
    </button>
  );
}

/** `lang` is the language the check was made in: names follow the answer's text. */
export function ListingCheckResult({ result, lang }: { result: Result; lang: Locale }) {
  const d = useDict().assistant;
  const { details, area } = result;

  const yesNo = (v: boolean | null) => (v === null ? d.unknown : v ? d.yes : d.no);
  const rows: [string, string][] = [
    [d.rent, details.rent_eur !== null ? `${details.rent_eur}€` : d.unknown],
    [d.size, details.size_m2 !== null ? `${details.size_m2} m²` : d.unknown],
    [d.floor, details.floor ?? d.unknown],
    [d.heating, details.heating ?? d.unknown],
    [d.furnished, yesNo(details.furnished)],
    [d.bills, yesNo(details.bills_included)],
    [d.deposit, details.deposit_months !== null ? fmt(d.depositMonths, { n: details.deposit_months }) : d.unknown],
  ];

  return (
    <article className="space-y-5 rounded-lg border border-border p-4 sm:p-6">
      <div className="space-y-2">
        <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${VERDICT_STYLE[result.verdict]}`}>
          {d.verdicts[result.verdict]}
        </span>
        <p>{result.summary}</p>
      </div>

      {area && (
        <section className="rounded-lg bg-brand-light p-4 text-sm">
          <h3 className="font-semibold">{fmt(d.areaTitle, { area: areaNames(lang, area)[0] })}</h3>
          <ul className="mt-1 space-y-0.5">
            <li>
              {fmt(d.typicalRent, { rent: area.typical_studio_rent })}
              {area.price_vs_area_pct !== null && (
                <span className="font-semibold">
                  {" · "}
                  {fmt(d.vsArea, { pct: (area.price_vs_area_pct > 0 ? "+" : "") + area.price_vs_area_pct })}
                </span>
              )}
            </li>
            {area.commute_minutes !== null && (
              <li>
                {fmt(d.commute, { minutes: area.commute_minutes })} {area.commute_estimated && d.estimated}
              </li>
            )}
            {area.canteen && (
              <li>
                {fmt(d.canteen, {
                  name: areaNames(lang, area.canteen)[0],
                  minutes: area.canteen.minutes,
                })}
              </li>
            )}
            {area.metro && (
              <li>{fmt(d.metro, { station: area.metro.station.name, minutes: area.metro.walk_minutes })}</li>
            )}
          </ul>
        </section>
      )}

      {result.is_listing && (
        <section>
          <h3 className="font-semibold">{d.details}</h3>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <List title={d.redFlags} items={result.red_flags} tone="warn" />
      <div className="grid gap-5 sm:grid-cols-2">
        <List title={d.pros} items={result.pros} />
        <List title={d.cons} items={result.cons} />
      </div>
      <List title={d.questions} items={result.questions_for_landlord} />

      {result.is_listing && result.landlord_message_el && (
        <section>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">{d.message}</h3>
            <CopyButton text={result.landlord_message_el} />
          </div>
          <p lang="el" className="mt-2 select-all whitespace-pre-line rounded-lg border border-border p-3 text-sm">
            {result.landlord_message_el}
          </p>
        </section>
      )}

      <p className="text-xs text-muted">{d.disclaimer}</p>
    </article>
  );
}
