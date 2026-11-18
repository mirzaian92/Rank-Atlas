import { describe, expect, it } from "vitest";
import { normalizeKeyword, normalizeSerp, serpFeatureCounts } from "@/lib/dataforseo/normalize/keywords";

describe("normalizeKeyword", () => {
  it("maps metrics, sorts monthly searches ascending and keeps the last 12", () => {
    const monthly = Array.from({ length: 14 }, (_, i) => ({ year: 2025 + Math.floor((i + 9) / 12), month: ((i + 9) % 12) + 1, search_volume: i }));
    const k = normalizeKeyword({
      keyword: "crm software",
      keyword_info: { search_volume: 9900, cpc: 12.5, competition: 0.8, monthly_searches: [...monthly].reverse() },
      keyword_properties: { keyword_difficulty: 71 },
      serp_info: { serp_item_types: ["organic", "people_also_ask", "video"], se_results_count: 1200000 },
      search_intent_info: { main_intent: "commercial" },
    });
    expect(k).toMatchObject({ searchVolume: 9900, cpc: 12.5, competition: 0.8, keywordDifficulty: 71, intent: "commercial", resultsCount: 1200000, wordCount: 2 });
    expect(k.serpFeatures).toEqual(["people_also_ask", "video"]);
    expect(k.monthlySearches).toHaveLength(12);
    expect(k.monthlySearches[0].date < k.monthlySearches[11].date).toBe(true);
    expect(k.monthlySearches[11].searchVolume).toBe(13);
  });
  it("keeps unknown values null instead of inventing them", () => {
    const k = normalizeKeyword({ keyword: "x", keyword_info: null, keyword_properties: null, search_intent_info: { main_intent: "weird" } });
    expect(k).toMatchObject({ searchVolume: 0, cpc: null, keywordDifficulty: null, intent: null, resultsCount: null, monthlySearches: [] });
  });
});

describe("normalizeSerp", () => {
  it("titles SERP features and leaves per-result metrics null", () => {
    const r = normalizeSerp({
      keyword: "crm",
      items: [
        { type: "featured_snippet", rank_absolute: 1, domain: "a.com", title: "Snippet", url: "https://a.com" },
        { type: "people_also_ask", rank_absolute: 2 },
        { type: "organic", rank_absolute: 3, domain: "b.com", title: " B ", url: "https://b.com/x" },
      ],
    });
    expect(r.map((x) => x.title)).toEqual(["Snippet", "People also ask", "B"]);
    expect(r[2]).toMatchObject({ rank: 3, domain: "b.com", domainRank: null, etv: null });
    expect(serpFeatureCounts(r)).toContainEqual({ type: "organic", count: 1 });
  });
  it("handles a missing result", () => {
    expect(normalizeSerp(null)).toEqual([]);
  });
});
