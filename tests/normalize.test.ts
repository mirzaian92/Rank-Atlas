import { describe, expect, it } from "vitest";
import { normalizeDomainOverview, normalizeHistory } from "@/lib/dataforseo/normalize/domain-overview";
import { positionBuckets } from "@/lib/dataforseo/normalize/common";

describe("positionBuckets", () => {
  it("collapses 12 provider buckets into 5", () => {
    const b = positionBuckets({ pos_1: 1, pos_2_3: 2, pos_4_10: 3, pos_11_20: 4, pos_21_30: 5, pos_31_40: 6, pos_41_50: 7, pos_51_60: 8, pos_61_70: 9, pos_71_80: 10, pos_81_90: 11, pos_91_100: 12 });
    expect(b.map((x) => x.count)).toEqual([3, 3, 4, 18, 50]);
  });
  it("treats missing metrics as zero", () => {
    expect(positionBuckets(null).every((x) => x.count === 0)).toBe(true);
  });
});

describe("normalizeHistory", () => {
  it("sorts months ascending and keys them YYYY-MM-01", () => {
    const h = normalizeHistory([
      { se_type: "google", year: 2026, month: 10, metrics: { organic: { etv: 2, count: 20 } } },
      { se_type: "google", year: 2026, month: 9, metrics: { organic: { etv: 1, count: 10 } } },
    ]);
    expect(h.map((x) => x.date)).toEqual(["2026-09-01", "2026-10-01"]);
    expect(h[1]).toMatchObject({ organicEtv: 2, organicKeywords: 20, paidEtv: 0 });
  });
});

describe("normalizeDomainOverview", () => {
  const base = { domain: "x.com", ranked: null, competitors: null, pages: null, backlinks: null, anchors: null };
  it("uses the calendar month before the latest point as 'previous', never a gap", () => {
    const d = normalizeDomainOverview({
      ...base,
      overview: { se_type: "google", location_code: 2840, language_code: "en", metrics: { organic: { count: 100, etv: 50 } } },
      history: [
        { se_type: "google", year: 2026, month: 8, metrics: { organic: { count: 70 } } },
        { se_type: "google", year: 2026, month: 10, metrics: { organic: { count: 90 } } },
      ],
    });
    expect(d.previous).toBeNull(); // September missing → no fabricated comparison
  });
  it("leaves backlink fields null when the backlinks call failed", () => {
    const d = normalizeDomainOverview({ ...base, overview: null, history: null });
    expect(d.summary.backlinks).toBeNull();
    expect(d.backlinkProfile).toBeNull();
    expect(d.summary.organicKeywords).toBe(0);
  });
  it("filters the target out of its own competitor list", () => {
    const d = normalizeDomainOverview({
      ...base, overview: null, history: null,
      competitors: [
        { se_type: "google", domain: "x.com", avg_position: 1, sum_position: 1, intersections: 100 },
        { se_type: "google", domain: "y.com", avg_position: 5, sum_position: 1, intersections: 10, full_domain_metrics: { organic: { count: 40, etv: 9 } } },
      ],
    });
    expect(d.competitors.map((c) => c.domain)).toEqual(["y.com"]);
  });
});
