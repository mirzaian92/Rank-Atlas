import { ReportError, ERROR_HTTP_STATUS, type ReportErrorCode } from "@/lib/reports/envelope";

/**
 * Map DataForSEO status codes to app error codes (verified against
 * https://docs.dataforseo.com/v3/appendix/errors/, Nov 2026).
 */
const AUTH = new Set([40100, 40104, 40201, 40207]); // unauthorized, unverified account, paused account, IP not whitelisted
const UNAVAILABLE = new Set([40101, 40103, 40107]); // search engine error, task execution failed, response timeout
const RATE = new Set([40202, 40205, 40206, 40209]); // per-minute, duplicate-task hourly/daily, simultaneous requests
const FUNDS = new Set([40200, 40210]); // payment required, insufficient funds

export function mapProviderStatus(code: number, message: string): ReportErrorCode | null {
  if (OK_CODES.has(code)) return null;
  if (AUTH.has(code)) return "NOT_CONFIGURED";
  if (RATE.has(code)) return "RATE_LIMITED";
  if (FUNDS.has(code)) return "INSUFFICIENT_FUNDS";
  if (code === 40203) return "BUDGET_EXCEEDED"; // provider-side cost limit set in the DataForSEO dashboard
  if (UNAVAILABLE.has(code) || code >= 50000) return "API_UNAVAILABLE";
  if (/rate limit/i.test(message)) return "RATE_LIMITED";
  return "PROVIDER_ERROR";
}

/** 20000 OK, 20100 task created, 40106 completed with partial results (data is still returned). */
export const OK_CODES = new Set([20000, 20100, 40106]);

export function providerError(code: ReportErrorCode, message: string, details?: unknown) {
  return new ReportError(code, message, ERROR_HTTP_STATUS[code], details);
}

/** Codes meaning "no data for this target" rather than a failure (treated as empty results). */
export const NO_RESULTS_CODES = new Set([40102]);
