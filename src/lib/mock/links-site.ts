/** MOCK generators for backlink, site audit and position tracking reports. Placeholder data only. */
import type {
  AnchorRow, AuditIssue, BacklinkAudit, BacklinkGapPage, BacklinkRow, BacklinkSummary, PositionTracking, ReferringDomainRow, SiteAudit,
} from "@/lib/reports/types";
import { assessRisk, spamDistribution } from "@/lib/reports/backlink-risk";
import type { BlGapQuery } from "@/lib/reports/backlink-query";
import { lastDays, lastMonths, rng, walk } from "./rng";
import { ANCHORS, COMPETITOR_STEMS, PAGE_PATHS, TLDS, TOPICS, domainStem } from "./words";
import type { MockCtx } from "./domain";
import { mockRankedKeywords } from "./domain";

const COUNTRIES = ["US", "GB", "DE", "FR", "CA", "IN", "NL", "AU", "BR", null];

function refDomains(target: string, n: number, salt = ""): ReferringDomainRow[] {
  const r = rng(`${target}|refdomains${salt}`);
  const used = new Set<string>();
  const rows: ReferringDomainRow[] = [];
  while (rows.length < n) {
    const d = `${r.pick([...COMPETITOR_STEMS, ...TOPICS.map((t) => t.replace(/\s/g, ""))])}${r.chance(0.3) ? r.int(1, 99) : ""}${r.pick([...TLDS, ".info", ".xyz", ".blog"])}`;
    if (used.has(d)) continue;
    used.add(d);
    const backlinks = r.logInt(1, 4000);
    rows.push({
      domain: d,
      domainRank: r.int(0, 92),
      backlinks,
      dofollow: Math.round(backlinks * r.float(0.3, 1)),
      firstSeen: new Date(Date.now() - r.int(10, 2400) * 864e5).toISOString(),
      spamScore: r.chance(0.85) ? r.int(0, 35) : r.int(36, 98),
      country: r.pick(COUNTRIES),
    });
  }
  return rows.sort((a, b) => (b.domainRank ?? 0) - (a.domainRank ?? 0));
}

/** MOCK backlink universe: summary + full row sets that the mock handler pages/filters. */
export type MockBacklinkData = BacklinkSummary & { backlinks: BacklinkRow[]; referringDomains: ReferringDomainRow[]; anchors: AnchorRow[] };

export function mockBacklinkAnalytics(target: string, _ctx?: MockCtx): MockBacklinkData {
  const r = rng(`${target}|backlinks`);
  const backlinks = r.logInt(2000, 40_000_000);
  const rd = Math.round(backlinks / r.float(8, 120));
  const nof = r.float(0.1, 0.45);
  const months = lastMonths(24);
  const bl = walk(r, 24, backlinks * 0.75, 0.012, 0.03);
  const domains = refDomains(target, 320);
  const rows: BacklinkRow[] = [...domains, ...domains.slice(0, 180)].map((d, i) => ({
    sourceUrl: `https://${d.domain}/${r.pick(["blog", "resources", "news", "review"])}/${r.pick(TOPICS).replace(/\s/g, "-")}-${i}`,
    sourceTitle: `${r.pick(TOPICS).replace(/\b\w/g, (c) => c.toUpperCase())} resources — ${d.domain}`,
    sourceDomainRank: d.domainRank,
    targetUrl: `https://${target}${r.pick(PAGE_PATHS)}`,
    anchor: r.chance(0.9) ? r.pick([target, domainStem(target), ...ANCHORS]) : null,
    dofollow: r.chance(1 - nof),
    type: r.chance(0.88) ? "anchor" : r.pick(["image", "redirect", "canonical"]),
    firstSeen: d.firstSeen,
    lastSeen: new Date(Date.now() - r.int(0, 20) * 864e5).toISOString(),
    isNew: r.chance(0.07),
    isLost: r.chance(0.05),
  }));
  return {
    target,
    summary: {
      domainRank: Math.min(100, Math.round(Math.log10(rd + 1) * 18)),
      backlinks, referringDomains: rd,
      referringIps: Math.round(rd * 0.8), referringSubnets: Math.round(rd * 0.62),
      dofollow: Math.round(backlinks * (1 - nof)), nofollow: Math.round(backlinks * nof),
      brokenBacklinks: Math.round(backlinks * r.float(0.005, 0.04)),
      spamScore: r.int(1, 30),
    },
    history: months.map((date, i) => ({
      date, backlinks: Math.round((bl[i] * backlinks) / bl[23]), referringDomains: Math.round((bl[i] * rd) / bl[23]),
      newReferringDomains: Math.round(rd * r.float(0.01, 0.04)), lostReferringDomains: Math.round(rd * r.float(0.008, 0.03)),
    })),
    backlinks: rows,
    referringDomains: domains,
    anchors: [target, domainStem(target), `https://${target}`, ...ANCHORS, "(empty)"].map((anchor, i) => ({
      anchor, backlinks: Math.round(backlinks * (0.22 / (i + 1))), referringDomains: Math.round(rd * (0.25 / (i + 1))), dofollowShare: Math.round(r.float(40, 98)), firstSeen: null,
    })),
    linkTypes: [
      { type: "Text", count: Math.round(backlinks * 0.82) }, { type: "Image", count: Math.round(backlinks * 0.11) },
      { type: "Redirect", count: Math.round(backlinks * 0.05) }, { type: "Canonical", count: Math.round(backlinks * 0.02) },
    ],
    tlds: [".com", ".org", ".net", ".io", ".co.uk", ".de", ".edu", ".gov"].map((tld, i) => ({ tld, referringDomains: Math.round(rd * (0.45 / (i + 1))) })),
  };
}

/** MOCK Backlink Gap tab page: referring domains with per-domain link counts, filtered by tab rules. */
export function mockBacklinkGap(domains: string[], q: BlGapQuery): BacklinkGapPage {
  const r = rng(`${domains.join("|")}|blgap`);
  const pool = refDomains(domains.join("+"), 400, "gap").map((d) => {
    const backlinks = domains.map((_, i) => (r.chance(i === 0 ? 0.35 : 0.55) ? r.logInt(1, 300) : 0));
    return { domain: d.domain, domainRank: d.domainRank, backlinks };
  });
  const you = (x: number[]) => x[0] > 0;
  const comps = (x: number[]) => x.slice(1);
  const rows = pool.filter((p) => {
    const b = p.backlinks;
    switch (q.tab) {
      case "best": return !you(b) && comps(b).every((n) => n > 0);
      case "untapped": return !you(b) && comps(b).some((n) => n > 0);
      case "shared": return b.every((n) => n > 0);
      case "unique": return you(b) && comps(b).every((n) => n === 0);
    }
  }).filter((p) => q.drMin === undefined || (p.domainRank ?? 0) >= q.drMin).sort((a, b) => (b.domainRank ?? 0) - (a.domainRank ?? 0));
  return { domains, tab: q.tab, total: rows.length, page: q.page, size: q.size, rows: rows.slice((q.page - 1) * q.size, q.page * q.size) };
}

export function mockBacklinkAudit(target: string, sample = 500): BacklinkAudit {
  const all = refDomains(target, 640, "audit");
  const domains = all.slice(0, sample).map((d) => ({ ...d, ...assessRisk(d) }));
  return {
    target,
    sampleSize: sample,
    totalReferringDomains: all.length,
    summary: {
      referringDomains: domains.length,
      toxic: domains.filter((d) => d.risk === "toxic").length,
      suspicious: domains.filter((d) => d.risk === "suspicious").length,
      healthy: domains.filter((d) => d.risk === "healthy").length,
      avgSpamScore: Math.round(domains.reduce((a, b) => a + (b.spamScore ?? 0), 0) / Math.max(1, domains.length)),
    },
    distribution: spamDistribution(domains.map((d) => d.spamScore)),
    domains: domains.sort((a, b) => (b.spamScore ?? 0) - (a.spamScore ?? 0)),
  };
}

const ISSUES: Omit<AuditIssue, "pages">[] = [
  { id: "4xx", title: "Pages returning 4xx status codes", severity: "error", category: "Crawlability", description: "Internal URLs return client errors. Fix or redirect them." },
  { id: "5xx", title: "Pages returning 5xx status codes", severity: "error", category: "Crawlability", description: "Server errors prevent crawling." },
  { id: "broken_links", title: "Broken internal links", severity: "error", category: "Links", description: "Links pointing to non-existent internal pages." },
  { id: "duplicate_title", title: "Duplicate title tags", severity: "error", category: "On-page", description: "Multiple pages share identical <title> elements." },
  { id: "no_title", title: "Missing title tag", severity: "error", category: "On-page", description: "Pages without a <title> element." },
  { id: "https_to_http", title: "HTTPS pages linking to HTTP", severity: "warning", category: "HTTPS", description: "Mixed protocol internal links." },
  { id: "no_description", title: "Missing meta description", severity: "warning", category: "On-page", description: "Pages without a meta description." },
  { id: "title_too_long", title: "Title too long", severity: "warning", category: "On-page", description: "Titles longer than the recommended length may be truncated." },
  { id: "low_content", title: "Low word count", severity: "warning", category: "Content", description: "Pages with very little text content." },
  { id: "large_page", title: "Large page size", severity: "warning", category: "Performance", description: "HTML size exceeds the recommended threshold." },
  { id: "slow_load", title: "Slow page load time", severity: "warning", category: "Performance", description: "Pages with high time to interactive." },
  { id: "no_image_alt", title: "Images missing alt text", severity: "warning", category: "Accessibility", description: "Images without alt attributes." },
  { id: "no_h1", title: "Missing H1 heading", severity: "notice", category: "On-page", description: "Pages without an H1 heading." },
  { id: "redirect_chain", title: "Redirect chains", severity: "notice", category: "Crawlability", description: "URLs redirecting through multiple hops." },
  { id: "orphan", title: "Pages with only one incoming internal link", severity: "notice", category: "Links", description: "Weakly linked pages." },
  { id: "no_canonical", title: "Missing canonical tag", severity: "notice", category: "Indexability", description: "Pages without rel=canonical." },
];

export function mockSiteAudit(target: string): SiteAudit {
  const r = rng(`${target}|audit`);
  const maxPages = 500;
  const crawled = r.int(120, maxPages);
  const issues = ISSUES.map((i) => ({ ...i, pages: r.chance(0.8) ? r.int(1, Math.round(crawled * (i.severity === "error" ? 0.08 : 0.3))) : 0 })).filter((i) => i.pages > 0);
  const count = (s: AuditIssue["severity"]) => issues.filter((i) => i.severity === s).reduce((a, b) => a + b.pages, 0);
  return {
    target,
    crawl: { status: "finished", pagesCrawled: crawled, pagesInQueue: 0, maxPages, startedAt: new Date(Date.now() - 36e5).toISOString(), finishedAt: new Date(Date.now() - 30e5).toISOString() },
    healthScore: r.int(58, 96),
    counts: { errors: count("error"), warnings: count("warning"), notices: count("notice") },
    issues: issues.sort((a, b) => ["error", "warning", "notice"].indexOf(a.severity) - ["error", "warning", "notice"].indexOf(b.severity) || b.pages - a.pages),
    thematic: ["Crawlability", "HTTPS", "On-page", "Performance", "Internal linking", "Markup"].map((label) => ({ label, score: r.int(55, 100) })),
    statusCodes: [
      { code: "2xx", pages: Math.round(crawled * 0.9) }, { code: "3xx", pages: Math.round(crawled * 0.06) },
      { code: "4xx", pages: Math.round(crawled * 0.035) }, { code: "5xx", pages: Math.round(crawled * 0.005) },
    ],
    pages: Array.from({ length: Math.min(crawled, 120) }, (_, i) => {
      const path = i < PAGE_PATHS.length ? PAGE_PATHS[i] : `/blog/${r.pick(TOPICS).replace(/\s/g, "-")}-${i}`;
      const code = r.chance(0.93) ? 200 : r.pick([301, 404, 500]);
      return {
        url: `https://${target}${path}`, statusCode: code, title: code === 200 ? `${path} — ${target}` : null,
        onpageScore: r.int(40, 100), issues: r.int(0, 9), loadTimeMs: r.int(180, 4200), words: code === 200 ? r.int(80, 3200) : null,
      };
    }),
  };
}

export function mockPositionTracking(domain: string, ctx: MockCtx): PositionTracking {
  const r = rng(`${domain}|tracking`);
  const days = lastDays(30);
  const kws = mockRankedKeywords(domain, ctx, 40);
  const keywords = kws.map((k) => {
    let p = k.position;
    const history = days.map(() => {
      p = Math.min(100, Math.max(1, p + r.int(-2, 2)));
      return r.chance(0.03) ? null : p;
    });
    const position = history[history.length - 1];
    const prev = history[history.length - 2];
    const best = Math.min(...history.filter((x): x is number => x != null));
    return {
      keyword: k.keyword, position, previous: prev, best: Number.isFinite(best) ? best : null, url: position ? k.url : null,
      searchVolume: k.searchVolume, tags: r.chance(0.4) ? [r.pick(["brand", "product", "blog", "priority"])] : [], history,
    };
  });
  return {
    project: { id: "mock-project", name: `${domain} — core keywords`, domain, device: "desktop", keywordCount: keywords.length, createdAt: new Date(Date.now() - 40 * 864e5).toISOString() },
    visibility: days.map((date, i) => {
      const ps = keywords.map((k) => k.history[i]);
      const ranked = ps.filter((p): p is number => p != null);
      const ctr = (p: number) => (p <= 1 ? 0.3 : p <= 3 ? 0.15 : p <= 10 ? 0.04 : p <= 20 ? 0.01 : 0);
      return {
        date,
        visibility: Math.round((ranked.reduce((a, p) => a + ctr(p), 0) / (keywords.length * 0.3)) * 10000) / 100,
        avgPosition: Math.round((ranked.reduce((a, b) => a + b, 0) / Math.max(1, ranked.length)) * 10) / 10,
        top3: ranked.filter((p) => p <= 3).length,
        top10: ranked.filter((p) => p <= 10).length,
      };
    }),
    keywords,
  };
}
