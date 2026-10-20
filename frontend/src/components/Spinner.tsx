"use client";

import { useDict } from "@/lib/i18n/client";

const SPOKES = 12;

/**
 * iOS-style activity indicator: twelve spokes fading in turn. Takes the current text
 * colour (brand green by default), so inside a filled button pass `className="text-white"`.
 * `decorative` hides it from screen readers, for buttons whose own text already says what's happening.
 */
export function Spinner({
  size = 32,
  className = "text-brand",
  label,
  decorative = false,
}: {
  size?: number;
  className?: string;
  label?: string;
  decorative?: boolean;
}) {
  const d = useDict();
  const a11y = decorative ? { "aria-hidden": true } : { role: "status", "aria-label": label ?? d.common.loading };
  return (
    <span {...a11y} className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      {Array.from({ length: SPOKES }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="spinner-spoke absolute left-[calc(50%-4.5%)] top-0 h-[28%] w-[9%] rounded-full bg-current"
          style={{
            transform: `rotate(${i * (360 / SPOKES)}deg)`,
            // Negative delays start every spoke mid-cycle, so the trail shows from the first frame.
            animationDelay: `${(i - SPOKES) / SPOKES}s`,
          }}
        />
      ))}
    </span>
  );
}

/** Centred spinner for a section or page that is still loading. */
export function LoadingBlock({ className = "min-h-64" }: { className?: string }) {
  return (
    <div className={`flex w-full items-center justify-center ${className}`}>
      <Spinner size={40} />
    </div>
  );
}
