import "server-only";
import type { OrganicCompetitors } from "@/lib/reports/types";
import { dfsCall } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { DfsCompetitorDomainItem, DfsLabsItemsResult } from "../types";
import { normalizeCompetitors } from "../normalize/domain-overview";
import { num } from "../normalize/common";
import { getRankOverview, labsBase, type LabsTarget } from "./labs-common";

/**
 * Organic Competitors — integration #5.
 * competitors_domain (top 100 by shared keywords, ≈ $0.02) + domain_rank_overview for the target's
 * own totals (usually cached from Domain Overview).
 * VERIFY: order_by field name `intersections` on competitors_domain.
 */
export async function fetchOrganicCompetitors(t: LabsTarget) {
  const tool = "organic-competitors" as const;
  const [ov, comp] = await Promise.all([
    getRankOverview(t, tool),
    dfsCall<DfsLabsItemsResult<DfsCompetitorDomainItem>>("competitorsDomain", { ...labsBase(t), limit: 100, order_by: ["intersections,desc"] }, { tool }),
  ]);
  const o = ov.item?.metrics?.organic;
  const targetKeywords = num(o?.count);
  const data: OrganicCompetitors = {
    domain: t.domain,
    target: { organicKeywords: targetKeywords, organicEtv: num(o?.etv) },
    competitors: normalizeCompetitors(comp.result[0]?.items ?? [], t.domain, targetKeywords).sort((a, b) => b.competitionLevel - a.competitionLevel),
  };
  return {
    data,
    costUsd: ov.costUsd + comp.costUsd,
    cached: ov.cached && comp.cached,
    notes: [] as string[],
    endpoints: [ENDPOINTS.competitorsDomain.path, ENDPOINTS.domainRankOverview.path],
  };
}
