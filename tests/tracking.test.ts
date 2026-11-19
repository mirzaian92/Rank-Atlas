import { describe, expect, it } from "vitest";
import { buildTrackingReport, ctr, estimateTrackingCost, hostOf, matchesDomain } from "@/lib/reports/tracking";

describe("domain matching", () => {
  it("normalizes hosts", () => {
    expect(hostOf("https://WWW.Example.com/path?q=1")).toBe("example.com");
  });
  it("matches the domain and its subdomains only", () => {
    expect(matchesDomain("www.example.com", "example.com")).toBe(true);
    expect(matchesDomain("blog.example.com", "example.com")).toBe(true);
    expect(matchesDomain("notexample.com", "example.com")).toBe(false);
    expect(matchesDomain("example.com.evil.io", "example.com")).toBe(false);
    expect(matchesDomain(null, "example.com")).toBe(false);
  });
});

describe("buildTrackingReport", () => {
  const project = { id: "p", name: "P", domain: "x.com", device: "desktop", keywordCount: 2, createdAt: "2026-11-01T00:00:00Z" };
  const kws = [{ id: "a", keyword: "alpha", tags: ["t"], searchVolume: 100 }, { id: "b", keyword: "beta", tags: [], searchVolume: null }];
  const end = new Date("2026-11-19T12:00:00Z");
  const snap = (keywordId: string, day: string, position: number | null, extra = {}) => ({ keywordId, checkedAt: `${day}T06:00:00Z`, status: "done", position, url: position ? "https://x.com/a" : null, source: "live", ...extra });

  it("uses the latest completed check per day and reports gaps as missing days", () => {
    const r = buildTrackingReport(project, kws, [
      snap("a", "2026-11-17", 8), snap("a", "2026-11-19", 5), snap("a", "2026-11-19", 4, { checkedAt: "2026-11-19T09:00:00Z" }),
      snap("b", "2026-11-19", null),
      { keywordId: "b", checkedAt: "2026-11-19T10:00:00Z", status: "pending", position: null, url: null, source: "live" },
    ], 3, end);
    expect(r.visibility.map((v) => v.date)).toEqual(["2026-11-17", "2026-11-19"]); // 18th had no checks → gap
    const a = r.keywords.find((k) => k.keyword === "alpha")!;
    expect(a).toMatchObject({ position: 4, previous: 8, best: 4, history: [8, null, 4] });
    const b = r.keywords.find((k) => k.keyword === "beta")!;
    expect(b).toMatchObject({ position: null, best: null });
    expect(r.pending).toBe(1);
    expect(r.mock).toBe(false);
    expect(r.checkedDays).toBe(2);
  });

  it("computes visibility from the CTR model", () => {
    const r = buildTrackingReport(project, kws, [snap("a", "2026-11-19", 1), snap("b", "2026-11-19", 2)], 1, end);
    // (0.30 + 0.15) / (2 × 0.30) = 75%
    expect(r.visibility[0]).toMatchObject({ visibility: 75, avgPosition: 1.5, top3: 2, top10: 2 });
    expect(ctr(15)).toBe(0.01);
    expect(ctr(null)).toBe(0);
  });

  it("flags mock data", () => {
    expect(buildTrackingReport(project, kws, [snap("a", "2026-11-19", 3, { source: "mock" })], 1, end).mock).toBe(true);
  });
});

describe("estimateTrackingCost", () => {
  it("scales with keywords and depth", () => {
    const e = estimateTrackingCost(50, 100);
    expect(e.perDay).toBeCloseTo(50 * 0.006, 6);
    expect(e.perMonth).toBeCloseTo(50 * 0.006 * 30, 6);
  });
});
