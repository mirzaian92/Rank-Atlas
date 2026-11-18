import "server-only";
import type { ToolId } from "@/lib/config/tools";
import { getCacheSettings } from "@/lib/server/settings";
import { ENDPOINTS, type EndpointKey } from "./endpoints";
import type { DfsEnvelope } from "./types";
import { getCredentials } from "./credentials";
import { cacheGet, cacheKey, cacheSet } from "./cache";
import { assertWithinBudget } from "./budget";
import { acquire } from "./rate-limit";
import { logUsage } from "./usage";
import { mapProviderStatus, NO_RESULTS_CODES, providerError } from "./errors";
import { apiBaseUrl, isToolLive } from "./mode";

export type DfsCallOptions = {
  tool?: ToolId;
  bypassCache?: boolean;
  timeoutMs?: number;
  /** Appended to the path, e.g. "/{task_id}" for on_page/summary. */
  pathSuffix?: string;
};

export type DfsCallResult<R> = {
  result: R[];
  costUsd: number;
  cached: boolean;
  endpoint: string;
  taskId: string | null;
};

const RETRYABLE_HTTP = new Set([429, 500, 502, 503, 504]);

/**
 * The single server-side entry point for DataForSEO requests.
 * Order: live gate → credentials → cache → budget → rate limit → fetch (retry) → envelope check → log → cache store.
 */
const inflight = new Map<string, Promise<DfsCallResult<unknown>>>();

export async function dfsCall<R>(key: EndpointKey, payload: Record<string, unknown> | null, opts: DfsCallOptions = {}): Promise<DfsCallResult<R>> {
  // Identical concurrent requests share one provider call (avoids paying twice).
  const flightKey = cacheKey(ENDPOINTS[key].path + (opts.pathSuffix ?? ""), payload) + (opts.bypassCache ? ":nocache" : "");
  const existing = inflight.get(flightKey);
  if (existing) return existing as Promise<DfsCallResult<R>>;
  const p = dfsCallInner<R>(key, payload, opts).finally(() => inflight.delete(flightKey));
  inflight.set(flightKey, p as Promise<DfsCallResult<unknown>>);
  return p;
}

async function dfsCallInner<R>(key: EndpointKey, payload: Record<string, unknown> | null, opts: DfsCallOptions): Promise<DfsCallResult<R>> {
  const ep = ENDPOINTS[key];
  const path = ep.path + (opts.pathSuffix ?? "");

  if (!("free" in ep && ep.free) && opts.tool) {
    const gate = isToolLive(opts.tool);
    if (!gate.live) throw providerError("LIVE_DISABLED", gate.reason);
  }
  const creds = await getCredentials();
  if (!creds) throw providerError("NOT_CONFIGURED", "DataForSEO credentials are not configured. Add them in Settings → API credentials.");

  const cacheSettings = await getCacheSettings();
  const ttl = Math.round(ep.ttl * cacheSettings.ttlMultiplier);
  const ck = cacheKey(path, payload);
  if (ttl > 0 && cacheSettings.enabled && !opts.bypassCache) {
    const hit = await cacheGet<R[]>(ck);
    if (hit) {
      await logUsage({ api: ep.api, endpoint: path, tool: opts.tool, cacheKey: ck, cacheHit: true, costUsd: 0 });
      return { result: hit.value, costUsd: 0, cached: true, endpoint: path, taskId: null };
    }
  }

  const estimate = payload ? ep.estimate(payload) : ep.estimate({});
  if (!("free" in ep && ep.free)) await assertWithinBudget(estimate);

  let release: () => void;
  try {
    release = await acquire(ep.api);
  } catch {
    throw providerError("RATE_LIMITED", "Local rate limit reached for this API. Try again in a minute.");
  }

  const started = Date.now();
  const auth = "Basic " + Buffer.from(`${creds.login}:${creds.password}`).toString("base64");
  let res: Response | null = null;
  let lastErr: unknown = null;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60_000);
      try {
        res = await fetch(apiBaseUrl() + path, {
          method: ep.method,
          headers: { Authorization: auth, "Content-Type": "application/json" },
          body: ep.method === "POST" ? JSON.stringify([payload ?? {}]) : undefined,
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!RETRYABLE_HTTP.has(res.status)) break;
      } catch (e) {
        lastErr = e;
        res = null;
      } finally {
        clearTimeout(timer);
      }
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  } finally {
    release();
  }

  const durationMs = Date.now() - started;
  if (!res) {
    const msg = lastErr instanceof Error ? lastErr.message : "network error";
    await logUsage({ api: ep.api, endpoint: path, tool: opts.tool, estimatedUsd: estimate, durationMs, error: msg });
    throw providerError("API_UNAVAILABLE", `DataForSEO is unreachable (${msg}).`);
  }

  let body: DfsEnvelope<R>;
  try {
    body = (await res.json()) as DfsEnvelope<R>;
  } catch {
    await logUsage({ api: ep.api, endpoint: path, tool: opts.tool, httpStatus: res.status, estimatedUsd: estimate, durationMs, error: "invalid JSON" });
    throw providerError(res.status === 401 ? "NOT_CONFIGURED" : "API_UNAVAILABLE", `DataForSEO returned HTTP ${res.status}.`);
  }

  const task = body.tasks?.[0];
  const statusCode = task?.status_code ?? body.status_code;
  const statusMessage = task?.status_message ?? body.status_message;
  const costUsd = Number(body.cost ?? 0);

  await logUsage({
    api: ep.api, endpoint: path, tool: opts.tool, cacheKey: ck, httpStatus: res.status, statusCode, statusMessage,
    costUsd, estimatedUsd: estimate, durationMs, resultCount: task?.result_count ?? 0,
    error: mapProviderStatus(statusCode, statusMessage) ? statusMessage : undefined,
  });

  const envErr = mapProviderStatus(body.status_code, body.status_message);
  if (envErr) throw providerError(envErr, `DataForSEO: ${body.status_message} (${body.status_code})`);

  let result: R[];
  if (task && NO_RESULTS_CODES.has(task.status_code)) result = [];
  else {
    const taskErr = task ? mapProviderStatus(task.status_code, task.status_message) : "PROVIDER_ERROR";
    if (taskErr) throw providerError(taskErr, `DataForSEO: ${statusMessage} (${statusCode})`);
    result = task!.result ?? [];
  }

  if (ttl > 0 && cacheSettings.enabled) await cacheSet(ck, path, payload, result, ttl, costUsd);
  return { result, costUsd, cached: false, endpoint: path, taskId: task?.id ?? null };
}

/** Free account check (balance, login). Used by Settings → "Test connection". */
export async function dfsUserData() {
  return dfsCall<import("./types").DfsUserData>("userData", null);
}
