import type { Point } from "@/types";

export function ProsCons({ pros, cons, limit }: { pros: Point[]; cons: Point[]; limit?: number }) {
  const p = limit ? pros.slice(0, limit) : pros;
  const c = limit ? cons.slice(0, limit) : cons;
  return (
    <div className="grid gap-3 text-sm sm:grid-cols-2">
      <ul className="space-y-1.5">
        {p.map((x) => (
          <li key={x.text} className="flex gap-2">
            <span aria-hidden className="font-bold text-brand">✓</span>
            <span>{x.text}</span>
          </li>
        ))}
      </ul>
      <ul className="space-y-1.5">
        {c.map((x) => (
          <li key={x.text} className="flex gap-2">
            <span aria-hidden className="font-bold text-accent-dark">✗</span>
            <span>{x.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
