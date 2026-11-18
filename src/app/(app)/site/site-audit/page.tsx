"use client";
import { Suspense } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, AlertTriangle, Info, Play } from "lucide-react";
import type { AuditIssue, SiteAudit } from "@/lib/reports/types";
import { ReportView } from "@/components/report/report-view";
import { MetricCard } from "@/components/report/metric-card";
import { Section } from "@/components/report/section";
import { BarList } from "@/components/charts/bar-list";
import { STATUS } from "@/components/charts/palette";
import { DataTable } from "@/components/data/data-table";
import { UrlCell } from "@/components/data/cells";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Hint } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchState } from "@/lib/client/use-search-state";
import { fmtNumber } from "@/lib/utils";

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

const SEV = {
  error: { icon: AlertCircle, color: STATUS.critical, variant: "critical" as const, label: "Error" },
  warning: { icon: AlertTriangle, color: STATUS.warning, variant: "warning" as const, label: "Warning" },
  notice: { icon: Info, color: "#2a78d6", variant: "default" as const, label: "Notice" },
};

const issueCols: ColumnDef<AuditIssue>[] = [
  {
    accessorKey: "severity", header: "Severity",
    sortingFn: (a, b) => ["error", "warning", "notice"].indexOf(a.original.severity) - ["error", "warning", "notice"].indexOf(b.original.severity),
    cell: ({ getValue }) => { const s = SEV[getValue<AuditIssue["severity"]>()]; const I = s.icon; return <Badge variant={s.variant}><I className="size-3" />{s.label}</Badge>; },
  },
  { accessorKey: "title", header: "Issue", cell: ({ row }) => <div><div className="font-medium text-ink">{row.original.title}</div><div className="text-xs text-ink-3">{row.original.description}</div></div> },
  { accessorKey: "category", header: "Category" },
  { accessorKey: "pages", header: "Pages", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
];

const pageCols: ColumnDef<SiteAudit["pages"][number]>[] = [
  { accessorKey: "url", header: "URL", cell: ({ getValue }) => <UrlCell url={getValue<string>()} max={50} /> },
  { accessorKey: "statusCode", header: "Status", cell: ({ getValue }) => { const c = getValue<number>(); return <Badge variant={c >= 400 ? "critical" : c >= 300 ? "warning" : "good"}>{c}</Badge>; } },
  { accessorKey: "onpageScore", header: "Page score", meta: { align: "right" } },
  { accessorKey: "issues", header: "Issues", meta: { align: "right" } },
  { accessorKey: "loadTimeMs", header: "Load (ms)", cell: ({ getValue }) => fmtNumber(getValue<number | null>()), meta: { align: "right" } },
  { accessorKey: "words", header: "Words", cell: ({ getValue }) => fmtNumber(getValue<number | null>()), meta: { align: "right" } },
];

function Gauge({ value }: { value: number }) {
  const r = 52, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, value));
  const color = pct >= 80 ? STATUS.good : pct >= 60 ? STATUS.warning : STATUS.critical;
  return (
    <svg viewBox="0 0 128 128" className="size-32" role="img" aria-label={`Site health ${pct}%`}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="#eceef2" strokeWidth="12" />
      <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 64 64)" />
      <text x="64" y="70" textAnchor="middle" className="fill-ink text-[26px] font-semibold">{pct}%</text>
    </svg>
  );
}

function Inner() {
  const { get, setParams } = useSearchState();
  const tab = get("tab") ?? "issues";
  return (
    <ReportView<SiteAudit>
      tool="site-audit"
      isEmpty={(d) => d.crawl.pagesCrawled === 0}
      actions={
        <Hint content="Starts a DataForSEO OnPage crawl (≈ $0.000125 per page, basic crawl). Available once Site Audit is integrated.">
          <span><Button size="sm" disabled><Play /> Re-run crawl</Button></span>
        </Hint>
      }
    >
      {(d, meta) => {
        const mock = meta.source === "mock";
        return (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-4">
              <Section title="Site health" mock={mock} info="DataForSEO OnPage score (0–100) averaged across crawled pages.">
                <div className="flex flex-col items-center"><Gauge value={d.healthScore} /></div>
              </Section>
              <div className="grid grid-cols-2 gap-3 xl:col-span-3 xl:grid-cols-4">
                <MetricCard mock={mock} label="Crawled pages" value={fmtNumber(d.crawl.pagesCrawled)} sub={`limit ${d.crawl.maxPages} · ${d.crawl.status}`} />
                <MetricCard mock={mock} label="Errors" value={fmtNumber(d.counts.errors)} accent={STATUS.critical} />
                <MetricCard mock={mock} label="Warnings" value={fmtNumber(d.counts.warnings)} accent={STATUS.warning} />
                <MetricCard mock={mock} label="Notices" value={fmtNumber(d.counts.notices)} accent="#2a78d6" />
                <Section className="col-span-2" title="Thematic scores" mock={mock}>
                  <BarList showShare={false} valueFormatter={(v) => `${v}%`} items={d.thematic.map((t) => ({ label: t.label, value: t.score }))} />
                </Section>
                <Section className="col-span-2" title="HTTP status codes" mock={mock}>
                  <BarList items={d.statusCodes.map((s) => ({ label: s.code, value: s.pages }))} colors={[STATUS.good, "#86b6ef", STATUS.serious, STATUS.critical]} valueFormatter={fmtNumber} />
                </Section>
              </div>
            </div>
            <Card>
              <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
                <TabsList className="px-5 pt-2">
                  <TabsTrigger value="issues">Issues ({d.issues.length})</TabsTrigger>
                  <TabsTrigger value="pages">Crawled pages</TabsTrigger>
                </TabsList>
                <TabsContent value="issues" className="pt-3">
                  <DataTable data={d.issues} columns={issueCols} searchText={(r) => r.title} filters={[
                    { id: "sev", label: "Severity", type: "multi", accessor: (r) => r.severity, options: [{ value: "error", label: "Errors" }, { value: "warning", label: "Warnings" }, { value: "notice", label: "Notices" }] },
                    { id: "cat", label: "Category", type: "multi", accessor: (r) => r.category, options: [...new Set(d.issues.map((i) => i.category))].map((c) => ({ value: c, label: c })) },
                  ]} exportName={`${d.target}_audit_issues`} initialSort={[{ id: "severity", desc: false }]} />
                </TabsContent>
                <TabsContent value="pages" className="pt-3">
                  <DataTable data={d.pages} columns={pageCols} searchText={(r) => r.url} filters={[
                    { id: "status", label: "Status", type: "multi", accessor: (r) => `${Math.floor(r.statusCode / 100)}xx`, options: ["2xx", "3xx", "4xx", "5xx"].map((v) => ({ value: v, label: v })) },
                    { id: "score", label: "Page score", type: "range", accessor: (r) => r.onpageScore },
                  ]} exportName={`${d.target}_crawled_pages`} initialSort={[{ id: "onpageScore", desc: false }]} />
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        );
      }}
    </ReportView>
  );
}
