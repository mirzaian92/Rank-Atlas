/**
 * DataForSEO → DomainOverview normalization. Pure functions (no I/O) so they can be unit
 * tested against saved provider responses.
 */
import type { DomainHistoryPoint, DomainOverview, RankedKeyword, CompetitorRow, SearchIntent } from "@/lib/reports/types";
import type {
  DfsAnchorsResult, DfsBacklinksSummary, DfsCompetitorDomainItem, DfsDomainRankOverviewItem, DfsHistoricalRankItem,
  DfsLabsItemsResult, DfsRankedKeywordItem, DfsRelevantPageItem,
} from "../types";
import { intentOf, monthKey, num, numOrNull, positionBuckets } from "./common";

export function normalizeHistory(items: DfsHistoricalRankItem[]): DomainHistoryPoint[] {
  return items
    .map((it) => {
      const o = it.metrics?.organic ?? {};
      const p = it.metrics?.paid ?? {};
      const b = positionBuckets(o);
      return {
        date: monthKey(it.year, it.month),
        organicEtv: num(o.etv), organicKeywords: num(o.count),
        paidEtv: num(p.etv), paidKeywords: num(p.count),
        pos1_3: b[0].count, pos4_10: b[1].count, pos11_20: b[2].count, pos21_50: b[3].count, pos51_100: b[4].count,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function normalizeRankedKeywords(items: DfsRankedKeywordItem[], domainEtv: number): RankedKeyword[] {
  return items.map((it) => {
    const kd = it.keyword_data;
    const se = it.ranked_serp_element;
    const si = se.serp_item;
    const etv = num(si.etv);
    return {
      keyword: kd.keyword,
      position: si.rank_group,
      previousPosition: si.rank_changes?.previous_rank_absolute ?? null,
      searchVolume: num(kd.keyword_info?.search_volume),
      cpc: numOrNull(kd.keyword_info?.cpc),
      keywordDifficulty: numOrNull(kd.keyword_properties?.keyword_difficulty),
      etv,
      trafficShare: domainEtv > 0 ? Math.round((etv / domainEtv) * 10000) / 100 : 0,
      intent: intentOf(kd.search_intent_info?.main_intent),
      url: si.url,
      serpFeatures: (se.serp_item_types ?? []).filter((t) => t !== "organic"),
      lastUpdated: se.last_updated_time ?? null,
      isNew: Boolean(si.rank_changes?.is_new),
    };
  });
}

export function normalizeCompetitors(items: DfsCompetitorDomainItem[], target: string, targetKeywords: number): CompetitorRow[] {
  return items
    .filter((c) => c.domain !== target)
    .map((c) => {
      const theirs = num(c.full_domain_metrics?.organic?.count);
      const common = num(c.intersections);
      const union = targetKeywords + theirs - common;
      return {
        domain: c.domain,
        commonKeywords: common,
        organicKeywords: theirs,
        organicEtv: num(c.full_domain_metrics?.organic?.etv),
        avgPosition: numOrNull(c.avg_position),
        competitionLevel: union > 0 ? Math.round((common / union) * 1000) / 1000 : 0,
      };
    });
}

export type DomainOverviewRaw = {
  domain: string;
  overview: DfsDomainRankOverviewItem | null;
  history: DfsHistoricalRankItem[] | null;
  ranked: DfsLabsItemsResult<DfsRankedKeywordItem> | null;
  competitors: DfsCompetitorDomainItem[] | null;
  pages: DfsRelevantPageItem[] | null;
  backlinks: DfsBacklinksSummary | null;
  anchors: DfsAnchorsResult | null;
};

export function normalizeDomainOverview(raw: DomainOverviewRaw): DomainOverview {
  const o = raw.overview?.metrics?.organic ?? {};
  const p = raw.overview?.metrics?.paid ?? {};
  const history = raw.history ? normalizeHistory(raw.history) : [];
  // Previous month = the historical point one calendar month before the latest point.
  const last = history[history.length - 1];
  let prevKey: string | null = null;
  if (last) {
    const d = new Date(last.date);
    d.setUTCMonth(d.getUTCMonth() - 1);
    prevKey = d.toISOString().slice(0, 10);
  }
  const prev = history.find((h) => h.date === prevKey) ?? null;
  const topKeywords = raw.ranked?.items ? normalizeRankedKeywords(raw.ranked.items, num(o.etv)) : [];

  const intentAgg = new Map<SearchIntent, { keywords: number; etv: number }>();
  for (const k of topKeywords) {
    if (!k.intent) continue;
    const v = intentAgg.get(k.intent) ?? { keywords: 0, etv: 0 };
    v.keywords++;
    v.etv += k.etv;
    intentAgg.set(k.intent, v);
  }

  const bl = raw.backlinks;
  const nofollow = num(bl?.referring_links_attributes?.nofollow);
  return {
    domain: raw.domain,
    summary: {
      domainRank: numOrNull(bl?.rank),
      organicKeywords: num(o.count),
      organicEtv: num(o.etv),
      organicTrafficCost: num(o.estimated_paid_traffic_cost),
      paidKeywords: num(p.count),
      paidEtv: num(p.etv),
      paidTrafficCost: num(p.estimated_paid_traffic_cost),
      backlinks: numOrNull(bl?.backlinks),
      referringDomains: numOrNull(bl?.referring_domains),
    },
    previous: prev ? { organicKeywords: prev.organicKeywords, organicEtv: prev.organicEtv, paidKeywords: prev.paidKeywords, paidEtv: prev.paidEtv } : null,
    positionDistribution: positionBuckets(o),
    movement: { isNew: num(o.is_new), isUp: num(o.is_up), isDown: num(o.is_down), isLost: num(o.is_lost) },
    history,
    topKeywords: topKeywords.slice(0, 10),
    topKeywordsTotal: num(raw.ranked?.total_count ?? o.count),
    competitors: raw.competitors ? normalizeCompetitors(raw.competitors, raw.domain, num(o.count)).slice(0, 10) : [],
    intents: (["informational", "navigational", "commercial", "transactional"] as SearchIntent[]).map((intent) => ({
      intent, keywords: intentAgg.get(intent)?.keywords ?? 0, etv: Math.round(intentAgg.get(intent)?.etv ?? 0),
    })),
    intentSampleSize: topKeywords.length,
    topPages: (raw.pages ?? []).map((pg) => ({ url: pg.page_address, keywords: num(pg.metrics?.organic?.count), etv: num(pg.metrics?.organic?.etv) })),
    backlinkProfile: bl
      ? {
          dofollow: Math.max(0, num(bl.backlinks) - nofollow),
          nofollow,
          referringIps: numOrNull(bl.referring_ips),
          topAnchors: (raw.anchors?.items ?? []).map((a) => ({ anchor: a.anchor, backlinks: num(a.backlinks), referringDomains: num(a.referring_domains) })),
          tlds: Object.entries(bl.referring_links_tld ?? {})
            .map(([tld, n]) => ({ tld: tld.startsWith(".") ? tld : `.${tld}`, referringDomains: num(n) }))
            .sort((a, b) => b.referringDomains - a.referringDomains)
            .slice(0, 6),
        }
      : null,
    countries: null, // Not requested in v1 — see docs/INTEGRATION.md
  };
}
