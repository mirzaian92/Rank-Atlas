import { describe, expect, it } from "vitest";
import { addMonths, countMissing, fillMonthGaps } from "@/lib/reports/history";

describe("addMonths", () => {
  it("crosses year boundaries", () => {
    expect(addMonths("2025-11-01", 3)).toBe("2026-02-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
  });
});

describe("fillMonthGaps", () => {
  it("inserts null rows for missing months and never interpolates", () => {
    const rows = fillMonthGaps([{ date: "2026-01-01", v: 10 }, { date: "2026-04-01", v: 40 }, { date: "2026-02-01", v: 20 }], ["v"]);
    expect(rows.map((r) => [r.date, r.v])).toEqual([["2026-01-01", 10], ["2026-02-01", 20], ["2026-03-01", null], ["2026-04-01", 40]]);
    expect(countMissing(rows as { missing?: boolean }[])).toBe(1);
  });
  it("handles empty and single-point input", () => {
    expect(fillMonthGaps([], [])).toEqual([]);
    expect(fillMonthGaps([{ date: "2026-05-01", v: 1 }], ["v"])).toHaveLength(1);
  });
});

import { estimateSerpCost } from "@/lib/reports/serp";
describe("estimateSerpCost", () => {
  it("charges per 10 results plus optional Domain Rank lookup", () => {
    expect(estimateSerpCost(10, false)).toBeCloseTo(0.002, 6);
    expect(estimateSerpCost(100, false)).toBeCloseTo(0.02, 6);
    expect(estimateSerpCost(10, true)).toBeCloseTo(0.002 + 0.02 + 0.0003, 6);
  });
});
