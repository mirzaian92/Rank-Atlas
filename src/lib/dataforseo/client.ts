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
  const flightKey = cacheKey(apiBaseUrl() + ENDPOINTS[key].path + (opts.pathSuffix ?? ""), payload) + (opts.bypassCache ? ":nocache" : "");
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
  // The base URL is part of the key so sandbox data can never be served as production data.
  const ck = cacheKey(apiBaseUrl() + path, payload);
  if (ttl > 0 && cacheSettings.enabled && !opts.bypassCache) {
    const hit = await cacheGet<R[]>(ck);
    if (hit) {
      // estimatedUsd on a cache hit = what the original request cost, i.e. money saved by the cache.
      await logUsage({ api: ep.api, endpoint: path, tool: opts.tool, cacheKey: ck, cacheHit: true, costUsd: 0, estimatedUsd: hit.costUsd });
      return { result: hit.value, costUsd: 0, cached: true, endpoint: path, taskId: null };
    }
  }

  const estimate = payload ? ep.estimate(payload) : ep.estimate({});
  if (!("free" in ep && ep.free)) await assertWithinBudget(estimate);

  const sent = await send(ep, path, ep.method === "POST" ? [payload ?? {}] : undefined, creds, opts.timeoutMs);
  const { res, durationMs } = sent;
  if (!res) {
    await logUsage({ api: ep.api, endpoint: path, tool: opts.tool, estimatedUsd: estimate, durationMs, error: sent.error });
    throw providerError("API_UNAVAILABLE", `DataForSEO is unreachable (${sent.error}).`);
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
    if (taskErr) throw providerError(taskErr, `DataForSEO: ${statusMessage} (${statusCode})`, { statusCode });
    result = task!.result ?? [];
  }

  if (ttl > 0 && cacheSettings.enabled) await cacheSet(ck, path, payload, result, ttl, costUsd);
  return { result, costUsd, cached: false, endpoint: path, taskId: task?.id ?? null };
}

/** Free account check (balance, login). Used by Settings → "Test connection". */
export async function dfsUserData() {
  return dfsCall<import("./types").DfsUserData>("userData", null);
}

// ---------------------------------------------------------------------------
// Shared HTTP send (auth, rate limit, timeout, retry on network / 429 / 5xx)
// ---------------------------------------------------------------------------
async function send(
  ep: (typeof ENDPOINTS)[EndpointKey],
  path: string,
  body: unknown[] | undefined,
  creds: { login: string; password: string },
  timeoutMs = 60_000,
): Promise<{ res: Response | null; durationMs: number; error?: string }> {
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
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        res = await fetch(apiBaseUrl() + path, {
          method: ep.method,
          headers: { Authorization: auth, "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
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
  return { res, durationMs: Date.now() - started, error: res ? undefined : lastErr instanceof Error ? lastErr.message : "network error" };
}

/** Task status codes meaning "accepted, not finished yet" (VERIFY: 40601 Task Handed, 40602 Task In Queue). */
export const PENDING_TASK_CODES = new Set([40601, 40602]);

export function isTaskPending(e: unknown): boolean {
  const code = (e as { details?: { statusCode?: number } })?.details?.statusCode;
  return typeof code === "number" && PENDING_TASK_CODES.has(code);
}

export type DfsBatchTask<R> = { id: string | null; statusCode: number; statusMessage: string; costUsd: number; tag: string | null; result: R[] };

/**
 * Post several tasks in one request (task_post endpoints accept up to 100). Never cached.
 * Budget is checked against the summed estimate; one usage row is logged with the total cost.
 */
export async function dfsBatch<R>(key: EndpointKey, payloads: Record<string, unknown>[], opts: { tool: ToolId }): Promise<{ tasks: DfsBatchTask<R>[]; costUsd: number }> {
  if (payloads.length === 0) return { tasks: [], costUsd: 0 };
  if (payloads.length > 100) throw providerError("VALIDATION_ERROR", "At most 100 tasks per request.");
  const ep = ENDPOINTS[key];
  const gate = isToolLive(opts.tool);
  if (!gate.live) throw providerError("LIVE_DISABLED", gate.reason);
  const creds = await getCredentials();
  if (!creds) throw providerError("NOT_CONFIGURED", "DataForSEO credentials are not configured. Add them in Settings → API credentials.");
  const estimate = payloads.reduce((a, p) => a + ep.estimate(p), 0);
  await assertWithinBudget(estimate);

  const sent = await send(ep, ep.path, payloads, creds);
  if (!sent.res) {
    await logUsage({ api: ep.api, endpoint: ep.path, tool: opts.tool, estimatedUsd: estimate, durationMs: sent.durationMs, error: sent.error });
    throw providerError("API_UNAVAILABLE", `DataForSEO is unreachable (${sent.error}).`);
  }
  let body: DfsEnvelope<R>;
  try {
    body = (await sent.res.json()) as DfsEnvelope<R>;
  } catch {
    throw providerError("API_UNAVAILABLE", `DataForSEO returned HTTP ${sent.res.status}.`);
  }
  const costUsd = Number(body.cost ?? 0);
  await logUsage({
    api: ep.api, endpoint: ep.path, tool: opts.tool, httpStatus: sent.res.status, statusCode: body.status_code, statusMessage: body.status_message,
    costUsd, estimatedUsd: estimate, durationMs: sent.durationMs, resultCount: body.tasks_count,
    error: body.tasks_error ? `${body.tasks_error} task(s) failed` : undefined,
  });
  const envErr = mapProviderStatus(body.status_code, body.status_message);
  if (envErr) throw providerError(envErr, `DataForSEO: ${body.status_message} (${body.status_code})`);
  return {
    costUsd,
    tasks: (body.tasks ?? []).map((t) => ({
      id: t.id ?? null,
      statusCode: t.status_code,
      statusMessage: t.status_message,
      costUsd: Number(t.cost ?? 0),
      tag: typeof t.data?.tag === "string" ? (t.data.tag as string) : null,
      result: t.result ?? [],
    })),
  };
}
