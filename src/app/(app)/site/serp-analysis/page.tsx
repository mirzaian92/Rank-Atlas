"use client";
import { Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { SerpAnalysis } from "@/lib/reports/types";
import { SERP_DEPTHS, estimateSerpCost } from "@/lib/reports/serp";
import { ReportView } from "@/components/report/report-view";
import { MetricCard } from "@/components/report/metric-card";
import { Section } from "@/components/report/section";
import { serpColumnsFor } from "@/components/report/serp-columns";
import { BarList } from "@/components/charts/bar-list";
import { DataTable } from "@/components/data/data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsSummary } from "@/components/layout/app-header";
import { fetchReport } from "@/lib/client/use-report";
import { useSearchState } from "@/lib/client/use-search-state";
import { fmtCompact, fmtCurrency } from "@/lib/utils";

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  const { get, setParams, baseParams } = useSearchState();
  const qc = useQueryClient();
  const device = (get("device") ?? "desktop") as "desktop" | "mobile";
  const depth = (SERP_DEPTHS as readonly number[]).includes(Number(get("depth"))) ? Number(get("depth")) : 10;
  const enrich = get("enrich") === "1";
  const { data: settings } = useSettingsSummary();
  const live = Boolean(settings?.live.enabled && settings.credentials.configured && settings.live.tools.find((t) => t.id === "serp-analysis")?.listed);
  const [rechecking, setRechecking] = useState(false);
  const params = { device, depth: String(depth), enrich: enrich ? "1" : "0" };

  /** One fresh paid request (refreshes the server cache), then reload the view from that cache. */
  async function recheck() {
    setRechecking(true);
    try {
      const r = await fetchReport<SerpAnalysis>("serp-analysis", { ...baseParams, ...params, fresh: "1" });
      await qc.invalidateQueries({ queryKey: ["report", "serp-analysis"] });
      toast.success("SERP re-checked", { description: r.meta.source === "mock" ? "Mock data" : `Cost ${fmtCurrency(r.meta.costUsd, 4)}` });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRechecking(false);
    }
  }

  return (
    <ReportView<SerpAnalysis>
      tool="serp-analysis"
      extraParams={params}
      isEmpty={(d) => d.results.length === 0}
      actions={
        <>
          <Segmented value={device} onChange={(v) => setParams({ device: v === "desktop" ? null : v }, { replace: true })} options={[{ value: "desktop", label: "Desktop" }, { value: "mobile", label: "Mobile" }]} />
          <Select value={String(depth)} onValueChange={(v) => setParams({ depth: v === "10" ? null : v }, { replace: true })}>
            <SelectTrigger className="h-8 w-[118px] text-[13px]" aria-label="Results depth"><SelectValue /></SelectTrigger>
            <SelectContent>{SERP_DEPTHS.map((n) => <SelectItem key={n} value={String(n)}>Top {n}</SelectItem>)}</SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-[12.5px] text-ink-2" title="Looks up each ranking domain's Domain Rank (backlinks/bulk_ranks)">
            <Switch checked={enrich} onCheckedChange={(v) => setParams({ enrich: v ? "1" : null }, { replace: true })} />
            Domain Rank
          </label>
          {settings && <span className="text-[12px] text-ink-3">{live ? `≈ ${fmtCurrency(estimateSerpCost(depth, enrich), 3)} per check` : "Mock data · $0"}</span>}
          <Button variant="outline" size="sm" onClick={recheck} disabled={rechecking} title="Fetch a fresh SERP instead of the 12-hour cache">
            <RefreshCw className={rechecking ? "animate-spin" : undefined} /> Re-check now
          </Button>
        </>
      }
    >
      {(d, meta) => {
        const mock = meta.source === "mock";
        const organic = d.results.filter((r) => r.type === "organic");
        const ranked = organic.filter((r) => r.domainRank != null);
        const avgRank = ranked.length ? Math.round(ranked.reduce((a, b) => a + (b.domainRank ?? 0), 0) / ranked.length) : null;
        const top10 = organic.slice(0, 10).map((r) => r.domain);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard mock={mock} label="Results count" value={fmtCompact(d.resultsCount)} sub="As reported by DataForSEO" info="DataForSEO's se_results_count. Google no longer shows full 'About N results' counts, so this can be far smaller than the web's real total — don't read it as competition." />
              <MetricCard mock={mock} label="Organic results" value={organic.length} sub={`Top ${depth} · ${d.device}`} />
              <MetricCard mock={mock} label="SERP features" value={d.features.filter((f) => f.type !== "organic").length} sub={`${new Set(top10).size} unique domains in top 10`} />
              <MetricCard
                mock={mock}
                label="Avg. Domain Rank (organic)"
                value={avgRank ?? "—"}
                sub={avgRank == null ? "Turn on Domain Rank above" : `${ranked.length} ranked results`}
                info="Mean backlink authority of the ranking domains — a rough indicator of how competitive this SERP is."
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
              <Section title="Result types" mock={mock} className="h-fit">
                <BarList items={d.features.map((f) => ({ label: f.type.replace(/_/g, " "), value: f.count }))} valueFormatter={(v) => String(v)} />
                <p className="mt-4 text-xs text-ink-3">Checked {new Date(d.checkedAt).toLocaleString()} · {d.device}</p>
              </Section>
              <Card className="min-w-0 pt-4">
                <DataTable data={d.results} columns={serpColumnsFor(d.results)} searchText={(r) => `${r.title} ${r.url}`} exportName={`serp_${d.keyword}_${d.device}_top${depth}`} pageSize={50} countLabel={(n) => `${n} results`} />
              </Card>
            </div>
          </div>
        );
      }}
    </ReportView>
  );
}
