import "server-only";
import type { DomainHistoryPoint } from "@/lib/reports/types";
import { dfsCall } from "../client";
import type { DfsDomainRankOverviewItem, DfsHistoricalRankItem, DfsLabsItemsResult } from "../types";
import { normalizeHistory } from "../normalize/domain-overview";
import type { ToolId } from "@/lib/config/tools";

export type LabsTarget = { domain: string; locationCode: number; languageCode: string };

/**
 * Payload builders shared by every tool that needs the same Labs data. Identical payloads hash
 * to the same cache key, so e.g. Organic Research reuses what Domain Overview already paid for.
 */
export const labsBase = (t: LabsTarget) => ({ target: t.domain, location_code: t.locationCode, language_code: t.languageCode });

export const rankOverviewPayload = (t: LabsTarget) => ({ ...labsBase(t), limit: 1 });

/** First day of the month `months - 1` months ago (UTC), so the payload is stable within a day. */
export function historyPayload(t: LabsTarget, months = 24) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  return { ...labsBase(t), date_from: from.toISOString().slice(0, 10) };
}

export async function getRankOverview(t: LabsTarget, tool: ToolId) {
  const r = await dfsCall<DfsLabsItemsResult<DfsDomainRankOverviewItem>>("domainRankOverview", rankOverviewPayload(t), { tool });
  return { item: r.result[0]?.items?.[0] ?? null, costUsd: r.costUsd, cached: r.cached };
}

export async function getHistory(t: LabsTarget, tool: ToolId, months = 24): Promise<{ history: DomainHistoryPoint[]; costUsd: number; cached: boolean }> {
  const r = await dfsCall<DfsLabsItemsResult<DfsHistoricalRankItem>>("historicalRankOverview", historyPayload(t, months), { tool });
  return { history: normalizeHistory(r.result[0]?.items ?? []), costUsd: r.costUsd, cached: r.cached };
}
