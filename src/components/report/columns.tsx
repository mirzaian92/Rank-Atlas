"use client";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { KeywordMetrics, RankedKeyword, SearchIntent } from "@/lib/reports/types";
import { IntentBadge, KdCell, PositionCell, SerpFeatureList, UrlCell } from "@/components/data/cells";
import { MiniBars } from "@/components/charts/sparkline";
import type { FilterDef } from "@/components/data/filters";
import { fmtCompact, fmtCurrency, fmtNumber, fmtPercent } from "@/lib/utils";

export function keywordLink(keyword: string, db: string, tool = "/seo/keyword-overview") {
  return `${tool}?${new URLSearchParams({ q: keyword, db })}`;
}

export const INTENT_OPTIONS: { value: SearchIntent; label: string }[] = [
  { value: "informational", label: "Informational" },
  { value: "navigational", label: "Navigational" },
  { value: "commercial", label: "Commercial" },
  { value: "transactional", label: "Transactional" },
];

export const VOLUME_PRESETS = [
  { label: "100,001+", min: 100001 }, { label: "10,001–100,000", min: 10001, max: 100000 },
  { label: "1,001–10,000", min: 1001, max: 10000 }, { label: "101–1,000", min: 101, max: 1000 },
  { label: "11–100", min: 11, max: 100 }, { label: "1–10", min: 1, max: 10 },
];
export const KD_PRESETS = [
  { label: "Very hard 85–100", min: 85, max: 100 }, { label: "Hard 70–84", min: 70, max: 84 },
  { label: "Difficult 50–69", min: 50, max: 69 }, { label: "Possible 30–49", min: 30, max: 49 },
  { label: "Easy 15–29", min: 15, max: 29 }, { label: "Very easy 0–14", min: 0, max: 14 },
];
export const POSITION_PRESETS = [
  { label: "Top 3", min: 1, max: 3 }, { label: "Top 10", min: 1, max: 10 }, { label: "11–20", min: 11, max: 20 },
  { label: "21–50", min: 21, max: 50 }, { label: "51–100", min: 51, max: 100 },
];

/** Columns for keyword-metric tables (Keyword Magic, Overview variations, KD). */
export function keywordMetricColumns(db: string, opts: { trend?: boolean; features?: boolean; isSortable?: (id: string) => boolean } = {}): ColumnDef<KeywordMetrics>[] {
  const cols: ColumnDef<KeywordMetrics>[] = [
    { accessorKey: "keyword", header: "Keyword", cell: ({ getValue }) => <Link className="font-medium text-brand hover:underline" href={keywordLink(getValue<string>(), db)}>{getValue<string>()}</Link> },
    { accessorKey: "intent", header: "Intent", cell: ({ row }) => <IntentBadge intent={row.original.intent} />, meta: { align: "center" }, enableSorting: false },
    { accessorKey: "searchVolume", header: "Volume", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
  ];
  if (opts.trend !== false) {
    cols.push({ id: "trend", header: "Trend", cell: ({ row }) => <MiniBars values={row.original.monthlySearches.map((m) => m.searchVolume)} />, enableSorting: false, meta: { noExport: true } });
  }
  cols.push(
    { accessorKey: "keywordDifficulty", header: "KD %", cell: ({ getValue }) => <KdCell kd={getValue<number | null>()} />, meta: { align: "right" } },
    { accessorKey: "cpc", header: "CPC (USD)", cell: ({ getValue }) => fmtCurrency(getValue<number | null>()), meta: { align: "right" } },
    { accessorKey: "competition", header: "Com.", cell: ({ getValue }) => getValue<number | null>()?.toFixed(2) ?? "—", meta: { align: "right", label: "Paid competition" } },
  );
  if (opts.features !== false) {
    cols.push({ accessorKey: "serpFeatures", header: "SERP features", cell: ({ row }) => <SerpFeatureList features={row.original.serpFeatures} />, enableSorting: false, meta: { exportValue: (r) => r.serpFeatures.join("; ") } });
  }
  cols.push({ accessorKey: "resultsCount", header: "Results", cell: ({ getValue }) => fmtCompact(getValue<number | null>()), meta: { align: "right" } });
  if (!opts.isSortable) return cols;
  return cols.map((c) => {
    const id = (c as { accessorKey?: string }).accessorKey ?? c.id ?? "";
    return opts.isSortable!(id) ? c : { ...c, enableSorting: false };
  });
}

/** `remote: true` drops filters the server can't apply (word count). */
export function keywordMetricFilters(opts: { remote?: boolean } = {}): FilterDef<KeywordMetrics>[] {
  const all: FilterDef<KeywordMetrics>[] = [
    { id: "include", label: "Include / exclude", type: "include", accessor: (r) => r.keyword },
    { id: "volume", label: "Volume", type: "range", accessor: (r) => r.searchVolume, presets: VOLUME_PRESETS },
    { id: "kd", label: "KD %", type: "range", accessor: (r) => r.keywordDifficulty, presets: KD_PRESETS },
    { id: "intent", label: "Intent", type: "multi", accessor: (r) => r.intent, options: INTENT_OPTIONS },
    { id: "cpc", label: "CPC", type: "range", accessor: (r) => r.cpc },
    { id: "words", label: "Word count", type: "range", accessor: (r) => r.wordCount },
  ];
  return opts.remote ? all.filter((f) => f.id !== "words") : all;
}

/** Columns for ranked-keyword tables (Organic Research). */
export function rankedKeywordColumns(db: string, opts: { isSortable?: (columnId: string) => boolean } = {}): ColumnDef<RankedKeyword>[] {
  const cols: ColumnDef<RankedKeyword>[] = [
    { accessorKey: "keyword", header: "Keyword", cell: ({ getValue }) => <Link className="font-medium text-brand hover:underline" href={keywordLink(getValue<string>(), db)}>{getValue<string>()}</Link> },
    { accessorKey: "intent", header: "Intent", cell: ({ row }) => <IntentBadge intent={row.original.intent} />, meta: { align: "center" }, enableSorting: false },
    { accessorKey: "position", header: "Position", cell: ({ row }) => <PositionCell position={row.original.position} previous={row.original.previousPosition} isNew={row.original.isNew} />, meta: { align: "right" } },
    { accessorKey: "previousPosition", header: "Prev.", cell: ({ getValue }) => getValue<number | null>() ?? "—", meta: { align: "right", label: "Previous position" } },
    { accessorKey: "serpFeatures", header: "SERP features", cell: ({ row }) => <SerpFeatureList features={row.original.serpFeatures} />, enableSorting: false, meta: { exportValue: (r) => r.serpFeatures.join("; ") } },
    { accessorKey: "etv", header: "Traffic (est.)", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
    { accessorKey: "trafficShare", header: "Traffic %", cell: ({ getValue }) => fmtPercent(getValue<number>(), 2), meta: { align: "right" } },
    { accessorKey: "searchVolume", header: "Volume", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
    { accessorKey: "keywordDifficulty", header: "KD %", cell: ({ getValue }) => <KdCell kd={getValue<number | null>()} />, meta: { align: "right" } },
    { accessorKey: "cpc", header: "CPC (USD)", cell: ({ getValue }) => fmtCurrency(getValue<number | null>()), meta: { align: "right" } },
    { accessorKey: "url", header: "URL", cell: ({ getValue }) => <UrlCell url={getValue<string>()} max={36} /> },
    { accessorKey: "lastUpdated", header: "Updated", cell: ({ getValue }) => { const v = getValue<string | null>(); return v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"; }, meta: { align: "right" } },
  ];
  // In remote mode only columns the server can order by are sortable.
  if (!opts.isSortable) return cols;
  return cols.map((c) => {
    const id = (c as { accessorKey?: string }).accessorKey ?? c.id ?? "";
    return opts.isSortable!(id) ? c : { ...c, enableSorting: false };
  });
}

export function rankedKeywordFilters(): FilterDef<RankedKeyword>[] {
  return [
    { id: "include", label: "Include / exclude", type: "include", accessor: (r) => r.keyword },
    { id: "position", label: "Positions", type: "range", accessor: (r) => r.position, presets: POSITION_PRESETS },
    { id: "volume", label: "Volume", type: "range", accessor: (r) => r.searchVolume, presets: VOLUME_PRESETS },
    { id: "kd", label: "KD %", type: "range", accessor: (r) => r.keywordDifficulty, presets: KD_PRESETS },
    { id: "intent", label: "Intent", type: "multi", accessor: (r) => r.intent, options: INTENT_OPTIONS },
    { id: "cpc", label: "CPC", type: "range", accessor: (r) => r.cpc },
    {
      id: "serp", label: "SERP features", type: "multi", accessor: (r) => r.serpFeatures,
      options: ["featured_snippet", "people_also_ask", "images", "video", "local_pack", "top_stories", "knowledge_graph", "sitelinks", "shopping"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })),
    },
  ];
}
