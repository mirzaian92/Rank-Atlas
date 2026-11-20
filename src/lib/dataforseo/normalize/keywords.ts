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

/**
 * Some live SERPs return organic results as Google redirect links (url = google.com/goto?url=…,
 * domain = google.com). The real site is still in `breadcrumb` ("https://www.site.com › blog › …"),
 * so recover the host from it. The exact page URL isn't recoverable; the site origin is used.
 */
export function resolveSerpTarget(it: { url?: string | null; domain?: string | null; breadcrumb?: string | null }): { url: string; domain: string } {
  const url = it.url ?? "";
  const domain = it.domain ?? "";
  const isRedirect = /^https?:\/\/(www\.)?google\.[a-z.]+\/(goto|url)\?/i.test(url);
  if (!isRedirect) return { url, domain };
  const crumb = (it.breadcrumb ?? "").split("›")[0].trim();
  const m = crumb.match(/^(https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})/i);
  if (!m) return { url, domain };
  const host = m[2].toLowerCase();
  return { url: `https://${host}/`, domain: host };
}

export function normalizeSerp(r: DfsSerpResult | null | undefined): SerpResult[] {
  return (r?.items ?? []).map((it, i) => {
    const target = resolveSerpTarget(it);
    return {
    rank: it.rank_absolute ?? i + 1,
    type: it.type,
    title: it.title?.trim() || FEATURE_TITLES[it.type] || it.type.replace(/_/g, " "),
    url: target.url,
    domain: target.domain,
    description: it.description ?? null,
    // Not part of the SERP response; would need an extra Backlinks / Labs call per domain.
    etv: null,
    domainRank: null,
    backlinks: null,
    };
  });
}

/** Count result types on the page, e.g. { organic: 10, people_also_ask: 1 }. */
export function serpFeatureCounts(results: SerpResult[]) {
  const m = new Map<string, number>();
  results.forEach((r) => m.set(r.type, (m.get(r.type) ?? 0) + 1));
  return [...m.entries()].map(([type, count]) => ({ type, count }));
}
