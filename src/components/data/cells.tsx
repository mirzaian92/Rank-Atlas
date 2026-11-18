import { ArrowDown, ArrowUp, ExternalLink, Sparkle } from "lucide-react";
import type { SearchIntent } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/ui/tooltip";

const INTENT: Record<SearchIntent, { short: string; className: string }> = {
  informational: { short: "I", className: "bg-[#e8f1fc] text-[#1c5cab]" },
  navigational: { short: "N", className: "bg-[#efeafd] text-[#4b3bb0]" },
  commercial: { short: "C", className: "bg-[#fff1e0] text-[#9a4a00]" },
  transactional: { short: "T", className: "bg-[#e3f6ec] text-[#0d6b48]" },
};

export function IntentBadge({ intent }: { intent: SearchIntent | null }) {
  if (!intent) return <span className="text-ink-3">—</span>;
  const c = INTENT[intent];
  return (
    <Hint content={intent[0].toUpperCase() + intent.slice(1)}>
      <span className={cn("inline-grid size-5 cursor-help place-items-center rounded text-[10.5px] font-bold", c.className)} aria-label={intent}>{c.short}</span>
    </Hint>
  );
}

/** Keyword difficulty 0–100 with a labelled band (never color alone). */
export function kdBand(kd: number) {
  if (kd >= 85) return { label: "Very hard", color: "#d03b3b" };
  if (kd >= 70) return { label: "Hard", color: "#ec835a" };
  if (kd >= 50) return { label: "Difficult", color: "#fab219" };
  if (kd >= 30) return { label: "Possible", color: "#86c76b" };
  if (kd >= 15) return { label: "Easy", color: "#1baf7a" };
  return { label: "Very easy", color: "#0ca30c" };
}

export function KdCell({ kd }: { kd: number | null }) {
  if (kd == null) return <span className="text-ink-3">n/a</span>;
  const b = kdBand(kd);
  return (
    <Hint content={`${b.label} (${kd}/100)`}>
      <span className="inline-flex cursor-help items-center gap-1.5 tabular">
        {kd}
        <span className="size-2 rounded-full" style={{ background: b.color }} />
      </span>
    </Hint>
  );
}

export function PositionCell({ position, previous, isNew }: { position: number | null; previous?: number | null; isNew?: boolean }) {
  if (position == null) return <span className="text-ink-3">—</span>;
  const diff = previous != null ? previous - position : 0;
  return (
    <span className="inline-flex items-center justify-end gap-1.5 tabular">
      <span className="font-medium">{position}</span>
      {isNew ? (
        <span className="inline-flex items-center gap-0.5 rounded bg-brand-soft px-1 text-[10px] font-semibold text-brand"><Sparkle className="size-2.5" />new</span>
      ) : diff !== 0 ? (
        <span className={cn("inline-flex w-9 items-center text-[11px] font-semibold", diff > 0 ? "text-good-text" : "text-[#b42318]")}>
          {diff > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
          {Math.abs(diff)}
        </span>
      ) : (
        <span className="w-9 text-[11px] text-ink-3">=</span>
      )}
    </span>
  );
}

export function UrlCell({ url, max = 44 }: { url: string | null; max?: number }) {
  if (!url) return <span className="text-ink-3">—</span>;
  const display = url.replace(/^https?:\/\//, "");
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="group inline-flex max-w-full items-center gap-1 text-brand hover:underline" title={url}>
      <span className="truncate" style={{ maxWidth: `${max}ch` }}>{display}</span>
      <ExternalLink className="size-3 shrink-0 opacity-0 group-hover:opacity-70" />
    </a>
  );
}

export function ShareBar({ value, max = 100, color = "var(--color-series-1)" }: { value: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className="h-1.5 w-full min-w-[48px] rounded-full bg-[#eceef2]">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function SerpFeatureList({ features }: { features: string[] }) {
  if (!features.length) return <span className="text-ink-3">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {features.slice(0, 3).map((f) => (
        <span key={f} className="rounded bg-page px-1.5 py-0.5 text-[10.5px] text-ink-2">{f.replace(/_/g, " ")}</span>
      ))}
      {features.length > 3 && <span className="text-[10.5px] text-ink-3">+{features.length - 3}</span>}
    </span>
  );
}
