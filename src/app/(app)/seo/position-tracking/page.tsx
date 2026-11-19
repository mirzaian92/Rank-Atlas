"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { ArrowLeft, Clock, Crosshair, Info, Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import type { PositionTracking } from "@/lib/reports/types";
import { TRACK_DEPTHS, estimateTrackingCost } from "@/lib/reports/tracking";
import { MARKETS, getMarket } from "@/lib/config/markets";
import { PageHeader } from "@/components/report/report-view";
import { MetricCard } from "@/components/report/metric-card";
import { Section } from "@/components/report/section";
import { SourceBadge } from "@/components/report/source-badge";
import { MarketSelector } from "@/components/layout/market-selector";
import { POSITION_PRESETS, VOLUME_PRESETS, keywordLink } from "@/components/report/columns";
import { TrendChart } from "@/components/charts/trend-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { DataTable } from "@/components/data/data-table";
import { PositionCell, UrlCell } from "@/components/data/cells";
import { DashboardSkeleton, EmptyState, ErrorState } from "@/components/states/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchState } from "@/lib/client/use-search-state";
import type { ReportErrorCode } from "@/lib/reports/envelope";
import { fmtCurrency, fmtDate, fmtNumber, fmtPercent } from "@/lib/utils";

type ProjectSummary = { id: string; name: string; domain: string; locationCode: number; languageCode: string; device: string; depth: number; keywordCount: number; createdAt: string; lastCheckedAt: string | null };
type Report = PositionTracking & {
  pending: number; mock: boolean; checkedDays: number; failedToday: number; mode: "live" | "mock";
  keywordIds: Record<string, string>;
  settings: { locationCode: number; languageCode: string; depth: number; lastCheckedAt: string | null };
};
type ApiError = Error & { code?: ReportErrorCode };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = new Error(body?.error?.message ?? `Request failed (${res.status})`) as ApiError;
    e.code = body?.error?.code;
    throw e;
  }
  return body as T;
}

const splitKeywords = (s: string) => [...new Set(s.split(/[\n,]/).map((k) => k.trim().toLowerCase()).filter(Boolean))];

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  const { get } = useSearchState();
  const project = get("project");
  return project ? <ProjectView id={project} /> : <ProjectList />;
}

// ---------------------------------------------------------------------------
// Project list + create
// ---------------------------------------------------------------------------
function ProjectList() {
  const [open, setOpen] = useState(false);
  const q = useQuery<{ projects: ProjectSummary[]; mode: "live" | "mock" }, ApiError>({ queryKey: ["tracking-projects"], queryFn: () => api("/api/tracking/projects") });
  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <PageHeader
        title="Position Tracking"
        description="Daily Google rankings for a keyword set, from stored checks. History starts with the first check — nothing is back-filled."
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus /> New project</Button>}
      />
      {q.isPending ? <DashboardSkeleton /> : q.isError ? (
        <ErrorState code={q.error.code ?? "INTERNAL"} message={q.error.message} onRetry={() => q.refetch()} />
      ) : q.data.projects.length === 0 ? (
        <Card>
          <EmptyState icon={Crosshair} title="No tracking projects yet" description="Create a project with a domain, a market and the keywords you want to follow." action={<Button onClick={() => setOpen(true)}><Plus /> New project</Button>} />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.data.projects.map((p) => {
            const m = MARKETS.find((x) => x.locationCode === p.locationCode);
            return (
              <Link key={p.id} href={`/seo/position-tracking?project=${p.id}`} className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-brand">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[15px] font-semibold text-ink">{p.name}</span>
                  {q.data.mode === "mock" && <Badge variant="mock">MOCK</Badge>}
                </div>
                <div className="mt-0.5 text-[13px] text-brand">{p.domain}</div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
                  <span>{m?.flag} {m?.country} · {p.languageCode.toUpperCase()}</span>
                  <span className="capitalize">{p.device}</span>
                  <span>Top {p.depth}</span>
                  <span>{fmtNumber(p.keywordCount)} keywords</span>
                </div>
                <div className="mt-2 text-[11.5px] text-ink-3">{p.lastCheckedAt ? `Last checked ${new Date(p.lastCheckedAt).toLocaleString()}` : "Not checked yet"}</div>
              </Link>
            );
          })}
        </div>
      )}
      <NewProjectDialog open={open} onOpenChange={setOpen} mode={q.data?.mode ?? "mock"} />
    </div>
  );
}

function NewProjectDialog({ open, onOpenChange, mode }: { open: boolean; onOpenChange: (v: boolean) => void; mode: "live" | "mock" }) {
  const qc = useQueryClient();
  const { setParams, market: current, language } = useSearchState();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [db, setDb] = useState(current.id);
  const [lang, setLang] = useState(language.code);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [depth, setDepth] = useState(100);
  const [keywords, setKeywords] = useState("");
  const [tags, setTags] = useState("");
  const list = splitKeywords(keywords);
  const est = estimateTrackingCost(list.length, depth);
  const create = useMutation<{ project: { id: string } }, ApiError>({
    mutationFn: () => api("/api/tracking/projects", {
      method: "POST",
      body: JSON.stringify({
        name: name || domain, domain, locationCode: getMarket(db).locationCode, languageCode: lang, device, depth, keywords: list,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["tracking-projects"] });
      onOpenChange(false);
      toast.success("Project created", { description: "Run the first check from the project page." });
      setParams({ project: r.project.id });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogTitle>New tracking project</DialogTitle>
        <DialogDescription>Rankings are checked once a day (and whenever you click “Check now”).</DialogDescription>
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="pt-domain">Domain</Label><Input id="pt-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" required /></div>
            <div className="space-y-1"><Label htmlFor="pt-name">Project name</Label><Input id="pt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={domain || "My project"} /></div>
          </div>
          <div className="space-y-1">
            <Label>Market</Label>
            <MarketSelector db={db} lang={lang} onChange={(d, l) => { setDb(d); setLang(l); }} />
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1"><Label>Device</Label><Segmented value={device} onChange={setDevice} options={[{ value: "desktop", label: "Desktop" }, { value: "mobile", label: "Mobile" }]} /></div>
            <div className="space-y-1">
              <Label>Check depth</Label>
              <Select value={String(depth)} onValueChange={(v) => setDepth(Number(v))}>
                <SelectTrigger className="h-8 w-[130px] text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>{TRACK_DEPTHS.map((d) => <SelectItem key={d} value={String(d)}>Top {d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pt-kw">Keywords (one per line, up to 500)</Label>
            <Textarea id="pt-kw" rows={6} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={"crm software\nbest crm for small business"} />
          </div>
          <div className="space-y-1"><Label htmlFor="pt-tags">Tags for these keywords (optional, comma separated)</Label><Input id="pt-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="brand, product" /></div>
          <div className="rounded-md bg-page px-3 py-2 text-[12.5px] text-ink-2">
            {mode === "live" ? (
              <>{fmtNumber(list.length)} keywords × top {depth}: about <b className="text-ink">{fmtCurrency(est.perDay, 3)}/day</b> · <b className="text-ink">{fmtCurrency(est.perMonth, 2)}/month</b> (standard queue). Search volumes are looked up once (≈ $0.01).</>
            ) : (
              <>Mock mode — checks generate labelled mock positions at no cost.</>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!domain || create.isPending}>{create.isPending && <Loader2 className="animate-spin" />} Create project</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Project view
// ---------------------------------------------------------------------------
type Row = PositionTracking["keywords"][number];

function ProjectView({ id }: { id: string }) {
  const qc = useQueryClient();
  const { setParams } = useSearchState();
  const [metric, setMetric] = useState<"visibility" | "avgPosition" | "top">("visibility");
  const [days, setDays] = useState(30);
  const [adding, setAdding] = useState(false);
  const key = ["tracking-project", id, days];
  const q = useQuery<Report, ApiError>({
    queryKey: key,
    queryFn: () => api(`/api/tracking/projects/${id}?days=${days}`),
    // While checks are queued, poll (collection is free) until they're done.
    refetchInterval: (query) => ((query.state.data?.pending ?? 0) > 0 ? 15_000 : false),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["tracking-project", id] });
  const check = useMutation<{ posted: number; mode: string; costUsd: number; alreadyChecked: boolean }, ApiError>({
    mutationFn: () => api(`/api/tracking/projects/${id}/check`, { method: "POST" }),
    onSuccess: (r) => {
      if (r.alreadyChecked) toast.info("Every keyword has already been checked today.");
      else toast.success(`${r.posted} keyword checks ${r.mode === "live" ? "queued" : "generated (mock)"}`, { description: r.mode === "live" ? `Cost ${fmtCurrency(r.costUsd, 4)} · results arrive within a few minutes` : undefined });
      refresh();
      qc.invalidateQueries({ queryKey: ["usage-meter"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation<unknown, ApiError, string>({
    mutationFn: (keywordId) => api(`/api/tracking/projects/${id}/keywords?keywordId=${keywordId}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const del = useMutation<unknown, ApiError>({
    mutationFn: () => api(`/api/tracking/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tracking-projects"] }); setParams({ project: null }); toast.success("Project deleted"); },
  });

  const cols = useMemo<ColumnDef<Row>[]>(() => [
    { accessorKey: "keyword", header: "Keyword", cell: ({ getValue }) => <Link href={keywordLink(getValue<string>(), MARKETS.find((x) => x.locationCode === q.data?.settings.locationCode)?.id ?? "us")} className="font-medium text-brand hover:underline">{getValue<string>()}</Link> },
    { accessorKey: "tags", header: "Tags", enableSorting: false, cell: ({ row }) => row.original.tags.map((t) => <span key={t} className="mr-1 rounded bg-page px-1.5 py-0.5 text-[11px] text-ink-2">{t}</span>), meta: { exportValue: (r) => r.tags.join("; ") } },
    { id: "position", accessorFn: (r) => r.position ?? 101, header: "Position", cell: ({ row }) => (!row.original.checked ? <span className="text-ink-3">not checked</span> : row.original.position == null ? <span className="text-ink-3" title="Checked — not found in the checked depth">not in top {q.data?.settings.depth}</span> : <PositionCell position={row.original.position} previous={row.original.previous} />), meta: { align: "right", exportValue: (r) => r.position } },
    { accessorKey: "best", header: "Best", cell: ({ getValue }) => getValue<number | null>() ?? "—", meta: { align: "right" } },
    { id: "history", header: `${days} days`, enableSorting: false, cell: ({ row }) => <div className="w-28"><Sparkline height={24} values={row.original.history.map((p) => (p == null ? 0 : 101 - p))} /></div>, meta: { noExport: true } },
    { accessorKey: "searchVolume", header: "Volume", cell: ({ getValue }) => fmtNumber(getValue<number | null>()), meta: { align: "right" } },
    { accessorKey: "url", header: "Ranking URL", cell: ({ getValue }) => <UrlCell url={getValue<string | null>()} max={36} /> },
    {
      id: "remove", header: "", enableSorting: false, meta: { noExport: true },
      cell: ({ row }) => (
        <button className="text-ink-3 hover:text-critical" aria-label={`Stop tracking ${row.original.keyword}`} onClick={() => { const kid = q.data?.keywordIds[row.original.keyword]; if (kid && confirm(`Stop tracking "${row.original.keyword}"? Its history is deleted.`)) remove.mutate(kid); }}>
          <X className="size-4" />
        </button>
      ),
    },
  ], [days, q.data?.keywordIds, q.data?.settings.locationCode, q.data?.settings.depth, remove]);

  if (q.isPending) return <div className="mx-auto max-w-[1440px]"><DashboardSkeleton /></div>;
  if (q.isError) return <div className="mx-auto max-w-[1440px] space-y-4"><BackLink /><ErrorState code={q.error.code ?? "INTERNAL"} message={q.error.message} onRetry={() => q.refetch()} /></div>;

  const d = q.data;
  const v = d.visibility;
  const last = v[v.length - 1];
  const prev = v[v.length - 2];
  const m = MARKETS.find((x) => x.locationCode === d.settings.locationCode);
  const unchecked = d.keywords.filter((k) => !k.checked).length;
  const est = estimateTrackingCost(d.keywords.length, d.settings.depth);
  const mock = d.mock;

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <BackLink />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight">{d.project?.name}</h1>
            <SourceBadge source={mock ? "mock" : "snapshot"} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-[12.5px] text-ink-3">
            <span className="text-brand">{d.project?.domain}</span>
            <span>{m?.flag} {m?.country} · {d.settings.languageCode.toUpperCase()}</span>
            <span className="capitalize">{d.project?.device}</span>
            <span>Top {d.settings.depth}</span>
            <span>{d.settings.lastCheckedAt ? `Last check ${new Date(d.settings.lastCheckedAt).toLocaleString()}` : "Never checked"}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={String(days)} onChange={(x) => setDays(Number(x))} options={[{ value: "7", label: "7D" }, { value: "30", label: "30D" }, { value: "90", label: "90D" }]} />
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus /> Keywords</Button>
          <Button size="sm" onClick={() => check.mutate()} disabled={check.isPending || d.keywords.length === 0} title={d.mode === "live" ? `≈ ${fmtCurrency(est.perCheck, 3)} for all keywords` : "Mock check (free)"}>
            {check.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check now
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Delete project" onClick={() => confirm("Delete this project and all its ranking history?") && del.mutate()}><Trash2 /></Button>
        </div>
      </div>

      {d.pending > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-[#bcd5f5] bg-brand-soft px-4 py-2.5 text-[13px] text-[#1c5cab]" role="status">
          <Clock className="size-4" /> {d.pending} check{d.pending > 1 ? "s" : ""} in the DataForSEO queue — results usually arrive within a few minutes. This page refreshes automatically.
        </div>
      )}
      {d.failedToday > 0 && <p className="text-[12.5px] text-critical">{d.failedToday} check{d.failedToday > 1 ? "s" : ""} failed today. They'll be retried tomorrow, or click “Check now”.</p>}
      <div className="flex items-start gap-2 text-[12px] text-ink-3">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {d.mode === "live" ? `Checked daily via the DataForSEO standard queue (≈ ${fmtCurrency(est.perDay, 3)}/day, ${fmtCurrency(est.perMonth, 2)}/month). ` : "Mock mode: checks generate labelled mock positions. "}
          Visibility = CTR-weighted share of the clicks you'd get at #1 for every keyword. Days without checks are gaps.
        </span>
      </div>

      {d.keywords.length === 0 ? (
        <Card><EmptyState title="No keywords yet" action={<Button onClick={() => setAdding(true)}><Plus /> Add keywords</Button>} /></Card>
      ) : v.length === 0 ? (
        <Card><EmptyState icon={Clock} title={d.pending ? "Waiting for the first results" : "No checks yet"} description={d.pending ? "The first check is in the queue." : "Run the first check to start recording positions."} action={!d.pending && <Button onClick={() => check.mutate()}><RefreshCw /> Check now</Button>} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard mock={mock} label="Visibility" value={fmtPercent(last.visibility, 2)} delta={prev ? last.visibility - prev.visibility : null} deltaLabel={prev ? `vs ${fmtDate(prev.date, { month: "short", day: "numeric" })}` : undefined} info="CTR-weighted share of the maximum possible clicks across tracked keywords (100% = all at #1)." />
            <MetricCard mock={mock} label="Avg. position" value={last.avgPosition || "—"} sub={prev ? `${(prev.avgPosition - last.avgPosition).toFixed(1)} vs previous check` : "Ranked keywords only"} />
            <MetricCard mock={mock} label="Top 3" value={last.top3} sub={`of ${d.keywords.length} keywords`} />
            <MetricCard mock={mock} label="Top 10" value={last.top10} sub={`${unchecked ? `${unchecked} not checked yet · ` : ""}${d.checkedDays} day${d.checkedDays === 1 ? "" : "s"} of data`} />
          </div>
          <Section
            title={metric === "visibility" ? "Visibility trend" : metric === "avgPosition" ? "Average position" : "Keywords in top 3 / top 10"}
            mock={mock}
            actions={<Segmented value={metric} onChange={setMetric} options={[{ value: "visibility", label: "Visibility" }, { value: "avgPosition", label: "Avg. position" }, { value: "top", label: "Top 3/10" }]} />}
          >
            {v.length > 1 ? (
              <TrendChart
                data={v}
                variant={metric === "visibility" ? "area" : "line"}
                dateFormat={{ month: "short", day: "numeric" }}
                valueFormatter={metric === "visibility" ? (x) => `${x.toFixed(1)}%` : (x) => x.toFixed(metric === "avgPosition" ? 1 : 0)}
                series={metric === "visibility" ? [{ key: "visibility", label: "Visibility" }] : metric === "avgPosition" ? [{ key: "avgPosition", label: "Avg. position" }] : [{ key: "top3", label: "Top 3" }, { key: "top10", label: "Top 10" }]}
              />
            ) : (
              <EmptyState compact title="One day of data so far" description="The trend appears after the second daily check." />
            )}
          </Section>
        </>
      )}

      {d.keywords.length > 0 && (
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
            exportName={`${d.project?.domain}_rankings_${days}d`}
            initialSort={[{ id: "position", desc: false }]}
            countLabel={(n) => `${n} keywords`}
          />
        </Card>
      )}
      <AddKeywordsDialog id={id} open={adding} onOpenChange={setAdding} onAdded={refresh} />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/seo/position-tracking" className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
      <ArrowLeft className="size-3.5" /> All projects
    </Link>
  );
}

function AddKeywordsDialog({ id, open, onOpenChange, onAdded }: { id: string; open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const add = useMutation<{ added: number }, ApiError>({
    mutationFn: () => api(`/api/tracking/projects/${id}/keywords`, { method: "POST", body: JSON.stringify({ keywords: splitKeywords(text), tags: tags.split(",").map((t) => t.trim()).filter(Boolean) }) }),
    onSuccess: (r) => { toast.success(`${r.added} keyword${r.added === 1 ? "" : "s"} added`); setText(""); onOpenChange(false); onAdded(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Add keywords</DialogTitle>
        <DialogDescription>New keywords are checked on the next daily run, or click “Check now”.</DialogDescription>
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="One keyword per line" />
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (optional, comma separated)" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!splitKeywords(text).length || add.isPending}>Add {splitKeywords(text).length || ""}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
