"use client";
import { Suspense, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { OrganicPage, OrganicResearchSummary, PagedRows, RankedKeyword } from "@/lib/reports/types";
import type { ReportMeta } from "@/lib/reports/envelope";
import { PAGE_SIZES } from "@/lib/reports/ranked-query";
import { ReportView } from "@/components/report/report-view";
import { MetricCard } from "@/components/report/metric-card";
import { Section } from "@/components/report/section";
import { SourceBadge } from "@/components/report/source-badge";
import { DateRangeControl, sliceRange, type RangeValue } from "@/components/report/date-range";
import { rankedKeywordColumns, rankedKeywordFilters } from "@/components/report/columns";
import { TrendChart } from "@/components/charts/trend-chart";
import { BarList } from "@/components/charts/bar-list";
import { POSITION_RAMP } from "@/components/charts/palette";
import { DataTable, type RemoteState } from "@/components/data/data-table";
import { ShareBar, UrlCell } from "@/components/data/cells";
import { ErrorState, TableSkeleton } from "@/components/states/states";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReport } from "@/lib/client/use-report";
import { useSearchState } from "@/lib/client/use-search-state";
import { isRemoteSortable, rankedParamsFromTable } from "@/lib/client/ranked-table";
import { fmtCompact, fmtCurrency, fmtNumber, fmtPercent, pctChange } from "@/lib/utils";

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  const { get, setParams, q, market, language } = useSearchState();
  const range = (get("range") as RangeValue) ?? "1y";
  const tab = get("tab") ?? "positions";
  return (
    <ReportView<OrganicResearchSummary>
      tool="organic-research"
      extraParams={{ view: "summary" }}
      isEmpty={(d) => d.summary.organicKeywords === 0}
      actions={<DateRangeControl value={range} onChange={(v) => setParams({ range: v }, { replace: true })} />}
    >
      {(d, meta) => {
        const mock = meta.source === "mock";
        const series = sliceRange(d.history, range);
        const prev = d.history.length >= 2 ? d.history[d.history.length - 2] : null;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard mock={mock} label="Organic keywords" value={fmtCompact(d.summary.organicKeywords)} delta={prev ? pctChange(d.summary.organicKeywords, prev.organicKeywords) : null} deltaLabel="vs previous month" info="Keywords ranking in Google's top 100 in this market." />
              <MetricCard mock={mock} label="Organic traffic (est.)" value={fmtCompact(d.summary.organicEtv)} delta={prev ? pctChange(d.summary.organicEtv, prev.organicEtv) : null} deltaLabel="vs previous month" info="Estimated monthly visits from organic search — modelled, not analytics data." />
              <MetricCard mock={mock} label="Traffic value" value={fmtCurrency(d.summary.organicTrafficCost, 0)} info="Equivalent Google Ads cost of the estimated organic traffic." />
              <MetricCard mock={mock} label="Position changes" value={<span className="text-lg">+{fmtCompact(d.movement.isUp)} / −{fmtCompact(d.movement.isDown)}</span>} sub={`${fmtCompact(d.movement.isNew)} new · ${fmtCompact(d.movement.isLost)} lost`} info="Keywords that improved / declined, appeared or dropped out since the provider's previous update." />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Section className="xl:col-span-2" title="Organic traffic & keywords" mock={mock} info="Monthly history from the provider's historical rank data.">
                {series.length > 1 ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    <TrendChart data={series} height={220} series={[{ key: "organicEtv", label: "Traffic (est.)" }]} />
                    <TrendChart data={series} height={220} variant="line" series={[{ key: "organicKeywords", label: "Keywords", color: "#1baf7a" }]} />
                  </div>
                ) : (
                  <p className="py-10 text-center text-sm text-ink-3">No monthly history available for this domain and market.</p>
                )}
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
                {/* Keyed on query + market so table state resets for a new search. */}
                <TabsContent value="positions" className="pt-3">
                  <KeywordsTable key={`${q}|${market.id}|${language.code}`} domain={d.domain} />
                </TabsContent>
                <TabsContent value="pages" className="pt-3">
                  <PagesTable key={`${q}|${market.id}|${language.code}`} domain={d.domain} />
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        );
      }}
    </ReportView>
  );
}

const DEFAULT_TABLE: RemoteState = { pageIndex: 0, pageSize: 50, sorting: [{ id: "etv", desc: true }], filters: {}, search: "" };

function PageMeta({ meta }: { meta?: ReportMeta }) {
  if (!meta) return null;
  return (
    <span className="flex items-center gap-2 text-[11.5px] text-ink-3">
      <SourceBadge source={meta.source} />
      {meta.source !== "mock" && <span>page cost {fmtCurrency(meta.costUsd, 4)}</span>}
    </span>
  );
}

function KeywordsTable({ domain }: { domain: string }) {
  const { baseParams, market } = useSearchState();
  const [state, setState] = useState<RemoteState>(DEFAULT_TABLE);
  const params = useMemo(() => ({ ...baseParams, view: "keywords", ...rankedParamsFromTable(state) }), [baseParams, state]);
  const query = useReport<PagedRows<RankedKeyword>>("organic-research", params, true, { keepPrevious: true });
  const columns = useMemo(() => rankedKeywordColumns(market.id, { isSortable: isRemoteSortable }), [market.id]);
  const filters = useMemo(() => rankedKeywordFilters(), []);

  if (query.isPending) return <TableSkeleton rows={10} />;
  if (query.isError && !query.data) return <div className="p-4"><ErrorState code={query.error.code} message={query.error.message} onRetry={() => query.refetch()} /></div>;
  const page = query.data!.data;
  return (
    <>
      {query.isError && (
        <p className="mx-5 mb-3 rounded-md bg-[#fbe5e5] px-3 py-2 text-[13px] text-[#a12424]" role="alert">{query.error.message}</p>
      )}
      <DataTable
        data={page.rows}
        columns={columns}
        filters={filters}
        searchText={(r) => r.keyword}
        searchPlaceholder="Keyword contains…"
        exportName={`${domain}_organic_positions_p${state.pageIndex + 1}`}
        toolbar={<PageMeta meta={query.data?.meta} />}
        remote={{ total: page.total, state, onChange: setState, fetching: query.isFetching, pageSizes: PAGE_SIZES }}
        countLabel={(n) => `${n.toLocaleString()} keywords`}
        emptyDescription="No keywords match these filters."
      />
    </>
  );
}

function PagesTable({ domain }: { domain: string }) {
  const { baseParams } = useSearchState();
  const [state, setState] = useState<RemoteState>({ ...DEFAULT_TABLE, sorting: [] });
  const params = useMemo(() => ({ ...baseParams, view: "pages", page: String(state.pageIndex + 1), size: String(state.pageSize) }), [baseParams, state]);
  const query = useReport<PagedRows<OrganicPage>>("organic-research", params, true, { keepPrevious: true });

  if (query.isPending) return <TableSkeleton rows={10} />;
  if (query.isError && !query.data) return <div className="p-4"><ErrorState code={query.error.code} message={query.error.message} onRetry={() => query.refetch()} /></div>;
  const page = query.data!.data;
  const max = Math.max(...page.rows.map((p) => p.etv), 1);
  const cols: ColumnDef<OrganicPage>[] = [
    { accessorKey: "url", header: "URL", enableSorting: false, cell: ({ getValue }) => <UrlCell url={getValue<string>()} max={60} /> },
    { accessorKey: "trafficShare", header: "Traffic %", enableSorting: false, cell: ({ row }) => <div className="flex items-center justify-end gap-2"><div className="w-20"><ShareBar value={row.original.etv} max={max} /></div><span className="w-14 text-right">{fmtPercent(row.original.trafficShare, 2)}</span></div>, meta: { align: "right" } },
    { accessorKey: "etv", header: "Traffic (est.) ↓", enableSorting: false, cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right", label: "Traffic (est.)" } },
    { accessorKey: "keywords", header: "Keywords", enableSorting: false, cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
  ];
  return (
    <DataTable
      data={page.rows}
      columns={cols}
      exportName={`${domain}_organic_pages_p${state.pageIndex + 1}`}
      toolbar={<PageMeta meta={query.data?.meta} />}
      remote={{ total: page.total, state, onChange: setState, fetching: query.isFetching, pageSizes: PAGE_SIZES }}
      countLabel={(n) => `${n.toLocaleString()} pages · sorted by traffic`}
    />
  );
}
