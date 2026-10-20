"use client";

import { useId, useState } from "react";
import { useDict } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import type { Metro } from "@/types";

/** The area's metro station (or the nearest); click it to see the lines serving it. */
export function MetroCard({ metro }: { metro: Metro }) {
  const d = useDict().metro;
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section className="max-w-xl">
      <h2 className="mb-3 text-xl font-semibold">{d.heading}</h2>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        title={open ? d.toggleHide : d.toggleShow}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-left hover:bg-brand-light"
      >
        <span>
          <span className="block text-xs font-medium text-muted">
            {metro.in_area ? d.inArea : d.nearest}
          </span>
          <span className="block font-semibold">{metro.station.name}</span>
          <span className="block text-sm text-muted">
            {fmt(d.walk, { n: metro.walk_minutes, m: metro.distance_m })}
          </span>
        </span>
        <span className="flex shrink-0 gap-1" aria-hidden>
          {metro.lines.map((l) => (
            <span key={l.slug} className="h-3 w-3 rounded-full" style={{ backgroundColor: l.hex }} />
          ))}
        </span>
      </button>
      {open && (
        <ul id={panelId} aria-label={fmt(d.linesAria, { station: metro.station.name })} className="mt-2 space-y-2">
          {metro.lines.map((l) => (
            <li key={l.slug} className="flex items-center gap-3 rounded-lg border border-border px-4 py-2 text-sm">
              <span
                className="inline-flex h-7 min-w-9 items-center justify-center rounded-full px-2 text-xs font-bold text-white"
                style={{ backgroundColor: l.hex }}
              >
                {l.code}
              </span>
              <span>
                <span className="block font-medium">{l.name}</span>
                <span className="block text-muted">{fmt(d.direction, { from: l.from_station, to: l.to_station })}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
