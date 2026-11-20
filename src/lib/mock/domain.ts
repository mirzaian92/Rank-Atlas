/**
 * MOCK generators for domain-level reports. Placeholder data for UI design only.
 */
import type {
  CompetitorRow, DomainHistoryPoint, DomainOverview, HistoricalTrends, OrganicCompetitors,
  OrganicPage, OrganicResearchSummary, PagedRows, PositionBucket, RankedKeyword, SearchIntent,
} from "@/lib/reports/types";
import { MARKETS } from "@/lib/config/markets";
import { lastMonths, rng, walk, type Rng } from "./rng";
import { COMPETITOR_STEMS, MODIFIERS_POST, MODIFIERS_PRE, PAGE_PATHS, SERP_FEATURES, TLDS, TOPICS, ANCHORS, domainStem } from "./words";

export type MockCtx = { locationCode: number; languageCode: string };

const INTENTS: SearchIntent[] = ["informational", "navigational", "commercial", "transactional"];
const BUCKETS: PositionBucket[] = ["1-3", "4-10", "11-20", "21-50", "51-100"];

function scale(domain: string, ctx: MockCtx) {
  const r = rng(`${domain}|${ctx.locationCode}|scale`);
  // A domain "size" so different domains look different.
  const keywords = r.logInt(800, 450000);
  return { r, keywords, etvPerKw: r.float(0.6, 6) };
}

export function mockHistory(domain: string, ctx: MockCtx, months = 24): DomainHistoryPoint[] {
  const { keywords, etvPerKw } = scale(domain, ctx);
  const r = rng(`${domain}|${ctx.locationCode}|history`);
  const dates = lastMonths(months);
  const kw = walk(r, months, keywords * 0.7, 0.015, 0.05);
  // Rescale so the final month equals the current keyword count.
  const factor = keywords / kw[kw.length - 1];
  return dates.map((date, i) => {
    const k = Math.round(kw[i] * factor);
    const etv = Math.round(k * etvPerKw * r.float(0.92, 1.08));
    const shares = [0.07, 0.13, 0.17, 0.3, 0.33].map((s) => s * r.float(0.9, 1.1));
    const sum = shares.reduce((a, b) => a + b, 0);
    const [p1, p2, p3, p4, p5] = shares.map((s) => Math.round((s / sum) * k));
    const paidK = Math.round(k * 0.012 * r.float(0.6, 1.4));
    return {
      date, organicEtv: etv, organicKeywords: k, paidEtv: Math.round(paidK * r.float(8, 30)), paidKeywords: paidK,
      pos1_3: p1, pos4_10: p2, pos11_20: p3, pos21_50: p4, pos51_100: p5,
    };
  });
}

function mockKeywordText(r: Rng, stem: string, i: number): string {
  const topic = r.pick(TOPICS);
  const roll = r.next();
  if (i < 3) return i === 0 ? stem : `${stem} ${r.pick(MODIFIERS_POST)}`;
  if (roll < 0.25) return `${stem} ${r.pick(MODIFIERS_POST)}`;
  if (roll < 0.55) return `${r.pick(MODIFIERS_PRE)} ${topic} ${r.pick(MODIFIERS_POST)}`;
  if (roll < 0.8) return `${topic} ${r.pick(MODIFIERS_POST)}`;
  return `${r.pick(MODIFIERS_PRE)} ${topic}`;
}

export function mockRankedKeywords(domain: string, ctx: MockCtx, count = 250): RankedKeyword[] {
  const r = rng(`${domain}|${ctx.locationCode}|kw`);
  const stem = domainStem(domain);
  const seen = new Set<string>();
  const rows: RankedKeyword[] = [];
  for (let i = 0; rows.length < count && i < count * 4; i++) {
    const keyword = mockKeywordText(r, stem, i);
    if (seen.has(keyword)) continue;
    seen.add(keyword);
    const brand = keyword.includes(stem);
    const position = brand ? r.int(1, 3) : Math.min(100, Math.max(1, Math.round(r.logInt(1, 100))));
    const volume = brand ? r.logInt(5000, 300000) : r.logInt(20, 60000);
    const ctr = position <= 1 ? 0.3 : position <= 3 ? 0.15 : position <= 10 ? 0.04 : position <= 20 ? 0.01 : 0.002;
    const isNew = r.chance(0.06);
    const prev = isNew ? null : Math.min(100, Math.max(1, position + r.int(-8, 8)));
    rows.push({
      keyword,
      position,
      previousPosition: prev,
      searchVolume: volume,
      cpc: r.chance(0.9) ? Math.round(r.float(0.2, 18) * 100) / 100 : null,
      keywordDifficulty: r.int(4, 96),
      etv: Math.round(volume * ctr * 10) / 10,
      trafficShare: 0,
      intent: brand ? "navigational" : r.pick(INTENTS),
      url: `https://${domain}${r.pick(PAGE_PATHS)}`,
      serpFeatures: SERP_FEATURES.filter(() => r.chance(0.18)),
      lastUpdated: new Date(Date.now() - r.int(1, 25) * 864e5).toISOString(),
      isNew,
    });
  }
  const total = rows.reduce((a, b) => a + b.etv, 0) || 1;
  rows.forEach((k) => (k.trafficShare = Math.round((k.etv / total) * 10000) / 100));
  return rows.sort((a, b) => b.etv - a.etv);
}

export function mockCompetitors(domain: string, ctx: MockCtx, count = 30): CompetitorRow[] {
  const r = rng(`${domain}|${ctx.locationCode}|comp`);
  const { keywords } = scale(domain, ctx);
  const used = new Set<string>();
  const out: CompetitorRow[] = [];
  while (out.length < count) {
    const d = `${r.pick(COMPETITOR_STEMS)}${r.chance(0.3) ? r.pick(["hq", "app", "labs", "hub"]) : ""}${r.pick(TLDS)}`;
    if (used.has(d) || d === domain) continue;
    used.add(d);
    const theirs = r.logInt(Math.max(200, keywords * 0.1), keywords * 3);
    const common = Math.round(Math.min(keywords, theirs) * r.float(0.02, 0.4));
    out.push({
      domain: d,
      commonKeywords: common,
      organicKeywords: theirs,
      organicEtv: Math.round(theirs * r.float(0.5, 6)),
      avgPosition: Math.round(r.float(8, 45) * 10) / 10,
      competitionLevel: Math.round((common / (keywords + theirs - common)) * 1000) / 1000,
    });
  }
  return out.sort((a, b) => b.competitionLevel - a.competitionLevel);
}

function distribution(h: DomainHistoryPoint) {
  return BUCKETS.map((bucket, i) => ({
    bucket,
    count: [h.pos1_3, h.pos4_10, h.pos11_20, h.pos21_50, h.pos51_100][i],
  }));
}

export function mockDomainOverview(domain: string, ctx: MockCtx): DomainOverview {
  const r = rng(`${domain}|${ctx.locationCode}|overview`);
  const history = mockHistory(domain, ctx, 24);
  const cur = history[history.length - 1];
  const prev = history[history.length - 2];
  const keywords = mockRankedKeywords(domain, ctx, 100);
  const competitors = mockCompetitors(domain, ctx, 10);
  const backlinks = r.logInt(2000, 40_000_000);
  const refDomains = Math.round(backlinks / r.float(8, 120));
  const intents = INTENTS.map((intent) => {
    const ks = keywords.filter((k) => k.intent === intent);
    return { intent, keywords: ks.length, etv: Math.round(ks.reduce((a, b) => a + b.etv, 0)) };
  });
  const pages = PAGE_PATHS.slice(0, 10).map((p, i) => ({
    url: `https://${domain}${p}`,
    keywords: Math.round(cur.organicKeywords * (0.3 / (i + 1)) * r.float(0.6, 1.2)),
    etv: Math.round(cur.organicEtv * (0.35 / (i + 1)) * r.float(0.6, 1.2)),
  })).sort((a, b) => b.etv - a.etv);
  const nofollowShare = r.float(0.1, 0.45);
  return {
    domain,
    summary: {
      domainRank: Math.min(100, Math.round(Math.log10(refDomains + 1) * 18)),
      organicKeywords: cur.organicKeywords,
      organicEtv: cur.organicEtv,
      organicTrafficCost: Math.round(cur.organicEtv * r.float(0.4, 3.5)),
      paidKeywords: cur.paidKeywords,
      paidEtv: cur.paidEtv,
      paidTrafficCost: Math.round(cur.paidEtv * r.float(0.8, 4)),
      backlinks,
      referringDomains: refDomains,
    },
    previous: { organicKeywords: prev.organicKeywords, organicEtv: prev.organicEtv, paidKeywords: prev.paidKeywords, paidEtv: prev.paidEtv },
    positionDistribution: distribution(cur),
    movement: {
      isNew: Math.round(cur.organicKeywords * r.float(0.03, 0.09)),
      isUp: Math.round(cur.organicKeywords * r.float(0.08, 0.2)),
      isDown: Math.round(cur.organicKeywords * r.float(0.08, 0.2)),
      isLost: Math.round(cur.organicKeywords * r.float(0.03, 0.09)),
    },
    history,
    topKeywords: keywords.slice(0, 10),
    topKeywordsTotal: cur.organicKeywords,
    competitors,
    intents,
    intentSampleSize: keywords.length,
    topPages: pages.slice(0, 6),
    backlinkProfile: {
      dofollow: Math.round(backlinks * (1 - nofollowShare)),
      nofollow: Math.round(backlinks * nofollowShare),
      referringIps: Math.round(refDomains * r.float(0.6, 0.9)),
      topAnchors: [domain, domainStem(domain), `https://${domain}`, ...ANCHORS].slice(0, 6).map((anchor, i) => ({
        anchor,
        backlinks: Math.round(backlinks * (0.2 / (i + 1))),
        referringDomains: Math.round(refDomains * (0.25 / (i + 1))),
      })),
      tlds: [".com", ".org", ".net", ".io", ".co.uk", ".de"].map((tld, i) => ({ tld, referringDomains: Math.round(refDomains * (0.45 / (i + 1))) })),
    },
    countries: MARKETS.slice(0, 8).map((m, i) => {
      const share = i === 0 ? 1 : r.float(0.02, 0.35) / i;
      return { locationCode: m.locationCode, country: m.country, organicEtv: Math.round(cur.organicEtv * share), organicKeywords: Math.round(cur.organicKeywords * share) };
    }).sort((a, b) => b.organicEtv - a.organicEtv),
  };
}

export function mockOrganicSummary(domain: string, ctx: MockCtx): OrganicResearchSummary {
  const o = mockDomainOverview(domain, ctx);
  return {
    domain,
    summary: { organicKeywords: o.summary.organicKeywords, organicEtv: o.summary.organicEtv, organicTrafficCost: o.summary.organicTrafficCost, paidKeywords: o.summary.paidKeywords },
    positionDistribution: o.positionDistribution,
    movement: o.movement,
    history: o.history,
  };
}

/** Mock keyword universe for paging (1,000 rows; the "total" reported is the filtered count of these). */
export function mockOrganicKeywordPool(domain: string, ctx: MockCtx): RankedKeyword[] {
  return mockRankedKeywords(domain, ctx, 1000);
}

export function mockOrganicPages(domain: string, ctx: MockCtx, page: number, size: number): PagedRows<OrganicPage> {
  const keywords = mockOrganicKeywordPool(domain, ctx);
  const byUrl = new Map<string, { keywords: number; etv: number }>();
  for (const k of keywords) {
    const v = byUrl.get(k.url) ?? { keywords: 0, etv: 0 };
    v.keywords++;
    v.etv += k.etv;
    byUrl.set(k.url, v);
  }
  const totalEtv = keywords.reduce((a, b) => a + b.etv, 0) || 1;
  const all = [...byUrl.entries()]
    .map(([url, v]) => ({ url, keywords: v.keywords, etv: Math.round(v.etv), trafficShare: Math.round((v.etv / totalEtv) * 10000) / 100 }))
    .sort((a, b) => b.etv - a.etv);
  return { domain, total: all.length, page, size, rows: all.slice((page - 1) * size, page * size) };
}

export function mockOrganicCompetitors(domain: string, ctx: MockCtx): OrganicCompetitors {
  const h = mockHistory(domain, ctx, 1)[0];
  const comps = mockCompetitors(domain, ctx, 40);
  // Generic sites show up as competitors for almost everything (hidden by default in the UI).
  const generic = ["wikipedia.org", "youtube.com", "reddit.com"].map((d, i) => ({
    domain: d, commonKeywords: Math.round(h.organicKeywords * (0.3 - i * 0.05)), organicKeywords: 40_000_000 / (i + 1),
    organicEtv: 900_000_000 / (i + 1), avgPosition: 12 + i * 3, competitionLevel: 0.02 + i * 0.005,
  }));
  return { domain, target: { organicKeywords: h.organicKeywords, organicEtv: h.organicEtv }, competitors: [...comps, ...generic] };
}

export function mockHistoricalTrends(domain: string, ctx: MockCtx, span: "1y" | "2y" | "5y" = "1y"): HistoricalTrends {
  const months = span === "5y" ? 60 : span === "2y" ? 24 : 12;
  const history = mockHistory(domain, ctx, months);
  const r = rng(`${domain}|bl-history|${span}`);
  const bl = walk(r, months, r.logInt(5000, 5_000_000), 0.01, 0.04);
  return {
    domain,
    span,
    history,
    backlinkHistory: history.map((h, i) => ({ date: h.date, backlinks: bl[i], referringDomains: Math.round(bl[i] / 25) })),
    snapshots: [],
  };
}
