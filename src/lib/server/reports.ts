import "server-only";
import { z } from "zod";
import type { ToolId } from "@/lib/config/tools";
import { domainListSchema, domainSchema, keywordListSchema, keywordSchema, marketSchema } from "@/lib/validation/params";
import { mockDomainOverview, mockHistoricalTrends, mockOrganicCompetitors, mockOrganicKeywordPool, mockOrganicPages, mockOrganicSummary } from "@/lib/mock/domain";
import { applyRankedQuery, rankedQuerySchema } from "@/lib/reports/ranked-query";
import { fetchOrganicKeywords, fetchOrganicPages, fetchOrganicSummary } from "@/lib/dataforseo/services/organic-research";
import { mockKeywordDifficulty, mockKeywordGap, mockKeywordMagic, mockKeywordOverview, mockSerpAnalysis } from "@/lib/mock/keywords";
import { mockBacklinkAnalytics, mockBacklinkAudit, mockBacklinkGap, mockPositionTracking, mockSiteAudit } from "@/lib/mock/links-site";
import { fetchDomainOverview } from "@/lib/dataforseo/services/domain-overview";

type Market = { market: string; locationCode: number; languageCode: string };
type LiveResult = { data: unknown; costUsd: number; cached: boolean; notes: string[]; endpoints: string[] };

type Handler<P> = {
  schema: z.ZodType<P>;
  mock: (p: P & Market) => unknown;
  live?: (p: P & Market) => Promise<LiveResult>;
  /** Shown under the page header for every response from this tool. */
  notes?: string[];
};

const q = <S extends z.ZodType>(s: S) => z.object({ q: s });
const ETV_NOTE = "Traffic figures are estimates modelled from rankings and search volume — not analytics or Search Console data.";

function h<P>(x: Handler<P>) {
  return x as unknown as Handler<unknown>;
}

export const REPORTS: Record<ToolId, Handler<unknown>> = {
  "domain-overview": h({
    schema: q(domainSchema).extend({ months: z.coerce.number().int().min(1).max(60).default(24) }),
    mock: (p) => mockDomainOverview(p.q, p),
    live: (p) => fetchDomainOverview({ domain: p.q, locationCode: p.locationCode, languageCode: p.languageCode, months: p.months }),
    notes: [ETV_NOTE],
  }),
  "organic-research": h({
    schema: q(domainSchema).extend({ view: z.enum(["summary", "keywords", "pages"]).default("summary") }).and(rankedQuerySchema),
    mock: (p) => {
      if (p.view === "pages") return mockOrganicPages(p.q, p, p.page, p.size);
      if (p.view === "keywords") {
        const { rows, total } = applyRankedQuery(mockOrganicKeywordPool(p.q, p), p);
        return { domain: p.q, total, page: p.page, size: p.size, rows };
      }
      return mockOrganicSummary(p.q, p);
    },
    live: (p) => {
      const t = { domain: p.q, locationCode: p.locationCode, languageCode: p.languageCode };
      if (p.view === "pages") return fetchOrganicPages(t, p.page, p.size);
      if (p.view === "keywords") return fetchOrganicKeywords(t, p);
      return fetchOrganicSummary(t);
    },
    notes: [ETV_NOTE],
  }),
  "organic-competitors": h({ schema: q(domainSchema), mock: (p) => mockOrganicCompetitors(p.q, p), notes: [ETV_NOTE] }),
  "keyword-overview": h({ schema: q(keywordSchema), mock: (p) => mockKeywordOverview(p.q, p) }),
  "keyword-magic-tool": h({
    schema: q(keywordSchema).extend({ mode: z.enum(["broad", "phrase", "exact", "related", "questions"]).default("broad") }),
    mock: (p) => mockKeywordMagic(p.q, p, p.mode),
  }),
  "keyword-difficulty": h({ schema: q(keywordListSchema), mock: (p) => mockKeywordDifficulty(p.q, p) }),
  "keyword-gap": h({ schema: q(domainListSchema), mock: (p) => mockKeywordGap(p.q, p) }),
  "position-tracking": h({ schema: q(domainSchema), mock: (p) => mockPositionTracking(p.q, p), notes: ["Position history comes only from stored daily SERP checks — no backfilled history."] }),
  "backlink-analytics": h({ schema: q(domainSchema), mock: (p) => mockBacklinkAnalytics(p.q, p) }),
  "backlink-gap": h({ schema: q(domainListSchema), mock: (p) => mockBacklinkGap(p.q) }),
  "backlink-audit": h({ schema: q(domainSchema), mock: (p) => mockBacklinkAudit(p.q), notes: ["Risk labels are heuristics based on spam score and link attributes; review before disavowing."] }),
  "site-audit": h({ schema: q(domainSchema), mock: (p) => mockSiteAudit(p.q) }),
  "historical-trends": h({ schema: q(domainSchema), mock: (p) => mockHistoricalTrends(p.q, p), notes: [ETV_NOTE] }),
  "serp-analysis": h({
    schema: q(keywordSchema).extend({ device: z.enum(["desktop", "mobile"]).default("desktop") }),
    mock: (p) => mockSerpAnalysis(p.q, p, p.device),
  }),
};

export function parseReportParams(tool: ToolId, sp: URLSearchParams) {
  const raw = Object.fromEntries(sp.entries());
  const market = marketSchema.safeParse(raw);
  const params = REPORTS[tool].schema.safeParse(raw);
  if (!market.success) return { ok: false as const, issues: market.error.issues };
  if (!params.success) return { ok: false as const, issues: params.error.issues };
  return { ok: true as const, value: { ...(params.data as object), ...market.data } as Record<string, unknown> & Market };
}
