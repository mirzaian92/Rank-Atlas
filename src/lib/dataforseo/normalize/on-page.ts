/**
 * DataForSEO OnPage → SiteAudit. Pure functions.
 * Only checks that indicate a problem are mapped to issues; "positive" checks (is_https,
 * has_micromarkup, seo_friendly_url, …) count passing pages and are ignored.
 * VERIFY check names against https://docs.dataforseo.com/v3/on_page/summary/.
 */
import type { AuditIssue, SiteAudit } from "@/lib/reports/types";
import type { DfsOnPagePage, DfsOnPageSummary } from "../types";
import { dfsDate } from "./backlinks";

type IssueMeta = Omit<AuditIssue, "id" | "pages">;
export const ONPAGE_ISSUES: Record<string, IssueMeta> = {
  is_4xx_code: { title: "Pages returning 4xx status codes", severity: "error", category: "Crawlability", description: "Internal URLs return client errors. Fix or redirect them." },
  is_5xx_code: { title: "Pages returning 5xx status codes", severity: "error", category: "Crawlability", description: "Server errors prevent crawling." },
  is_broken: { title: "Broken pages", severity: "error", category: "Crawlability", description: "Pages that could not be loaded." },
  broken_links: { title: "Broken links", severity: "error", category: "Links", description: "Links pointing to pages that return errors." },
  broken_resources: { title: "Broken resources", severity: "error", category: "Performance", description: "Images, scripts or styles that fail to load." },
  redirect_loop: { title: "Redirect loops", severity: "error", category: "Crawlability", description: "URLs that redirect back to themselves." },
  no_title: { title: "Missing title tag", severity: "error", category: "On-page", description: "Pages without a <title> element." },
  duplicate_title: { title: "Duplicate title tags", severity: "error", category: "On-page", description: "Multiple pages share identical <title> elements." },
  canonical_to_broken: { title: "Canonical points to a broken page", severity: "error", category: "Indexability", description: "rel=canonical targets a URL that returns an error." },
  https_to_http_links: { title: "HTTPS pages linking to HTTP", severity: "warning", category: "HTTPS", description: "Mixed-protocol internal links." },
  duplicate_description: { title: "Duplicate meta descriptions", severity: "warning", category: "On-page", description: "Multiple pages share the same meta description." },
  duplicate_content: { title: "Duplicate content", severity: "warning", category: "Content", description: "Pages with near-identical content." },
  no_description: { title: "Missing meta description", severity: "warning", category: "On-page", description: "Pages without a meta description." },
  title_too_long: { title: "Title too long", severity: "warning", category: "On-page", description: "Titles longer than the recommended length may be truncated." },
  title_too_short: { title: "Title too short", severity: "warning", category: "On-page", description: "Very short titles carry little information." },
  low_content_rate: { title: "Low text-to-HTML ratio", severity: "warning", category: "Content", description: "Little visible text relative to the page's HTML." },
  high_loading_time: { title: "Slow page load time", severity: "warning", category: "Performance", description: "Pages that take a long time to load." },
  high_waiting_time: { title: "Slow server response", severity: "warning", category: "Performance", description: "High time to first byte." },
  large_page_size: { title: "Large page size", severity: "warning", category: "Performance", description: "HTML size exceeds the recommended threshold." },
  size_greater_than_3mb: { title: "Pages larger than 3 MB", severity: "warning", category: "Performance", description: "Very large pages may not be fully crawled." },
  no_image_alt: { title: "Images missing alt text", severity: "warning", category: "Accessibility", description: "Images without alt attributes." },
  redirect_chain: { title: "Redirect chains", severity: "warning", category: "Crawlability", description: "URLs redirecting through multiple hops." },
  canonical_to_redirect: { title: "Canonical points to a redirect", severity: "warning", category: "Indexability", description: "rel=canonical targets a URL that redirects." },
  has_meta_refresh_redirect: { title: "Meta refresh redirects", severity: "warning", category: "Crawlability", description: "Pages redirecting with <meta http-equiv=refresh>." },
  has_render_blocking_resources: { title: "Render-blocking resources", severity: "notice", category: "Performance", description: "Scripts or styles that delay rendering." },
  no_h1_tag: { title: "Missing H1 heading", severity: "notice", category: "On-page", description: "Pages without an H1 heading." },
  has_links_to_redirects: { title: "Links to redirects", severity: "notice", category: "Links", description: "Internal links that point to redirecting URLs." },
  is_orphan_page: { title: "Orphan pages", severity: "notice", category: "Links", description: "Pages with no incoming internal links." },
  no_image_title: { title: "Images missing title attribute", severity: "notice", category: "Accessibility", description: "Images without a title attribute." },
  no_favicon: { title: "Missing favicon", severity: "notice", category: "Markup", description: "No favicon detected." },
  deprecated_html_tags: { title: "Deprecated HTML tags", severity: "notice", category: "Markup", description: "Obsolete tags such as <font> or <center>." },
  no_doctype: { title: "Missing doctype", severity: "notice", category: "Markup", description: "Pages without a <!DOCTYPE> declaration." },
  no_encoding_meta_tag: { title: "Missing encoding declaration", severity: "notice", category: "Markup", description: "Pages without a charset declaration." },
  low_readability_rate: { title: "Low readability", severity: "notice", category: "Content", description: "Text that is hard to read." },
};

const SEVERITY_ORDER = { error: 0, warning: 1, notice: 2 } as const;

export function normalizeOnPage(target: string, s: DfsOnPageSummary | null, pages: DfsOnPagePage[], maxPages: number): SiteAudit {
  const pm = s?.page_metrics ?? {};
  const checks = { ...(pm.checks ?? {}) } as Record<string, number>;
  // Some counts live at the page_metrics top level rather than in checks.
  for (const k of ["duplicate_title", "duplicate_description", "duplicate_content", "broken_links", "broken_resources", "redirect_loop"]) {
    const v = pm[k];
    if (typeof v === "number" && checks[k] == null) checks[k] = v;
  }
  const issues: AuditIssue[] = Object.entries(checks)
    .filter(([k, n]) => ONPAGE_ISSUES[k] && typeof n === "number" && n > 0)
    .map(([k, n]) => ({ id: k, pages: n, ...ONPAGE_ISSUES[k] }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.pages - a.pages);
  const count = (sev: AuditIssue["severity"]) => issues.filter((i) => i.severity === sev).reduce((a, b) => a + b.pages, 0);

  const crawled = s?.crawl_status?.pages_crawled ?? pages.length;
  const c4 = checks.is_4xx_code ?? 0;
  const c5 = checks.is_5xx_code ?? 0;
  const c3 = checks.is_redirect ?? 0;
  const finished = s?.crawl_progress === "finished";
  return {
    target,
    crawl: {
      status: finished ? "finished" : "crawling",
      pagesCrawled: crawled,
      pagesInQueue: s?.crawl_status?.pages_in_queue ?? 0,
      maxPages: s?.crawl_status?.max_crawl_pages ?? maxPages,
      startedAt: dfsDate(s?.domain_info?.crawl_start),
      finishedAt: dfsDate(s?.domain_info?.crawl_end),
    },
    healthScore: Math.round(Number(pm.onpage_score ?? 0)),
    counts: { errors: count("error"), warnings: count("warning"), notices: count("notice") },
    issues,
    statusCodes: [
      { code: "2xx", pages: Math.max(0, crawled - c3 - c4 - c5) },
      { code: "3xx", pages: c3 },
      { code: "4xx", pages: c4 },
      { code: "5xx", pages: c5 },
    ],
    pages: pages
      .filter((p) => !p.resource_type || p.resource_type === "html" || p.resource_type === "broken" || p.resource_type === "redirect")
      .map((p) => ({
        url: p.url,
        statusCode: p.status_code ?? 0,
        title: p.meta?.title ?? null,
        onpageScore: Math.round(p.onpage_score ?? 0),
        issues: Object.entries(p.checks ?? {}).filter(([k, v]) => v === true && ONPAGE_ISSUES[k]).length,
        loadTimeMs: p.page_timing?.duration_time ?? null,
        words: p.meta?.content?.plain_text_word_count ?? null,
      })),
  };
}
