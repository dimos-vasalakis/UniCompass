import { fmt } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/en";
import type { RouteGuide as Route, RouteOption, RouteStep } from "@/types";

const ICON = { walk: "🚶", metro: "🚇", transit: "🚌" } as const;

function LineBadge({ code, hex }: { code: string; hex: string }) {
  return (
    <span
      className="inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded-full px-2 text-xs font-bold text-white"
      style={{ backgroundColor: hex }}
    >
      {code}
    </span>
  );
}

function Step({ d, step }: { d: Dictionary["route"]; step: RouteStep }) {
  const minutes = <span className="shrink-0 whitespace-nowrap tabular-nums text-muted">{fmt(d.rideStop, { n: step.minutes })}</span>;
  let text: string;
  let badge: React.ReactNode = <span aria-hidden>{step.kind === "transit" ? "🚌" : "🚶"}</span>;
  switch (step.kind) {
    case "walk":
      text = fmt(step.to_kind === "station" ? d.walkToStation : d.walkToCampus, {
        to: step.to ?? "",
        n: step.minutes,
        m: step.meters ?? 0,
      });
      break;
    case "ride":
      badge = <LineBadge code={step.line_code ?? ""} hex={step.line_hex ?? "#666"} />;
      text = fmt(d.ride, {
        line: step.line_code ?? "",
        name: step.line_name ?? "",
        direction: step.direction ?? "",
        from: step.from_station ?? "",
        to: step.to_station ?? "",
        stops: step.stops ?? 0,
      });
      break;
    case "transfer":
      badge = <LineBadge code={step.line_code ?? ""} hex={step.line_hex ?? "#666"} />;
      text = fmt(d.transfer, {
        station: step.station ?? "",
        from: step.from_line_code ?? "",
        line: step.line_code ?? "",
        name: step.line_name ?? "",
      });
      break;
    case "transit":
      text = fmt(d.transit, { to: step.to ?? "", n: step.minutes });
      break;
  }
  return (
    <li className="flex items-start gap-3 py-2 text-sm">
      <span className="flex h-6 w-8 shrink-0 items-center justify-center">{badge}</span>
      <span className="flex-1">{text}</span>
      {step.kind !== "walk" && step.kind !== "transit" ? minutes : null}
    </li>
  );
}

function Option({ d, option, fastest }: { d: Dictionary["route"]; option: RouteOption; fastest: boolean }) {
  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <span aria-hidden>{ICON[option.mode]}</span>
          {d.modes[option.mode]}
          {fastest && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-white">{d.fastest}</span>}
        </h3>
        <span className="whitespace-nowrap font-semibold tabular-nums">
          {option.estimated ? "~" : ""}
          {fmt(d.rideStop, { n: option.minutes })}
        </span>
      </div>
      <ol className="mt-2 divide-y divide-border">
        {option.steps.map((s, i) => (
          <Step key={i} d={d} step={s} />
        ))}
      </ol>
    </li>
  );
}

/** How a student gets from the area to a campus: on foot, by metro (with line changes) and by bus. */
export function RouteGuide({ d, areaName, route }: { d: Dictionary["route"]; areaName: string; route: Route }) {
  const hasMetro = route.options.some((o) => o.mode === "metro");
  return (
    <section>
      <h2 className="text-xl font-semibold">{fmt(d.heading, { campus: route.campus.name })}</h2>
      <p className="mb-3 text-sm text-muted">{fmt(d.from, { area: areaName })}</p>
      <ul className="grid gap-4 lg:grid-cols-2">
        {route.options.map((o, i) => (
          <Option key={o.mode} d={d} option={o} fastest={i === 0 && route.options.length > 1} />
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">
        {!hasMetro && `${d.noMetro} `}
        {d.estimate}
      </p>
    </section>
  );
}
