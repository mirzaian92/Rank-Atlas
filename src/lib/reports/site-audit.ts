/** Site Audit options shared by browser and server. */
export const AUDIT_PAGE_LIMITS = [100, 250, 500, 1000, 2000] as const;

/** OnPage basic crawl: $0.00015 per page (verified Nov 2026; JavaScript rendering costs more and is off). */
export function estimateCrawlCost(maxPages: number) {
  return 0.00015 * maxPages;
}
