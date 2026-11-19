"use client";
import { Suspense, useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { KeywordGap, KeywordGapRow } from "@/lib/reports/types";
import { GAP_SAMPLES, GAP_TABS, GAP_TAB_INFO, estimateGapCost, inGapTab, type GapTab } from "@/lib/reports/keyword-gap";
import { ReportView } from "@/components/report/report-view";
import { MultiDomainForm } from "@/components/report/multi-domain-form";
import { MetricCard } from "@/components/report/metric-card";
import { INTENT_OPTIONS, KD_PRESETS, VOLUME_PRESETS, keywordLink } from "@/components/report/columns";
import { DataTable } from "@/components/data/data-table";
import { IntentBadge, KdCell } from "@/components/data/cells";
import { SERIES } from "@/components/charts/palette";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsSummary } from "@/components/layout/app-header";
import { useSearchState } from "@/lib/client/use-search-state";
import { cn, fmtCurrency, fmtNumber } from "@/lib/utils";

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  const { q, setParams, get, market } = useSearchState();
  const tab = (GAP_TABS as readonly string[]).includes(get("tab") ?? "") ? (get("tab") as GapTab) : "all";
  const sample = (GAP_SAMPLES as readonly number[]).includes(Number(get("sample"))) ? Number(get("sample")) : 200;
  const { data: settings } = useSettingsSummary();
  const live = Boolean(settings?.live.enabled && settings.credentials.configured && settings.live.tools.find((t) => t.id === "keyword-gap")?.listed);

  const form = (
    <MultiDomainForm
      value={q}
      onSubmit={(v) => setParams({ q: v, tab: null })}
      extra={(n) => (
        <>
          <div>
            <label className="mb-1 block text-[11.5px] font-medium text-ink-2">Sample per comparison</label>
            <Select value={String(sample)} onValueChange={(v) => setParams({ sample: v === "200" ? null : v }, { replace: true })}>
              <SelectTrigger className="h-9 w-[150px] text-[13px]" aria-label="Sample size"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GAP_SAMPLES.map((s) => <SelectItem key={s} value={String(s)}>Top {s.toLocaleString()} keywords</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="pb-2 text-[12px] text-ink-3" title="3 requests per competitor + 1 per domain; cached results cost nothing">
            {!settings ? null : live ? <>Est. cost <b className="text-ink">≤ {fmtCurrency(estimateGapCost(Math.max(2, n), sample), 2)}</b></> : "Mock data · $0"}
          </div>
        </>
      )}
    />
  );

  return (
    <ReportView<KeywordGap> tool="keyword-gap" extraParams={{ sample: String(sample) }} landing={form} above={form} isEmpty={(d) => d.rows.length === 0}>
      {(d, meta) => <GapBody d={d} mock={meta.source === "mock"} tab={tab} setTab={(t) => setParams({ tab: t === "all" ? null : t }, { replace: true })} db={market.id} />}
    </ReportView>
  );
}

function GapBody({ d, mock, tab, setTab, db }: { d: KeywordGap; mock: boolean; tab: GapTab; setTab: (t: GapTab) => void; db: string }) {
  const counts = useMemo(() => Object.fromEntries(GAP_TABS.map((t) => [t, d.rows.filter((r) => inGapTab(r.positions, t)).length])) as Record<GapTab, number>, [d.rows]);
  const rows = useMemo(() => d.rows.filter((r) => inGapTab(r.positions, tab)), [d.rows, tab]);
  const cols = useMemo<ColumnDef<KeywordGapRow>[]>(() => [
    { accessorKey: "keyword", header: "Keyword", cell: ({ getValue }) => <Link className="font-medium text-brand hover:underline" href={keywordLink(getValue<string>(), db)}>{getValue<string>()}</Link> },
    ...d.domains.map((dom, i): ColumnDef<KeywordGapRow> => ({
      id: `pos${i}`,
      accessorFn: (r) => r.positions[i] ?? 101,
      header: () => <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: SERIES[i] }} />{dom}</span>,
      cell: ({ row }) => {
        const p = row.original.positions[i];
        const best = Math.min(...row.original.positions.filter((x): x is number => x != null));
        return p == null ? <span className="text-ink-3">—</span> : <span className={cn(p === best && row.original.positions.filter((x) => x != null).length > 1 && "font-semibold text-good-text")}>{p}</span>;
      },
      meta: { align: "right", label: `${dom} position`, exportValue: (r) => r.positions[i] },
    })),
    { accessorKey: "intent", header: "Intent", cell: ({ row }) => <IntentBadge intent={row.original.intent} />, meta: { align: "center" }, enableSorting: false },
    { accessorKey: "searchVolume", header: "Volume", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
    { accessorKey: "keywordDifficulty", header: "KD %", cell: ({ getValue }) => <KdCell kd={getValue<number | null>()} />, meta: { align: "right" } },
    { accessorKey: "cpc", header: "CPC", cell: ({ getValue }) => fmtCurrency(getValue<number | null>()), meta: { align: "right" } },
  ], [d.domains, db]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {d.totals.map((t, i) => (
          <MetricCard
            key={t.domain}
            mock={mock}
            accent={SERIES[i]}
            label={i === 0 ? `${t.domain} (you)` : t.domain}
            value={t.keywords != null ? fmtNumber(t.keywords) : "—"}
            sub="organic keywords in total"
            info="All keywords this domain ranks for in this market. The comparison below uses a sample of the highest-volume keywords."
          />
        ))}
      </div>
      <Card className="pt-3">
        <div className="flex flex-wrap gap-1 border-b border-border px-5 pb-3">
          {GAP_TABS.map((t) => (
            <button
              key={t}
              title={GAP_TAB_INFO[t].tip}
              onClick={() => setTab(t)}
              className={cn("rounded-md border px-3 py-1.5 text-left text-[13px]", tab === t ? "border-brand bg-brand-soft text-brand" : "border-border text-ink-2 hover:border-border-strong")}
            >
              <div className="font-semibold">{GAP_TAB_INFO[t].label}</div>
              <div className="text-[11.5px] tabular opacity-80">{fmtNumber(counts[t])}</div>
            </button>
          ))}
          <p className="ml-auto self-end text-[11.5px] text-ink-3">{GAP_TAB_INFO[tab].tip}</p>
        </div>
        <div className="pt-3">
          <DataTable
            data={rows}
            columns={cols}
            searchText={(r) => r.keyword}
            filters={[
              { id: "include", label: "Include / exclude", type: "include", accessor: (r) => r.keyword },
              { id: "volume", label: "Volume", type: "range", accessor: (r) => r.searchVolume, presets: VOLUME_PRESETS },
              { id: "kd", label: "KD %", type: "range", accessor: (r) => r.keywordDifficulty, presets: KD_PRESETS },
              { id: "intent", label: "Intent", type: "multi", accessor: (r) => r.intent, options: INTENT_OPTIONS },
            ]}
            exportName={`keyword_gap_${d.domains.join("_vs_")}_${tab}`}
            initialSort={[{ id: "searchVolume", desc: true }]}
            countLabel={(n) => `${n.toLocaleString()} keywords in sample`}
          />
        </div>
      </Card>
    </div>
  );
}
