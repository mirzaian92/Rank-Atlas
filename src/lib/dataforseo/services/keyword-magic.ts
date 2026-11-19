import "server-only";
import type { KeywordMagicPage } from "@/lib/reports/types";
import { wordGroups, type KeywordQuery } from "@/lib/reports/keyword-query";
import { ReportError } from "@/lib/reports/envelope";
import { dfsCall } from "../client";
import { ENDPOINTS, type EndpointKey } from "../endpoints";
import type { DfsKeywordItem, DfsLabsItemsResult, DfsRelatedKeywordItem } from "../types";
import { normalizeKeyword } from "../normalize/keywords";
import { FilterLimitError, keywordQueryToDfs } from "../filters";

/**
 * Keyword Magic Tool — integration #4. One request per table page.
 *
 *   broad     keyword_suggestions   (seed words in any order — exact_match: false)
 *   phrase    keyword_suggestions   (exact_match: true)
 *   questions keyword_suggestions   + regex filter on question words
 *   related   related_keywords      (depth 2; items nested under keyword_data)
 *   ideas     keyword_ideas         (keywords: [seed])
 *
 * VERIFY: `exact_match` semantics on keyword_suggestions; related_keywords `depth` + offset paging;
 * keyword_ideas accepting order_by / filters on these fields.
 */
export async function fetchKeywordMagic(
  seed: string,
  t: { locationCode: number; languageCode: string },
  q: KeywordQuery,
): Promise<{ data: KeywordMagicPage; costUsd: number; cached: boolean; notes: string[]; endpoints: string[] }> {
  const related = q.mode === "related";
  let dfs: ReturnType<typeof keywordQueryToDfs>;
  try {
    dfs = keywordQueryToDfs(q, related ? "keyword_data." : "");
  } catch (e) {
    if (e instanceof FilterLimitError) throw new ReportError("VALIDATION_ERROR", e.message, 400);
    throw e;
  }
  const loc = { location_code: t.locationCode, language_code: t.languageCode };
  const common = { ...loc, include_serp_info: true, ...dfs };

  let key: EndpointKey;
  let payload: Record<string, unknown>;
  if (related) {
    key = "relatedKeywords";
    payload = { keyword: seed, depth: 2, ...common };
  } else if (q.mode === "ideas") {
    key = "keywordIdeas";
    payload = { keywords: [seed], ...common };
  } else {
    key = "keywordSuggestions";
    payload = { keyword: seed, exact_match: q.mode === "phrase", ...common };
  }

  const tool = "keyword-magic-tool" as const;
  let total = 0;
  let rows;
  let costUsd = 0;
  let cached = false;
  if (related) {
    const r = await dfsCall<DfsLabsItemsResult<DfsRelatedKeywordItem>>(key, payload, { tool });
    total = r.result[0]?.total_count ?? 0;
    rows = (r.result[0]?.items ?? []).map((it) => normalizeKeyword(it.keyword_data));
    costUsd = r.costUsd;
    cached = r.cached;
  } else {
    const r = await dfsCall<DfsLabsItemsResult<DfsKeywordItem>>(key, payload, { tool });
    total = r.result[0]?.total_count ?? 0;
    rows = (r.result[0]?.items ?? []).map(normalizeKeyword);
    costUsd = r.costUsd;
    cached = r.cached;
  }

  return {
    data: { seed, mode: q.mode, total, page: q.page, size: q.size, rows, groups: wordGroups(rows, seed) },
    costUsd,
    cached,
    notes: [],
    endpoints: [ENDPOINTS[key].path],
  };
}
