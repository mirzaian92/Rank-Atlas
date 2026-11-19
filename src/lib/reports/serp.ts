/** SERP Analysis options shared by browser and server. */
export const SERP_DEPTHS = [10, 20, 50, 100] as const;

/** Pre-flight estimate: SERP (≈ $0.002 per 10 results — VERIFY pricing) + optional bulk_ranks. */
export function estimateSerpCost(depth: number, enrich: boolean) {
  return 0.002 * Math.ceil(depth / 10) + (enrich ? 0.02 + 0.00003 * depth : 0);
}
