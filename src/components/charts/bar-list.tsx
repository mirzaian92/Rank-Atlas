"use client";
import { fmtCompact } from "@/lib/utils";
import { Hint } from "@/components/ui/tooltip";

/** Horizontal labelled bars (HTML, not SVG) — for distributions and top-N lists. */
export function BarList({ items, color = "#2a78d6", valueFormatter = fmtCompact, colors, showShare = true }: {
  items: { label: React.ReactNode; value: number; key?: string; hint?: string }[];
  color?: string;
  colors?: readonly string[];
  valueFormatter?: (v: number) => string;
  showShare?: boolean;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <ul className="space-y-2">
      {items.map((it, idx) => (
        <li key={it.key ?? idx}>
          <Hint content={it.hint ?? `${valueFormatter(it.value)} (${((it.value / total) * 100).toFixed(1)}%)`}>
            <div className="group cursor-default">
              <div className="mb-1 flex items-center justify-between gap-2 text-[12.5px]">
                <span className="truncate text-ink-2">{it.label}</span>
                <span className="shrink-0 font-semibold text-ink tabular">
                  {valueFormatter(it.value)}
                  {showShare && <span className="ml-1.5 font-normal text-ink-3">{((it.value / total) * 100).toFixed(1)}%</span>}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#eceef2]">
                <div className="h-full rounded-full transition-[filter] group-hover:brightness-110" style={{ width: `${(it.value / max) * 100}%`, background: colors?.[idx] ?? color }} />
              </div>
            </div>
          </Hint>
        </li>
      ))}
    </ul>
  );
}

/** Single segmented 100% bar with legend below — e.g. dofollow vs nofollow. */
export function SegmentBar({ segments, valueFormatter = fmtCompact }: { segments: { label: string; value: number; color: string }[]; valueFormatter?: (v: number) => string }) {
  const total = segments.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={segments.map((s) => `${s.label} ${((s.value / total) * 100).toFixed(0)}%`).join(", ")}>
        {segments.map((s) => (
          <Hint key={s.label} content={`${s.label}: ${valueFormatter(s.value)} (${((s.value / total) * 100).toFixed(1)}%)`}>
            <div style={{ width: `${(s.value / total) * 100}%`, background: s.color }} className="h-full first:rounded-l-full last:rounded-r-full" />
          </Hint>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
            <span className="h-2 w-3 rounded-sm" style={{ background: s.color }} />
            {s.label}
            <span className="font-semibold text-ink tabular">{((s.value / total) * 100).toFixed(0)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
