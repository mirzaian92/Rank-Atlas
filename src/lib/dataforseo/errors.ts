import { ReportError, ERROR_HTTP_STATUS, type ReportErrorCode } from "@/lib/reports/envelope";

/**
 * Map DataForSEO status codes to app error codes.
 * Ref: https://docs.dataforseo.com/v3/appendix/errors/ — VERIFY the specific codes there.
 *   20000      OK
 *   40100-40199 authentication problems
 *   40200 / 40210 payment required / insufficient funds
 *   40202      rate limit exceeded (per-minute)
 *   40400-40599 request / validation problems
 *   50000+     provider-side errors
 */
export function mapProviderStatus(code: number, message: string): ReportErrorCode | null {
  if (code === 20000 || code === 20100) return null;
  if (code === 40202 || /rate limit/i.test(message)) return "RATE_LIMITED";
  if (code >= 40100 && code < 40200) return "NOT_CONFIGURED";
  if (code === 40200 || code === 40210 || /insufficient|not enough funds|balance/i.test(message)) return "INSUFFICIENT_FUNDS";
  if (code >= 50000) return "API_UNAVAILABLE";
  return "PROVIDER_ERROR";
}

export function providerError(code: ReportErrorCode, message: string, details?: unknown) {
  return new ReportError(code, message, ERROR_HTTP_STATUS[code], details);
}

/** Codes meaning "no data for this target" rather than a failure (treated as empty results). */
export const NO_RESULTS_CODES = new Set([40102]);
