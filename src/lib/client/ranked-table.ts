"use client";
import type { RemoteState } from "@/components/data/data-table";
import type { RangeValue } from "@/components/data/filters";
import { RANKED_SORTS, rankedQueryToParams, type RankedSort } from "@/lib/reports/ranked-query";

/** Column ids that sort to a different server field. */
const SORT_ALIASES: Record<string, RankedSort> = { trafficShare: "etv" };

export function isRemoteSortable(columnId: string): boolean {
  return (RANKED_SORTS as readonly string[]).includes(columnId) || columnId in SORT_ALIASES;
}

/**
 * DataTable remote state → /api/reports/organic-research?view=keywords params.
 * Filter ids must match rankedKeywordFilters() in components/report/columns.tsx.
 */
export function rankedParamsFromTable(s: RemoteState): Record<string, string | undefined> {
  const f = s.filters;
  const range = (id: string) => (f[id] as RangeValue | undefined) ?? {};
  const words = (v: string | undefined) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const incl = f.include as { include?: string; exclude?: string } | undefined;
  const sortCol = s.sorting[0];
  const sort = sortCol ? SORT_ALIASES[sortCol.id] ?? (RANKED_SORTS.includes(sortCol.id as RankedSort) ? (sortCol.id as RankedSort) : "etv") : "etv";
  return rankedQueryToParams({
    page: s.pageIndex + 1,
    size: s.pageSize,
    sort,
    dir: sortCol ? (sortCol.desc ? "desc" : "asc") : "desc",
    inc: [...(s.search ? [s.search] : []), ...words(incl?.include)].slice(0, 3),
    exc: words(incl?.exclude).slice(0, 3),
    posMin: range("position").min, posMax: range("position").max,
    volMin: range("volume").min, volMax: range("volume").max,
    kdMin: range("kd").min, kdMax: range("kd").max,
    cpcMin: range("cpc").min, cpcMax: range("cpc").max,
    intent: (f.intent as string[] | undefined) ?? [],
    serp: (f.serp as string[] | undefined) ?? [],
  });
}
