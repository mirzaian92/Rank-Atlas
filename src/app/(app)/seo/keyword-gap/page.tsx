"use client";
import { Suspense, useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { KeywordGap, KeywordGapRow } from "@/lib/reports/types";
import { ReportView } from "@/components/report/report-view";
import { MultiDomainForm } from "@/components/report/multi-domain-form";
import { MetricCard } from "@/components/report/metric-card";
import { INTENT_OPTIONS, KD_PRESETS, VOLUME_PRESETS, keywordLink } from "@/components/report/columns";
import { DataTable } from "@/components/data/data-table";
import { IntentBadge, KdCell } from "@/components/data/cells";
import { SERIES } from "@/components/charts/palette";
import { Card } from "@/components/ui/card";
import { useSearchState } from "@/lib/client/use-search-state";
import { cn, fmtCurrency, fmtNumber } from "@/lib/utils";

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

const CATS: { id: KeywordGapRow["category"] | "all"; label: string; tip: string }[] = [
  { id: "all", label: "All", tip: "Every keyword any domain ranks for" },
  { id: "shared", label: "Shared", tip: "All domains rank" },
  { id: "missing", label: "Missing", tip: "All competitors rank, you don't" },
  { id: "weak", label: "Weak", tip: "You rank lower than every competitor" },
  { id: "strong", label: "Strong", tip: "You rank higher than every competitor" },
  { id: "untapped", label: "Untapped", tip: "At least one competitor ranks, you don't" },
  { id: "unique", label: "Unique", tip: "Only one domain ranks" },
];

function Inner() {
  const { q, setParams, get, market } = useSearchState();
  const cat = (get("cat") ?? "all") as (typeof CATS)[number]["id"];
  const form = <MultiDomainForm value={q} onSubmit={(v) => setParams({ q: v })} />;
  return (
    <ReportView<KeywordGap> tool="keyword-gap" landing={form} above={form} isEmpty={(d) => d.rows.length === 0}>
      {(d, meta) => <GapBody d={d} mock={meta.source === "mock"} cat={cat} setCat={(c) => setParams({ cat: c === "all" ? null : c }, { replace: true })} db={market.id} />}
    </ReportView>
  );
}

function GapBody({ d, mock, cat, setCat, db }: { d: KeywordGap; mock: boolean; cat: string; setCat: (c: string) => void; db: string }) {
  const rows = cat === "all" ? d.rows : d.rows.filter((r) => r.category === cat);
  const cols = useMemo<ColumnDef<KeywordGapRow>[]>(() => [
    { accessorKey: "keyword", header: "Keyword", cell: ({ getValue }) => <Link className="font-medium text-brand hover:underline" href={keywordLink(getValue<string>(), db)}>{getValue<string>()}</Link> },
    ...d.domains.map((dom, i): ColumnDef<KeywordGapRow> => ({
      id: `pos${i}`,
      accessorFn: (r) => r.positions[i] ?? 101,
      header: () => <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: SERIES[i] }} />{dom}</span>,
      cell: ({ row }) => row.original.positions[i] ?? <span className="text-ink-3">—</span>,
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
          <MetricCard key={t.domain} mock={mock} accent={SERIES[i]} label={t.domain} value={fmtNumber(t.keywords)} sub="ranking keywords (sample)" />
        ))}
        <MetricCard mock={mock} label="Shared by all" value={fmtNumber(d.overlap.shared)} sub={`${fmtNumber(d.overlap.uniqueToOthers)} you don't rank for`} />
      </div>
      <Card className="pt-3">
        <div className="flex flex-wrap gap-1 border-b border-border px-5 pb-3">
          {CATS.map((c) => {
            const n = c.id === "all" ? d.rows.length : d.rows.filter((r) => r.category === c.id).length;
            return (
              <button key={c.id} title={c.tip} onClick={() => setCat(c.id)} className={cn("rounded-md border px-3 py-1.5 text-left text-[13px]", cat === c.id ? "border-brand bg-brand-soft text-brand" : "border-border text-ink-2 hover:border-border-strong")}>
                <div className="font-semibold">{c.label}</div>
                <div className="text-[11.5px] tabular opacity-80">{fmtNumber(n)}</div>
              </button>
            );
          })}
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
            exportName={`keyword_gap_${d.domains.join("_vs_")}_${cat}`}
            initialSort={[{ id: "searchVolume", desc: true }]}
            countLabel={(n) => `${n.toLocaleString()} keywords`}
          />
        </div>
      </Card>
    </div>
  );
}
