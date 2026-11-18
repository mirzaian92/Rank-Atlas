import type { PositionBucket, SearchIntent } from "@/lib/reports/types";
import type { DfsRankMetrics } from "../types";

export const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
export const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Collapse DataForSEO's 12 position buckets into the 5 used across the UI. */
export function positionBuckets(m: DfsRankMetrics | null | undefined): { bucket: PositionBucket; count: number }[] {
  const g = (k: keyof DfsRankMetrics) => num(m?.[k]);
  return [
    { bucket: "1-3", count: g("pos_1") + g("pos_2_3") },
    { bucket: "4-10", count: g("pos_4_10") },
    { bucket: "11-20", count: g("pos_11_20") },
    { bucket: "21-50", count: g("pos_21_30") + g("pos_31_40") + g("pos_41_50") },
    { bucket: "51-100", count: g("pos_51_60") + g("pos_61_70") + g("pos_71_80") + g("pos_81_90") + g("pos_91_100") },
  ];
}

const INTENTS = new Set<SearchIntent>(["informational", "navigational", "commercial", "transactional"]);
export function intentOf(v: string | null | undefined): SearchIntent | null {
  return v && INTENTS.has(v as SearchIntent) ? (v as SearchIntent) : null;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
