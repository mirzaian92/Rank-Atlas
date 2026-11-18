import "server-only";
import type { ApiGroup } from "./endpoints";

/**
 * In-process limiter: a per-minute token bucket per API group plus a global concurrency cap.
 * DataForSEO's documented account limit is ~2000 requests/minute with lower simultaneous-request
 * caps on some APIs — VERIFY current limits in the docs. We stay well below them by default.
 * For multi-instance deployments, replace with a shared (Redis/Postgres) limiter.
 */
const PER_MINUTE: Record<ApiGroup, number> = { labs: 250, serp: 500, backlinks: 250, on_page: 250, appendix: 60 };
const MAX_CONCURRENT = 8;

type Bucket = { tokens: number; updated: number };
const buckets = new Map<ApiGroup, Bucket>();
let active = 0;
const waiters: (() => void)[] = [];

function take(group: ApiGroup): number {
  const cap = PER_MINUTE[group];
  const now = Date.now();
  const b = buckets.get(group) ?? { tokens: cap, updated: now };
  b.tokens = Math.min(cap, b.tokens + ((now - b.updated) / 60000) * cap);
  b.updated = now;
  buckets.set(group, b);
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return 0;
  }
  return Math.ceil(((1 - b.tokens) / cap) * 60000);
}

/** Returns a release function. Throws if the wait would exceed `maxWaitMs`. */
export async function acquire(group: ApiGroup, maxWaitMs = 15000): Promise<() => void> {
  const wait = take(group);
  if (wait > maxWaitMs) throw new Error(`RATE_LIMITED:${wait}`);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  if (active >= MAX_CONCURRENT) await new Promise<void>((r) => waiters.push(r));
  active++;
  return () => {
    active--;
    waiters.shift()?.();
  };
}
