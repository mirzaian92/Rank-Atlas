import { describe, expect, it } from "vitest";
import { keywordQueryToDfs } from "@/lib/dataforseo/filters";
import { applyKeywordQuery, keywordQuerySchema, QUESTION_REGEX, wordGroups, isQuestion } from "@/lib/reports/keyword-query";
import type { KeywordMetrics } from "@/lib/reports/types";

const parse = (o: Record<string, unknown>) => keywordQuerySchema.parse(o);
const km = (keyword: string, searchVolume: number, extra: Partial<KeywordMetrics> = {}): KeywordMetrics => ({
  keyword, searchVolume, cpc: 1, competition: 0.5, keywordDifficulty: 40, intent: "commercial", monthlySearches: [], serpFeatures: [], resultsCount: null, wordCount: keyword.split(" ").length, ...extra,
});

describe("keywordQueryToDfs", () => {
  it("uses top-level fields for suggestions and sorts by volume by default", () => {
    expect(keywordQueryToDfs(parse({}))).toEqual({ order_by: ["keyword_info.search_volume,desc"], limit: 50, offset: 0 });
  });
  it("prefixes fields with keyword_data. for related_keywords", () => {
    const r = keywordQueryToDfs(parse({ mode: "related", kdMax: "30", sort: "cpc", dir: "asc" }), "keyword_data.");
    expect(r.filters).toEqual([["keyword_data.keyword_properties.keyword_difficulty", "<=", 30]]);
    expect(r.order_by).toEqual(["keyword_data.keyword_info.cpc,asc", "keyword_data.keyword_info.search_volume,desc"]);
  });
  it("adds the question regex in questions mode, before user filters", () => {
    const r = keywordQueryToDfs(parse({ mode: "questions", inc: "free" }));
    expect(r.filters).toEqual([["keyword", "regex", QUESTION_REGEX], "and", ["keyword", "ilike", "%free%"]]);
  });
  it("rejects more than 8 conditions", () => {
    expect(() => keywordQueryToDfs(parse({ mode: "questions", inc: "a,b,c", exc: "d,e,f", volMin: "1", kdMin: "1" }))).toThrow(/up to 8/);
  });
  it("rejects unknown modes and sorts", () => {
    expect(keywordQuerySchema.safeParse({ mode: "exact" }).success).toBe(false);
    expect(keywordQuerySchema.safeParse({ sort: "position" }).success).toBe(false);
  });
});

describe("applyKeywordQuery / wordGroups", () => {
  const rows = [km("crm software free", 500), km("best crm software", 900, { intent: "informational" }), km("crm software pricing", 300, { keywordDifficulty: 80 }), km("free crm tools", 50)];
  it("filters, sorts and reports the filtered total", () => {
    const r = applyKeywordQuery(rows, parse({ inc: "free", sort: "searchVolume", dir: "asc" }));
    expect(r.total).toBe(2);
    expect(r.rows.map((x) => x.keyword)).toEqual(["free crm tools", "crm software free"]);
    expect(applyKeywordQuery(rows, parse({ kdMin: "70" })).rows[0].keyword).toBe("crm software pricing");
  });
  it("groups repeated non-seed words and ignores stop words", () => {
    const g = wordGroups(rows, "crm software");
    expect(g).toEqual([{ term: "free", count: 2, volume: 550 }]);
  });
  it("recognises questions", () => {
    expect(isQuestion("How does crm work")).toBe(true);
    expect(isQuestion("however crm")).toBe(false);
  });
});
