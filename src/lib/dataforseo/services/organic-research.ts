import "server-only";
import type { OrganicPage, OrganicResearchSummary, PagedRows, RankedKeyword } from "@/lib/reports/types";
import type { RankedQuery } from "@/lib/reports/ranked-query";
import { ReportError } from "@/lib/reports/envelope";
import { dfsCall } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { DfsLabsItemsResult, DfsRankedKeywordItem, DfsRelevantPageItem } from "../types";
import { normalizeRankedKeywords } from "../normalize/domain-overview";
import { num, positionBuckets } from "../normalize/common";
import { FilterLimitError, rankedQueryToDfs } from "../filters";
import { getHistory, getRankOverview, labsBase, type LabsTarget } from "./labs-common";

/**
 * Organic Research — integration #2.
 *   summary  → domain_rank_overview + historical_rank_overview (same payloads as Domain Overview → shared cache)
 *   keywords → ranked_keywords with server-side filters / order_by / limit / offset (one request per page)
 *   pages    → relevant_pages with limit / offset
 */
const tool = "organic-research" as const;

type LiveResult<T> = { data: T; costUsd: number; cached: boolean; notes: string[]; endpoints: string[] };

export async function fetchOrganicSummary(t: LabsTarget): Promise<LiveResult<OrganicResearchSummary>> {
  const [ov, hist] = await Promise.allSettled([getRankOverview(t, tool), getHistory(t, tool)]);
  if (ov.status === "rejected") throw ov.reason;
  const notes: string[] = [];
  if (hist.status === "rejected") notes.push(`Historical data unavailable: ${hist.reason instanceof Error ? hist.reason.message : "error"}`);
  const o = ov.value.item?.metrics?.organic ?? {};
  const p = ov.value.item?.metrics?.paid ?? {};
  return {
    data: {
      domain: t.domain,
      summary: { organicKeywords: num(o.count), organicEtv: num(o.etv), organicTrafficCost: num(o.estimated_paid_traffic_cost), paidKeywords: num(p.count) },
      positionDistribution: positionBuckets(o),
      movement: { isNew: num(o.is_new), isUp: num(o.is_up), isDown: num(o.is_down), isLost: num(o.is_lost) },
      history: hist.status === "fulfilled" ? hist.value.history : [],
    },
    costUsd: ov.value.costUsd + (hist.status === "fulfilled" ? hist.value.costUsd : 0),
    cached: ov.value.cached && (hist.status !== "fulfilled" || hist.value.cached),
    notes,
    endpoints: [ENDPOINTS.domainRankOverview.path, ENDPOINTS.historicalRankOverview.path],
  };
}

export async function fetchOrganicKeywords(t: LabsTarget, q: RankedQuery): Promise<LiveResult<PagedRows<RankedKeyword>>> {
  let dfs: ReturnType<typeof rankedQueryToDfs>;
  try {
    dfs = rankedQueryToDfs(q);
  } catch (e) {
    if (e instanceof FilterLimitError) throw new ReportError("VALIDATION_ERROR", e.message, 400);
    throw e;
  }
  // Domain ETV is needed for "traffic %". It comes from the (usually cached) overview call.
  const [ov, kw] = await Promise.all([
    getRankOverview(t, tool),
    dfsCall<DfsLabsItemsResult<DfsRankedKeywordItem>>("rankedKeywords", { ...labsBase(t), item_types: ["organic"], ...dfs }, { tool }),
  ]);
  const res = kw.result[0];
  return {
    data: {
      domain: t.domain,
      total: num(res?.total_count),
      page: q.page,
      size: q.size,
      rows: normalizeRankedKeywords(res?.items ?? [], num(ov.item?.metrics?.organic?.etv)),
    },
    costUsd: ov.costUsd + kw.costUsd,
    cached: ov.cached && kw.cached,
    notes: [],
    endpoints: [ENDPOINTS.rankedKeywords.path],
  };
}

export async function fetchOrganicPages(t: LabsTarget, page: number, size: number): Promise<LiveResult<PagedRows<OrganicPage>>> {
  const [ov, pg] = await Promise.all([
    getRankOverview(t, tool),
    dfsCall<DfsLabsItemsResult<DfsRelevantPageItem>>("relevantPages", {
      ...labsBase(t), limit: size, offset: (page - 1) * size, order_by: ["metrics.organic.etv,desc"],
    }, { tool }),
  ]);
  const domainEtv = num(ov.item?.metrics?.organic?.etv);
  const res = pg.result[0];
  return {
    data: {
      domain: t.domain,
      total: num(res?.total_count),
      page,
      size,
      rows: (res?.items ?? []).map((it) => {
        const etv = num(it.metrics?.organic?.etv);
        return { url: it.page_address, keywords: num(it.metrics?.organic?.count), etv, trafficShare: domainEtv > 0 ? Math.round((etv / domainEtv) * 10000) / 100 : 0 };
      }),
    },
    costUsd: ov.costUsd + pg.costUsd,
    cached: ov.cached && pg.cached,
    notes: [],
    endpoints: [ENDPOINTS.relevantPages.path],
  };
}
