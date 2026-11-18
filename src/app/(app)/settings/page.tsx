"use client";
import { Suspense, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, PlugZap, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/report/report-view";
import { Section } from "@/components/report/section";
import { MetricCard } from "@/components/report/metric-card";
import { VBarChart } from "@/components/charts/bar-chart";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/states/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchState } from "@/lib/client/use-search-state";
import { fmtCurrency, fmtNumber } from "@/lib/utils";

type Settings = {
  credentials: { configured: boolean; source: "env" | "database" | null; loginMasked: string | null; lastVerifiedAt: string | null; lastBalanceUsd: number | null; databaseAvailable: boolean; encryptionConfigured: boolean };
  limits: { dailyUsd: number; monthlyUsd: number; maxRequestUsd: number; hardStop: boolean };
  cache: { ttlMultiplier: number; enabled: boolean };
  live: { enabled: boolean; sandbox: boolean; tools: { id: string; label: string; order: number; integration: string; listed: boolean; endpoints: string[] }[] };
};
type Usage = {
  usage: null | {
    todayUsd: number; monthUsd: number; requestsThisMonth: number; cacheHitsThisMonth: number;
    byTool: { tool: string; costUsd: number; requests: number }[];
    daily: { date: string; costUsd: number; requests: number }[];
    recent: { id: string; createdAt: string; endpoint: string; tool: string | null; cacheHit: boolean; statusCode: number | null; costUsd: number; durationMs: number | null; error: string | null }[];
  };
  limits: Settings["limits"];
};

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  return json;
}

export default function SettingsPage() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  const { get, setParams } = useSearchState();
  const tab = get("tab") ?? "credentials";
  const settings = useQuery<Settings>({ queryKey: ["settings"], queryFn: () => fetch("/api/settings").then((r) => r.json()) });
  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <PageHeader title="Settings" description="DataForSEO connection, spending limits, cache and integration status." />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="credentials">API credentials</TabsTrigger>
          <TabsTrigger value="usage">Usage & limits</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>
        <div className="pt-4">
          {!settings.data ? (
            <div className="text-sm text-ink-3">Loading…</div>
          ) : (
            <>
              <TabsContent value="credentials"><Credentials s={settings.data} /></TabsContent>
              <TabsContent value="usage"><UsageTab limits={settings.data.limits} dbOk={settings.data.credentials.databaseAvailable} /></TabsContent>
              <TabsContent value="cache"><CacheTab s={settings.data} /></TabsContent>
              <TabsContent value="integrations"><Integrations s={settings.data} /></TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}

function Credentials({ s }: { s: Settings }) {
  const qc = useQueryClient();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const c = s.credentials;
  const refresh = () => qc.invalidateQueries({ queryKey: ["settings"] });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Section className="lg:col-span-2" title="DataForSEO API credentials" description="Use the API login and API password from your DataForSEO dashboard (not your account password).">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await send("/api/settings/credentials", "PUT", { login, password });
              setPassword("");
              toast.success("Credentials saved (encrypted)");
              refresh();
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="login">API login</Label>
              <Input id="login" autoComplete="off" value={login} onChange={(e) => setLogin(e.target.value)} placeholder={c.loginMasked ?? "you@company.com"} disabled={c.source === "env"} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">API password</Label>
              <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={c.configured ? "•••••••• (stored)" : ""} disabled={c.source === "env"} />
            </div>
          </div>
          {c.source === "env" && <p className="text-xs text-ink-2">Credentials are set via DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD environment variables, which take precedence. Edit .env to change them.</p>}
          {!c.databaseAvailable && <p className="text-xs text-critical">Database not reachable — credentials can only be set via environment variables.</p>}
          {!c.encryptionConfigured && <p className="text-xs text-critical">APP_ENCRYPTION_KEY is missing; credentials cannot be stored.</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || c.source === "env" || !login || !password}>Save credentials</Button>
            <Button
              type="button" variant="outline" disabled={!c.configured || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await send("/api/settings/credentials/test", "POST");
                  toast.success(`Connected as ${r.login}`, { description: r.balanceUsd != null ? `Balance ${fmtCurrency(r.balanceUsd)}` : undefined });
                  refresh();
                } catch (err) {
                  toast.error((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <PlugZap /> Test connection
            </Button>
            {c.source === "database" && (
              <Button type="button" variant="ghost" className="text-critical" onClick={async () => { await send("/api/settings/credentials", "DELETE"); toast.success("Credentials removed"); refresh(); }}>
                <Trash2 /> Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-ink-3">“Test connection” calls the free <code>/v3/appendix/user_data</code> endpoint to verify the login and read your balance. No paid request is made.</p>
        </form>
      </Section>
      <Section title="Status">
        <ul className="space-y-3 text-[13px]">
          <StatusRow ok={c.configured} label="Credentials" detail={c.configured ? `${c.loginMasked} (${c.source})` : "Not configured"} />
          <StatusRow ok={Boolean(c.lastVerifiedAt)} label="Verified" detail={c.lastVerifiedAt ? new Date(c.lastVerifiedAt).toLocaleString() : "Never"} />
          <StatusRow ok={c.lastBalanceUsd != null && c.lastBalanceUsd > 1} label="Balance" detail={c.lastBalanceUsd != null ? fmtCurrency(c.lastBalanceUsd) : "Unknown"} />
          <StatusRow ok={c.databaseAvailable} label="Database" detail={c.databaseAvailable ? "Connected" : "Unavailable"} />
          <StatusRow ok={s.live.enabled} label="Live mode" detail={s.live.enabled ? (s.live.sandbox ? "On (sandbox)" : "On") : "Off — mock data"} />
        </ul>
        <div className="mt-4 flex items-start gap-2 rounded-md bg-page p-3 text-xs text-ink-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-good-text" />
          Credentials are encrypted with AES-256-GCM and used only by server-side route handlers. They are never sent to the browser.
        </div>
      </Section>
    </div>
  );
}

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="size-4 text-good" /> : <CircleAlert className="size-4 text-ink-3" />}
      <span className="font-medium text-ink">{label}</span>
      <span className="ml-auto truncate text-ink-2">{detail}</span>
    </li>
  );
}

function UsageTab({ limits, dbOk }: { limits: Settings["limits"]; dbOk: boolean }) {
  const qc = useQueryClient();
  const usage = useQuery<Usage>({ queryKey: ["usage"], queryFn: () => fetch("/api/usage").then((r) => r.json()) });
  const [form, setForm] = useState(limits);
  useEffect(() => setForm(limits), [limits]);
  const u = usage.data?.usage;
  const recentCols: ColumnDef<NonNullable<Usage["usage"]>["recent"][number]>[] = [
    { accessorKey: "createdAt", header: "Time", cell: ({ getValue }) => new Date(getValue<string>()).toLocaleString() },
    { accessorKey: "tool", header: "Tool", cell: ({ getValue }) => getValue<string | null>() ?? "—" },
    { accessorKey: "endpoint", header: "Endpoint", cell: ({ getValue }) => <code className="text-[11.5px]">{getValue<string>()}</code> },
    { accessorKey: "cacheHit", header: "Cache", cell: ({ getValue }) => (getValue<boolean>() ? <Badge variant="good">hit</Badge> : <Badge variant="muted">miss</Badge>) },
    { accessorKey: "statusCode", header: "Status", cell: ({ row }) => row.original.error ? <span className="text-critical" title={row.original.error}>{row.original.statusCode ?? "error"}</span> : row.original.statusCode ?? "—" },
    { accessorKey: "costUsd", header: "Cost", cell: ({ getValue }) => fmtCurrency(getValue<number>(), 4), meta: { align: "right" } },
    { accessorKey: "durationMs", header: "ms", cell: ({ getValue }) => fmtNumber(getValue<number | null>()), meta: { align: "right" } },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Spent today" value={fmtCurrency(u?.todayUsd ?? 0, 4)} sub={`of ${fmtCurrency(limits.dailyUsd)} daily limit`}>
          <Progress value={((u?.todayUsd ?? 0) / Math.max(0.0001, limits.dailyUsd)) * 100} />
        </MetricCard>
        <MetricCard label="Spent this month" value={fmtCurrency(u?.monthUsd ?? 0, 4)} sub={`of ${fmtCurrency(limits.monthlyUsd)} monthly limit`}>
          <Progress value={((u?.monthUsd ?? 0) / Math.max(0.0001, limits.monthlyUsd)) * 100} />
        </MetricCard>
        <MetricCard label="Paid requests (month)" value={fmtNumber(u?.requestsThisMonth ?? 0)} />
        <MetricCard label="Cache hits (month)" value={fmtNumber(u?.cacheHitsThisMonth ?? 0)} sub="Requests served without cost" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Section className="lg:col-span-2" title="Daily cost (last 30 days)" description="Actual cost reported by DataForSEO on each response.">
          {u?.daily.length ? <VBarChart data={u.daily} xKey="date" series={[{ key: "costUsd", label: "Cost (USD)" }]} valueFormatter={(v) => `$${v.toFixed(2)}`} /> : <EmptyState compact title="No paid requests yet" description={dbOk ? "Usage appears here once live requests are made." : "Database unavailable — usage cannot be recorded."} />}
        </Section>
        <Section title="Spending limits" description="Checked before every paid request using a pre-flight estimate.">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await send("/api/settings/limits", "PUT", form);
                toast.success("Limits saved");
                qc.invalidateQueries({ queryKey: ["settings"] });
                qc.invalidateQueries({ queryKey: ["usage"] });
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            {([["dailyUsd", "Daily limit (USD)"], ["monthlyUsd", "Monthly limit (USD)"], ["maxRequestUsd", "Max per request (USD)"]] as const).map(([k, label]) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={k}>{label}</Label>
                <Input id={k} type="number" min={0} step="0.01" value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} />
              </div>
            ))}
            <label className="flex items-center justify-between gap-2 text-[13px]">
              <span>Block requests when a limit is reached</span>
              <Switch checked={form.hardStop} onCheckedChange={(v) => setForm({ ...form, hardStop: v })} />
            </label>
            <Button type="submit" disabled={!dbOk} className="w-full">Save limits</Button>
          </form>
        </Section>
      </div>
      <Section flush title="Recent requests" description="Last 50 provider calls and cache hits.">
        <DataTable data={u?.recent ?? []} columns={recentCols} exportName="api_usage" emptyTitle="No requests logged" />
      </Section>
    </div>
  );
}

function CacheTab({ s }: { s: Settings }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(s.cache);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Response cache" description="Identical requests (same endpoint and parameters) are served from PostgreSQL until they expire, at no API cost.">
        <div className="space-y-4">
          <label className="flex items-center justify-between text-[13px]"><span>Enable caching</span><Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} /></label>
          <div className="space-y-1">
            <Label htmlFor="ttl">TTL multiplier</Label>
            <Input id="ttl" type="number" min={0.1} max={30} step={0.1} value={form.ttlMultiplier} onChange={(e) => setForm({ ...form, ttlMultiplier: Number(e.target.value) })} />
            <p className="text-xs text-ink-3">Defaults: Labs 3–14 days · Backlinks 1–7 days · SERP 12 hours. 2 = keep twice as long.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={async () => { try { await send("/api/settings/cache", "PUT", form); toast.success("Cache settings saved"); qc.invalidateQueries({ queryKey: ["settings"] }); } catch (e) { toast.error((e as Error).message); } }}>Save</Button>
            <Button variant="outline" onClick={async () => { const r = await send("/api/settings/cache", "DELETE"); toast.success(`Cleared ${r.cleared} cached responses`); }}><Trash2 /> Clear cache</Button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Integrations({ s }: { s: Settings }) {
  const tools = [...s.live.tools].sort((a, b) => a.order - b.order);
  return (
    <div className="space-y-4">
      <Section title="Live mode" description="Live DataForSEO requests require all of the conditions below. Until then every report serves labelled mock data.">
        <ol className="list-decimal space-y-1 pl-5 text-[13px] text-ink-2">
          <li>Credentials configured and verified (API credentials tab).</li>
          <li><code>DATAFORSEO_LIVE_ENABLED=true</code> in <code>.env</code> — currently <b>{s.live.enabled ? "true" : "false"}</b>.</li>
          <li>The tool listed in <code>DATAFORSEO_LIVE_TOOLS</code> (comma separated).</li>
          <li>The tool has a reviewed live implementation (status “Ready”).</li>
        </ol>
        <p className="mt-3 text-xs text-ink-3">Tip: set <code>DATAFORSEO_USE_SANDBOX=true</code> to test integrations against the free DataForSEO sandbox, which returns placeholder data.</p>
      </Section>
      <Section flush title="Integration plan" description="Tools are integrated one at a time in this order.">
        <div className="divide-y divide-border">
          {tools.map((t) => (
            <div key={t.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
              <span className="grid size-6 place-items-center rounded-full bg-page text-xs font-semibold text-ink-2">{t.order}</span>
              <div className="min-w-[180px] flex-1">
                <div className="flex items-center gap-2 text-[13px] font-semibold">
                  {t.label}
                  <Badge variant={t.integration === "mock" ? "mock" : t.integration === "live" ? "live" : "default"}>{t.integration === "mock" ? "Mock" : t.integration === "ready" ? "Ready" : "Live"}</Badge>
                  {t.listed && <Badge variant="live">listed</Badge>}
                </div>
                <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-ink-3">{t.endpoints.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
