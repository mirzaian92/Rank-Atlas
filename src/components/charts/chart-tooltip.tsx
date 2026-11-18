"use client";
/** Shared Recharts tooltip body: date/label header + one row per series with swatch. */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }[];
  label?: string | number;
  labelFormatter?: (l: string) => string;
  valueFormatter?: (v: number, key?: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[160px] rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      {label != null && <div className="mb-1.5 font-semibold text-ink">{labelFormatter ? labelFormatter(String(label)) : label}</div>}
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="text-ink-2">{p.name}</span>
            <span className="ml-auto pl-3 font-semibold text-ink tabular">
              {typeof p.value === "number" ? (valueFormatter ? valueFormatter(p.value, String(p.dataKey)) : p.value.toLocaleString()) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartLegend({ items, onToggle, hidden }: { items: { key: string; label: string; color: string }[]; onToggle?: (key: string) => void; hidden?: Set<string> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => {
        const off = hidden?.has(i.key);
        return (
          <button
            key={i.key}
            type="button"
            onClick={() => onToggle?.(i.key)}
            className={`inline-flex items-center gap-1.5 text-xs ${off ? "text-ink-3 line-through" : "text-ink-2"} ${onToggle ? "hover:text-ink" : "cursor-default"}`}
            aria-pressed={onToggle ? !off : undefined}
          >
            <span className="h-2 w-3 rounded-sm" style={{ background: off ? "#d4d6dc" : i.color }} />
            {i.label}
          </button>
        );
      })}
    </div>
  );
}
