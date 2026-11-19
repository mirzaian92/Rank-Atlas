"use client";
import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, Bug, Info, Loader2, Play } from "lucide-react";
import type { AuditIssue, SiteAudit } from "@/lib/reports/types";
import type { ReportErrorCode } from "@/lib/reports/envelope";
import { AUDIT_PAGE_LIMITS, estimateCrawlCost } from "@/lib/reports/site-audit";
import { getTool } from "@/lib/config/tools";
import { PageHeader } from "@/components/report/report-view";
import { ToolLanding } from "@/components/report/tool-landing";
import { MetricCard } from "@/components/report/metric-card";
import { Section } from "@/components/report/section";
import { SourceBadge } from "@/components/report/source-badge";
import { BarList } from "@/components/charts/bar-list";
import { STATUS } from "@/components/charts/palette";
import { DataTable } from "@/components/data/data-table";
import { UrlCell } from "@/components/data/cells";
import { DashboardSkeleton, EmptyState, ErrorState } from "@/components/states/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchState } from "@/lib/client/use-search-state";
import { fmtCurrency, fmtNumber } from "@/lib/utils";

type Crawl = { id: string; target: string; source: string; status: "queued" | "crawling" | "finished" | "failed"; maxPages: number; createdAt: string; finishedAt: string | null; pagesCrawled: number; pagesInQueue: number; costUsd: number; error: string | null };
type ApiError = Error & { code?: ReportErrorCode };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = new Error(body?.error?.message ?? `Request failed (${res.status})`) as ApiError;
    e.code = body?.error?.code;
    throw e;
  }
  return body as T;
}

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
  const tool = getTool("site-audit");
  const { q, get, setParams } = useSearchState();
  const qc = useQueryClient();
  const [limit, setLimit] = useState<number>(100);
  const list = useQuery<{ crawls: Crawl[]; mode: "live" | "mock" }, ApiError>({
    queryKey: ["crawls", q],
    queryFn: () => api(`/api/site-audit/crawls?target=${encodeURIComponent(q)}`),
    enabled: Boolean(q),
  });
  const crawls = list.data?.crawls ?? [];
  const selectedId = get("crawl") && crawls.some((c) => c.id === get("crawl")) ? get("crawl")! : crawls.find((c) => c.status === "finished")?.id ?? crawls[0]?.id;
  const running = crawls.find((c) => c.status === "queued" || c.status === "crawling");
  const start = useMutation<{ crawl: Crawl }, ApiError>({
    mutationFn: () => api("/api/site-audit/crawls", { method: "POST", body: JSON.stringify({ target: q, maxPages: limit }) }),
    onSuccess: (r) => {
      toast.success(r.crawl.source === "mock" ? "Mock crawl created" : "Crawl started", { description: r.crawl.source === "mock" ? undefined : `Cost ${fmtCurrency(r.crawl.costUsd, 4)} · usually a few minutes` });
      qc.invalidateQueries({ queryKey: ["crawls", q] });
      qc.invalidateQueries({ queryKey: ["usage-meter"] });
      setParams({ crawl: r.crawl.id }, { replace: true });
    },
    onError: (e) => toast.error(e.message),
  });
  const live = list.data?.mode === "live";

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <PageHeader
        title={tool.label}
        subject={q || undefined}
        description={!q ? tool.description : undefined}
        actions={q ? (
          <div className="flex flex-wrap items-center gap-2">
            {crawls.length > 1 && (
              <Select value={selectedId} onValueChange={(v) => setParams({ crawl: v }, { replace: true })}>
                <SelectTrigger className="h-8 w-[230px] text-[13px]" aria-label="Crawl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {crawls.map((c) => <SelectItem key={c.id} value={c.id}>{new Date(c.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · {c.status}{c.source === "mock" ? " · mock" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="h-8 w-[130px] text-[13px]" aria-label="Page limit"><SelectValue /></SelectTrigger>
              <SelectContent>{AUDIT_PAGE_LIMITS.map((n) => <SelectItem key={n} value={String(n)}>{n.toLocaleString()} pages</SelectItem>)}</SelectContent>
            </Select>
            {list.data && <span className="text-[12px] text-ink-3">{live ? `≈ ${fmtCurrency(estimateCrawlCost(limit), 3)}` : "Mock · $0"}</span>}
            <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending || Boolean(running) || !list.data} title={running ? "A crawl is already running" : undefined}>
              {start.isPending ? <Loader2 className="animate-spin" /> : <Play />} {crawls.length ? "New crawl" : "Start crawl"}
            </Button>
          </div>
        ) : null}
      />
      {!q ? (
        <ToolLanding tool={tool} />
      ) : list.isPending ? (
        <DashboardSkeleton />
      ) : list.isError ? (
        <ErrorState code={list.error.code ?? "INTERNAL"} message={list.error.message} onRetry={() => list.refetch()} />
      ) : !selectedId ? (
        <Card>
          <EmptyState icon={Bug} title={`No crawls yet for ${q}`} description={live ? `Pick a page limit and start a crawl (≈ ${fmtCurrency(estimateCrawlCost(limit), 3)}). Results are stored here, so past audits stay available.` : "Mock mode: starting a crawl creates a labelled mock audit at no cost."} action={<Button onClick={() => start.mutate()} disabled={start.isPending}><Play /> Start crawl</Button>} />
        </Card>
      ) : (
        <CrawlView key={selectedId} id={selectedId} />
      )}
    </div>
  );
}

function CrawlView({ id }: { id: string }) {
  const qc = useQueryClient();
  const { get, setParams, q } = useSearchState();
  const tab = get("tab") ?? "issues";
  const c = useQuery<{ crawl: Crawl; report: SiteAudit | null }, ApiError>({
    queryKey: ["crawl", id],
    queryFn: async () => {
      const r = await api<{ crawl: Crawl; report: SiteAudit | null }>(`/api/site-audit/crawls/${id}`);
      if (r.crawl.status === "finished" || r.crawl.status === "failed") qc.invalidateQueries({ queryKey: ["crawls", q] });
      return r;
    },
    // Poll while the crawl runs (status checks are free).
    refetchInterval: (query) => (["queued", "crawling"].includes(query.state.data?.crawl.status ?? "") ? 8_000 : false),
  });
  if (c.isPending) return <DashboardSkeleton />;
  if (c.isError) return <ErrorState code={c.error.code ?? "INTERNAL"} message={c.error.message} onRetry={() => c.refetch()} />;
  const { crawl, report: d } = c.data;

  if (crawl.status === "failed") {
    return <ErrorState code="PROVIDER_ERROR" message={crawl.error ?? "The crawl failed."} />;
  }
  if (!d || crawl.status !== "finished") {
    const pct = crawl.maxPages ? Math.min(100, (crawl.pagesCrawled / crawl.maxPages) * 100) : 0;
    return (
      <Card className="p-8">
        <div className="mx-auto max-w-lg text-center">
          <Loader2 className="mx-auto mb-3 size-6 animate-spin text-brand" />
          <p className="text-[15px] font-semibold">Crawling {crawl.target}…</p>
          <p className="mt-1 text-[13px] text-ink-2">{fmtNumber(crawl.pagesCrawled)} pages crawled · {fmtNumber(crawl.pagesInQueue)} in queue · limit {fmtNumber(crawl.maxPages)}</p>
          <Progress value={pct} className="mt-4 h-2" />
          <p className="mt-3 text-[12px] text-ink-3">Started {new Date(crawl.createdAt).toLocaleString()} · this page updates every few seconds. You can leave — the result is saved when it finishes.</p>
        </div>
      </Card>
    );
  }

  const mock = crawl.source === "mock";
  const byCategory = Object.entries(d.issues.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.category]: (acc[i.category] ?? 0) + i.pages }), {}))
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
        <SourceBadge source={mock ? "mock" : "snapshot"} />
        <span>Crawled {new Date(crawl.finishedAt ?? crawl.createdAt).toLocaleString()}</span>
        {!mock && <span>Cost {fmtCurrency(crawl.costUsd, 4)}</span>}
        <span>Stored locally — available after the provider deletes it.</span>
      </div>
      <div className="grid gap-4 xl:grid-cols-4">
        <Section title="Site health" mock={mock} info="DataForSEO OnPage score (0–100) for the crawled pages.">
          <div className="flex flex-col items-center"><Gauge value={d.healthScore} /></div>
        </Section>
        <div className="grid grid-cols-2 gap-3 xl:col-span-3 xl:grid-cols-4">
          <MetricCard mock={mock} label="Crawled pages" value={fmtNumber(d.crawl.pagesCrawled)} sub={`limit ${fmtNumber(d.crawl.maxPages)}`} />
          <MetricCard mock={mock} label="Errors" value={fmtNumber(d.counts.errors)} accent={STATUS.critical} />
          <MetricCard mock={mock} label="Warnings" value={fmtNumber(d.counts.warnings)} accent={STATUS.warning} />
          <MetricCard mock={mock} label="Notices" value={fmtNumber(d.counts.notices)} accent="#2a78d6" />
          <Section className="col-span-2" title="Issues by category" mock={mock} info="Affected pages per category (a page can count in several).">
            {byCategory.length ? <BarList items={byCategory} valueFormatter={fmtNumber} /> : <EmptyState compact title="No issues found" />}
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
            <TabsTrigger value="pages">Crawled pages ({fmtNumber(d.pages.length)})</TabsTrigger>
          </TabsList>
          <TabsContent value="issues" className="pt-3">
            <DataTable data={d.issues} columns={issueCols} searchText={(r) => r.title} filters={[
              { id: "sev", label: "Severity", type: "multi", accessor: (r) => r.severity, options: [{ value: "error", label: "Errors" }, { value: "warning", label: "Warnings" }, { value: "notice", label: "Notices" }] },
              { id: "cat", label: "Category", type: "multi", accessor: (r) => r.category, options: [...new Set(d.issues.map((i) => i.category))].map((c) => ({ value: c, label: c })) },
            ]} exportName={`${d.target}_audit_issues`} initialSort={[{ id: "severity", desc: false }]} emptyTitle="No issues" />
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
}
