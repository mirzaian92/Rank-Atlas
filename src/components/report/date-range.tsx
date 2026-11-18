"use client";
import { CalendarRange } from "lucide-react";
import { Segmented } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDate } from "@/lib/utils";

export const RANGE_OPTIONS = [
  { value: "1m", label: "1M", months: 1 },
  { value: "6m", label: "6M", months: 6 },
  { value: "1y", label: "1Y", months: 12 },
  { value: "2y", label: "2Y", months: 24 },
  { value: "all", label: "All", months: 999 },
] as const;
export type RangeValue = (typeof RANGE_OPTIONS)[number]["value"];

export function rangeMonths(v: string | undefined): number {
  return RANGE_OPTIONS.find((o) => o.value === v)?.months ?? 12;
}

/** Slice a monthly series to the selected range (keeps at least 2 points for trend lines). */
export function sliceRange<T extends { date: string }>(series: T[], range: string | undefined): T[] {
  const n = rangeMonths(range);
  return series.slice(-Math.max(2, Math.min(series.length, n + 1)));
}

export function DateRangeControl({ value, onChange }: { value: RangeValue; onChange: (v: RangeValue) => void }) {
  return (
    <div className="flex items-center gap-2">
      <CalendarRange className="size-4 text-ink-3" />
      <Segmented value={value} onChange={onChange} options={RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
    </div>
  );
}

/** Historical "as of" month picker — choose which month's snapshot to view (from available history). */
export function MonthPicker({ months, value, onChange, label = "Data for" }: { months: string[]; value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-3">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[170px] text-[13px]" aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>
          {[...months].reverse().map((m, i) => (
            <SelectItem key={m} value={m}>{i === 0 ? `${fmtDate(m)} (latest)` : fmtDate(m)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
