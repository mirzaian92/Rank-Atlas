import "server-only";
import type { AnchorRow, BacklinkAudit, BacklinkGapPage, BacklinkRow, PagedRows, ReferringDomainRow } from "@/lib/reports/types";
import type { BlGapQuery, BlQuery } from "@/lib/reports/backlink-query";
import { assessRisk, spamDistribution } from "@/lib/reports/backlink-risk";
import { ReportError } from "@/lib/reports/envelope";
import type { ToolId } from "@/lib/config/tools";
import { dfsCall } from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  DfsAnchorItem, DfsBacklinkItem, DfsBacklinksHistoryItem, DfsBacklinksItemsResult, DfsBacklinksSummary, DfsBlIntersectionItem,
  DfsReferringDomainItem, DfsSpamScoreItem,
} from "../types";
import { normalizeAnchor, normalizeBacklink, normalizeBacklinkSummary, normalizeGapItem, normalizeReferringDomain } from "../normalize/backlinks";
import { FilterLimitError, blGapToDfs, blQueryToDfs } from "../filters";

type Live<T> = { data: T; costUsd: number; cached: boolean; notes: string[]; endpoints: string[] };

/** Shared with Domain Overview so both hit the same cache entry. */
export const backlinksSummaryPayload = (target: string) => ({ target, include_subdomains: true, rank_scale: "one_hundred" });

function historyFrom(months = 24) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1)).toISOString().slice(0, 10);
}

function filterError(e: unknown): never {
  if (e instanceof FilterLimitError) throw new ReportError("VALIDATION_ERROR", e.message, 400);
  throw e;
}

/** Backlink Analytics summary: backlinks/summary + backlinks/history (monthly). */
export async function fetchBacklinkSummary(target: string): Promise<Live<ReturnType<typeof normalizeBacklinkSummary>>> {
  const tool: ToolId = "backlink-analytics";
  const [sum, hist] = await Promise.allSettled([
    dfsCall<DfsBacklinksSummary>("backlinksSummary", backlinksSummaryPayload(target), { tool }),
    dfsCall<DfsBacklinksItemsResult<DfsBacklinksHistoryItem>>("backlinksHistory", { target, date_from: historyFrom(24), rank_scale: "one_hundred" }, { tool }),
  ]);
  if (sum.status === "rejected") throw sum.reason;
  const notes: string[] = [];
  if (hist.status === "rejected") notes.push(`Link history unavailable: ${hist.reason instanceof Error ? hist.reason.message : "error"}`);
  const history = hist.status === "fulfilled" ? hist.value.result[0]?.items ?? [] : [];
  return {
    data: normalizeBacklinkSummary(target, sum.value.result[0] ?? null, history),
    costUsd: sum.value.costUsd + (hist.status === "fulfilled" ? hist.value.costUsd : 0),
    cached: sum.value.cached && (hist.status !== "fulfilled" || hist.value.cached),
    notes,
    endpoints: [ENDPOINTS.backlinksSummary.path, ENDPOINTS.backlinksHistory.path],
  };
}

/** One page of the backlinks / referring domains / anchors table. */
export async function fetchBacklinkTable(target: string, q: BlQuery): Promise<Live<PagedRows<BacklinkRow | ReferringDomainRow | AnchorRow>>> {
  const tool: ToolId = "backlink-analytics";
  let frag: Record<string, unknown>;
  try {
    frag = blQueryToDfs(q);
  } catch (e) {
    filterError(e);
  }
  const payload = { target, include_subdomains: true, ...frag };
  const page = (total: number | null | undefined, rows: (BacklinkRow | ReferringDomainRow | AnchorRow)[]) => ({ domain: target, total: total ?? 0, page: q.page, size: q.size, rows });

  if (q.view === "backlinks") {
    const r = await dfsCall<DfsBacklinksItemsResult<DfsBacklinkItem>>("backlinksBacklinks", payload, { tool });
    return { data: page(r.result[0]?.total_count, (r.result[0]?.items ?? []).map(normalizeBacklink)), costUsd: r.costUsd, cached: r.cached, notes: [], endpoints: [ENDPOINTS.backlinksBacklinks.path] };
  }
  if (q.view === "domains") {
    const r = await dfsCall<DfsBacklinksItemsResult<DfsReferringDomainItem>>("backlinksReferringDomains", payload, { tool });
    return { data: page(r.result[0]?.total_count, (r.result[0]?.items ?? []).map(normalizeReferringDomain)), costUsd: r.costUsd, cached: r.cached, notes: [], endpoints: [ENDPOINTS.backlinksReferringDomains.path] };
  }
  const r = await dfsCall<DfsBacklinksItemsResult<DfsAnchorItem>>("backlinksAnchors", payload, { tool });
  return { data: page(r.result[0]?.total_count, (r.result[0]?.items ?? []).map(normalizeAnchor)), costUsd: r.costUsd, cached: r.cached, notes: [], endpoints: [ENDPOINTS.backlinksAnchors.path] };
}

/** Backlink Gap — one domain_intersection request per tab page. */
export async function fetchBacklinkGap(domains: string[], q: BlGapQuery): Promise<Live<BacklinkGapPage>> {
  const { payload, targetIndex } = blGapToDfs(domains, q);
  const r = await dfsCall<DfsBacklinksItemsResult<DfsBlIntersectionItem>>("backlinksDomainIntersection", payload, { tool: "backlink-gap" });
  const res = r.result[0];
  const rows = (res?.items ?? []).map((it) => normalizeGapItem(it, domains, targetIndex)).filter((x): x is NonNullable<typeof x> => x != null);
  return {
    data: { domains, tab: q.tab, total: res?.total_count ?? 0, page: q.page, size: q.size, rows },
    costUsd: r.costUsd,
    cached: r.cached,
    notes: [],
    endpoints: [ENDPOINTS.backlinksDomainIntersection.path],
  };
}

/**
 * Backlink Audit: top `sample` referring domains by backlinks + each domain's own spam score
 * (bulk_spam_score), then local risk heuristics.
 */
export async function fetchBacklinkAudit(target: string, sample: number): Promise<Live<BacklinkAudit>> {
  const tool: ToolId = "backlink-audit";
  const rd = await dfsCall<DfsBacklinksItemsResult<DfsReferringDomainItem>>("backlinksReferringDomains", {
    target, include_subdomains: true, limit: sample, order_by: ["backlinks,desc"], rank_scale: "one_hundred",
  }, { tool });
  const domains = (rd.result[0]?.items ?? []).map(normalizeReferringDomain);
  const notes: string[] = [];
  let costUsd = rd.costUsd;
  let cached = rd.cached;

  if (domains.length) {
    try {
      const ss = await dfsCall<DfsBacklinksItemsResult<DfsSpamScoreItem>>("backlinksBulkSpamScore", { targets: domains.map((d) => d.domain) }, { tool });
      const scores = new Map((ss.result[0]?.items ?? []).map((i) => [i.target.toLowerCase(), i.spam_score]));
      // Prefer the domain's own spam score; fall back to the score of its links to the target.
      for (const d of domains) d.spamScore = scores.get(d.domain.toLowerCase()) ?? d.spamScore;
      costUsd += ss.costUsd;
      cached &&= ss.cached;
    } catch (e) {
      notes.push(`Domain spam scores unavailable (${e instanceof Error ? e.message : "error"}); using link-level spam scores instead.`);
    }
  }

  const assessed = domains.map((d) => ({ ...d, ...assessRisk(d) }));
  const total = rd.result[0]?.total_count ?? null;
  if (total != null && total > assessed.length) notes.push(`Analysed the top ${assessed.length.toLocaleString()} of ${total.toLocaleString()} referring domains (by number of backlinks).`);
  return {
    data: {
      target,
      sampleSize: sample,
      totalReferringDomains: total,
      summary: {
        referringDomains: assessed.length,
        toxic: assessed.filter((d) => d.risk === "toxic").length,
        suspicious: assessed.filter((d) => d.risk === "suspicious").length,
        healthy: assessed.filter((d) => d.risk === "healthy").length,
        avgSpamScore: assessed.length ? Math.round(assessed.reduce((a, b) => a + (b.spamScore ?? 0), 0) / assessed.length) : 0,
      },
      distribution: spamDistribution(assessed.map((d) => d.spamScore)),
      domains: assessed.sort((a, b) => (b.spamScore ?? 0) - (a.spamScore ?? 0)),
    },
    costUsd,
    cached,
    notes,
    endpoints: [ENDPOINTS.backlinksReferringDomains.path, ENDPOINTS.backlinksBulkSpamScore.path],
  };
}
