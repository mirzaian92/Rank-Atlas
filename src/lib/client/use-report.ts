"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ToolId } from "@/lib/config/tools";
import type { ReportErrorBody, ReportErrorCode, ReportResponse } from "@/lib/reports/envelope";

export class ClientReportError extends Error {
  constructor(public code: ReportErrorCode, message: string, public status: number) {
    super(message);
  }
}

export async function fetchReport<T>(tool: ToolId, params: Record<string, string | undefined>): Promise<ReportResponse<T>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") qs.set(k, v);
  let res: Response;
  try {
    res = await fetch(`/api/reports/${tool}?${qs.toString()}`, { headers: { Accept: "application/json" } });
  } catch {
    throw new ClientReportError("API_UNAVAILABLE", "Could not reach the application server.", 0);
  }
  const body = (await res.json().catch(() => null)) as ReportResponse<T> | ReportErrorBody | null;
  if (!res.ok || !body || "error" in body) {
    const err = body && "error" in body ? body.error : { code: "INTERNAL" as const, message: `Request failed (${res.status})` };
    throw new ClientReportError(err.code, err.message, res.status);
  }
  return body;
}

/** Fetch a report through /api/reports/:tool. Disabled until `enabled` (usually: a query is present). */
export function useReport<T>(tool: ToolId, params: Record<string, string | undefined>, enabled = true, opts: { keepPrevious?: boolean } = {}) {
  return useQuery<ReportResponse<T>, ClientReportError>({
    queryKey: ["report", tool, params],
    queryFn: () => fetchReport<T>(tool, params),
    enabled,
    // Paged tables keep showing the current page while the next one loads.
    placeholderData: opts.keepPrevious ? keepPreviousData : undefined,
    staleTime: 5 * 60_000,
    retry: (count, err) => count < 1 && (err.code === "API_UNAVAILABLE" || err.code === "INTERNAL"),
  });
}
