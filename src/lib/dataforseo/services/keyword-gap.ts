import "server-only";
import type { KeywordGap } from "@/lib/reports/types";
import { mergeGap, type GapKeyword, type PairwiseLists } from "@/lib/reports/keyword-gap";
import { dfsCall } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { DfsDomainIntersectionItem, DfsLabsItemsResult } from "../types";
import { intentOf, num, numOrNull } from "../normalize/common";
import { getRankOverview } from "./labs-common";

/**
 * Keyword Gap — integration #6.
 * For each competitor: three domain_intersection requests (shared / competitor-only / you-only),
 * each capped at `sample` rows by search volume; plus domain_rank_overview per domain for totals.
 * Requests: 3 × competitors + domains. See estimateGapCost() for the pre-flight estimate.
 */
export async function fetchKeywordGap(domains: string[], t: { locationCode: number; languageCode: string }, sample: number) {
  const tool = "keyword-gap" as const;
  const base = { location_code: t.locationCode, language_code: t.languageCode, limit: sample, item_types: ["organic"], order_by: ["keyword_data.keyword_info.search_volume,desc"] };
  const you = domains[0];

  const intersect = (target1: string, target2: string, intersections: boolean) =>
    dfsCall<DfsLabsItemsResult<DfsDomainIntersectionItem>>("domainIntersection", { ...base, target1, target2, intersections }, { tool });

  const toKw = (it: DfsDomainIntersectionItem): GapKeyword => ({
    keyword: it.keyword_data.keyword,
    searchVolume: num(it.keyword_data.keyword_info?.search_volume),
    cpc: numOrNull(it.keyword_data.keyword_info?.cpc),
    keywordDifficulty: numOrNull(it.keyword_data.keyword_properties?.keyword_difficulty),
    intent: intentOf(it.keyword_data.search_intent_info?.main_intent),
  });
  const pos = (e: DfsDomainIntersectionItem["first_domain_serp_element"]) => e?.rank_group ?? null;

  const notes: string[] = [];
  let costUsd = 0;
  let allCached = true;
  const track = <T extends { costUsd: number; cached: boolean }>(r: PromiseSettledResult<T>, label: string): T | null => {
    if (r.status === "fulfilled") {
      costUsd += r.value.costUsd;
      allCached &&= r.value.cached;
      return r.value;
    }
    notes.push(`${label}: ${r.reason instanceof Error ? r.reason.message : "request failed"}`);
    return null;
  };

  const competitorJobs = domains.slice(1).map(async (comp, idx): Promise<PairwiseLists | null> => {
    const [shared, onlyComp, onlyYou] = await Promise.allSettled([intersect(you, comp, true), intersect(comp, you, false), intersect(you, comp, false)]);
    const s = track(shared, `Shared keywords with ${comp}`);
    const c = track(onlyComp, `Keywords only ${comp} ranks for`);
    const y = track(onlyYou, `Keywords only you rank for (vs ${comp})`);
    if (!s && !c && !y) return null;
    const items = (r: typeof s) => r?.result[0]?.items ?? [];
    return {
      competitor: idx + 1,
      // target1 is always the first domain in each request.
      shared: items(s).flatMap((it) => { const a = pos(it.first_domain_serp_element), b = pos(it.second_domain_serp_element); return a != null && b != null ? [{ kw: toKw(it), you: a, them: b }] : []; }),
      onlyComp: items(c).flatMap((it) => { const b = pos(it.first_domain_serp_element); return b != null ? [{ kw: toKw(it), them: b }] : []; }),
      onlyYou: items(y).flatMap((it) => { const a = pos(it.first_domain_serp_element); return a != null ? [{ kw: toKw(it), you: a }] : []; }),
    };
  });

  const [lists, overviews] = await Promise.all([
    Promise.all(competitorJobs),
    Promise.allSettled(domains.map((d) => getRankOverview({ domain: d, locationCode: t.locationCode, languageCode: t.languageCode }, tool))),
  ]);
  const totals = domains.map((d, i) => {
    const r = track(overviews[i], `Totals for ${d}`);
    return { domain: d, keywords: r ? num(r.item?.metrics?.organic?.count) : null };
  });

  const ok = lists.filter((l): l is PairwiseLists => l != null);
  if (ok.length === 0) {
    const first = [...overviews].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw first?.reason ?? new Error("All keyword gap requests failed.");
  }

  const data: KeywordGap = { domains, sampleSize: sample, totals, rows: mergeGap(domains.length, ok) };
  notes.unshift(`Based on up to ${sample.toLocaleString()} highest-volume keywords per comparison. A keyword marked "not ranking" may rank beyond the sample.`);
  return { data, costUsd, cached: allCached, notes, endpoints: [ENDPOINTS.domainIntersection.path, ENDPOINTS.domainRankOverview.path] };
}
