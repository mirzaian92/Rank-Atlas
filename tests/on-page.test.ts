import { describe, expect, it } from "vitest";
import { normalizeOnPage } from "@/lib/dataforseo/normalize/on-page";

describe("normalizeOnPage", () => {
  const summary = {
    crawl_progress: "finished",
    crawl_status: { max_crawl_pages: 100, pages_in_queue: 0, pages_crawled: 50 },
    domain_info: { crawl_start: "2026-11-19 06:00:00 +00:00", crawl_end: "2026-11-19 06:05:00 +00:00" },
    page_metrics: {
      onpage_score: 87.6,
      duplicate_title: 3,
      broken_links: 2,
      checks: { is_4xx_code: 4, is_redirect: 6, no_description: 10, no_h1_tag: 7, is_https: 50, has_micromarkup: 12, some_new_check: 9 },
    },
  };
  const pages = [
    { url: "https://x.com/", status_code: 200, onpage_score: 95.2, meta: { title: "Home", content: { plain_text_word_count: 800 } }, page_timing: { duration_time: 420 }, checks: { no_h1_tag: true, is_https: true, no_description: false }, resource_type: "html" },
    { url: "https://x.com/img.png", status_code: 200, resource_type: "image" },
  ];

  it("maps only problem checks to issues, sorted by severity then pages", () => {
    const a = normalizeOnPage("x.com", summary, pages, 100);
    expect(a.issues.map((i) => [i.id, i.pages])).toEqual([
      ["is_4xx_code", 4], ["duplicate_title", 3], ["broken_links", 2], ["no_description", 10], ["no_h1_tag", 7],
    ]);
    expect(a.counts).toEqual({ errors: 9, warnings: 10, notices: 7 });
    expect(a.healthScore).toBe(88);
  });

  it("derives status codes and crawl info", () => {
    const a = normalizeOnPage("x.com", summary, pages, 100);
    expect(a.statusCodes).toEqual([{ code: "2xx", pages: 40 }, { code: "3xx", pages: 6 }, { code: "4xx", pages: 4 }, { code: "5xx", pages: 0 }]);
    expect(a.crawl).toMatchObject({ status: "finished", pagesCrawled: 50, maxPages: 100, finishedAt: "2026-11-19T06:05:00.000Z" });
  });

  it("keeps HTML pages and counts their failing checks", () => {
    const a = normalizeOnPage("x.com", summary, pages, 100);
    expect(a.pages).toEqual([{ url: "https://x.com/", statusCode: 200, title: "Home", onpageScore: 95, issues: 1, loadTimeMs: 420, words: 800 }]);
  });

  it("reports an in-progress crawl", () => {
    expect(normalizeOnPage("x.com", { crawl_progress: "in_progress", crawl_status: { pages_crawled: 3, pages_in_queue: 40 } }, [], 100).crawl).toMatchObject({ status: "crawling", pagesCrawled: 3, pagesInQueue: 40 });
  });
});
