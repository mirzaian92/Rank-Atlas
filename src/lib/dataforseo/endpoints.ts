/**
 * DataForSEO API v3 endpoint registry.
 *
 * Every outbound call goes through an entry here, so validation, cost estimates,
 * cache TTLs and rate-limit groups live in one place.
 *
 * Pricing numbers are PRE-FLIGHT ESTIMATES used only for spending-limit checks. Billing truth
 * is the `cost` field DataForSEO returns on every response, which is what we log.
 * VERIFY estimates against https://dataforseo.com/pricing before enabling live mode.
 */
export type ApiGroup = "labs" | "serp" | "backlinks" | "on_page" | "appendix";

export type EndpointDef = {
  key: string;
  path: string;
  method: "POST" | "GET";
  api: ApiGroup;
  /** Cache TTL in seconds (0 = never cache). */
  ttl: number;
  /** Pre-flight estimate in USD for one task with the given payload. */
  estimate: (payload: Record<string, unknown>) => number;
  /** Free endpoints never count against spending limits. */
  free?: boolean;
  docs: string;
};

const HOUR = 3600;
const DAY = 24 * HOUR;

/** Labs: ~$0.01 per task + ~$0.0001 per returned item (limit). */
const labs = (perItem = 0.0001, base = 0.01) => (p: Record<string, unknown>) => base + perItem * Number(p.limit ?? 1);
/** Backlinks: ~$0.02 per task + ~$0.00003 per returned row (limit). */
const backlinks = (base = 0.02) => (p: Record<string, unknown>) => base + 0.00003 * Number(p.limit ?? 1);

const DOCS = "https://docs.dataforseo.com/v3";

export const ENDPOINTS = {
  // ---------- Appendix (free) ----------
  userData: { key: "userData", path: "/v3/appendix/user_data", method: "GET", api: "appendix", ttl: 0, estimate: () => 0, free: true, docs: `${DOCS}/appendix/user_data/` },
  labsLocations: { key: "labsLocations", path: "/v3/dataforseo_labs/locations_and_languages", method: "GET", api: "labs", ttl: 30 * DAY, estimate: () => 0, free: true, docs: `${DOCS}/dataforseo_labs/locations_and_languages/` },

  // ---------- DataForSEO Labs (Google) ----------
  domainRankOverview: { key: "domainRankOverview", path: "/v3/dataforseo_labs/google/domain_rank_overview/live", method: "POST", api: "labs", ttl: 7 * DAY, estimate: labs(), docs: `${DOCS}/dataforseo_labs/google/domain_rank_overview/live/` },
  historicalRankOverview: { key: "historicalRankOverview", path: "/v3/dataforseo_labs/google/historical_rank_overview/live", method: "POST", api: "labs", ttl: 7 * DAY, estimate: () => 0.0101 + 0.0001 * 24, docs: `${DOCS}/dataforseo_labs/google/historical_rank_overview/live/` },
  rankedKeywords: { key: "rankedKeywords", path: "/v3/dataforseo_labs/google/ranked_keywords/live", method: "POST", api: "labs", ttl: 3 * DAY, estimate: labs(), docs: `${DOCS}/dataforseo_labs/google/ranked_keywords/live/` },
  competitorsDomain: { key: "competitorsDomain", path: "/v3/dataforseo_labs/google/competitors_domain/live", method: "POST", api: "labs", ttl: 7 * DAY, estimate: labs(), docs: `${DOCS}/dataforseo_labs/google/competitors_domain/live/` },
  relevantPages: { key: "relevantPages", path: "/v3/dataforseo_labs/google/relevant_pages/live", method: "POST", api: "labs", ttl: 7 * DAY, estimate: labs(), docs: `${DOCS}/dataforseo_labs/google/relevant_pages/live/` },
  domainIntersection: { key: "domainIntersection", path: "/v3/dataforseo_labs/google/domain_intersection/live", method: "POST", api: "labs", ttl: 3 * DAY, estimate: labs(), docs: `${DOCS}/dataforseo_labs/google/domain_intersection/live/` },
  keywordOverview: { key: "keywordOverview", path: "/v3/dataforseo_labs/google/keyword_overview/live", method: "POST", api: "labs", ttl: 14 * DAY, estimate: (p) => 0.01 + 0.0001 * ((p.keywords as unknown[])?.length ?? 1), docs: `${DOCS}/dataforseo_labs/google/keyword_overview/live/` },
  keywordSuggestions: { key: "keywordSuggestions", path: "/v3/dataforseo_labs/google/keyword_suggestions/live", method: "POST", api: "labs", ttl: 14 * DAY, estimate: labs(), docs: `${DOCS}/dataforseo_labs/google/keyword_suggestions/live/` },
  relatedKeywords: { key: "relatedKeywords", path: "/v3/dataforseo_labs/google/related_keywords/live", method: "POST", api: "labs", ttl: 14 * DAY, estimate: labs(), docs: `${DOCS}/dataforseo_labs/google/related_keywords/live/` },
  keywordIdeas: { key: "keywordIdeas", path: "/v3/dataforseo_labs/google/keyword_ideas/live", method: "POST", api: "labs", ttl: 14 * DAY, estimate: labs(), docs: `${DOCS}/dataforseo_labs/google/keyword_ideas/live/` },
  bulkKeywordDifficulty: { key: "bulkKeywordDifficulty", path: "/v3/dataforseo_labs/google/bulk_keyword_difficulty/live", method: "POST", api: "labs", ttl: 14 * DAY, estimate: (p) => 0.01 + 0.0001 * ((p.keywords as unknown[])?.length ?? 1), docs: `${DOCS}/dataforseo_labs/google/bulk_keyword_difficulty/live/` },
  searchIntent: { key: "searchIntent", path: "/v3/dataforseo_labs/google/search_intent/live", method: "POST", api: "labs", ttl: 30 * DAY, estimate: (p) => 0.001 + 0.0001 * ((p.keywords as unknown[])?.length ?? 1), docs: `${DOCS}/dataforseo_labs/google/search_intent/live/` },

  // ---------- SERP API (Google Organic) ----------
  serpOrganicLiveAdvanced: { key: "serpOrganicLiveAdvanced", path: "/v3/serp/google/organic/live/advanced", method: "POST", api: "serp", ttl: 12 * HOUR, estimate: (p) => 0.002 * Math.ceil(Number(p.depth ?? 10) / 10), docs: `${DOCS}/serp/google/organic/live/advanced/` },
  serpOrganicTaskPost: { key: "serpOrganicTaskPost", path: "/v3/serp/google/organic/task_post", method: "POST", api: "serp", ttl: 0, estimate: (p) => 0.0006 * Math.ceil(Number(p.depth ?? 10) / 10), docs: `${DOCS}/serp/google/organic/task_post/` },
  serpOrganicTasksReady: { key: "serpOrganicTasksReady", path: "/v3/serp/google/organic/tasks_ready", method: "GET", api: "serp", ttl: 0, estimate: () => 0, free: true, docs: `${DOCS}/serp/google/organic/tasks_ready/` },

  // ---------- Backlinks API ----------
  backlinksSummary: { key: "backlinksSummary", path: "/v3/backlinks/summary/live", method: "POST", api: "backlinks", ttl: 1 * DAY, estimate: backlinks(), docs: `${DOCS}/backlinks/summary/live/` },
  backlinksBacklinks: { key: "backlinksBacklinks", path: "/v3/backlinks/backlinks/live", method: "POST", api: "backlinks", ttl: 1 * DAY, estimate: backlinks(), docs: `${DOCS}/backlinks/backlinks/live/` },
  backlinksReferringDomains: { key: "backlinksReferringDomains", path: "/v3/backlinks/referring_domains/live", method: "POST", api: "backlinks", ttl: 1 * DAY, estimate: backlinks(), docs: `${DOCS}/backlinks/referring_domains/live/` },
  backlinksAnchors: { key: "backlinksAnchors", path: "/v3/backlinks/anchors/live", method: "POST", api: "backlinks", ttl: 1 * DAY, estimate: backlinks(), docs: `${DOCS}/backlinks/anchors/live/` },
  backlinksHistory: { key: "backlinksHistory", path: "/v3/backlinks/history/live", method: "POST", api: "backlinks", ttl: 7 * DAY, estimate: backlinks(), docs: `${DOCS}/backlinks/history/live/` },
  backlinksDomainIntersection: { key: "backlinksDomainIntersection", path: "/v3/backlinks/domain_intersection/live", method: "POST", api: "backlinks", ttl: 1 * DAY, estimate: backlinks(), docs: `${DOCS}/backlinks/domain_intersection/live/` },
  backlinksBulkSpamScore: { key: "backlinksBulkSpamScore", path: "/v3/backlinks/bulk_spam_score/live", method: "POST", api: "backlinks", ttl: 7 * DAY, estimate: (p) => 0.02 + 0.00003 * ((p.targets as unknown[])?.length ?? 1), docs: `${DOCS}/backlinks/bulk_spam_score/live/` },

  // ---------- OnPage API ----------
  onPageTaskPost: { key: "onPageTaskPost", path: "/v3/on_page/task_post", method: "POST", api: "on_page", ttl: 0, estimate: (p) => 0.000125 * Number(p.max_crawl_pages ?? 100), docs: `${DOCS}/on_page/task_post/` },
  onPageSummary: { key: "onPageSummary", path: "/v3/on_page/summary", method: "GET", api: "on_page", ttl: 0, estimate: () => 0, free: true, docs: `${DOCS}/on_page/summary/` },
  onPagePages: { key: "onPagePages", path: "/v3/on_page/pages", method: "POST", api: "on_page", ttl: 0, estimate: () => 0, free: true, docs: `${DOCS}/on_page/pages/` },
  onPageDuplicateTags: { key: "onPageDuplicateTags", path: "/v3/on_page/duplicate_tags", method: "POST", api: "on_page", ttl: 0, estimate: () => 0, free: true, docs: `${DOCS}/on_page/duplicate_tags/` },
  onPageLinks: { key: "onPageLinks", path: "/v3/on_page/links", method: "POST", api: "on_page", ttl: 0, estimate: () => 0, free: true, docs: `${DOCS}/on_page/links/` },
} satisfies Record<string, EndpointDef>;

export type EndpointKey = keyof typeof ENDPOINTS;
