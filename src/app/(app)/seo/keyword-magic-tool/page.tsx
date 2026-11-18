"use client";
import { Suspense, useMemo, useState } from "react";
import type { KeywordMagic } from "@/lib/reports/types";
import { ReportView } from "@/components/report/report-view";
import { MetricCard } from "@/components/report/metric-card";
import { keywordMetricColumns, keywordMetricFilters } from "@/components/report/columns";
import { DataTable } from "@/components/data/data-table";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/tabs";
import { useSearchState } from "@/lib/client/use-search-state";
import { cn, fmtCompact, fmtNumber } from "@/lib/utils";

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

const MODES = [
  { value: "broad", label: "Broad match" }, { value: "phrase", label: "Phrase match" }, { value: "exact", label: "Exact match" },
  { value: "related", label: "Related" }, { value: "questions", label: "Questions" },
] as const;

function Inner() {
  const { get, setParams, market } = useSearchState();
  const mode = (get("mode") ?? "broad") as (typeof MODES)[number]["value"];
  const cols = useMemo(() => keywordMetricColumns(market.id), [market.id]);
  const filters = useMemo(() => keywordMetricFilters(), []);
  const [group, setGroup] = useState<string | null>(null);
  return (
    <ReportView<KeywordMagic>
      tool="keyword-magic-tool"
      extraParams={{ mode }}
      isEmpty={(d) => d.keywords.length === 0}
      actions={<Segmented value={mode} onChange={(v) => { setGroup(null); setParams({ mode: v }, { replace: true }); }} options={MODES.map((m) => ({ value: m.value, label: m.label }))} />}
    >
      {(d, meta) => {
        const mock = meta.source === "mock";
        let rows = group ? d.keywords.filter((k) => k.keyword.split(/\s+/).includes(group)) : d.keywords;
        if (mode === "questions") rows = rows.filter((k) => /^(how|what|why|when|where|can|is|which|who)\b/.test(k.keyword));
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard mock={mock} label="Keywords" value={fmtNumber(d.total)} />
              <MetricCard mock={mock} label="Total volume" value={fmtCompact(d.totalVolume)} />
              <MetricCard mock={mock} label="Avg. KD" value={`${Math.round(d.keywords.reduce((a, b) => a + (b.keywordDifficulty ?? 0), 0) / Math.max(1, d.keywords.length))}%`} />
              <MetricCard mock={mock} label="Groups" value={fmtNumber(d.groups.length)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
              <Card className="h-fit p-2">
                <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Groups</div>
                <button onClick={() => setGroup(null)} className={cn("flex w-full justify-between rounded px-2 py-1.5 text-[13px]", !group ? "bg-brand-soft font-medium text-brand" : "hover:bg-page")}>
                  All keywords <span className="tabular">{fmtNumber(d.total)}</span>
                </button>
                <div className="max-h-[560px] overflow-y-auto">
                  {d.groups.map((g) => (
                    <button key={g.term} onClick={() => setGroup(g.term)} className={cn("flex w-full justify-between rounded px-2 py-1.5 text-[13px]", group === g.term ? "bg-brand-soft font-medium text-brand" : "text-ink-2 hover:bg-page")}>
                      <span className="truncate">{g.term}</span>
                      <span className="text-ink-3 tabular">{g.count}</span>
                    </button>
                  ))}
                </div>
              </Card>
              <Card className="min-w-0 pt-4">
                <DataTable
                  data={rows}
                  columns={cols}
                  filters={filters}
                  searchText={(r) => r.keyword}
                  searchPlaceholder="Filter keywords"
                  exportName={`${d.seed}_${mode}_keywords`}
                  initialSort={[{ id: "searchVolume", desc: true }]}
                  pageSize={50}
                  countLabel={(n) => `${n.toLocaleString()} keywords`}
                />
              </Card>
            </div>
          </div>
        );
      }}
    </ReportView>
  );
}
