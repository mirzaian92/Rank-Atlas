/**
 * Raw DataForSEO v3 response shapes (subset of fields we consume).
 * Field names follow the official docs; keep optional everything the docs mark nullable.
 */

/** Common envelope for every v3 response. */
export type DfsEnvelope<R> = {
  version: string;
  status_code: number; // 20000 = OK
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: DfsTask<R>[] | null;
};

export type DfsTask<R> = {
  id: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  result_count: number;
  path: string[];
  data: Record<string, unknown>;
  result: R[] | null;
};

/** Labs "metrics" block used by domain_rank_overview, historical_rank_overview, competitors_domain. */
export type DfsRankMetrics = {
  pos_1?: number; pos_2_3?: number; pos_4_10?: number; pos_11_20?: number; pos_21_30?: number;
  pos_31_40?: number; pos_41_50?: number; pos_51_60?: number; pos_61_70?: number; pos_71_80?: number;
  pos_81_90?: number; pos_91_100?: number;
  etv?: number; count?: number; estimated_paid_traffic_cost?: number;
  is_new?: number; is_up?: number; is_down?: number; is_lost?: number;
};

export type DfsMetricsByType = { organic?: DfsRankMetrics | null; paid?: DfsRankMetrics | null };

export type DfsLabsItemsResult<I> = {
  se_type?: string;
  target?: string;
  location_code: number;
  language_code: string;
  total_count: number | null;
  items_count: number;
  items: I[] | null;
};

export type DfsDomainRankOverviewItem = { se_type: string; location_code: number; language_code: string; metrics: DfsMetricsByType };
export type DfsHistoricalRankItem = { se_type: string; year: number; month: number; metrics: DfsMetricsByType };

export type DfsRankedKeywordItem = {
  se_type: string;
  keyword_data: {
    keyword: string;
    keyword_info?: { search_volume: number | null; cpc: number | null; competition: number | null; monthly_searches?: { year: number; month: number; search_volume: number }[] | null } | null;
    keyword_properties?: { keyword_difficulty: number | null } | null;
    search_intent_info?: { main_intent: string | null; foreign_intent?: string[] | null } | null;
  };
  ranked_serp_element: {
    serp_item: {
      type: string;
      rank_group: number;
      rank_absolute: number;
      url: string;
      etv?: number | null;
      rank_changes?: { previous_rank_absolute: number | null; is_new: boolean; is_up: boolean; is_down: boolean } | null;
    };
    serp_item_types?: string[] | null;
    last_updated_time?: string | null;
  };
};

export type DfsCompetitorDomainItem = {
  se_type: string;
  domain: string;
  avg_position: number | null;
  sum_position: number | null;
  intersections: number | null;
  full_domain_metrics?: DfsMetricsByType | null;
  metrics?: DfsMetricsByType | null;
};

export type DfsRelevantPageItem = { page_address: string; metrics: DfsMetricsByType };

export type DfsBacklinksSummary = {
  target: string;
  rank: number | null;
  backlinks: number | null;
  backlinks_spam_score: number | null;
  broken_backlinks: number | null;
  referring_domains: number | null;
  referring_domains_nofollow: number | null;
  referring_main_domains: number | null;
  referring_ips: number | null;
  referring_subnets: number | null;
  referring_links_tld: Record<string, number> | null;
  referring_links_types: Record<string, number> | null;
  referring_links_attributes: Record<string, number> | null;
};

export type DfsAnchorsResult = { total_count: number; items: { anchor: string; backlinks: number; referring_domains: number; referring_links_attributes?: Record<string, number> | null }[] | null };

export type DfsUserData = {
  login: string;
  timezone: string;
  rates?: unknown;
  money: { total: number; balance: number; limits?: unknown; statistics?: unknown };
};

/** Keyword item shape shared by keyword_overview, keyword_suggestions, related/ideas (Labs). */
export type DfsKeywordItem = {
  se_type?: string;
  keyword: string;
  location_code?: number;
  language_code?: string;
  keyword_info?: {
    search_volume: number | null;
    cpc: number | null;
    competition: number | null;
    competition_level?: string | null;
    monthly_searches?: { year: number; month: number; search_volume: number | null }[] | null;
  } | null;
  keyword_properties?: { keyword_difficulty: number | null } | null;
  serp_info?: { serp_item_types?: string[] | null; se_results_count?: number | null; last_updated_time?: string | null } | null;
  search_intent_info?: { main_intent: string | null } | null;
};

/** Google Organic SERP (live/advanced) result. */
export type DfsSerpItem = {
  type: string;
  rank_group?: number;
  rank_absolute?: number;
  domain?: string | null;
  title?: string | null;
  url?: string | null;
  description?: string | null;
  items?: { title?: string | null }[] | null;
};
export type DfsSerpResult = {
  keyword: string;
  check_url?: string;
  datetime?: string;
  se_results_count?: number | null;
  item_types?: string[] | null;
  items: DfsSerpItem[] | null;
};

/** related_keywords items wrap the keyword in `keyword_data`. */
export type DfsRelatedKeywordItem = { se_type?: string; keyword_data: DfsKeywordItem; depth?: number; related_keywords?: string[] | null };
