"use client";
import { Suspense, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Info } from "lucide-react";
import type { PositionTracking } from "@/lib/reports/types";
import { ReportView } from "@/components/report/report-view";
import { MetricCard } from "@/components/report/metric-card";
import { Section } from "@/components/report/section";
import { POSITION_PRESETS, VOLUME_PRESETS, keywordLink } from "@/components/report/columns";
import { TrendChart } from "@/components/charts/trend-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { DataTable } from "@/components/data/data-table";
import { PositionCell, UrlCell } from "@/components/data/cells";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/tabs";
import { useSearchState } from "@/lib/client/use-search-state";
import { fmtNumber, fmtPercent } from "@/lib/utils";
import Link from "next/link";

type Row = PositionTracking["keywords"][number];

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  const { market } = useSearchState();
  const [metric, setMetric] = useState<"visibility" | "avgPosition" | "top">("visibility");
  const cols = useMemo<ColumnDef<Row>[]>(() => [
    { accessorKey: "keyword", header: "Keyword", cell: ({ getValue }) => <Link href={keywordLink(getValue<string>(), market.id)} className="font-medium text-brand hover:underline">{getValue<string>()}</Link> },
    { accessorKey: "tags", header: "Tags", cell: ({ row }) => row.original.tags.map((t) => <span key={t} className="mr-1 rounded bg-page px-1.5 py-0.5 text-[11px] text-ink-2">{t}</span>), enableSorting: false, meta: { exportValue: (r) => r.tags.join("; ") } },
    { accessorKey: "position", header: "Position", accessorFn: (r) => r.position ?? 101, cell: ({ row }) => <PositionCell position={row.original.position} previous={row.original.previous} />, meta: { align: "right", exportValue: (r) => r.position } },
    { accessorKey: "best", header: "Best", cell: ({ getValue }) => getValue<number | null>() ?? "—", meta: { align: "right" } },
    { id: "history", header: "30 days", cell: ({ row }) => <div className="w-28"><Sparkline height={24} values={row.original.history.map((p) => (p == null ? 0 : 101 - p))} /></div>, enableSorting: false, meta: { noExport: true } },
    { accessorKey: "searchVolume", header: "Volume", cell: ({ getValue }) => fmtNumber(getValue<number | null>()), meta: { align: "right" } },
    { accessorKey: "url", header: "Ranking URL", cell: ({ getValue }) => <UrlCell url={getValue<string | null>()} max={36} /> },
  ], [market.id]);
  return (
    <ReportView<PositionTracking> tool="position-tracking" isEmpty={(d) => !d.project || d.keywords.length === 0}>
      {(d, meta) => {
        const mock = meta.source === "mock";
        const v = d.visibility;
        const last = v[v.length - 1];
        const prev = v[v.length - 2];
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-border bg-surface px-4 py-3 text-[13px] text-ink-2">
              <Info className="mt-0.5 size-4 shrink-0 text-brand" />
              <span>
                <b className="text-ink">{d.project?.name}</b> · {d.project?.keywordCount} keywords · {d.project?.device}. Rankings are collected by scheduled Google SERP checks and stored daily;
                history starts on the first check and is never back-filled.
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard mock={mock} label="Visibility" value={fmtPercent(last.visibility, 2)} delta={prev ? last.visibility - prev.visibility : null} info="CTR-weighted share of the maximum possible clicks across tracked keywords (100% = all at #1)." />
              <MetricCard mock={mock} label="Avg. position" value={last.avgPosition} sub={prev ? `${(prev.avgPosition - last.avgPosition).toFixed(1)} vs yesterday` : undefined} />
              <MetricCard mock={mock} label="Top 3" value={last.top3} sub={`of ${d.keywords.length} keywords`} />
              <MetricCard mock={mock} label="Top 10" value={last.top10} sub={`of ${d.keywords.length} keywords`} />
            </div>
            <Section
              title={metric === "visibility" ? "Visibility trend" : metric === "avgPosition" ? "Average position" : "Keywords in top 3 / top 10"}
              mock={mock}
              actions={<Segmented value={metric} onChange={setMetric} options={[{ value: "visibility", label: "Visibility" }, { value: "avgPosition", label: "Avg. position" }, { value: "top", label: "Top 3/10" }]} />}
            >
              <TrendChart
                data={v}
                variant={metric === "visibility" ? "area" : "line"}
                dateFormat={{ month: "short", day: "numeric" }}
                valueFormatter={metric === "visibility" ? (x) => `${x.toFixed(1)}%` : (x) => x.toFixed(metric === "avgPosition" ? 1 : 0)}
                series={metric === "visibility" ? [{ key: "visibility", label: "Visibility" }] : metric === "avgPosition" ? [{ key: "avgPosition", label: "Avg. position" }] : [{ key: "top3", label: "Top 3" }, { key: "top10", label: "Top 10" }]}
              />
            </Section>
            <Card className="pt-4">
              <DataTable
                data={d.keywords}
                columns={cols}
                searchText={(r) => r.keyword}
                filters={[
                  { id: "position", label: "Position", type: "range", accessor: (r) => r.position, presets: POSITION_PRESETS },
                  { id: "volume", label: "Volume", type: "range", accessor: (r) => r.searchVolume, presets: VOLUME_PRESETS },
                  { id: "tags", label: "Tags", type: "multi", accessor: (r) => r.tags, options: [...new Set(d.keywords.flatMap((k) => k.tags))].map((t) => ({ value: t, label: t })) },
                ]}
                exportName={`${d.project?.domain}_rankings`}
                initialSort={[{ id: "position", desc: false }]}
                countLabel={(n) => `${n} keywords`}
              />
            </Card>
          </div>
        );
      }}
    </ReportView>
  );
}
