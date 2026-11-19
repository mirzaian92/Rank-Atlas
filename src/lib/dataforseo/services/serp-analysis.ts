import "server-only";
import type { SerpAnalysis } from "@/lib/reports/types";
import { dfsCall } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { DfsBacklinksItemsResult, DfsBulkRankItem, DfsSerpResult } from "../types";
import { normalizeSerp, serpFeatureCounts } from "../normalize/keywords";
import { dfsDate } from "../normalize/backlinks";

/**
 * SERP Analysis — integration #13.
 *   serp/google/organic/live/advanced (device, depth) → results + feature counts
 *   optional backlinks/bulk_ranks for the ranking domains → Domain Rank column
 * `fresh` bypasses the 12 h cache (one new paid request).
 */
export async function fetchSerpAnalysis(
  keyword: string,
  t: { locationCode: number; languageCode: string },
  o: { device: "desktop" | "mobile"; depth: number; enrich: boolean; fresh: boolean },
) {
  const tool = "serp-analysis" as const;
  const serp = await dfsCall<DfsSerpResult>("serpOrganicLiveAdvanced", {
    keyword, location_code: t.locationCode, language_code: t.languageCode, device: o.device, depth: o.depth,
  }, { tool, bypassCache: o.fresh });
  const raw = serp.result[0];
  const results = normalizeSerp(raw);
  const notes: string[] = [];
  let costUsd = serp.costUsd;
  let cached = serp.cached;

  if (o.enrich) {
    const domains = [...new Set(results.map((r) => r.domain).filter(Boolean))];
    if (domains.length) {
      try {
        const ranks = await dfsCall<DfsBacklinksItemsResult<DfsBulkRankItem>>("backlinksBulkRanks", { targets: domains, rank_scale: "one_hundred" }, { tool });
        const byDomain = new Map((ranks.result[0]?.items ?? []).map((i) => [i.target.toLowerCase(), i.rank]));
        for (const r of results) if (r.domain) r.domainRank = byDomain.get(r.domain.toLowerCase()) ?? null;
        costUsd += ranks.costUsd;
        cached &&= ranks.cached;
      } catch (e) {
        notes.push(`Domain Rank unavailable: ${e instanceof Error ? e.message : "error"}`);
      }
    }
  } else {
    notes.push("Domain Rank per result is off — enable it above (one extra request).");
  }

  const checkedAt = dfsDate(raw?.datetime) ?? new Date().toISOString();
  if (cached) {
    const mins = Math.max(0, Math.round((Date.now() - new Date(checkedAt).getTime()) / 60000));
    const age = mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`;
    notes.push(`Google checked ${age} ago (cached up to 12 hours). Use “Re-check now” for a fresh result.`);
  }

  const data: SerpAnalysis = {
    keyword,
    device: o.device,
    checkedAt,
    resultsCount: raw?.se_results_count ?? null,
    features: serpFeatureCounts(results),
    results,
  };
  return { data, costUsd, cached, notes, endpoints: [ENDPOINTS.serpOrganicLiveAdvanced.path, ...(o.enrich ? [ENDPOINTS.backlinksBulkRanks.path] : [])] };
}
