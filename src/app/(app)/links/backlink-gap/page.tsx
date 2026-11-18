"use client";
import { Suspense, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { BacklinkGap } from "@/lib/reports/types";
import { ReportView } from "@/components/report/report-view";
import { MultiDomainForm } from "@/components/report/multi-domain-form";
import { DataTable } from "@/components/data/data-table";
import { SERIES } from "@/components/charts/palette";
import { Card } from "@/components/ui/card";
import { useSearchState } from "@/lib/client/use-search-state";
import { cn, fmtNumber } from "@/lib/utils";

type Row = BacklinkGap["rows"][number];
const CATS = [
  { id: "all", label: "All", tip: "All referring domains" },
  { id: "best", label: "Best", tip: "Link to all competitors but not to you" },
  { id: "weak", label: "Weak", tip: "Link to some competitors but not to you" },
  { id: "shared", label: "Shared", tip: "Link to everyone" },
  { id: "unique", label: "Unique", tip: "Link to you but not to every competitor" },
] as const;

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  const { q, setParams, get } = useSearchState();
  const cat = get("cat") ?? "best";
  const form = <MultiDomainForm value={q} onSubmit={(v) => setParams({ q: v })} />;
  return (
    <ReportView<BacklinkGap> tool="backlink-gap" landing={form} above={form} isEmpty={(d) => d.rows.length === 0}>
      {(d) => <Body d={d} cat={cat} setCat={(c) => setParams({ cat: c }, { replace: true })} />}
    </ReportView>
  );
}

function Body({ d, cat, setCat }: { d: BacklinkGap; cat: string; setCat: (c: string) => void }) {
  const cols = useMemo<ColumnDef<Row>[]>(() => [
    { accessorKey: "domain", header: "Referring domain", cell: ({ getValue }) => <span className="font-medium text-brand">{getValue<string>()}</span> },
    { accessorKey: "domainRank", header: "Domain Rank", cell: ({ getValue }) => getValue<number | null>() ?? "—", meta: { align: "right" } },
    ...d.domains.map((dom, i): ColumnDef<Row> => ({
      id: `bl${i}`, accessorFn: (r) => r.backlinks[i] ?? 0,
      header: () => <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: SERIES[i] }} />{dom}</span>,
      cell: ({ row }) => (row.original.backlinks[i] != null ? fmtNumber(row.original.backlinks[i]) : <span className="text-ink-3">—</span>),
      meta: { align: "right", label: `${dom} backlinks`, exportValue: (r) => r.backlinks[i] },
    })),
  ], [d.domains]);
  const rows = cat === "all" ? d.rows : d.rows.filter((r) => r.category === cat);
  return (
    <Card className="pt-3">
      <div className="flex flex-wrap gap-1 border-b border-border px-5 pb-3">
        {CATS.map((c) => (
          <button key={c.id} title={c.tip} onClick={() => setCat(c.id)} className={cn("rounded-md border px-3 py-1.5 text-left text-[13px]", cat === c.id ? "border-brand bg-brand-soft text-brand" : "border-border text-ink-2 hover:border-border-strong")}>
            <div className="font-semibold">{c.label}</div>
            <div className="text-[11.5px] tabular opacity-80">{fmtNumber(c.id === "all" ? d.rows.length : d.rows.filter((r) => r.category === c.id).length)}</div>
          </button>
        ))}
      </div>
      <div className="pt-3">
        <DataTable data={rows} columns={cols} searchText={(r) => r.domain} filters={[{ id: "dr", label: "Domain Rank", type: "range", accessor: (r) => r.domainRank }]} exportName={`backlink_gap_${cat}`} initialSort={[{ id: "domainRank", desc: true }]} countLabel={(n) => `${n} referring domains`} />
      </div>
    </Card>
  );
}
