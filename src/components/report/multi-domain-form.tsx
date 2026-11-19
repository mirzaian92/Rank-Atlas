"use client";
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { looksLikeDomain, normalizeDomain } from "@/lib/utils";
import { SERIES } from "@/components/charts/palette";

/** "You vs competitors" input used by Keyword Gap and Backlink Gap. Writes ?q=a.com,b.com */
export function MultiDomainForm({ value, onSubmit, max = 5, labels = ["You"], extra }: {
  value: string;
  onSubmit: (q: string) => void;
  max?: number;
  labels?: string[];
  /** Extra controls / info rendered before the submit button; receives the number of filled domains. */
  extra?: (filledCount: number) => React.ReactNode;
}) {
  const initial = value ? value.split(",").map((s) => s.trim()) : ["", ""];
  const [domains, setDomains] = useState<string[]>(initial.length >= 2 ? initial : [...initial, ""]);
  useEffect(() => {
    if (value) setDomains(value.split(",").map((s) => s.trim()));
  }, [value]);
  const filled = domains.map(normalizeDomain).filter(Boolean);
  const invalid = filled.filter((d) => !looksLikeDomain(d));
  return (
    <Card className="p-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (filled.length >= 2 && !invalid.length) onSubmit(filled.join(","));
        }}
      >
        {domains.map((d, i) => (
          <div key={i} className="w-full sm:w-[210px]">
            <label className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium text-ink-2">
              <span className="size-2 rounded-full" style={{ background: SERIES[i] }} />
              {labels[i] ?? `Competitor ${i}`}
            </label>
            <div className="relative">
              <Input value={d} onChange={(e) => setDomains(domains.map((x, j) => (j === i ? e.target.value : x)))} placeholder="domain.com" className="h-9 pr-8" aria-label={labels[i] ?? `Competitor ${i}`} />
              {i >= 2 && (
                <button type="button" onClick={() => setDomains(domains.filter((_, j) => j !== i))} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink" aria-label="Remove domain">
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {domains.length < max && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setDomains([...domains, ""])}><Plus /> Add competitor</Button>
        )}
        <div className="ml-auto flex flex-wrap items-end gap-3">
          {extra?.(filled.length)}
          <Button type="submit" disabled={filled.length < 2 || invalid.length > 0}>Compare</Button>
        </div>
      </form>
      {invalid.length > 0 && <p className="mt-2 text-xs text-critical">Invalid domain: {invalid.join(", ")}</p>}
    </Card>
  );
}
