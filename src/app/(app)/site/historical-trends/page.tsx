"use client";
import { Suspense } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Database } from "lucide-react";
import type { DomainHistoryPoint, HistoricalTrends } from "@/lib/reports/types";
import { ReportView } from "@/components/report/report-view";
import { Section } from "@/components/report/section";
import { MetricCard } from "@/components/report/metric-card";
import { DateRangeControl, sliceRange, type RangeValue } from "@/components/report/date-range";
import { TrendChart } from "@/components/charts/trend-chart";
import { POSITION_RAMP, SERIES } from "@/components/charts/palette";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/states/states";
import { Card } from "@/components/ui/card";
import { useSearchState } from "@/lib/client/use-search-state";
import { fmtCompact, fmtDate, fmtNumber, pctChange } from "@/lib/utils";

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

const cols: ColumnDef<DomainHistoryPoint>[] = [
  { accessorKey: "date", header: "Month", cell: ({ getValue }) => fmtDate(getValue<string>(), { month: "long", year: "numeric" }) },
  { accessorKey: "organicEtv", header: "Organic traffic (est.)", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
  { accessorKey: "organicKeywords", header: "Organic keywords", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
  { accessorKey: "pos1_3", header: "Top 3", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
  { accessorKey: "pos4_10", header: "4–10", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
  { accessorKey: "pos11_20", header: "11–20", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
  { accessorKey: "paidEtv", header: "Paid traffic (est.)", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
  { accessorKey: "paidKeywords", header: "Paid keywords", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
];

function Inner() {
  const { get, setParams } = useSearchState();
  const range = (get("range") as RangeValue) ?? "2y";
  return (
    <ReportView<HistoricalTrends>
      tool="historical-trends"
      isEmpty={(d) => d.history.length === 0}
      actions={<DateRangeControl value={range} onChange={(v) => setParams({ range: v }, { replace: true })} />}
      subtitle="Monthly provider history plus snapshots stored from earlier live lookups. Missing months are shown as gaps, never interpolated."
    >
      {(d, meta) => {
        const mock = meta.source === "mock";
        const s = sliceRange(d.history, range);
        const first = s[0];
        const last = s[s.length - 1];
        const bl = sliceRange(d.backlinkHistory, range);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard mock={mock} label="Organic traffic (est.)" value={fmtCompact(last.organicEtv)} delta={pctChange(last.organicEtv, first.organicEtv)} deltaLabel={`since ${fmtDate(first.date)}`} />
              <MetricCard mock={mock} label="Organic keywords" value={fmtCompact(last.organicKeywords)} delta={pctChange(last.organicKeywords, first.organicKeywords)} deltaLabel={`since ${fmtDate(first.date)}`} />
              <MetricCard mock={mock} label="Top 3 keywords" value={fmtCompact(last.pos1_3)} delta={pctChange(last.pos1_3, first.pos1_3)} deltaLabel={`since ${fmtDate(first.date)}`} />
              <MetricCard mock={mock} label="Referring domains" value={fmtCompact(bl[bl.length - 1]?.referringDomains)} delta={pctChange(bl[bl.length - 1]?.referringDomains, bl[0]?.referringDomains)} deltaLabel={bl[0] ? `since ${fmtDate(bl[0].date)}` : undefined} />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Section title="Organic & paid traffic (est.)" mock={mock}><TrendChart data={s} series={[{ key: "organicEtv", label: "Organic" }, { key: "paidEtv", label: "Paid" }]} /></Section>
              <Section title="Ranking keywords by position" mock={mock}>
                <TrendChart data={s} stacked series={[
                  { key: "pos1_3", label: "Top 3", color: POSITION_RAMP[0] }, { key: "pos4_10", label: "4–10", color: POSITION_RAMP[1] },
                  { key: "pos11_20", label: "11–20", color: POSITION_RAMP[2] }, { key: "pos21_50", label: "21–50", color: POSITION_RAMP[3] }, { key: "pos51_100", label: "51–100", color: POSITION_RAMP[4] },
                ]} />
              </Section>
              <Section title="Backlinks" mock={mock}><TrendChart data={bl} variant="line" series={[{ key: "backlinks", label: "Backlinks", color: SERIES[0] }]} /></Section>
              <Section title="Referring domains" mock={mock}><TrendChart data={bl} variant="line" series={[{ key: "referringDomains", label: "Referring domains", color: SERIES[2] }]} /></Section>
            </div>
            <Section title="Stored snapshots" info="Captured each time a live Domain Overview runs for this domain and market. Used to extend history beyond what the provider returns.">
              {d.snapshots.length ? (
                <ul className="divide-y divide-border text-sm">
                  {d.snapshots.map((x) => (
                    <li key={x.capturedAt} className="flex justify-between py-2"><span>{new Date(x.capturedAt).toLocaleString()}</span><span className="tabular">{fmtNumber(x.organicKeywords)} kw · {fmtNumber(x.organicEtv)} est. visits</span></li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact icon={Database} title="No stored snapshots yet" description="Snapshots are recorded from real provider responses once live mode is enabled. Nothing is back-filled." />
              )}
            </Section>
            <Card className="pt-4">
              <DataTable data={[...s].reverse()} columns={cols} exportName={`${d.domain}_monthly_history`} pageSize={12} countLabel={(n) => `${n} months`} />
            </Card>
          </div>
        );
      }}
    </ReportView>
  );
}
