/**
 * Normalized report payloads. UI components only consume these types; provider-specific
 * response shapes are mapped into them in src/lib/dataforseo/normalize/*.
 *
 * Traffic fields named `etv` are *estimated* traffic derived from rankings × search volume × CTR
 * models. They are not Google Analytics / Search Console measurements.
 */

export type SearchIntent = "informational" | "navigational" | "commercial" | "transactional";
export type PositionBucket = "1-3" | "4-10" | "11-20" | "21-50" | "51-100";

export type MonthlyPoint = { date: string /* YYYY-MM-01 */ };

export type DomainHistoryPoint = MonthlyPoint & {
  organicEtv: number;
  organicKeywords: number;
  paidEtv: number;
  paidKeywords: number;
  pos1_3: number;
  pos4_10: number;
  pos11_20: number;
  pos21_50: number;
  pos51_100: number;
};

export type RankedKeyword = {
  keyword: string;
  position: number;
  previousPosition: number | null;
  searchVolume: number;
  cpc: number | null;
  keywordDifficulty: number | null;
  etv: number;
  trafficShare: number; // % of domain ETV
  intent: SearchIntent | null;
  url: string;
  serpFeatures: string[];
  lastUpdated: string | null;
  isNew: boolean;
};

export type CompetitorRow = {
  domain: string;
  commonKeywords: number;
  organicKeywords: number;
  organicEtv: number;
  avgPosition: number | null;
  /** commonKeywords / (target keywords + competitor keywords − common); 0–1 */
  competitionLevel: number;
};

export type DomainOverview = {
  domain: string;
  summary: {
    domainRank: number | null; // DataForSEO backlinks rank, 0–100 scale
    organicKeywords: number;
    organicEtv: number;
    organicTrafficCost: number;
    paidKeywords: number;
    paidEtv: number;
    paidTrafficCost: number;
    backlinks: number | null;
    referringDomains: number | null;
  };
  /** Same summary one month earlier (from historical endpoint); null if unavailable. */
  previous: { organicKeywords: number; organicEtv: number; paidKeywords: number; paidEtv: number } | null;
  positionDistribution: { bucket: PositionBucket; count: number }[];
  movement: { isNew: number; isUp: number; isDown: number; isLost: number };
  history: DomainHistoryPoint[];
  topKeywords: RankedKeyword[];
  topKeywordsTotal: number;
  competitors: CompetitorRow[];
  intents: { intent: SearchIntent; keywords: number; etv: number }[];
  intentSampleSize: number;
  topPages: { url: string; keywords: number; etv: number }[];
  backlinkProfile: {
    dofollow: number;
    nofollow: number;
    referringIps: number | null;
    topAnchors: { anchor: string; backlinks: number; referringDomains: number }[];
    tlds: { tld: string; referringDomains: number }[];
  } | null;
  countries: { locationCode: number; country: string; organicEtv: number; organicKeywords: number }[] | null;
};

/** Organic Research is served as three views so paging the tables never refetches the charts. */
export type OrganicResearchSummary = {
  domain: string;
  summary: { organicKeywords: number; organicEtv: number; organicTrafficCost: number; paidKeywords: number };
  positionDistribution: { bucket: PositionBucket; count: number }[];
  movement: { isNew: number; isUp: number; isDown: number; isLost: number };
  history: DomainHistoryPoint[];
};

export type OrganicPage = { url: string; keywords: number; etv: number; trafficShare: number };

/** A server-paged slice of a larger result set. `total` is the filtered total reported by the provider. */
export type PagedRows<T> = { domain: string; total: number; page: number; size: number; rows: T[] };

export type OrganicCompetitors = {
  domain: string;
  target: { organicKeywords: number; organicEtv: number };
  competitors: CompetitorRow[];
};

export type KeywordMetrics = {
  keyword: string;
  searchVolume: number;
  cpc: number | null;
  competition: number | null; // 0–1 paid competition
  keywordDifficulty: number | null;
  intent: SearchIntent | null;
  monthlySearches: { date: string; searchVolume: number }[];
  serpFeatures: string[];
  resultsCount: number | null;
  wordCount: number;
};

export type SerpResult = {
  rank: number;
  type: string; // organic | featured_snippet | people_also_ask | ...
  title: string;
  url: string;
  domain: string;
  description: string | null;
  etv: number | null;
  domainRank: number | null;
  backlinks: number | null;
};

export type KeywordOverview = {
  keyword: KeywordMetrics;
  variations: KeywordMetrics[];
  questions: KeywordMetrics[];
  serp: SerpResult[];
};

export type KeywordMagic = {
  seed: string;
  total: number;
  totalVolume: number;
  groups: { term: string; count: number; volume: number }[];
  keywords: KeywordMetrics[];
};

export type KeywordDifficultyReport = { keywords: KeywordMetrics[] };

export type KeywordGapRow = {
  keyword: string;
  searchVolume: number;
  cpc: number | null;
  keywordDifficulty: number | null;
  intent: SearchIntent | null;
  positions: (number | null)[]; // per domain, same order as `domains`
  category: "shared" | "missing" | "weak" | "strong" | "untapped" | "unique";
};
export type KeywordGap = {
  domains: string[];
  totals: { domain: string; keywords: number }[];
  overlap: { shared: number; uniqueToFirst: number; uniqueToOthers: number };
  rows: KeywordGapRow[];
};

export type PositionTracking = {
  project: { id: string; name: string; domain: string; device: string; keywordCount: number; createdAt: string } | null;
  /** daily visibility from stored rank snapshots */
  visibility: { date: string; visibility: number; avgPosition: number; top3: number; top10: number }[];
  keywords: {
    keyword: string;
    position: number | null;
    previous: number | null;
    best: number | null;
    url: string | null;
    searchVolume: number | null;
    tags: string[];
    history: (number | null)[];
  }[];
};

export type BacklinkRow = {
  sourceUrl: string;
  sourceTitle: string | null;
  sourceDomainRank: number | null;
  targetUrl: string;
  anchor: string | null;
  dofollow: boolean;
  type: string; // anchor | image | redirect | canonical
  firstSeen: string | null;
  lastSeen: string | null;
  isNew: boolean;
  isLost: boolean;
};

export type ReferringDomainRow = {
  domain: string;
  domainRank: number | null;
  backlinks: number;
  dofollow: number;
  firstSeen: string | null;
  spamScore: number | null;
  country: string | null;
};

export type BacklinkAnalytics = {
  target: string;
  summary: {
    domainRank: number | null;
    backlinks: number;
    referringDomains: number;
    referringIps: number;
    referringSubnets: number;
    dofollow: number;
    nofollow: number;
    brokenBacklinks: number;
    spamScore: number | null;
  };
  history: { date: string; backlinks: number; referringDomains: number; newReferringDomains: number; lostReferringDomains: number }[];
  backlinks: BacklinkRow[];
  referringDomains: ReferringDomainRow[];
  anchors: { anchor: string; backlinks: number; referringDomains: number; dofollowShare: number }[];
  linkTypes: { type: string; count: number }[];
  tlds: { tld: string; referringDomains: number }[];
};

export type BacklinkGap = {
  domains: string[];
  rows: { domain: string; domainRank: number | null; backlinks: (number | null)[]; category: "best" | "weak" | "shared" | "unique" }[];
};

export type BacklinkAudit = {
  target: string;
  summary: { referringDomains: number; toxic: number; suspicious: number; healthy: number; avgSpamScore: number };
  distribution: { range: string; count: number }[];
  domains: (ReferringDomainRow & { risk: "toxic" | "suspicious" | "healthy"; reasons: string[] })[];
};

export type AuditIssue = {
  id: string;
  title: string;
  severity: "error" | "warning" | "notice";
  category: string;
  pages: number;
  description: string;
};
export type SiteAudit = {
  target: string;
  crawl: { status: "queued" | "crawling" | "finished" | "failed"; pagesCrawled: number; pagesInQueue: number; maxPages: number; startedAt: string | null; finishedAt: string | null };
  healthScore: number; // DataForSEO onpage_score (0–100)
  counts: { errors: number; warnings: number; notices: number };
  issues: AuditIssue[];
  thematic: { label: string; score: number }[];
  statusCodes: { code: string; pages: number }[];
  pages: { url: string; statusCode: number; title: string | null; onpageScore: number; issues: number; loadTimeMs: number | null; words: number | null }[];
};

export type HistoricalTrends = {
  domain: string;
  history: DomainHistoryPoint[];
  backlinkHistory: { date: string; backlinks: number; referringDomains: number }[];
  snapshots: { capturedAt: string; organicKeywords: number | null; organicEtv: number | null; source: string }[];
};

export type SerpAnalysis = {
  keyword: string;
  device: string;
  checkedAt: string;
  resultsCount: number | null;
  features: { type: string; count: number }[];
  results: SerpResult[];
};
