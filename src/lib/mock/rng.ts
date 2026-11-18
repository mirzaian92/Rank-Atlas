/**
 * Deterministic pseudo-random helpers for MOCK data only.
 * The same input (domain/keyword + market) always yields the same placeholder numbers,
 * so the UI is stable while designing. None of this is real SEO data.
 */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Rng = {
  next: () => number;
  int: (min: number, max: number) => number;
  float: (min: number, max: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  chance: (p: number) => boolean;
  /** log-uniform: good for search volumes, traffic */
  logInt: (min: number, max: number) => number;
};

export function rng(seed: string): Rng {
  let a = hashString(seed) || 1;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    float: (min, max) => next() * (max - min) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    logInt: (min, max) => Math.round(Math.exp(Math.log(min) + next() * (Math.log(max) - Math.log(min)))),
  };
}

/** First day of each of the last `n` months (UTC), oldest first, ending with the current month. */
export function lastMonths(n: number, end = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function lastDays(n: number, end = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Smooth random walk around a trend, used for mock time series. */
export function walk(r: Rng, n: number, start: number, drift = 0.01, vol = 0.06): number[] {
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    v = Math.max(0, v * (1 + drift + (r.next() - 0.5) * vol * 2));
    out.push(Math.round(v));
  }
  return out;
}
