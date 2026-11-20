import { describe, expect, it } from "vitest";
import { estimateGapCost, inGapTab, mergeGap, type GapKeyword } from "@/lib/reports/keyword-gap";
import { isGenericDomain } from "@/lib/reports/generic-domains";

const kw = (keyword: string, searchVolume = 100): GapKeyword => ({ keyword, searchVolume, cpc: null, keywordDifficulty: null, intent: null });

describe("inGapTab (positions[0] = you)", () => {
  it("classifies two-domain cases", () => {
    expect(inGapTab([3, 5], "shared")).toBe(true);
    expect(inGapTab([3, 5], "strong")).toBe(true);
    expect(inGapTab([3, 5], "weak")).toBe(false);
    expect(inGapTab([9, 5], "weak")).toBe(true);
    expect(inGapTab([null, 5], "missing")).toBe(true);
    expect(inGapTab([null, 5], "untapped")).toBe(true);
    expect(inGapTab([4, null], "unique")).toBe(true);
    expect(inGapTab([4, null], "shared")).toBe(false);
  });
  it("needs every competitor for missing/weak/strong, any one for untapped", () => {
    expect(inGapTab([null, 5, null], "missing")).toBe(false);
    expect(inGapTab([null, 5, null], "untapped")).toBe(true);
    expect(inGapTab([10, 5, 20], "weak")).toBe(false); // better than one competitor
    expect(inGapTab([10, 5, 20], "strong")).toBe(false);
    expect(inGapTab([10, 5, 20], "shared")).toBe(true);
    expect(inGapTab([30, 5, 20], "weak")).toBe(true);
  });
  it("treats equal positions as neither strong nor weak", () => {
    expect(inGapTab([5, 5], "strong")).toBe(false);
    expect(inGapTab([5, 5], "weak")).toBe(false);
  });
});

describe("mergeGap", () => {
  it("merges pairwise lists into one row per keyword (case-insensitive), sorted by volume", () => {
    const rows = mergeGap(3, [
      { competitor: 1, shared: [{ kw: kw("crm", 900), you: 2, them: 4 }], onlyComp: [{ kw: kw("erp", 500), them: 7 }], onlyYou: [{ kw: kw("Billing", 50), you: 9 }] },
      { competitor: 2, shared: [{ kw: kw("CRM", 900), you: 2, them: 1 }], onlyComp: [{ kw: kw("erp", 500), them: 3 }], onlyYou: [] },
    ]);
    expect(rows.map((r) => [r.keyword, r.positions])).toEqual([
      ["crm", [2, 4, 1]],
      ["erp", [null, 7, 3]],
      ["Billing", [9, null, null]],
    ]);
    expect(inGapTab(rows[1].positions, "missing")).toBe(true);
    expect(inGapTab(rows[2].positions, "unique")).toBe(true);
  });
});

describe("estimateGapCost", () => {
  it("is 3 requests per competitor plus one overview per domain", () => {
    expect(estimateGapCost(2, 200)).toBeCloseTo(3 * (0.012 + 0.024) + 2 * 0.01212, 6);
    expect(estimateGapCost(5, 1000)).toBeCloseTo(4 * 3 * (0.012 + 0.12) + 5 * 0.01212, 6);
  });
});

describe("isGenericDomain", () => {
  it("matches listed sites and their subdomains only", () => {
    expect(isGenericDomain("wikipedia.org")).toBe(true);
    expect(isGenericDomain("de.wikipedia.org")).toBe(true);
    expect(isGenericDomain("mywikipedia.org")).toBe(false);
    expect(isGenericDomain("hubspot.com")).toBe(false);
  });
});

import { logAxis } from "@/components/charts/scatter-map";
describe("logAxis", () => {
  it("returns unique ascending ticks inside the domain, even for a narrow range", () => {
    for (const vals of [[6120, 3060], [6120, 6120], [1, 5_000_000], [42]]) {
      const { domain, ticks } = logAxis(vals);
      expect(new Set(ticks).size).toBe(ticks.length);
      expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
      expect(ticks.every((t) => t >= domain[0] && t <= domain[1])).toBe(true);
      expect(ticks.length).toBeGreaterThanOrEqual(2);
      expect(ticks.length).toBeLessThanOrEqual(10);
    }
  });
});
