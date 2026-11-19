"use client";
import { Suspense, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { BacklinkGapPage, BacklinkGapTab } from "@/lib/reports/types";
import { BL_GAP_TABS, BL_GAP_TAB_INFO } from "@/lib/reports/backlink-query";
import { PAGE_SIZES } from "@/lib/reports/ranked-query";
import { getTool } from "@/lib/config/tools";
import { PageHeader } from "@/components/report/report-view";
import { MultiDomainForm } from "@/components/report/multi-domain-form";
import { SourceBadge } from "@/components/report/source-badge";
import { DataTable, type RemoteState } from "@/components/data/data-table";
import type { FilterDef, RangeValue } from "@/components/data/filters";
import { SERIES } from "@/components/charts/palette";
import { ErrorState, TableSkeleton } from "@/components/states/states";
import { Card } from "@/components/ui/card";
import { useReport } from "@/lib/client/use-report";
import { useSearchState } from "@/lib/client/use-search-state";
import { cn, fmtCurrency, fmtNumber } from "@/lib/utils";

type Row = BacklinkGapPage["rows"][number];

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  const { q, setParams, get, market, language } = useSearchState();
  const tool = getTool("backlink-gap");
  const tab = (BL_GAP_TABS as readonly string[]).includes(get("tab") ?? "") ? (get("tab") as BacklinkGapTab) : "best";
  const domains = q ? q.split(",") : [];
  const form = <MultiDomainForm value={q} onSubmit={(v) => setParams({ q: v, tab: null })} />;
  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <PageHeader
        title={tool.label}
        subject={q ? domains.join(" vs ") : undefined}
        market={`${market.flag} ${market.country} · ${language.name}`}
        description={!q ? tool.description : undefined}
      />
      {form}
      {q && (
        <Card className="pt-3">
          <div className="flex flex-wrap items-end gap-1 border-b border-border px-5 pb-3">
            {BL_GAP_TABS.map((t) => (
              <button
                key={t}
                title={BL_GAP_TAB_INFO[t].tip}
                onClick={() => setParams({ tab: t === "best" ? null : t }, { replace: true })}
                className={cn("rounded-md border px-3 py-1.5 text-left text-[13px] font-semibold", tab === t ? "border-brand bg-brand-soft text-brand" : "border-border text-ink-2 hover:border-border-strong")}
              >
                {BL_GAP_TAB_INFO[t].label}
              </button>
            ))}
            <p className="ml-auto text-[11.5px] text-ink-3">{BL_GAP_TAB_INFO[tab].tip}. Each tab loads on demand (one request per page).</p>
          </div>
          <GapTable key={`${q}|${tab}`} tab={tab} domains={domains} />
        </Card>
      )}
    </div>
  );
}

const FILTERS: FilterDef<Row>[] = [
  { id: "dr", label: "Min. Domain Rank", type: "range", accessor: () => null, presets: [{ label: "50+", min: 50 }, { label: "30+", min: 30 }, { label: "10+", min: 10 }] },
];

function GapTable({ tab, domains }: { tab: BacklinkGapTab; domains: string[] }) {
  const { baseParams } = useSearchState();
  const [state, setState] = useState<RemoteState>({ pageIndex: 0, pageSize: 50, sorting: [], filters: {}, search: "" });
  const params = useMemo(() => {
    const dr = (state.filters.dr as RangeValue | undefined)?.min;
    return { ...baseParams, tab, page: String(state.pageIndex + 1), size: String(state.pageSize), ...(dr !== undefined ? { drMin: String(dr) } : {}) };
  }, [baseParams, tab, state]);
  const query = useReport<BacklinkGapPage>("backlink-gap", params, true, { keepPrevious: true });

  const cols = useMemo<ColumnDef<Row>[]>(() => [
    { accessorKey: "domain", header: "Referring domain", enableSorting: false, cell: ({ getValue }) => <span className="font-medium text-brand">{getValue<string>()}</span> },
    { accessorKey: "domainRank", header: "Domain Rank ↓", enableSorting: false, cell: ({ getValue }) => getValue<number | null>() ?? "—", meta: { align: "right", label: "Domain Rank" } },
    ...domains.map((dom, i): ColumnDef<Row> => ({
      id: `bl${i}`,
      accessorFn: (r) => r.backlinks[i] ?? 0,
      enableSorting: false,
      header: () => <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: SERIES[i] }} />{i === 0 ? `${dom} (you)` : dom}</span>,
      cell: ({ row }) => (row.original.backlinks[i] ? fmtNumber(row.original.backlinks[i]) : <span className="text-ink-3">—</span>),
      meta: { align: "right", label: `${dom} backlinks`, exportValue: (r) => r.backlinks[i] ?? 0 },
    })),
  ], [domains]);

  if (query.isPending) return <TableSkeleton rows={10} />;
  if (query.isError && !query.data) return <div className="p-4"><ErrorState code={query.error.code} message={query.error.message} onRetry={() => query.refetch()} /></div>;
  const { data: d, meta } = query.data!;
  return (
    <div className="pt-3">
      {query.isError && <p className="mx-5 mb-3 rounded-md bg-[#fbe5e5] px-3 py-2 text-[13px] text-[#a12424]" role="alert">{query.error.message}</p>}
      <DataTable
        data={d.rows}
        columns={cols}
        filters={FILTERS}
        exportName={`backlink_gap_${domains.join("_vs_")}_${tab}_p${state.pageIndex + 1}`}
        toolbar={
          <span className="flex items-center gap-2 text-[11.5px] text-ink-3">
            <SourceBadge source={meta.source} />
            {meta.source !== "mock" && <span>page cost {fmtCurrency(meta.costUsd, 4)}</span>}
          </span>
        }
        remote={{ total: d.total, state, onChange: setState, fetching: query.isFetching, pageSizes: PAGE_SIZES }}
        countLabel={(n) => `${n.toLocaleString()} referring domains · sorted by Domain Rank`}
        emptyTitle="No referring domains in this tab"
      />
    </div>
  );
}
