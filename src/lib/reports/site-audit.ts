/** Site Audit options shared by browser and server. */
export const AUDIT_PAGE_LIMITS = [100, 250, 500, 1000, 2000] as const;

/** OnPage basic crawl ≈ $0.000125 per page (VERIFY pricing; JavaScript rendering costs more and is off). */
export function estimateCrawlCost(maxPages: number) {
  return 0.000125 * maxPages;
}
