import { NextResponse, type NextRequest } from "next/server";
import { TOOLS, type ToolId } from "@/lib/config/tools";
import { REPORTS, parseReportParams } from "@/lib/server/reports";
import { isToolLive } from "@/lib/dataforseo/mode";
import { ReportError, ERROR_HTTP_STATUS, type ReportErrorBody, type ReportErrorCode, type ReportResponse } from "@/lib/reports/envelope";

export const dynamic = "force-dynamic";

function errorResponse(code: ReportErrorCode, message: string, details?: unknown) {
  return NextResponse.json<ReportErrorBody>({ error: { code, message, details } }, { status: ERROR_HTTP_STATUS[code] });
}

/**
 * GET /api/reports/:tool?q=...&db=us&lang=en[&source=auto|mock|live]
 *
 * source=auto (default): live when the tool is enabled for live mode, otherwise labelled mock data.
 * source=mock: always mock. source=live: live or a typed error (never silently falls back to mock).
 * Development only: __state=error|unavailable|empty|slow|budget simulates UI states.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ tool: string }> }) {
  const { tool } = await ctx.params;
  if (!TOOLS.some((t) => t.id === tool)) return errorResponse("NOT_FOUND", `Unknown report "${tool}".`);
  const toolId = tool as ToolId;
  const sp = req.nextUrl.searchParams;

  if (process.env.NODE_ENV !== "production") {
    const sim = sp.get("__state");
    if (sim === "slow") await new Promise((r) => setTimeout(r, 2500));
    if (sim === "error") return errorResponse("PROVIDER_ERROR", "Simulated provider error (development only).");
    if (sim === "unavailable") return errorResponse("API_UNAVAILABLE", "Simulated: DataForSEO is unreachable (development only).");
    if (sim === "budget") return errorResponse("BUDGET_EXCEEDED", "Simulated: daily spending limit reached (development only).");
  }

  const parsed = parseReportParams(toolId, sp);
  if (!parsed.ok) return errorResponse("VALIDATION_ERROR", parsed.issues[0]?.message ?? "Invalid parameters", parsed.issues);
  const params = parsed.value;
  const handler = REPORTS[toolId];
  const source = sp.get("source") ?? "auto";
  const gate = isToolLive(toolId);
  const useLive = source !== "mock" && gate.live && Boolean(handler.live);

  if (source === "live" && !useLive) return errorResponse("LIVE_DISABLED", gate.reason || "This tool has no live integration yet.");

  const base = { tool: toolId, fetchedAt: new Date().toISOString(), locationCode: params.locationCode, languageCode: params.languageCode };

  if (!useLive) {
    let data = handler.mock(params);
    if (process.env.NODE_ENV !== "production" && sp.get("__state") === "empty") data = emptyLike(data);
    return NextResponse.json<ReportResponse<unknown>>({
      meta: { ...base, source: "mock", costUsd: 0, endpoints: [], notes: [...(handler.notes ?? [])], mockReason: gate.reason || (handler.live ? undefined : "This tool has no live integration yet.") },
      data,
    });
  }

  try {
    const r = await handler.live!(params);
    return NextResponse.json<ReportResponse<unknown>>({
      meta: { ...base, source: r.cached ? "cache" : "live", costUsd: r.costUsd, endpoints: r.endpoints, notes: [...(handler.notes ?? []), ...r.notes] },
      data: r.data,
    });
  } catch (e) {
    if (e instanceof ReportError) return errorResponse(e.code, e.message, e.details);
    console.error(`[reports/${tool}]`, e);
    return errorResponse("INTERNAL", "Unexpected error while building the report.");
  }
}

/** Development helper: blank every array so pages can render their empty states. */
function emptyLike(v: unknown): unknown {
  if (Array.isArray(v)) return [];
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, emptyLike(x)]));
  return typeof v === "number" ? 0 : v;
}
