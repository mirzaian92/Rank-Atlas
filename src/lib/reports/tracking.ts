/**
 * Position Tracking logic shared by server and tests. History is built only from stored checks
 * (RankSnapshot rows) — days without a check are gaps, never estimated.
 */
import type { PositionTracking } from "./types";

export const TRACK_DEPTHS = [10, 20, 50, 100] as const;

/** Standard-queue SERP estimate per keyword check (≈ $0.0006 per 10 results — VERIFY pricing). */
export function estimateCheckCost(depth: number) {
  return 0.0006 * Math.ceil(depth / 10);
}
export function estimateTrackingCost(keywords: number, depth: number) {
  const perDay = keywords * estimateCheckCost(depth);
  return { perCheck: perDay, perDay, perMonth: perDay * 30 };
}

/** Normalize a host: lowercase, no protocol/www/path. */
export function hostOf(urlOrDomain: string): string {
  return urlOrDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#:].*$/, "");
}

/** Does a SERP result domain belong to the tracked domain (exact host or any subdomain)? */
export function matchesDomain(resultDomain: string | null | undefined, tracked: string): boolean {
  if (!resultDomain) return false;
  const r = hostOf(resultDomain);
  const t = hostOf(tracked);
  return r === t || r.endsWith(`.${t}`);
}

/** CTR model for the visibility score (share of the clicks a #1 ranking would get). */
export function ctr(position: number | null): number {
  if (position == null) return 0;
  if (position === 1) return 0.3;
  if (position <= 3) return 0.15;
  if (position <= 10) return 0.04;
  if (position <= 20) return 0.01;
  return 0;
}

export type SnapshotInput = { keywordId: string; checkedAt: Date | string; status: string; position: number | null; url: string | null; source: string };
export type KeywordInput = { id: string; keyword: string; tags: string[]; searchVolume: number | null };

const dayKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

export function lastNDays(n: number, end = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - (n - 1 - i)));
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Build the report from stored checks. For each keyword and day the latest *completed* check wins.
 * Days with no completed checks at all are omitted from the visibility series (gaps).
 */
export function buildTrackingReport(
  project: NonNullable<PositionTracking["project"]>,
  keywords: KeywordInput[],
  snapshots: SnapshotInput[],
  days = 30,
  end = new Date(),
): PositionTracking & { pending: number; mock: boolean; checkedDays: number } {
  const range = lastNDays(days, end);
  const done = snapshots.filter((s) => s.status === "done");
  // keywordId -> day -> latest snapshot that day
  const grid = new Map<string, Map<string, SnapshotInput>>();
  for (const s of done) {
    const day = dayKey(s.checkedAt);
    const m = grid.get(s.keywordId) ?? new Map<string, SnapshotInput>();
    const prev = m.get(day);
    if (!prev || new Date(prev.checkedAt) < new Date(s.checkedAt)) m.set(day, s);
    grid.set(s.keywordId, m);
  }
  const checkedDays = range.filter((d) => keywords.some((k) => grid.get(k.id)?.has(d)));

  const rows = keywords.map((k) => {
    const m = grid.get(k.id);
    const history = range.map((d) => (m?.get(d) ? m.get(d)!.position : null));
    const checks = range.flatMap((d) => (m?.get(d) ? [m.get(d)!] : []));
    const latest = checks[checks.length - 1];
    const previous = checks[checks.length - 2];
    const ranked = checks.map((c) => c.position).filter((p): p is number => p != null);
    return {
      keyword: k.keyword,
      position: latest?.position ?? null,
      previous: previous?.position ?? null,
      best: ranked.length ? Math.min(...ranked) : null,
      url: latest?.url ?? null,
      searchVolume: k.searchVolume,
      tags: k.tags,
      history,
      checked: Boolean(latest),
    };
  });

  const visibility = checkedDays.map((d) => {
    const ps = keywords.map((k) => grid.get(k.id)?.get(d)?.position ?? null);
    const ranked = ps.filter((p): p is number => p != null);
    return {
      date: d,
      visibility: keywords.length ? Math.round((ps.reduce<number>((a, p) => a + ctr(p), 0) / (keywords.length * 0.3)) * 10000) / 100 : 0,
      avgPosition: ranked.length ? Math.round((ranked.reduce((a, b) => a + b, 0) / ranked.length) * 10) / 10 : 0,
      top3: ranked.filter((p) => p <= 3).length,
      top10: ranked.filter((p) => p <= 10).length,
    };
  });

  return {
    project,
    visibility,
    keywords: rows,
    pending: snapshots.filter((s) => s.status === "pending").length,
    mock: done.some((s) => s.source === "mock"),
    checkedDays: checkedDays.length,
  };
}
