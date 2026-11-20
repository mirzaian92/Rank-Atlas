import "server-only";
import type { DomainOverview } from "@/lib/reports/types";
import { dbAvailable, prisma } from "@/lib/server/db";
import { dfsCall } from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  DfsAnchorsResult, DfsBacklinksSummary, DfsCompetitorDomainItem, DfsDomainRankOverviewItem, DfsHistoricalRankItem,
  DfsLabsItemsResult, DfsRankedKeywordItem, DfsRelevantPageItem,
} from "../types";
import { normalizeDomainOverview } from "../normalize/domain-overview";
import { historyPayload, labsBase, rankOverviewPayload } from "./labs-common";
import { backlinksSummaryPayload } from "./backlinks";

/** Marker for optional sections that were not requested (no provider call, no cost). */
const SKIP = Symbol("skipped");
const SKIPPED = Promise.reject(SKIP) as Promise<never>;
SKIPPED.catch(() => {});

export type DomainOverviewInput = { domain: string; locationCode: number; languageCode: string; months: number; trend?: boolean; anchors?: boolean };

/**
 * Domain Overview — integration #1.
 * Up to seven requests, run in parallel. Only domain_rank_overview is required; others degrade to
 * empty sections with a note. By default the two most expensive optional sections are skipped
 * (monthly history ≈ $0.08 for 12 months, anchors ≈ $0.024) and loaded only on request, which
 * brings an uncached lookup from ≈ $0.20 to ≈ $0.09. Loading them later re-uses the cached rest.
 */
export async function fetchDomainOverview(input: DomainOverviewInput) {
  const base = labsBase(input);
  const tool = "domain-overview" as const;

  const [overview, history, ranked, competitors, pages, backlinks, anchors] = await Promise.allSettled([
    dfsCall<DfsLabsItemsResult<DfsDomainRankOverviewItem>>("domainRankOverview", rankOverviewPayload(input), { tool }),
    input.trend
      ? dfsCall<DfsLabsItemsResult<DfsHistoricalRankItem>>("historicalRankOverview", historyPayload(input, input.months), { tool })
      : SKIPPED,
    dfsCall<DfsLabsItemsResult<DfsRankedKeywordItem>>("rankedKeywords", {
      ...base, limit: 100, item_types: ["organic"], order_by: ["ranked_serp_element.serp_item.etv,desc"],
    }, { tool }),
    dfsCall<DfsLabsItemsResult<DfsCompetitorDomainItem>>("competitorsDomain", { ...base, limit: 11 }, { tool }),
    dfsCall<DfsLabsItemsResult<DfsRelevantPageItem>>("relevantPages", { ...base, limit: 6, order_by: ["metrics.organic.etv,desc"] }, { tool }),
    // Backlinks API is location-independent.
    dfsCall<DfsBacklinksSummary>("backlinksSummary", backlinksSummaryPayload(input.domain), { tool }),
    input.anchors
      ? dfsCall<DfsAnchorsResult>("backlinksAnchors", { target: input.domain, limit: 6, order_by: ["backlinks,desc"] }, { tool })
      : SKIPPED,
  ]);

  // The core call must succeed; rethrow its typed error so the UI shows the right state.
  if (overview.status === "rejected") throw overview.reason;

  const notes: string[] = [];
  const ok = <T,>(r: PromiseSettledResult<{ result: T[] }>, label: string): T | null => {
    if (r.status === "fulfilled") return r.value.result[0] ?? null;
    if (r.reason === SKIP) return null;
    notes.push(`${label} unavailable: ${r.reason instanceof Error ? r.reason.message : "error"}`);
    return null;
  };

  const raw = {
    domain: input.domain,
    overview: overview.value.result[0]?.items?.[0] ?? null,
    history: ok(history, "Historical data")?.items ?? null,
    ranked: ok(ranked, "Top keywords"),
    competitors: ok(competitors, "Competitors")?.items ?? null,
    pages: ok(pages, "Top pages")?.items ?? null,
    backlinks: ok(backlinks, "Backlinks summary"),
    anchors: ok(anchors, "Anchors"),
  };
  const data: DomainOverview = { ...normalizeDomainOverview(raw), historyLoaded: Boolean(input.trend), anchorsLoaded: Boolean(input.anchors) };
  if (data.intentSampleSize > 0) notes.push(`Intent breakdown is based on the top ${data.intentSampleSize} keywords by estimated traffic.`);

  const settled = [overview, history, ranked, competitors, pages, backlinks, anchors];
  const costUsd = settled.reduce((s, r) => s + (r.status === "fulfilled" ? r.value.costUsd : 0), 0);
  const allCached = settled.every((r) => r.status !== "fulfilled" || r.value.cached);

  // Store a snapshot from real provider data so Historical Trends can show our own history later.
  if (!allCached && (await dbAvailable())) {
    await prisma.domainSnapshot.create({
      data: {
        domain: input.domain, locationCode: input.locationCode, languageCode: input.languageCode,
        source: ENDPOINTS.domainRankOverview.path,
        organicKeywords: data.summary.organicKeywords, organicEtv: data.summary.organicEtv,
        paidKeywords: data.summary.paidKeywords, paidEtv: data.summary.paidEtv,
        backlinks: data.summary.backlinks != null ? BigInt(Math.round(data.summary.backlinks)) : null,
        referringDomains: data.summary.referringDomains, domainRank: data.summary.domainRank,
      },
    }).catch((e) => console.error("[domain-overview] snapshot failed", e));
  }

  return {
    data,
    costUsd,
    cached: allCached,
    notes,
    endpoints: [
      ENDPOINTS.domainRankOverview.path, ...(input.trend ? [ENDPOINTS.historicalRankOverview.path] : []), ENDPOINTS.rankedKeywords.path,
      ENDPOINTS.competitorsDomain.path, ENDPOINTS.relevantPages.path, ENDPOINTS.backlinksSummary.path,
      ...(input.anchors ? [ENDPOINTS.backlinksAnchors.path] : []),
    ],
  };
}
