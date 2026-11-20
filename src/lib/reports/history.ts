/**
 * Monthly history helpers. Months the provider did not return are kept as explicit gaps (null
 * values) so charts show a break and tables show "—". Nothing is interpolated.
 */

/** Add `n` months to a YYYY-MM-01 key. */
export function addMonths(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n, 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns one row per calendar month from the first to the last point. Missing months get
 * `missing: true` and every metric set to null.
 */
export function fillMonthGaps<T extends { date: string }>(points: T[], keys: (keyof T)[]): (T | ({ date: string; missing: true } & Record<string, null>))[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(sorted.map((p) => [p.date.slice(0, 7), p]));
  const out: (T | ({ date: string; missing: true } & Record<string, null>))[] = [];
  const last = sorted[sorted.length - 1].date.slice(0, 7) + "-01";
  for (let d = sorted[0].date.slice(0, 7) + "-01"; d <= last; d = addMonths(d, 1)) {
    const hit = byDate.get(d.slice(0, 7));
    if (hit) out.push(hit);
    else out.push({ date: d, missing: true, ...Object.fromEntries(keys.map((k) => [k, null])) } as { date: string; missing: true } & Record<string, null>);
  }
  return out;
}

export function countMissing(rows: { missing?: boolean }[]): number {
  return rows.filter((r) => r.missing).length;
}

export const HISTORY_SPANS = { "1y": 12, "2y": 24, "5y": 60 } as const;
/** Organic history is billed per month returned (measured Nov 2026: 24 months = $0.1488). Backlink history is flat ≈ $0.024. */
export function estimateHistoryCost(months: number) {
  return 0.012 + 0.0057 * months + 0.024;
}
export type HistorySpan = keyof typeof HISTORY_SPANS;
