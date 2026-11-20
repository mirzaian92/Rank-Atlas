/**
 * Keyword Gap logic shared by the browser, the mock handler and the DataForSEO service.
 *
 * DataForSEO's domain_intersection compares exactly two domains, so for "you vs N competitors"
 * we run three requests per competitor and merge them here:
 *   shared    (intersections: true)              you AND competitor rank
 *   onlyComp  (target1 = competitor, false)      competitor ranks, you don't
 *   onlyYou   (target1 = you, false)             you rank, competitor doesn't
 * Each list is capped at `sample` keywords (highest volume first), so categories describe the
 * analysed sample, not every keyword the domains rank for.
 */
import { z } from "zod";
import type { KeywordGapRow, SearchIntent } from "./types";

export const GAP_SAMPLES = [200, 500, 1000] as const;
export const gapQuerySchema = z.object({
  sample: z.coerce.number().int().refine((n) => (GAP_SAMPLES as readonly number[]).includes(n), "Invalid sample size").default(200),
});

/** Pre-flight estimate in USD (uncached). Labs: $0.012 per request + $0.00012 per row. */
export function estimateGapCost(domainCount: number, sample: number): number {
  const competitors = Math.max(0, domainCount - 1);
  return competitors * 3 * (0.012 + 0.00012 * sample) + domainCount * 0.01212;
}

export type GapKeyword = {
  keyword: string;
  searchVolume: number;
  cpc: number | null;
  keywordDifficulty: number | null;
  intent: SearchIntent | null;
};

export type PairwiseLists = {
  /** Index of the competitor in `domains` (1..n). */
  competitor: number;
  shared: { kw: GapKeyword; you: number; them: number }[];
  onlyComp: { kw: GapKeyword; them: number }[];
  onlyYou: { kw: GapKeyword; you: number }[];
};

/** Merge pairwise lists into one row per keyword with a position per domain (null = not ranking / not in sample). */
export function mergeGap(domainCount: number, lists: PairwiseLists[]): KeywordGapRow[] {
  const rows = new Map<string, KeywordGapRow>();
  const row = (kw: GapKeyword) => {
    const key = kw.keyword.toLowerCase();
    let r = rows.get(key);
    if (!r) {
      r = { ...kw, positions: Array.from({ length: domainCount }, () => null) };
      rows.set(key, r);
    }
    return r;
  };
  for (const l of lists) {
    for (const x of l.shared) {
      const r = row(x.kw);
      r.positions[0] = x.you;
      r.positions[l.competitor] = x.them;
    }
    for (const x of l.onlyComp) row(x.kw).positions[l.competitor] = x.them;
    for (const x of l.onlyYou) row(x.kw).positions[0] = x.you;
  }
  return [...rows.values()].sort((a, b) => b.searchVolume - a.searchVolume);
}

export const GAP_TABS = ["all", "shared", "missing", "weak", "strong", "untapped", "unique"] as const;
export type GapTab = (typeof GAP_TABS)[number];

export const GAP_TAB_INFO: Record<GapTab, { label: string; tip: string }> = {
  all: { label: "All", tip: "Every keyword in the analysed sample" },
  shared: { label: "Shared", tip: "Every domain ranks" },
  missing: { label: "Missing", tip: "Every competitor ranks, you don't" },
  weak: { label: "Weak", tip: "Every domain ranks, and you rank lower than all competitors" },
  strong: { label: "Strong", tip: "Every domain ranks, and you rank higher than all competitors" },
  untapped: { label: "Untapped", tip: "At least one competitor ranks, you don't" },
  unique: { label: "Unique", tip: "Only you rank" },
};

/** Does a row belong in a tab? positions[0] is "you". */
export function inGapTab(positions: (number | null)[], tab: GapTab): boolean {
  const [you, ...others] = positions;
  const ranked = others.filter((p): p is number => p != null);
  const allOthers = ranked.length === others.length && others.length > 0;
  switch (tab) {
    case "all": return true;
    case "shared": return you != null && allOthers;
    case "missing": return you == null && allOthers;
    case "weak": return you != null && allOthers && ranked.every((p) => you > p);
    case "strong": return you != null && allOthers && ranked.every((p) => you < p);
    case "untapped": return you == null && ranked.length > 0;
    case "unique": return you != null && ranked.length === 0;
  }
}
