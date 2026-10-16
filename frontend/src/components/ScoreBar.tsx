export function ScoreBar({ label, value, max = 5 }: { label: string; value: number; max?: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-muted">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-light">
        <div className="h-full rounded-full bg-brand" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="w-8 text-right tabular-nums">
        {value}/{max}
      </span>
    </div>
  );
}
