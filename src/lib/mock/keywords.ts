/** MOCK generators for keyword-level reports. Placeholder data for UI design only. */
import type {
  KeywordDifficultyReport, KeywordGap, KeywordMetrics, RankedKeyword, KeywordOverview,
  SearchIntent, SerpAnalysis, SerpResult,
} from "@/lib/reports/types";
import { lastMonths, rng } from "./rng";
import { COMPETITOR_STEMS, MODIFIERS_POST, MODIFIERS_PRE, QUESTIONS, SERP_FEATURES, TLDS, TOPICS } from "./words";
import type { MagicMode } from "@/lib/reports/keyword-query";
import type { MockCtx } from "./domain";
import { mockHistory, mockRankedKeywords } from "./domain";
import { mergeGap, type GapKeyword, type PairwiseLists } from "@/lib/reports/keyword-gap";

const INTENTS: SearchIntent[] = ["informational", "navigational", "commercial", "transactional"];

export function mockKeywordMetrics(keyword: string, ctx: MockCtx): KeywordMetrics {
  const r = rng(`${keyword}|${ctx.locationCode}|kwm`);
  const words = keyword.trim().split(/\s+/).length;
  const volume = r.logInt(10, Math.max(100, 400000 / Math.pow(words, 2)));
  const months = lastMonths(12);
  const seasonal = r.float(0, 0.35);
  const phase = r.int(0, 11);
  const q = keyword.toLowerCase();
  const intent: SearchIntent = /^(how|what|why|when|where|can|is)\b/.test(q)
    ? "informational"
    : /\b(buy|price|pricing|cheap|discount|coupon)\b/.test(q)
      ? "transactional"
      : /\b(best|top|vs|review|reviews|alternatives|compare)\b/.test(q)
        ? "commercial"
        : r.pick(INTENTS);
  return {
    keyword,
    searchVolume: volume,
    cpc: r.chance(0.92) ? Math.round(r.float(0.1, 22) * 100) / 100 : null,
    competition: Math.round(r.next() * 100) / 100,
    keywordDifficulty: Math.min(100, Math.round(r.float(0, 1) * 70 + 30 / words)),
    intent,
    monthlySearches: months.map((date, i) => ({
      date,
      searchVolume: Math.round(volume * (1 + seasonal * Math.sin(((i + phase) / 12) * Math.PI * 2)) * r.float(0.92, 1.08)),
    })),
    serpFeatures: SERP_FEATURES.filter(() => r.chance(0.3)),
    resultsCount: r.logInt(10000, 2_000_000_000),
    wordCount: words,
  };
}

function expand(seed: string, r: ReturnType<typeof rng>, n: number, questionsOnly = false): string[] {
  const out = new Set<string>();
  let guard = 0;
  while (out.size < n && guard++ < n * 10) {
    const roll = r.next();
    if (questionsOnly || roll < 0.15) out.add(`${r.pick(QUESTIONS)} ${seed}`);
    else if (roll < 0.5) out.add(`${seed} ${r.pick(MODIFIERS_POST)}`);
    else if (roll < 0.8) out.add(`${r.pick(MODIFIERS_PRE)} ${seed}`);
    else out.add(`${r.pick(MODIFIERS_PRE)} ${seed} ${r.pick(MODIFIERS_POST)}`);
  }
  return [...out];
}

export function mockSerp(keyword: string, ctx: MockCtx, device = "desktop"): SerpResult[] {
  const r = rng(`${keyword}|${ctx.locationCode}|${device}|serp`);
  const results: SerpResult[] = [];
  let rank = 1;
  if (r.chance(0.4)) {
    const d = `${r.pick(COMPETITOR_STEMS)}${r.pick(TLDS)}`;
    results.push({ rank: rank++, type: "featured_snippet", title: `${keyword} — explained`, url: `https://${d}/guide/${keyword.replace(/\s+/g, "-")}`, domain: d, description: "Mock featured snippet text.", etv: null, domainRank: r.int(20, 90), backlinks: r.logInt(100, 2_000_000) });
  }
  for (let i = 0; i < 10; i++) {
    const d = `${r.pick(COMPETITOR_STEMS)}${r.pick(["", "hq", "app"])}${r.pick(TLDS)}`;
    results.push({
      rank: rank++,
      type: "organic",
      title: `${keyword.replace(/\b\w/g, (c) => c.toUpperCase())} | ${d}`,
      url: `https://${d}/${r.pick(["blog", "guide", "pricing", "learn"])}/${keyword.replace(/\s+/g, "-")}`,
      domain: d,
      description: "Mock result description for layout purposes.",
      etv: Math.round(r.logInt(10, 20000)),
      domainRank: r.int(10, 95),
      backlinks: r.logInt(50, 5_000_000),
    });
    if (i === 2 && r.chance(0.6)) results.push({ rank: rank++, type: "people_also_ask", title: "People also ask", url: "", domain: "", description: null, etv: null, domainRank: null, backlinks: null });
  }
  return results;
}

export function mockKeywordOverview(keyword: string, ctx: MockCtx): KeywordOverview {
  const r = rng(`${keyword}|${ctx.locationCode}|ov`);
  return {
    keyword: mockKeywordMetrics(keyword, ctx),
    variations: expand(keyword, r, 10).map((k) => mockKeywordMetrics(k, ctx)).sort((a, b) => b.searchVolume - a.searchVolume),
    questions: expand(keyword, r, 6, true).map((k) => mockKeywordMetrics(k, ctx)).sort((a, b) => b.searchVolume - a.searchVolume),
    serp: mockSerp(keyword, ctx),
  };
}

/**
 * MOCK keyword universe for each Keyword Magic mode (paged / filtered by applyKeywordQuery).
 * broad = seed words in any position · phrase = contains the exact seed phrase · related = topical
 * neighbours without the seed · questions = question-form · ideas = mix of all.
 */
export function mockKeywordMagicPool(seed: string, ctx: MockCtx, mode: MagicMode): KeywordMetrics[] {
  const r = rng(`${seed}|${ctx.locationCode}|magic|${mode}`);
  const s = seed.toLowerCase();
  const words = s.split(/\s+/);
  let list: string[];
  if (mode === "questions") list = expand(seed, r, 220, true);
  else if (mode === "phrase") list = expand(seed, r, 600).filter((k) => k.includes(s));
  else if (mode === "related") {
    const out = new Set<string>();
    let guard = 0;
    while (out.size < 400 && guard++ < 4000) {
      const t = r.pick(TOPICS);
      out.add(r.chance(0.5) ? `${r.pick(MODIFIERS_PRE)} ${t} ${r.pick(MODIFIERS_POST)}` : `${t} ${r.pick(MODIFIERS_POST)}`);
    }
    list = [...out];
  } else if (mode === "broad") {
    // Seed words split around modifiers, e.g. "crm software" → "crm for small business software".
    const extra = words.length > 1 ? expand(words.join(` ${r.pick(["for", "and", "with"])} `), r, 150) : [];
    list = [...new Set([...expand(seed, r, 600), ...extra])];
  } else {
    list = [...new Set([...expand(seed, r, 300), ...expand(r.pick(TOPICS), r, 200), ...expand(seed, r, 80, true)])];
  }
  return list.map((k) => mockKeywordMetrics(k, ctx));
}

export function mockKeywordDifficulty(keywords: string[], ctx: MockCtx): KeywordDifficultyReport {
  return { keywords: keywords.map((k) => mockKeywordMetrics(k, ctx)) };
}

export function mockKeywordGap(domains: string[], ctx: MockCtx, sample = 200): KeywordGap {
  // Build mock pairwise lists from each domain's mock rankings, then merge with the real merge logic.
  const pools = domains.map((d) => mockRankedKeywords(d, ctx, 220));
  const r = rng(`${domains.join("|")}|gap`);
  const you = new Map(pools[0].map((k) => [k.keyword, k]));
  const lists: PairwiseLists[] = domains.slice(1).map((_, idx) => {
    const ci = idx + 1;
    const theirs = new Map(pools[ci].map((k) => [k.keyword, k]));
    // Make some of your keywords shared with this competitor.
    for (const k of pools[0].slice(0, 120)) if (r.chance(0.55) && !theirs.has(k.keyword)) theirs.set(k.keyword, { ...k, position: r.int(1, 100) });
    const toKw = (k: RankedKeyword): GapKeyword => ({ keyword: k.keyword, searchVolume: k.searchVolume, cpc: k.cpc, keywordDifficulty: k.keywordDifficulty, intent: k.intent });
    const byVol = <T extends { kw: GapKeyword }>(a: T[]) => a.sort((x, y) => y.kw.searchVolume - x.kw.searchVolume).slice(0, sample);
    return {
      competitor: ci,
      shared: byVol([...theirs.values()].filter((k) => you.has(k.keyword)).map((k) => ({ kw: toKw(k), you: you.get(k.keyword)!.position, them: k.position }))),
      onlyComp: byVol([...theirs.values()].filter((k) => !you.has(k.keyword)).map((k) => ({ kw: toKw(k), them: k.position }))),
      onlyYou: byVol([...you.values()].filter((k) => !theirs.has(k.keyword)).map((k) => ({ kw: toKw(k), you: k.position }))),
    };
  });
  return {
    domains,
    sampleSize: sample,
    totals: domains.map((d) => ({ domain: d, keywords: mockHistory(d, ctx, 1)[0].organicKeywords })),
    rows: mergeGap(domains.length, lists),
  };
}

export function mockSerpAnalysis(keyword: string, ctx: MockCtx, device: string): SerpAnalysis {
  const results = mockSerp(keyword, ctx, device);
  const features = new Map<string, number>();
  results.forEach((x) => features.set(x.type, (features.get(x.type) ?? 0) + 1));
  return {
    keyword,
    device,
    checkedAt: new Date().toISOString(),
    resultsCount: mockKeywordMetrics(keyword, ctx).resultsCount,
    features: [...features.entries()].map(([type, count]) => ({ type, count })),
    results,
  };
}
