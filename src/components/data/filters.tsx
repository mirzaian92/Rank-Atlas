"use client";
import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type RangeValue = { min?: number; max?: number };
export type FilterDef<T> =
  | { id: string; label: string; type: "range"; accessor: (r: T) => number | null; presets?: { label: string; min?: number; max?: number }[]; step?: number }
  | { id: string; label: string; type: "multi"; accessor: (r: T) => string | string[] | null; options: { value: string; label: string }[] }
  | { id: string; label: string; type: "include"; accessor: (r: T) => string };
export type FilterState = Record<string, RangeValue | string[] | { include?: string; exclude?: string } | undefined>;

export function applyFilters<T>(rows: T[], defs: FilterDef<T>[], state: FilterState): T[] {
  const active = defs.filter((d) => isActive(state[d.id]));
  if (!active.length) return rows;
  return rows.filter((r) =>
    active.every((d) => {
      const v = state[d.id];
      if (d.type === "range") {
        const { min, max } = v as RangeValue;
        const x = d.accessor(r);
        if (x == null) return false;
        return (min == null || x >= min) && (max == null || x <= max);
      }
      if (d.type === "multi") {
        const sel = v as string[];
        const x = d.accessor(r);
        if (x == null) return false;
        return Array.isArray(x) ? x.some((y) => sel.includes(y)) : sel.includes(x);
      }
      const { include, exclude } = v as { include?: string; exclude?: string };
      const text = d.accessor(r).toLowerCase();
      const inc = include?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) ?? [];
      const exc = exclude?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) ?? [];
      return inc.every((w) => text.includes(w)) && !exc.some((w) => text.includes(w));
    }),
  );
}

export function isActive(v: FilterState[string]): boolean {
  if (!v) return false;
  if (Array.isArray(v)) return v.length > 0;
  if ("min" in v || "max" in v) return (v as RangeValue).min != null || (v as RangeValue).max != null;
  const t = v as { include?: string; exclude?: string };
  return Boolean(t.include?.trim() || t.exclude?.trim());
}

function summary<T>(d: FilterDef<T>, v: FilterState[string]): string | null {
  if (!isActive(v)) return null;
  if (d.type === "range") {
    const { min, max } = v as RangeValue;
    if (min != null && max != null) return `${min}–${max}`;
    return min != null ? `≥ ${min}` : `≤ ${max}`;
  }
  if (d.type === "multi") {
    const sel = v as string[];
    return sel.length === 1 ? d.options.find((o) => o.value === sel[0])?.label ?? sel[0] : `${sel.length} selected`;
  }
  const t = v as { include?: string; exclude?: string };
  return [t.include && `+${t.include}`, t.exclude && `−${t.exclude}`].filter(Boolean).join(" ");
}

export function FilterButton<T>({ def, value, onChange }: { def: FilterDef<T>; value: FilterState[string]; onChange: (v: FilterState[string]) => void }) {
  const [open, setOpen] = useState(false);
  const s = summary(def, value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("inline-flex items-center rounded-md border text-[13px]", s ? "border-brand bg-brand-soft text-brand" : "border-border-strong bg-surface text-ink")}>
        <PopoverTrigger asChild>
          <button className="inline-flex h-8 items-center gap-1 pl-3 pr-2 font-medium">
            {def.label}
            {s && <span className="max-w-[140px] truncate font-normal">: {s}</span>}
            {!s && <ChevronDown className="size-3.5 text-ink-3" />}
          </button>
        </PopoverTrigger>
        {s && (
          <button className="mr-1 rounded p-0.5 hover:bg-brand/10" onClick={() => onChange(undefined)} aria-label={`Clear ${def.label} filter`}>
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-64 p-3">
        {def.type === "range" && <RangeEditor def={def} value={value as RangeValue | undefined} onApply={(v) => { onChange(v); setOpen(false); }} />}
        {def.type === "multi" && <MultiEditor def={def} value={(value as string[]) ?? []} onChange={onChange} />}
        {def.type === "include" && <IncludeEditor value={value as { include?: string; exclude?: string } | undefined} onApply={(v) => { onChange(v); setOpen(false); }} />}
      </PopoverContent>
    </Popover>
  );
}

function RangeEditor<T>({ def, value, onApply }: { def: Extract<FilterDef<T>, { type: "range" }>; value?: RangeValue; onApply: (v: RangeValue | undefined) => void }) {
  const [min, setMin] = useState(value?.min?.toString() ?? "");
  const [max, setMax] = useState(value?.max?.toString() ?? "");
  const parse = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? undefined : Number(s));
  return (
    <div className="space-y-3">
      {def.presets && (
        <div className="grid grid-cols-2 gap-1">
          {def.presets.map((p) => (
            <button key={p.label} onClick={() => onApply({ min: p.min, max: p.max })} className="rounded px-2 py-1 text-left text-[13px] hover:bg-page">
              {p.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input aria-label="From" placeholder="From" value={min} onChange={(e) => setMin(e.target.value)} className="h-8" inputMode="decimal" />
        <span className="text-ink-3">–</span>
        <Input aria-label="To" placeholder="To" value={max} onChange={(e) => setMax(e.target.value)} className="h-8" inputMode="decimal" />
      </div>
      <Button size="sm" className="w-full" onClick={() => onApply(parse(min) == null && parse(max) == null ? undefined : { min: parse(min), max: parse(max) })}>Apply</Button>
    </div>
  );
}

function MultiEditor<T>({ def, value, onChange }: { def: Extract<FilterDef<T>, { type: "multi" }>; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1">
      {def.options.map((o) => (
        <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-page">
          <Checkbox checked={value.includes(o.value)} onCheckedChange={(c) => onChange(c ? [...value, o.value] : value.filter((x) => x !== o.value))} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function IncludeEditor({ value, onApply }: { value?: { include?: string; exclude?: string }; onApply: (v: { include?: string; exclude?: string } | undefined) => void }) {
  const [inc, setInc] = useState(value?.include ?? "");
  const [exc, setExc] = useState(value?.exclude ?? "");
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-ink-2">Include all of (comma separated)</label>
      <Input value={inc} onChange={(e) => setInc(e.target.value)} className="h-8" placeholder="e.g. best, free" />
      <label className="block text-xs font-medium text-ink-2">Exclude any of</label>
      <Input value={exc} onChange={(e) => setExc(e.target.value)} className="h-8" placeholder="e.g. login" />
      <Button size="sm" className="w-full" onClick={() => onApply(inc.trim() || exc.trim() ? { include: inc, exclude: exc } : undefined)}>Apply</Button>
    </div>
  );
}
