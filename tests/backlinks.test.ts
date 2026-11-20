import { describe, expect, it } from "vitest";
import { blGapToDfs, blQueryToDfs } from "@/lib/dataforseo/filters";
import { blGapQuerySchema, blQuerySchema, applyBacklinkQuery } from "@/lib/reports/backlink-query";
import { assessRisk, spamDistribution, estimateAuditCost } from "@/lib/reports/backlink-risk";
import { dfsDate, normalizeBacklinkSummary, normalizeGapItem, normalizeReferringDomain } from "@/lib/dataforseo/normalize/backlinks";
import type { BacklinkRow } from "@/lib/reports/types";

const bq = (o: Record<string, unknown>) => blQuerySchema.parse(o);

describe("blQueryToDfs", () => {
  it("backlinks: live status, rank scale, default sort by referring domain rank", () => {
    expect(blQueryToDfs(bq({ view: "backlinks" }))).toEqual({
      mode: "as_is", backlinks_status_type: "live", order_by: ["domain_from_rank,desc"], limit: 50, offset: 0, rank_scale: "one_hundred",
    });
  });
  it("backlinks: new + nofollow + type + rank range + search", () => {
    const r = blQueryToDfs(bq({ view: "backlinks", status: "new", attr: "nofollow", type: "image", drMin: "30", search: "50%", sort: "firstSeen", dir: "asc", page: "2", size: "25" }));
    expect(r).toMatchObject({ backlinks_status_type: "live", order_by: ["first_seen,asc"], limit: 25, offset: 25 });
    expect(r.filters).toEqual([
      ["is_new", "=", true], "and", ["dofollow", "=", false], "and", ["item_type", "in", ["image"]], "and",
      ["domain_from_rank", ">=", 30], "and", [["url_from", "like", "%50\\%%"], "or", ["anchor", "like", "%50\\%%"]],
    ]);
  });
  it("lost backlinks use backlinks_status_type lost", () => {
    expect(blQueryToDfs(bq({ view: "backlinks", status: "lost" }))).toMatchObject({ backlinks_status_type: "lost" });
  });
  it("domains and anchors map their own fields", () => {
    expect(blQueryToDfs(bq({ view: "domains", spamMax: "20", search: "blog", sort: "backlinks" }))).toMatchObject({
      filters: [["backlinks_spam_score", "<=", 20], "and", ["domain", "like", "%blog%"]], order_by: ["backlinks,desc"],
    });
    expect(blQueryToDfs(bq({ view: "anchors", sort: "referringDomains" }))).toMatchObject({ order_by: ["referring_domains,desc"] });
  });
  it("rejects sorts a view can't use", () => {
    expect(blQuerySchema.safeParse({ view: "anchors", sort: "domainRank" }).success).toBe(false);
    expect(blQuerySchema.safeParse({ view: "backlinks", sort: "lastSeen" }).success).toBe(true);
  });
});

describe("blGapToDfs (domains[0] = you)", () => {
  const d = ["you.com", "a.com", "b.com"];
  const g = (tab: string) => blGapToDfs(d, blGapQuerySchema.parse({ tab }));
  it("best: competitors only, all of them, excluding you", () => {
    const { payload, targetIndex } = g("best");
    expect(payload).toMatchObject({ targets: { "1": "a.com", "2": "b.com" }, exclude_targets: ["you.com"], intersection_mode: "all" });
    expect(targetIndex).toEqual({ "1": 1, "2": 2 });
  });
  it("untapped is partial; shared includes you; unique excludes competitors", () => {
    expect(g("untapped").payload).toMatchObject({ intersection_mode: "partial", exclude_targets: ["you.com"] });
    expect(g("shared").payload).toMatchObject({ targets: { "1": "you.com", "2": "a.com", "3": "b.com" }, intersection_mode: "all" });
    expect(g("shared").payload).not.toHaveProperty("exclude_targets");
    expect(g("unique").payload).toMatchObject({ targets: { "1": "you.com" }, exclude_targets: ["a.com", "b.com"] });
  });
});

describe("backlink normalizers", () => {
  it("parses DataForSEO dates", () => {
    expect(dfsDate("2026-10-01 00:00:00 +00:00")).toBe("2026-10-01T00:00:00.000Z");
    expect(dfsDate("garbage")).toBeNull();
    expect(dfsDate(null)).toBeNull();
  });
  it("maps gap items by target key and fills excluded domains with 0", () => {
    const item = { domain_intersection: { "1": { domain: "ref.org", rank: 44, backlinks: 3 }, "2": { domain: "ref.org", rank: 44, backlinks: 9 } } };
    expect(normalizeGapItem(item, ["you.com", "a.com", "b.com"], { "1": 1, "2": 2 })).toEqual({ domain: "ref.org", domainRank: 44, backlinks: [0, 3, 9] });
  });
  it("never uses an analysed target as the referring domain name", () => {
    expect(normalizeGapItem({ domain_intersection: { "1": { target: "a.com", backlinks: 1 } } }, ["you.com", "a.com"], { "1": 1 })).toBeNull();
    expect(normalizeGapItem({ "1": { target: "ref.net", backlinks: 2 } }, ["you.com", "a.com"], { "1": 1 })?.domain).toBe("ref.net");
  });
  it("summary: dofollow = backlinks − nofollow, monthly history sorted", () => {
    const s = normalizeBacklinkSummary("x.com", { target: "x.com", rank: 40, backlinks: 100, backlinks_spam_score: 3, broken_backlinks: 1, referring_domains: 10, referring_domains_nofollow: 1, referring_main_domains: 9, referring_ips: 8, referring_subnets: 7, referring_links_tld: { com: 6 }, referring_links_types: { anchor: 90, image: 10 }, referring_links_attributes: { nofollow: 25 } }, [
      { date: "2026-10-01 00:00:00 +00:00", backlinks: 100, referring_domains: 10 },
      { date: "2026-09-01 00:00:00 +00:00", backlinks: 90, referring_domains: 9 },
    ]);
    expect(s.summary).toMatchObject({ dofollow: 75, nofollow: 25, domainRank: 40 });
    expect(s.history.map((h) => h.date)).toEqual(["2026-09-01", "2026-10-01"]);
    expect(s.linkTypes[0]).toEqual({ type: "Text", count: 90 });
    expect(s.tlds).toEqual([{ tld: ".com", referringDomains: 6 }]);
  });
  it("referring domain dofollow count", () => {
    expect(normalizeReferringDomain({ domain: "r.com", backlinks: 10, referring_links_attributes: { nofollow: 4 } }).dofollow).toBe(6);
  });
});

describe("risk rules", () => {
  const rd = (o: Partial<Parameters<typeof assessRisk>[0]>) => ({ domain: "ok.com", domainRank: 40, backlinks: 10, dofollow: 5, firstSeen: null, spamScore: 5, country: null, ...o });
  it("labels risk with reasons", () => {
    expect(assessRisk(rd({})).risk).toBe("healthy");
    expect(assessRisk(rd({ spamScore: 70 })).risk).toBe("toxic");
    expect(assessRisk(rd({ spamScore: 35 })).risk).toBe("suspicious");
    expect(assessRisk(rd({ domain: "x.xyz", domainRank: 2 }))).toEqual({ risk: "toxic", reasons: ["Low-quality TLD", "Very low domain rank"] });
  });
  it("buckets spam scores", () => {
    const d = spamDistribution([0, 10, 11, 100, null]);
    expect(d[0].count).toBe(2);
    expect(d[1].count).toBe(1);
    expect(d[9].count).toBe(1);
  });
  it("estimates audit cost", () => {
    expect(estimateAuditCost(1000)).toBeCloseTo(0.024 * 2 + 0.000036 * 2000, 6); // verified prices
  });
});

describe("applyBacklinkQuery (mock)", () => {
  const row = (o: Partial<BacklinkRow>): BacklinkRow => ({ sourceUrl: "https://s.com/a", sourceTitle: null, sourceDomainRank: 10, targetUrl: "t", anchor: "x", dofollow: true, type: "anchor", firstSeen: null, lastSeen: null, isNew: false, isLost: false, ...o });
  it("defaults to live links and applies status/attr filters", () => {
    const rows = [row({}), row({ isLost: true }), row({ isNew: true, dofollow: false })];
    expect(applyBacklinkQuery(rows, bq({ view: "backlinks" })).total).toBe(2);
    expect(applyBacklinkQuery(rows, bq({ view: "backlinks", status: "lost" })).total).toBe(1);
    expect(applyBacklinkQuery(rows, bq({ view: "backlinks", status: "new", attr: "nofollow" })).total).toBe(1);
  });
});

describe("sitewide rule", () => {
  const base = { domain: "big.com", backlinks: 5000, dofollow: 4990, firstSeen: null, spamScore: 5, country: null };
  it("does not flag sitewide links from established domains", () => {
    expect(assessRisk({ ...base, domainRank: 70 }).risk).toBe("healthy");
  });
  it("flags sitewide links from low-authority domains", () => {
    expect(assessRisk({ ...base, domainRank: 12 })).toEqual({ risk: "suspicious", reasons: ["Sitewide links from a low-authority domain"] });
  });
});
