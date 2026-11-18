"use client";
import { Suspense, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { OrganicResearch } from "@/lib/reports/types";
import { ReportView } from "@/components/report/report-view";
import { MetricCard } from "@/components/report/metric-card";
import { Section } from "@/components/report/section";
import { DateRangeControl, sliceRange, type RangeValue } from "@/components/report/date-range";
import { rankedKeywordColumns, rankedKeywordFilters } from "@/components/report/columns";
import { TrendChart } from "@/components/charts/trend-chart";
import { BarList } from "@/components/charts/bar-list";
import { POSITION_RAMP } from "@/components/charts/palette";
import { DataTable } from "@/components/data/data-table";
import { ShareBar, UrlCell } from "@/components/data/cells";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchState } from "@/lib/client/use-search-state";
import { fmtCompact, fmtCurrency, fmtNumber, fmtPercent } from "@/lib/utils";

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  const { get, setParams, market } = useSearchState();
  const range = (get("range") as RangeValue) ?? "1y";
  const tab = get("tab") ?? "positions";
  const columns = useMemo(() => rankedKeywordColumns(market.id), [market.id]);
  const filters = useMemo(() => rankedKeywordFilters(), []);
  return (
    <ReportView<OrganicResearch>
      tool="organic-research"
      isEmpty={(d) => d.keywords.length === 0}
      actions={<DateRangeControl value={range} onChange={(v) => setParams({ range: v }, { replace: true })} />}
    >
      {(d, meta) => {
        const mock = meta.source === "mock";
        const series = sliceRange(d.history, range);
        const maxPage = Math.max(...d.pages.map((p) => p.etv), 1);
        const pageCols: ColumnDef<OrganicResearch["pages"][number]>[] = [
          { accessorKey: "url", header: "URL", cell: ({ getValue }) => <UrlCell url={getValue<string>()} max={60} /> },
          { accessorKey: "trafficShare", header: "Traffic %", cell: ({ row }) => <div className="flex items-center justify-end gap-2"><div className="w-20"><ShareBar value={row.original.etv} max={maxPage} /></div><span className="w-14 text-right">{fmtPercent(row.original.trafficShare, 2)}</span></div>, meta: { align: "right" } },
          { accessorKey: "etv", header: "Traffic (est.)", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
          { accessorKey: "keywords", header: "Keywords", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
        ];
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard mock={mock} label="Organic keywords" value={fmtCompact(d.summary.organicKeywords)} info="Keywords ranking in Google's top 100 in this market." />
              <MetricCard mock={mock} label="Organic traffic (est.)" value={fmtCompact(d.summary.organicEtv)} info="Estimated monthly visits from organic search (not analytics data)." />
              <MetricCard mock={mock} label="Traffic value" value={fmtCurrency(d.summary.organicTrafficCost, 0)} info="Equivalent Google Ads cost of the estimated organic traffic." />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Section className="xl:col-span-2" title="Organic traffic & keywords" mock={mock} info="Monthly history from the provider's historical rank data.">
                <div className="grid gap-6 md:grid-cols-2">
                  <TrendChart data={series} height={220} series={[{ key: "organicEtv", label: "Traffic (est.)" }]} />
                  <TrendChart data={series} height={220} variant="line" series={[{ key: "organicKeywords", label: "Keywords", color: "#1baf7a" }]} />
                </div>
              </Section>
              <Section title="Position distribution" mock={mock}>
                <BarList colors={POSITION_RAMP} items={d.positionDistribution.map((p) => ({ key: p.bucket, label: p.bucket === "1-3" ? "Top 3" : p.bucket, value: p.count }))} />
              </Section>
            </div>
            <Card>
              <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
                <TabsList className="px-5 pt-2">
                  <TabsTrigger value="positions">Positions</TabsTrigger>
                  <TabsTrigger value="pages">Pages</TabsTrigger>
                </TabsList>
                <TabsContent value="positions" className="pt-3">
                  <DataTable
                    data={d.keywords}
                    columns={columns}
                    filters={filters}
                    searchText={(r) => r.keyword + " " + r.url}
                    searchPlaceholder="Filter by keyword or URL"
                    exportName={`${d.domain}_organic_positions`}
                    exportNote={d.total > d.keywords.length ? `Loaded ${d.keywords.length} of ${d.total.toLocaleString()} keywords. Live mode will page through the API.` : undefined}
                    initialSort={[{ id: "etv", desc: true }]}
                    countLabel={(n) => `${n.toLocaleString()} of ${d.total.toLocaleString()} keywords`}
                  />
                </TabsContent>
                <TabsContent value="pages" className="pt-3">
                  <DataTable data={d.pages} columns={pageCols} searchText={(r) => r.url} searchPlaceholder="Filter by URL" exportName={`${d.domain}_organic_pages`} initialSort={[{ id: "etv", desc: true }]} countLabel={(n) => `${n} pages`} />
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        );
      }}
    </ReportView>
  );
}
