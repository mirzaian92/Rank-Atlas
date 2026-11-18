/** DataForSEO keyword + SERP responses → normalized UI types. Pure functions. */
import type { KeywordMetrics, SerpResult } from "@/lib/reports/types";
import type { DfsKeywordItem, DfsSerpResult } from "../types";
import { intentOf, monthKey, num, numOrNull } from "./common";

export function normalizeKeyword(it: DfsKeywordItem): KeywordMetrics {
  const ki = it.keyword_info;
  const monthly = (ki?.monthly_searches ?? [])
    .filter((m) => m && m.year && m.month)
    .map((m) => ({ date: monthKey(m.year, m.month), searchVolume: num(m.search_volume) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12);
  return {
    keyword: it.keyword,
    searchVolume: num(ki?.search_volume),
    cpc: numOrNull(ki?.cpc),
    competition: numOrNull(ki?.competition),
    keywordDifficulty: numOrNull(it.keyword_properties?.keyword_difficulty),
    intent: intentOf(it.search_intent_info?.main_intent),
    monthlySearches: monthly,
    serpFeatures: (it.serp_info?.serp_item_types ?? []).filter((t) => t !== "organic"),
    resultsCount: numOrNull(it.serp_info?.se_results_count),
    wordCount: it.keyword.trim().split(/\s+/).length,
  };
}

const FEATURE_TITLES: Record<string, string> = {
  people_also_ask: "People also ask",
  related_searches: "Related searches",
  local_pack: "Local pack",
  images: "Images",
  video: "Videos",
  top_stories: "Top stories",
  knowledge_graph: "Knowledge panel",
  featured_snippet: "Featured snippet",
  shopping: "Shopping results",
  paid: "Ad",
};

export function normalizeSerp(r: DfsSerpResult | null | undefined): SerpResult[] {
  return (r?.items ?? []).map((it, i) => ({
    rank: it.rank_absolute ?? i + 1,
    type: it.type,
    title: it.title?.trim() || FEATURE_TITLES[it.type] || it.type.replace(/_/g, " "),
    url: it.url ?? "",
    domain: it.domain ?? "",
    description: it.description ?? null,
    // Not part of the SERP response; would need an extra Backlinks / Labs call per domain.
    etv: null,
    domainRank: null,
    backlinks: null,
  }));
}

/** Count result types on the page, e.g. { organic: 10, people_also_ask: 1 }. */
export function serpFeatureCounts(results: SerpResult[]) {
  const m = new Map<string, number>();
  results.forEach((r) => m.set(r.type, (m.get(r.type) ?? 0) + 1));
  return [...m.entries()].map(([type, count]) => ({ type, count }));
}
