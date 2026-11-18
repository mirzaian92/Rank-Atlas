"use client";
import { Suspense } from "react";
import type { SerpAnalysis } from "@/lib/reports/types";
import { ReportView } from "@/components/report/report-view";
import { MetricCard } from "@/components/report/metric-card";
import { Section } from "@/components/report/section";
import { serpColumnsFor } from "@/components/report/serp-columns";
import { BarList } from "@/components/charts/bar-list";
import { DataTable } from "@/components/data/data-table";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/tabs";
import { useSearchState } from "@/lib/client/use-search-state";
import { fmtCompact } from "@/lib/utils";

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  const { get, setParams } = useSearchState();
  const device = (get("device") ?? "desktop") as "desktop" | "mobile";
  return (
    <ReportView<SerpAnalysis>
      tool="serp-analysis"
      extraParams={{ device }}
      isEmpty={(d) => d.results.length === 0}
      actions={<Segmented value={device} onChange={(v) => setParams({ device: v }, { replace: true })} options={[{ value: "desktop", label: "Desktop" }, { value: "mobile", label: "Mobile" }]} />}
    >
      {(d, meta) => {
        const mock = meta.source === "mock";
        const organic = d.results.filter((r) => r.type === "organic");
        const avgRank = organic.reduce((a, b) => a + (b.domainRank ?? 0), 0) / Math.max(1, organic.length);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard mock={mock} label="Results" value={fmtCompact(d.resultsCount)} sub="Reported by Google" />
              <MetricCard mock={mock} label="Organic results" value={organic.length} sub="On page 1" />
              <MetricCard mock={mock} label="SERP features" value={d.features.filter((f) => f.type !== "organic").length} />
              <MetricCard mock={mock} label="Avg. Domain Rank (top 10)" value={Math.round(avgRank)} info="Mean backlink authority of the ranking domains — a rough indicator of competitiveness." />
            </div>
            <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
              <Section title="Result types" mock={mock} className="h-fit">
                <BarList items={d.features.map((f) => ({ label: f.type.replace(/_/g, " "), value: f.count }))} valueFormatter={(v) => String(v)} />
                <p className="mt-4 text-xs text-ink-3">Checked {new Date(d.checkedAt).toLocaleString()} · {d.device}</p>
              </Section>
              <Card className="min-w-0 pt-4">
                <DataTable data={d.results} columns={serpColumnsFor(d.results)} searchText={(r) => `${r.title} ${r.url}`} exportName={`serp_${d.keyword}_${d.device}`} pageSize={50} countLabel={(n) => `${n} results`} />
              </Card>
            </div>
          </div>
        );
      }}
    </ReportView>
  );
}
