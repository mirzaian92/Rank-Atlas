import { describe, expect, it } from "vitest";
import { applyRankedQuery, rankedQuerySchema } from "@/lib/reports/ranked-query";
import type { RankedKeyword } from "@/lib/reports/types";

const kw = (keyword: string, position: number, searchVolume: number, etv: number, extra: Partial<RankedKeyword> = {}): RankedKeyword => ({
  keyword, position, previousPosition: null, searchVolume, cpc: 1, keywordDifficulty: 50, etv, trafficShare: 0,
  intent: "commercial", url: "https://x.com/", serpFeatures: [], lastUpdated: null, isNew: false, ...extra,
});
const rows = [kw("best crm", 3, 1000, 50), kw("crm login", 1, 5000, 900, { intent: "navigational" }), kw("free crm", 15, 2000, 10, { serpFeatures: ["video"] }), kw("email tool", 8, 300, 5)];

describe("applyRankedQuery", () => {
  it("filters, sorts and pages, reporting the filtered total", () => {
    const r = applyRankedQuery(rows, rankedQuerySchema.parse({ inc: "crm", size: "25", sort: "searchVolume", dir: "asc" }));
    expect(r.total).toBe(3);
    expect(r.rows.map((x) => x.keyword)).toEqual(["best crm", "free crm", "crm login"]);
  });
  it("supports intent, serp and range filters", () => {
    expect(applyRankedQuery(rows, rankedQuerySchema.parse({ intent: "navigational" })).total).toBe(1);
    expect(applyRankedQuery(rows, rankedQuerySchema.parse({ serp: "video" })).rows[0].keyword).toBe("free crm");
    expect(applyRankedQuery(rows, rankedQuerySchema.parse({ posMax: "5" })).total).toBe(2);
  });
});
