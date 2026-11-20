"use client";
import { Suspense } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Database } from "lucide-react";
import type { HistoricalTrends, HistoryRow } from "@/lib/reports/types";
import { ReportView } from "@/components/report/report-view";
import { Section } from "@/components/report/section";
import { MetricCard } from "@/components/report/metric-card";
import { DateRangeControl, sliceRange, type RangeValue } from "@/components/report/date-range";
import { TrendChart } from "@/components/charts/trend-chart";
import { POSITION_RAMP, SERIES } from "@/components/charts/palette";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/states/states";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/tabs";
import { useSettingsSummary } from "@/components/layout/app-header";
import { useSearchState } from "@/lib/client/use-search-state";
import { fmtCompact, fmtCurrency, fmtDate, fmtNumber, pctChange } from "@/lib/utils";
import { HISTORY_SPANS, estimateHistoryCost } from "@/lib/reports/history";

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

const num = (v: number | null | undefined) => (v == null ? <span className="text-ink-3">—</span> : fmtNumber(v));

const cols: ColumnDef<HistoryRow>[] = [
  {
    accessorKey: "date", header: "Month",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-2">
        {fmtDate(row.original.date, { month: "long", year: "numeric" })}
        {row.original.missing && <Badge variant="muted">no data</Badge>}
      </span>
    ),
  },
  { accessorKey: "organicEtv", header: "Organic traffic (est.)", cell: ({ getValue }) => num(getValue<number | null>()), meta: { align: "right" } },
  { accessorKey: "organicKeywords", header: "Organic keywords", cell: ({ getValue }) => num(getValue<number | null>()), meta: { align: "right" } },
  { accessorKey: "pos1_3", header: "Top 3", cell: ({ getValue }) => num(getValue<number | null>()), meta: { align: "right" } },
  { accessorKey: "pos4_10", header: "4–10", cell: ({ getValue }) => num(getValue<number | null>()), meta: { align: "right" } },
  { accessorKey: "pos11_20", header: "11–20", cell: ({ getValue }) => num(getValue<number | null>()), meta: { align: "right" } },
  { accessorKey: "paidEtv", header: "Paid traffic (est.)", cell: ({ getValue }) => num(getValue<number | null>()), meta: { align: "right" } },
  { accessorKey: "paidKeywords", header: "Paid keywords", cell: ({ getValue }) => num(getValue<number | null>()), meta: { align: "right" } },
];

/** First and last rows in a range that actually have a value for `key` (gaps are skipped, never filled). */
function ends<T extends { date: string }>(rows: T[], key: keyof T) {
  const withData = rows.filter((r) => r[key] != null);
  return { first: withData[0], last: withData[withData.length - 1] };
}

function Inner() {
  const { get, setParams } = useSearchState();
  const span = get("span") === "5y" ? "5y" : get("span") === "2y" ? "2y" : "1y";
  const range = (get("range") as RangeValue) ?? "all";
  const { data: settings } = useSettingsSummary();
  const live = Boolean(settings?.live.enabled && settings.credentials.configured && settings.live.tools.find((t) => t.id === "historical-trends")?.listed);
  return (
    <ReportView<HistoricalTrends>
      tool="historical-trends"
      extraParams={{ span }}
      isEmpty={(d) => d.history.length === 0 && d.backlinkHistory.length === 0}
      subtitle="Monthly provider history plus snapshots stored from earlier live lookups. Missing months are shown as gaps, never interpolated."
      actions={
        <>
          <Segmented
            value={span}
            onChange={(v) => setParams({ span: v === "1y" ? null : v, range: null }, { replace: true })}
            options={(["1y", "2y", "5y"] as const).map((sp) => ({
              value: sp,
              label: (
                <span title={live ? (sp === "1y" ? "Shared with Domain Overview / Organic Research — usually free from cache" : `Organic history is billed per month: ≈ ${fmtCurrency(estimateHistoryCost(HISTORY_SPANS[sp]), 2)} unless cached`) : undefined}>
                  {sp === "1y" ? "1 year" : sp === "2y" ? "2 years" : "5 years"}
                  {live && sp !== "1y" ? ` · ≈${fmtCurrency(estimateHistoryCost(HISTORY_SPANS[sp]), 2)}` : ""}
                </span>
              ),
            }))}
          />
          <DateRangeControl value={range} onChange={(v) => setParams({ range: v }, { replace: true })} />
        </>
      }
    >
      {(d, meta) => {
        const mock = meta.source === "mock";
        const s = sliceRange(d.history, range);
        const bl = sliceRange(d.backlinkHistory, range);
        const tr = ends(s, "organicEtv");
        const kw = ends(s, "organicKeywords");
        const top = ends(s, "pos1_3");
        const rd = ends(bl, "referringDomains");
        const since = (r?: { date: string }) => (r ? `since ${fmtDate(r.date)}` : undefined);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard mock={mock} label="Organic traffic (est.)" value={fmtCompact(tr.last?.organicEtv)} delta={pctChange(tr.last?.organicEtv, tr.first?.organicEtv)} deltaLabel={since(tr.first)} />
              <MetricCard mock={mock} label="Organic keywords" value={fmtCompact(kw.last?.organicKeywords)} delta={pctChange(kw.last?.organicKeywords, kw.first?.organicKeywords)} deltaLabel={since(kw.first)} />
              <MetricCard mock={mock} label="Top 3 keywords" value={fmtCompact(top.last?.pos1_3)} delta={pctChange(top.last?.pos1_3, top.first?.pos1_3)} deltaLabel={since(top.first)} />
              <MetricCard mock={mock} label="Referring domains" value={fmtCompact(rd.last?.referringDomains)} delta={pctChange(rd.last?.referringDomains, rd.first?.referringDomains)} deltaLabel={since(rd.first)} />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Section title="Organic & paid traffic (est.)" mock={mock}>
                {s.length > 1 ? <TrendChart data={s} series={[{ key: "organicEtv", label: "Organic" }, { key: "paidEtv", label: "Paid" }]} /> : <EmptyState compact title="No organic history" />}
              </Section>
              <Section title="Ranking keywords by position" mock={mock}>
                {s.length > 1 ? (
                  <TrendChart data={s} stacked series={[
                    { key: "pos1_3", label: "Top 3", color: POSITION_RAMP[0] }, { key: "pos4_10", label: "4–10", color: POSITION_RAMP[1] },
                    { key: "pos11_20", label: "11–20", color: POSITION_RAMP[2] }, { key: "pos21_50", label: "21–50", color: POSITION_RAMP[3] }, { key: "pos51_100", label: "51–100", color: POSITION_RAMP[4] },
                  ]} />
                ) : <EmptyState compact title="No organic history" />}
              </Section>
              <Section title="Backlinks" mock={mock}>
                {bl.length > 1 ? <TrendChart data={bl} variant="line" series={[{ key: "backlinks", label: "Backlinks", color: SERIES[0] }]} /> : <EmptyState compact title="No backlink history" />}
              </Section>
              <Section title="Referring domains" mock={mock}>
                {bl.length > 1 ? <TrendChart data={bl} variant="line" series={[{ key: "referringDomains", label: "Referring domains", color: SERIES[2] }]} /> : <EmptyState compact title="No backlink history" />}
              </Section>
            </div>
            <Section flush title="Stored snapshots" info="Recorded each time a live Domain Overview runs for this domain and market — this app's own record, independent of provider history.">
              {d.snapshots.length ? (
                <DataTable
                  data={d.snapshots}
                  exportName={`${d.domain}_snapshots`}
                  columns={[
                    { accessorKey: "capturedAt", header: "Captured", cell: ({ getValue }) => new Date(getValue<string>()).toLocaleString() },
                    { accessorKey: "organicKeywords", header: "Organic keywords", cell: ({ getValue }) => num(getValue<number | null>()), meta: { align: "right" } },
                    { accessorKey: "organicEtv", header: "Organic traffic (est.)", cell: ({ getValue }) => num(getValue<number | null>()), meta: { align: "right" } },
                    { accessorKey: "referringDomains", header: "Referring domains", cell: ({ getValue }) => num(getValue<number | null>()), meta: { align: "right" } },
                  ]}
                  countLabel={(n) => `${n} snapshots`}
                />
              ) : (
                <div className="px-5 pb-5"><EmptyState compact icon={Database} title="No stored snapshots yet" description="Snapshots are recorded from real provider responses whenever Domain Overview runs live. Nothing is back-filled." /></div>
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
