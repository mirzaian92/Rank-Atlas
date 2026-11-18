"use client";
import { Suspense, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { BacklinkAnalytics, BacklinkRow, ReferringDomainRow } from "@/lib/reports/types";
import { ReportView } from "@/components/report/report-view";
import { MetricCard } from "@/components/report/metric-card";
import { Section } from "@/components/report/section";
import { DateRangeControl, sliceRange, type RangeValue } from "@/components/report/date-range";
import { TrendChart } from "@/components/charts/trend-chart";
import { VBarChart } from "@/components/charts/bar-chart";
import { BarList, SegmentBar } from "@/components/charts/bar-list";
import { DonutChart } from "@/components/charts/donut-chart";
import { SERIES } from "@/components/charts/palette";
import { DataTable } from "@/components/data/data-table";
import { UrlCell } from "@/components/data/cells";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Segmented, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchState } from "@/lib/client/use-search-state";
import { fmtCompact, fmtNumber } from "@/lib/utils";

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
  { accessorKey: "sourceDomainRank", header: "Domain Rank", cell: ({ getValue }) => getValue<number | null>() ?? "—", meta: { align: "right" } },
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
  { accessorKey: "country", header: "Country", cell: ({ getValue }) => getValue<string | null>() ?? "—" },
  { accessorKey: "firstSeen", header: "First seen", cell: ({ getValue }) => d0(getValue<string | null>()), meta: { align: "right" } },
];

function Inner() {
  const { get, setParams } = useSearchState();
  const range = (get("range") as RangeValue) ?? "1y";
  const tab = get("tab") ?? "backlinks";
  const [metric, setMetric] = useState<"referringDomains" | "backlinks">("referringDomains");
  return (
    <ReportView<BacklinkAnalytics>
      tool="backlink-analytics"
      isEmpty={(d) => d.summary.backlinks === 0}
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
              <Section className="xl:col-span-2" title={metric === "backlinks" ? "Backlinks over time" : "Referring domains over time"} mock={mock} actions={<Segmented value={metric} onChange={setMetric} options={[{ value: "referringDomains", label: "Ref. domains" }, { value: "backlinks", label: "Backlinks" }]} />}>
                <TrendChart data={h} series={[{ key: metric, label: metric === "backlinks" ? "Backlinks" : "Referring domains" }]} />
              </Section>
              <Section title="Link attributes" mock={mock}>
                <SegmentBar segments={[{ label: "Follow", value: s.dofollow, color: SERIES[0] }, { label: "Nofollow", value: s.nofollow, color: "#b7d3f6" }]} />
                <div className="mt-6"><DonutChart height={150} data={d.linkTypes.map((t) => ({ name: t.type, value: t.count }))} /></div>
              </Section>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Section className="xl:col-span-2" title="New & lost referring domains" mock={mock}>
                <VBarChart data={h} xKey="date" isDate stacked={false} series={[{ key: "newReferringDomains", label: "New", color: SERIES[2] }, { key: "lostReferringDomains", label: "Lost", color: SERIES[7] }]} />
              </Section>
              <Section title="Top-level domains" mock={mock}>
                <BarList items={d.tlds.map((t) => ({ label: t.tld, value: t.referringDomains }))} />
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
                  <DataTable
                    data={d.backlinks} columns={backlinkColumns} searchText={(r) => `${r.sourceUrl} ${r.anchor ?? ""}`} searchPlaceholder="Filter by URL or anchor"
                    filters={[
                      { id: "attr", label: "Link attribute", type: "multi", accessor: (r) => (r.dofollow ? "follow" : "nofollow"), options: [{ value: "follow", label: "Follow" }, { value: "nofollow", label: "Nofollow" }] },
                      { id: "status", label: "Status", type: "multi", accessor: (r) => (r.isNew ? "new" : r.isLost ? "lost" : "live"), options: [{ value: "new", label: "New" }, { value: "lost", label: "Lost" }, { value: "live", label: "Live" }] },
                      { id: "dr", label: "Domain Rank", type: "range", accessor: (r) => r.sourceDomainRank },
                    ]}
                    exportName={`${d.target}_backlinks`} initialSort={[{ id: "sourceDomainRank", desc: true }]} countLabel={(n) => `${n.toLocaleString()} backlinks loaded`}
                  />
                </TabsContent>
                <TabsContent value="domains" className="pt-3">
                  <DataTable data={d.referringDomains} columns={refDomainColumns} searchText={(r) => r.domain} exportName={`${d.target}_referring_domains`} initialSort={[{ id: "domainRank", desc: true }]} filters={[{ id: "dr", label: "Domain Rank", type: "range", accessor: (r) => r.domainRank }, { id: "spam", label: "Spam score", type: "range", accessor: (r) => r.spamScore }]} countLabel={(n) => `${n} domains loaded`} />
                </TabsContent>
                <TabsContent value="anchors" className="pt-3">
                  <DataTable
                    data={d.anchors}
                    columns={[
                      { accessorKey: "anchor", header: "Anchor" },
                      { accessorKey: "referringDomains", header: "Domains", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
                      { accessorKey: "backlinks", header: "Backlinks", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
                      { accessorKey: "dofollowShare", header: "Follow %", cell: ({ getValue }) => `${getValue<number>()}%`, meta: { align: "right" } },
                    ]}
                    searchText={(r) => r.anchor} exportName={`${d.target}_anchors`} initialSort={[{ id: "backlinks", desc: true }]}
                  />
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        );
      }}
    </ReportView>
  );
}
