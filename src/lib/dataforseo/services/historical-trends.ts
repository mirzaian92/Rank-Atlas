import "server-only";
import type { HistoricalTrends } from "@/lib/reports/types";
import { HISTORY_SPANS, fillMonthGaps, type HistorySpan } from "@/lib/reports/history";
import { dbAvailable, prisma } from "@/lib/server/db";
import { dfsCall } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { DfsBacklinksHistoryItem, DfsBacklinksItemsResult } from "../types";
import { normalizeBacklinkSummary } from "../normalize/backlinks";
import { getHistory, type LabsTarget } from "./labs-common";
import { backlinksHistoryPayload } from "./backlinks";

/**
 * Historical Domain Trends — integration #12.
 *   historical_rank_overview (Labs, monthly) + backlinks/history (monthly) + stored DomainSnapshot rows.
 * The default 2-year span sends the same payloads as Domain Overview / Backlink Analytics, so it is
 * usually served from cache. Missing months are returned as explicit gaps.
 */
export async function fetchHistoricalTrends(t: LabsTarget, span: HistorySpan) {
  const tool = "historical-trends" as const;
  const months = HISTORY_SPANS[span];
  const [rank, links, snaps] = await Promise.allSettled([
    getHistory(t, tool, months),
    dfsCall<DfsBacklinksItemsResult<DfsBacklinksHistoryItem>>("backlinksHistory", backlinksHistoryPayload(t.domain, months), { tool }),
    (async () =>
      (await dbAvailable())
        ? prisma.domainSnapshot.findMany({
            where: { domain: t.domain, locationCode: t.locationCode, languageCode: t.languageCode },
            orderBy: { capturedAt: "desc" },
            take: 100,
          })
        : [])(),
  ]);
  if (rank.status === "rejected" && links.status === "rejected") throw rank.reason;

  const notes: string[] = [];
  const reason = (r: PromiseRejectedResult) => (r.reason instanceof Error ? r.reason.message : "error");
  if (rank.status === "rejected") notes.push(`Organic history unavailable: ${reason(rank)}`);
  if (links.status === "rejected") notes.push(`Backlink history unavailable: ${reason(links)}`);

  const history = fillMonthGaps(rank.status === "fulfilled" ? rank.value.history : [], [
    "organicEtv", "organicKeywords", "paidEtv", "paidKeywords", "pos1_3", "pos4_10", "pos11_20", "pos21_50", "pos51_100",
  ]) as HistoricalTrends["history"];
  const blRaw = links.status === "fulfilled" ? normalizeBacklinkSummary(t.domain, null, links.value.result[0]?.items ?? []).history : [];
  const backlinkHistory = fillMonthGaps(blRaw.map(({ date, backlinks, referringDomains }) => ({ date, backlinks, referringDomains })), ["backlinks", "referringDomains"]) as HistoricalTrends["backlinkHistory"];

  const missing = history.filter((h) => h.missing).length + backlinkHistory.filter((h) => h.missing).length;
  if (missing) notes.push(`${missing} month(s) have no provider data and are shown as gaps.`);

  const snapshots = snaps.status === "fulfilled"
    ? snaps.value.map((s) => ({ capturedAt: s.capturedAt.toISOString(), organicKeywords: s.organicKeywords, organicEtv: s.organicEtv, referringDomains: s.referringDomains, source: s.source }))
    : [];

  const paid = [rank, links].flatMap((r) => (r.status === "fulfilled" ? [{ costUsd: r.value.costUsd, cached: r.value.cached }] : []));
  return {
    data: { domain: t.domain, span, history, backlinkHistory, snapshots } satisfies HistoricalTrends,
    costUsd: paid.reduce((a, r) => a + r.costUsd, 0),
    cached: paid.every((r) => r.cached),
    notes,
    endpoints: [ENDPOINTS.historicalRankOverview.path, ENDPOINTS.backlinksHistory.path],
  };
}
