import "server-only";
import type { KeywordDifficultyReport, KeywordOverview } from "@/lib/reports/types";
import { ReportError } from "@/lib/reports/envelope";
import { dfsCall } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { DfsKeywordItem, DfsLabsItemsResult, DfsSerpResult } from "../types";
import { normalizeKeyword, normalizeSerp } from "../normalize/keywords";

export type KeywordTarget = { keyword: string; locationCode: number; languageCode: string };
type LiveResult<T> = { data: T; costUsd: number; cached: boolean; notes: string[]; endpoints: string[] };

const loc = (t: { locationCode: number; languageCode: string }) => ({ location_code: t.locationCode, language_code: t.languageCode });

// Question keywords: suggestions that start with a question word.
// VERIFY: the `regex` operator on `keyword` in keyword_suggestions filters.
import { QUESTION_REGEX } from "@/lib/reports/keyword-query";

/**
 * Keyword Overview — integration #3.
 * Four parallel requests (only keyword_overview is required). Estimated uncached cost ≈ $0.035.
 */
export async function fetchKeywordOverview(t: KeywordTarget): Promise<LiveResult<KeywordOverview>> {
  const tool = "keyword-overview" as const;
  const [overview, variations, questions, serp] = await Promise.allSettled([
    dfsCall<DfsLabsItemsResult<DfsKeywordItem>>("keywordOverview", { keywords: [t.keyword], ...loc(t), include_serp_info: true }, { tool }),
    dfsCall<DfsLabsItemsResult<DfsKeywordItem>>("keywordSuggestions", {
      keyword: t.keyword, ...loc(t), limit: 10, include_serp_info: true, order_by: ["keyword_info.search_volume,desc"],
    }, { tool }),
    dfsCall<DfsLabsItemsResult<DfsKeywordItem>>("keywordSuggestions", {
      keyword: t.keyword, ...loc(t), limit: 10, include_serp_info: true, order_by: ["keyword_info.search_volume,desc"],
      filters: [["keyword", "regex", QUESTION_REGEX]],
    }, { tool }),
    dfsCall<DfsSerpResult>("serpOrganicLiveAdvanced", { keyword: t.keyword, ...loc(t), device: "desktop", depth: 10 }, { tool }),
  ]);
  if (overview.status === "rejected") throw overview.reason;

  const item = overview.value.result[0]?.items?.[0];
  if (!item) throw new ReportError("NOT_FOUND", `No keyword data for "${t.keyword}" in this market.`, 404);

  const notes: string[] = [];
  const fail = (label: string, r: PromiseRejectedResult) => notes.push(`${label} unavailable: ${r.reason instanceof Error ? r.reason.message : "error"}`);
  if (variations.status === "rejected") fail("Keyword variations", variations);
  if (questions.status === "rejected") fail("Questions", questions);
  if (serp.status === "rejected") fail("SERP", serp);
  else notes.push("Domain Rank, backlinks and traffic per SERP result are not included in live SERP data yet.");

  const list = (r: PromiseSettledResult<{ result: DfsLabsItemsResult<DfsKeywordItem>[] }>) =>
    r.status === "fulfilled" ? (r.value.result[0]?.items ?? []).filter((k) => k.keyword !== t.keyword).map(normalizeKeyword) : [];

  const settled = [overview, variations, questions, serp];
  return {
    data: {
      keyword: normalizeKeyword(item),
      variations: list(variations),
      questions: list(questions),
      serp: serp.status === "fulfilled" ? normalizeSerp(serp.value.result[0]) : [],
    },
    costUsd: settled.reduce((s, r) => s + (r.status === "fulfilled" ? r.value.costUsd : 0), 0),
    cached: settled.every((r) => r.status !== "fulfilled" || r.value.cached),
    notes,
    endpoints: [ENDPOINTS.keywordOverview.path, ENDPOINTS.keywordSuggestions.path, ENDPOINTS.serpOrganicLiveAdvanced.path],
  };
}

/**
 * Keyword Difficulty tool: one keyword_overview call for the whole list (≤ 100 keywords here;
 * the API accepts up to 700 — VERIFY). Keywords without data are reported in a note, not invented.
 */
export async function fetchKeywordDifficulty(keywords: string[], t: { locationCode: number; languageCode: string }): Promise<LiveResult<KeywordDifficultyReport>> {
  const r = await dfsCall<DfsLabsItemsResult<DfsKeywordItem>>("keywordOverview", { keywords, ...loc(t), include_serp_info: true }, { tool: "keyword-difficulty" });
  const items = (r.result[0]?.items ?? []).map(normalizeKeyword);
  const found = new Set(items.map((k) => k.keyword.toLowerCase()));
  const missing = keywords.filter((k) => !found.has(k.toLowerCase()));
  // Keep the user's order.
  const order = new Map(keywords.map((k, i) => [k.toLowerCase(), i]));
  items.sort((a, b) => (order.get(a.keyword.toLowerCase()) ?? 0) - (order.get(b.keyword.toLowerCase()) ?? 0));
  return {
    data: { keywords: items },
    costUsd: r.costUsd,
    cached: r.cached,
    notes: missing.length ? [`No data for ${missing.length} keyword${missing.length > 1 ? "s" : ""}: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "…" : ""}`] : [],
    endpoints: [ENDPOINTS.keywordOverview.path],
  };
}
