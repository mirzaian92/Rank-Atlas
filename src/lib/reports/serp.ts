/** SERP Analysis options shared by browser and server. */
export const SERP_DEPTHS = [10, 20, 50, 100] as const;

/** Pre-flight estimate: SERP ($0.002 per 10 results, live) + optional bulk_ranks ($0.024 + $0.000036/target). */
export function estimateSerpCost(depth: number, enrich: boolean) {
  return 0.002 * Math.ceil(depth / 10) + (enrich ? 0.024 + 0.000036 * depth : 0);
}
