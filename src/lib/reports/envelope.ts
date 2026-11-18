/**
 * Shared contract between /api/reports/* route handlers and the browser.
 * Every report response says where its numbers came from.
 */
import type { ToolId } from "@/lib/config/tools";

/** mock = generated placeholder data; live = fresh provider call; cache = provider data served from cache; snapshot = stored history. */
export type DataSource = "mock" | "live" | "cache" | "snapshot";

export type ReportMeta = {
  tool: ToolId;
  source: DataSource;
  fetchedAt: string;
  locationCode: number;
  languageCode: string;
  /** Actual provider cost for this response in USD (0 for mock / cache). */
  costUsd: number;
  /** Provider endpoints that produced this payload. */
  endpoints: string[];
  /** Caveats shown under the page header (e.g. sample sizes). */
  notes?: string[];
};

export type ReportResponse<T> = { meta: ReportMeta; data: T };

export const REPORT_ERROR_CODES = [
  "VALIDATION_ERROR",
  "NOT_CONFIGURED", // no DataForSEO credentials
  "LIVE_DISABLED", // live mode off for this tool
  "API_UNAVAILABLE", // provider unreachable / 5xx / timeout
  "RATE_LIMITED",
  "BUDGET_EXCEEDED", // local spending limit hit
  "INSUFFICIENT_FUNDS", // provider account balance
  "PROVIDER_ERROR", // provider returned a task-level error
  "NOT_FOUND",
  "INTERNAL",
] as const;
export type ReportErrorCode = (typeof REPORT_ERROR_CODES)[number];

export type ReportErrorBody = { error: { code: ReportErrorCode; message: string; details?: unknown } };

export class ReportError extends Error {
  constructor(public code: ReportErrorCode, message: string, public status = 500, public details?: unknown) {
    super(message);
    this.name = "ReportError";
  }
}

export const ERROR_HTTP_STATUS: Record<ReportErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_CONFIGURED: 503,
  LIVE_DISABLED: 503,
  API_UNAVAILABLE: 503,
  RATE_LIMITED: 429,
  BUDGET_EXCEEDED: 402,
  INSUFFICIENT_FUNDS: 402,
  PROVIDER_ERROR: 502,
  NOT_FOUND: 404,
  INTERNAL: 500,
};
