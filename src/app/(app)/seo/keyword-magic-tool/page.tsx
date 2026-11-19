"use client";
import { Suspense, useMemo, useState } from "react";
import type { KeywordMagicPage } from "@/lib/reports/types";
import { MAGIC_MODES, type MagicMode } from "@/lib/reports/keyword-query";
import { PAGE_SIZES } from "@/lib/reports/ranked-query";
import { getTool } from "@/lib/config/tools";
import { PageHeader } from "@/components/report/report-view";
import { ToolLanding } from "@/components/report/tool-landing";
import { MetricCard } from "@/components/report/metric-card";
import { SourceBadge } from "@/components/report/source-badge";
import { keywordMetricColumns, keywordMetricFilters } from "@/components/report/columns";
import { DataTable, type RemoteState } from "@/components/data/data-table";
import { DashboardSkeleton, ErrorState } from "@/components/states/states";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/tabs";
import { Hint } from "@/components/ui/tooltip";
import { useReport } from "@/lib/client/use-report";
import { useSearchState } from "@/lib/client/use-search-state";
import { isKeywordSortable, keywordParamsFromTable } from "@/lib/client/ranked-table";
import { cn, fmtCompact, fmtCurrency, fmtNumber } from "@/lib/utils";

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

const MODE_LABEL: Record<MagicMode, { label: string; tip: string }> = {
  broad: { label: "Broad match", tip: "Keywords containing the seed's words in any order" },
  phrase: { label: "Phrase match", tip: "Keywords containing the exact seed phrase" },
  related: { label: "Related", tip: "Semantically related searches (from Google's 'related searches')" },
  questions: { label: "Questions", tip: "Question-form keywords containing the seed" },
  ideas: { label: "Ideas", tip: "Keywords from the same topic category" },
};

function Inner() {
  const { q, get, setParams, market, language } = useSearchState();
  const mode = (MAGIC_MODES as readonly string[]).includes(get("mode") ?? "") ? (get("mode") as MagicMode) : "broad";
  const tool = getTool("keyword-magic-tool");
  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <PageHeader
        title={tool.label}
        subject={q || undefined}
        market={`${market.flag} ${market.country} · ${language.name}`}
        description={!q ? tool.description : undefined}
        actions={
          q ? (
            <Segmented
              value={mode}
              onChange={(v) => setParams({ mode: v === "broad" ? null : v }, { replace: true })}
              options={MAGIC_MODES.map((m) => ({ value: m, label: <Hint content={MODE_LABEL[m].tip}><span>{MODE_LABEL[m].label}</span></Hint> }))}
            />
          ) : null
        }
      />
      {!q ? <ToolLanding tool={tool} /> : <Results key={`${q}|${market.id}|${language.code}|${mode}`} mode={mode} />}
    </div>
  );
}

const DEFAULT_STATE: RemoteState = { pageIndex: 0, pageSize: 50, sorting: [{ id: "searchVolume", desc: true }], filters: {}, search: "" };

function Results({ mode }: { mode: MagicMode }) {
  const { baseParams, market } = useSearchState();
  const [state, setState] = useState<RemoteState>(DEFAULT_STATE);
  const params = useMemo(() => ({ ...baseParams, mode, ...keywordParamsFromTable(state) }), [baseParams, mode, state]);
  const query = useReport<KeywordMagicPage>("keyword-magic-tool", params, true, { keepPrevious: true });
  const columns = useMemo(() => keywordMetricColumns(market.id, { isSortable: isKeywordSortable }), [market.id]);
  const filters = useMemo(() => keywordMetricFilters({ remote: true }), []);

  if (query.isPending) return <DashboardSkeleton />;
  if (query.isError && !query.data) return <ErrorState code={query.error.code} message={query.error.message} onRetry={() => query.refetch()} />;

  const { data: d, meta } = query.data!;
  const mock = meta.source === "mock";
  const activeGroup = (state.filters.include as { include?: string } | undefined)?.include ?? null;
  const setGroup = (term: string | null) =>
    setState((s) => ({ ...s, pageIndex: 0, filters: { ...s.filters, include: term ? { include: term } : undefined } }));
  const avgKd = d.rows.length ? Math.round(d.rows.reduce((a, b) => a + (b.keywordDifficulty ?? 0), 0) / d.rows.filter((r) => r.keywordDifficulty != null).length || 0) : null;

  return (
    <div className="space-y-4">
      {meta.notes && meta.notes.length > 0 && <ul className="text-[12px] text-ink-3">{meta.notes.map((n) => <li key={n}>• {n}</li>)}</ul>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard mock={mock} label="Keywords found" value={fmtNumber(d.total)} sub={`${MODE_LABEL[mode].label}${activeGroup ? ` · containing “${activeGroup}”` : ""}`} info="Total matching keywords reported by the provider for this mode and these filters." />
        <MetricCard mock={mock} label="Volume on this page" value={fmtCompact(d.rows.reduce((a, b) => a + b.searchVolume, 0))} sub={`${d.rows.length} keywords shown`} info="Sum of monthly search volume for the keywords on the current page only." />
        <MetricCard mock={mock} label="Avg. KD on this page" value={avgKd != null ? `${avgKd}%` : "—"} />
        <MetricCard mock={mock} label="Avg. CPC on this page" value={fmtCurrency(d.rows.length ? d.rows.reduce((a, b) => a + (b.cpc ?? 0), 0) / Math.max(1, d.rows.filter((r) => r.cpc != null).length) : null)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="h-fit p-2">
          <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Groups</div>
          <p className="px-2 pb-2 text-[11px] leading-snug text-ink-3">Common words in the keywords on this page. Click to filter all results.</p>
          <button onClick={() => setGroup(null)} className={cn("flex w-full justify-between rounded px-2 py-1.5 text-[13px]", !activeGroup ? "bg-brand-soft font-medium text-brand" : "hover:bg-page")}>
            All keywords <span className="tabular">{fmtNumber(d.total)}</span>
          </button>
          {activeGroup && !d.groups.some((g) => g.term === activeGroup) && (
            <button onClick={() => setGroup(null)} className="flex w-full justify-between rounded bg-brand-soft px-2 py-1.5 text-[13px] font-medium text-brand">
              <span className="truncate">{activeGroup}</span><span>×</span>
            </button>
          )}
          <div className="max-h-[560px] overflow-y-auto">
            {d.groups.map((g) => (
              <button key={g.term} onClick={() => setGroup(activeGroup === g.term ? null : g.term)} className={cn("flex w-full justify-between rounded px-2 py-1.5 text-[13px]", activeGroup === g.term ? "bg-brand-soft font-medium text-brand" : "text-ink-2 hover:bg-page")}>
                <span className="truncate">{g.term}</span>
                <span className="text-ink-3 tabular">{g.count}</span>
              </button>
            ))}
            {d.groups.length === 0 && <p className="px-2 py-2 text-[12px] text-ink-3">No repeated words on this page.</p>}
          </div>
        </Card>
        <Card className="min-w-0 pt-4">
          {query.isError && <p className="mx-5 mb-3 rounded-md bg-[#fbe5e5] px-3 py-2 text-[13px] text-[#a12424]" role="alert">{query.error.message}</p>}
          <DataTable
            data={d.rows}
            columns={columns}
            filters={filters}
            searchText={(r) => r.keyword}
            searchPlaceholder="Keyword contains…"
            exportName={`${d.seed}_${mode}_keywords_p${state.pageIndex + 1}`}
            toolbar={
              <span className="flex items-center gap-2 text-[11.5px] text-ink-3">
                <SourceBadge source={meta.source} />
                {meta.source !== "mock" && <span>page cost {fmtCurrency(meta.costUsd, 4)}</span>}
              </span>
            }
            remote={{ total: d.total, state, onChange: setState, fetching: query.isFetching, pageSizes: PAGE_SIZES }}
            countLabel={(n) => `${n.toLocaleString()} keywords`}
            emptyDescription="No keywords match these filters."
          />
        </Card>
      </div>
    </div>
  );
}
