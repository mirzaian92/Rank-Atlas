"use client";
import { Suspense, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AnchorRow, BacklinkRow, BacklinkSummary, PagedRows, ReferringDomainRow } from "@/lib/reports/types";
import type { ReportMeta } from "@/lib/reports/envelope";
import { PAGE_SIZES } from "@/lib/reports/ranked-query";
import { defaultBlSort } from "@/lib/reports/backlink-query";
import { ReportView } from "@/components/report/report-view";
import { MetricCard } from "@/components/report/metric-card";
import { Section } from "@/components/report/section";
import { SourceBadge } from "@/components/report/source-badge";
import { DateRangeControl, sliceRange, type RangeValue } from "@/components/report/date-range";
import { TrendChart } from "@/components/charts/trend-chart";
import { VBarChart } from "@/components/charts/bar-chart";
import { BarList, SegmentBar } from "@/components/charts/bar-list";
import { DonutChart } from "@/components/charts/donut-chart";
import { SERIES } from "@/components/charts/palette";
import { DataTable, type RemoteState } from "@/components/data/data-table";
import type { FilterDef } from "@/components/data/filters";
import { UrlCell } from "@/components/data/cells";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/states/states";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Segmented, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReport } from "@/lib/client/use-report";
import { useSearchState } from "@/lib/client/use-search-state";
import { blParamsFromTable, isBlSortable, type BlTableView } from "@/lib/client/ranked-table";
import { fmtCompact, fmtCurrency, fmtNumber } from "@/lib/utils";

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

const d0 = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

const backlinkColumns: ColumnDef<BacklinkRow>[] = [
  {
    accessorKey: "sourceUrl", header: "Source page title & URL",
    cell: ({ row }) => (
      <div className="min-w-[260px] max-w-[420px]">
        <div className="truncate text-ink">{row.original.sourceTitle ?? "—"}</div>
        <UrlCell url={row.original.sourceUrl} max={52} />
      </div>
    ),
  },
  { id: "domainRank", accessorKey: "sourceDomainRank", header: "Domain Rank", cell: ({ getValue }) => getValue<number | null>() ?? "—", meta: { align: "right" } },
  {
    accessorKey: "anchor", header: "Anchor & target URL",
    cell: ({ row }) => (
      <div className="min-w-[220px] max-w-[360px]">
        <div className="truncate">{row.original.anchor ?? <span className="text-ink-3">(no anchor)</span>}</div>
        <UrlCell url={row.original.targetUrl} max={44} />
      </div>
    ),
  },
  {
    accessorKey: "dofollow", header: "Attributes",
    cell: ({ row }) => (
      <span className="inline-flex gap-1">
        <Badge variant={row.original.dofollow ? "good" : "muted"}>{row.original.dofollow ? "follow" : "nofollow"}</Badge>
        {row.original.type !== "anchor" && <Badge variant="outline">{row.original.type}</Badge>}
        {row.original.isNew && <Badge>new</Badge>}
        {row.original.isLost && <Badge variant="critical">lost</Badge>}
      </span>
    ),
    meta: { exportValue: (r) => (r.dofollow ? "follow" : "nofollow") },
  },
  { accessorKey: "firstSeen", header: "First seen", cell: ({ getValue }) => d0(getValue<string | null>()), meta: { align: "right" } },
  { accessorKey: "lastSeen", header: "Last seen", cell: ({ getValue }) => d0(getValue<string | null>()), meta: { align: "right" } },
];

const refDomainColumns: ColumnDef<ReferringDomainRow>[] = [
  { accessorKey: "domain", header: "Referring domain", cell: ({ getValue }) => <span className="font-medium text-brand">{getValue<string>()}</span> },
  { accessorKey: "domainRank", header: "Domain Rank", cell: ({ getValue }) => getValue<number | null>() ?? "—", meta: { align: "right" } },
  { accessorKey: "backlinks", header: "Backlinks", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
  { accessorKey: "dofollow", header: "Follow", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
  { accessorKey: "spamScore", header: "Spam score", cell: ({ getValue }) => getValue<number | null>() ?? "—", meta: { align: "right" } },
  { accessorKey: "firstSeen", header: "First seen", cell: ({ getValue }) => d0(getValue<string | null>()), meta: { align: "right" } },
];

const anchorColumns: ColumnDef<AnchorRow>[] = [
  { accessorKey: "anchor", header: "Anchor", enableSorting: false, cell: ({ getValue }) => <span className="block max-w-[420px] truncate" title={getValue<string>()}>{getValue<string>() || <span className="text-ink-3">(empty)</span>}</span> },
  { accessorKey: "referringDomains", header: "Domains", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
  { accessorKey: "backlinks", header: "Backlinks", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
  { accessorKey: "dofollowShare", header: "Follow %", enableSorting: false, cell: ({ getValue }) => (getValue<number | null>() != null ? `${getValue<number>()}%` : "—"), meta: { align: "right" } },
];

const BACKLINK_FILTERS: FilterDef<BacklinkRow>[] = [
  { id: "status", label: "Status", type: "multi", accessor: () => null, options: [{ value: "new", label: "New" }, { value: "lost", label: "Lost" }] },
  { id: "attr", label: "Link attribute", type: "multi", accessor: () => null, options: [{ value: "follow", label: "Follow" }, { value: "nofollow", label: "Nofollow" }] },
  { id: "type", label: "Link type", type: "multi", accessor: () => null, options: [{ value: "anchor", label: "Text" }, { value: "image", label: "Image" }, { value: "redirect", label: "Redirect" }, { value: "canonical", label: "Canonical" }] },
  { id: "dr", label: "Domain Rank", type: "range", accessor: () => null, presets: [{ label: "50+", min: 50 }, { label: "30+", min: 30 }, { label: "10+", min: 10 }] },
];
const DOMAIN_FILTERS: FilterDef<ReferringDomainRow>[] = [
  { id: "dr", label: "Domain Rank", type: "range", accessor: () => null, presets: [{ label: "50+", min: 50 }, { label: "30+", min: 30 }, { label: "10+", min: 10 }] },
  { id: "spam", label: "Max spam score", type: "range", accessor: () => null, presets: [{ label: "≤ 10", max: 10 }, { label: "≤ 30", max: 30 }] },
];

function Inner() {
  const { get, setParams, q, market } = useSearchState();
  const range = (get("range") as RangeValue) ?? "1y";
  const tab = (get("tab") as BlTableView) ?? "backlinks";
  const [metric, setMetric] = useState<"referringDomains" | "backlinks">("referringDomains");
  return (
    <ReportView<BacklinkSummary>
      tool="backlink-analytics"
      extraParams={{ view: "summary" }}
      isEmpty={(d) => d.summary.backlinks === 0 && d.summary.referringDomains === 0}
      actions={<DateRangeControl value={range} onChange={(v) => setParams({ range: v }, { replace: true })} />}
    >
      {(d, meta) => {
        const mock = meta.source === "mock";
        const h = sliceRange(d.history, range);
        const s = d.summary;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <MetricCard mock={mock} label="Domain Rank" value={s.domainRank ?? "—"} info="DataForSEO backlink authority (0–100)." />
              <MetricCard mock={mock} label="Referring domains" value={fmtCompact(s.referringDomains)} />
              <MetricCard mock={mock} label="Backlinks" value={fmtCompact(s.backlinks)} />
              <MetricCard mock={mock} label="Referring IPs" value={fmtCompact(s.referringIps)} sub={`${fmtCompact(s.referringSubnets)} subnets`} />
              <MetricCard mock={mock} label="Broken backlinks" value={fmtCompact(s.brokenBacklinks)} info="Backlinks pointing to URLs on the target that return 4xx/5xx." />
              <MetricCard mock={mock} label="Spam score" value={s.spamScore ?? "—"} info="Provider estimate (0–100) of how spammy the backlink profile looks. Higher is worse." />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Section className="xl:col-span-2" title={metric === "backlinks" ? "Backlinks over time" : "Referring domains over time"} mock={mock} info="Monthly values from the provider's backlink history." actions={<Segmented value={metric} onChange={setMetric} options={[{ value: "referringDomains", label: "Ref. domains" }, { value: "backlinks", label: "Backlinks" }]} />}>
                {h.length > 1 ? <TrendChart data={h} series={[{ key: metric, label: metric === "backlinks" ? "Backlinks" : "Referring domains" }]} /> : <EmptyState compact title="No history available" />}
              </Section>
              <Section title="Link attributes" mock={mock}>
                <SegmentBar segments={[{ label: "Follow", value: s.dofollow, color: SERIES[0] }, { label: "Nofollow", value: s.nofollow, color: "#b7d3f6" }]} />
                {d.linkTypes.length > 0 && <div className="mt-6"><DonutChart height={150} data={d.linkTypes.map((t) => ({ name: t.type, value: t.count }))} /></div>}
              </Section>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Section className="xl:col-span-2" title="New & lost referring domains" mock={mock}>
                {h.length > 1 ? <VBarChart data={h} xKey="date" isDate stacked={false} series={[{ key: "newReferringDomains", label: "New", color: SERIES[2] }, { key: "lostReferringDomains", label: "Lost", color: SERIES[7] }]} /> : <EmptyState compact title="No history available" />}
              </Section>
              <Section title="Top-level domains" mock={mock}>
                {d.tlds.length ? <BarList items={d.tlds.map((t) => ({ label: t.tld, value: t.referringDomains }))} /> : <EmptyState compact title="No TLD data" />}
              </Section>
            </div>
            <Card>
              <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
                <TabsList className="px-5 pt-2">
                  <TabsTrigger value="backlinks">Backlinks</TabsTrigger>
                  <TabsTrigger value="domains">Referring domains</TabsTrigger>
                  <TabsTrigger value="anchors">Anchors</TabsTrigger>
                </TabsList>
                <TabsContent value="backlinks" className="pt-3">
                  <BlTable key={`b|${q}|${market.id}`} view="backlinks" columns={backlinkColumns} filters={BACKLINK_FILTERS} target={d.target} searchPlaceholder="URL or anchor contains…" noun="backlinks" />
                </TabsContent>
                <TabsContent value="domains" className="pt-3">
                  <BlTable key={`d|${q}|${market.id}`} view="domains" columns={refDomainColumns} filters={DOMAIN_FILTERS} target={d.target} searchPlaceholder="Domain contains…" noun="referring domains" />
                </TabsContent>
                <TabsContent value="anchors" className="pt-3">
                  <BlTable key={`a|${q}|${market.id}`} view="anchors" columns={anchorColumns} filters={[]} target={d.target} searchPlaceholder="Anchor contains…" noun="anchors" />
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        );
      }}
    </ReportView>
  );
}

function PageMeta({ meta }: { meta?: ReportMeta }) {
  if (!meta) return null;
  return (
    <span className="flex items-center gap-2 text-[11.5px] text-ink-3">
      <SourceBadge source={meta.source} />
      {meta.source !== "mock" && <span>page cost {fmtCurrency(meta.costUsd, 4)}</span>}
    </span>
  );
}

/** One server-paged Backlink Analytics table (backlinks / referring domains / anchors). */
function BlTable<T>({ view, columns, filters, target, searchPlaceholder, noun }: {
  view: BlTableView;
  columns: ColumnDef<T>[];
  filters: FilterDef<T>[];
  target: string;
  searchPlaceholder: string;
  noun: string;
}) {
  const { baseParams } = useSearchState();
  const [state, setState] = useState<RemoteState>({ pageIndex: 0, pageSize: 50, sorting: [{ id: defaultBlSort(view), desc: true }], filters: {}, search: "" });
  const params = useMemo(() => ({ ...baseParams, ...blParamsFromTable(view, state) }), [baseParams, view, state]);
  const query = useReport<PagedRows<T>>("backlink-analytics", params, true, { keepPrevious: true });
  const sortable = useMemo(() => columns.map((c) => {
    const id = c.id ?? (c as { accessorKey?: string }).accessorKey ?? "";
    return isBlSortable(view)(id) ? c : { ...c, enableSorting: false };
  }), [columns, view]);

  if (query.isPending) return <TableSkeleton rows={10} />;
  if (query.isError && !query.data) return <div className="p-4"><ErrorState code={query.error.code} message={query.error.message} onRetry={() => query.refetch()} /></div>;
  const page = query.data!.data;
  return (
    <>
      {query.isError && <p className="mx-5 mb-3 rounded-md bg-[#fbe5e5] px-3 py-2 text-[13px] text-[#a12424]" role="alert">{query.error.message}</p>}
      <DataTable
        data={page.rows}
        columns={sortable}
        filters={filters}
        searchText={() => ""}
        searchPlaceholder={searchPlaceholder}
        exportName={`${target}_${view}_p${state.pageIndex + 1}`}
        toolbar={<PageMeta meta={query.data?.meta} />}
        remote={{ total: page.total, state, onChange: setState, fetching: query.isFetching, pageSizes: PAGE_SIZES }}
        countLabel={(n) => `${n.toLocaleString()} ${noun}`}
      />
    </>
  );
}
