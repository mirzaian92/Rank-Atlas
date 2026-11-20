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

/** One server-paged slice of Keyword Magic Tool results. */
export type KeywordMagicPage = {
  seed: string;
  mode: "broad" | "phrase" | "related" | "questions" | "ideas";
  /** Filtered total reported by the provider for this mode + filters. */
  total: number;
  page: number;
  size: number;
  rows: KeywordMetrics[];
  /** Common words among `rows` only (not across all results). */
  groups: { term: string; count: number; volume: number }[];
}

export type KeywordDifficultyReport = { keywords: KeywordMetrics[] };

export type KeywordGapRow = {
  keyword: string;
  searchVolume: number;
  cpc: number | null;
  keywordDifficulty: number | null;
  intent: SearchIntent | null;
  /** Position per domain, same order as `domains` (index 0 = you). null = not ranking or not in the sample. */
  positions: (number | null)[];
};
export type KeywordGap = {
  domains: string[];
  /** Max keywords requested per pairwise list (see lib/reports/keyword-gap.ts). */
  sampleSize: number;
  /** Total organic keywords per domain (from domain_rank_overview), not limited by the sample. */
  totals: { domain: string; keywords: number | null }[];
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
    /** At least one completed check in the range (position null + checked = not in the checked depth). */
    checked?: boolean;
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

/** Backlink Analytics summary view (cards + charts). Tables are separate paged views. */
export type BacklinkSummary = {
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
  /** Monthly history from the provider (backlinks/history) — never interpolated. */
  history: { date: string; backlinks: number; referringDomains: number; newReferringDomains: number; lostReferringDomains: number }[];
  linkTypes: { type: string; count: number }[];
  tlds: { tld: string; referringDomains: number }[];
};

export type AnchorRow = { anchor: string; backlinks: number; referringDomains: number; dofollowShare: number | null; firstSeen: string | null };

export type BacklinkGapTab = "best" | "untapped" | "shared" | "unique";
/** One server-paged tab of Backlink Gap. backlinks[i] = links from the referring domain to domains[i] (0 = excluded / none). */
export type BacklinkGapPage = {
  domains: string[];
  tab: BacklinkGapTab;
  total: number;
  page: number;
  size: number;
  rows: { domain: string; domainRank: number | null; backlinks: (number | null)[] }[];
};

export type RiskLevel = "toxic" | "suspicious" | "healthy";
export type BacklinkAudit = {
  target: string;
  /** Referring domains analysed (top N by backlinks). */
  sampleSize: number;
  /** All referring domains the target has, if known. */
  totalReferringDomains: number | null;
  summary: { referringDomains: number; toxic: number; suspicious: number; healthy: number; avgSpamScore: number };
  distribution: { range: string; count: number }[];
  domains: (ReferringDomainRow & { risk: RiskLevel; reasons: string[] })[];
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
  statusCodes: { code: string; pages: number }[];
  pages: { url: string; statusCode: number; title: string | null; onpageScore: number; issues: number; loadTimeMs: number | null; words: number | null }[];
};

type Nullable<T> = { [K in keyof T]: T[K] | null };
/** A month in a history series; `missing` months have null metrics (shown as gaps, never interpolated). */
export type HistoryRow = { date: string; missing?: boolean } & Nullable<Omit<DomainHistoryPoint, "date">>;
export type BacklinkHistoryRow = { date: string; missing?: boolean; backlinks: number | null; referringDomains: number | null };

export type HistoricalTrends = {
  domain: string;
  span: "1y" | "2y" | "5y";
  history: HistoryRow[];
  backlinkHistory: BacklinkHistoryRow[];
  /** Point-in-time values stored from earlier live Domain Overview lookups (this app's own record). */
  snapshots: { capturedAt: string; organicKeywords: number | null; organicEtv: number | null; referringDomains: number | null; source: string }[];
};

export type SerpAnalysis = {
  keyword: string;
  device: string;
  checkedAt: string;
  resultsCount: number | null;
  features: { type: string; count: number }[];
  results: SerpResult[];
};
