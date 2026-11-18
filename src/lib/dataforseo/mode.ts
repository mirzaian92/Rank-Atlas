import "server-only";
import type { ToolId } from "@/lib/config/tools";
import { getTool } from "@/lib/config/tools";

/**
 * Live (paid) requests require ALL of:
 *   1. DATAFORSEO_LIVE_ENABLED=true
 *   2. the tool listed in DATAFORSEO_LIVE_TOOLS
 *   3. the tool's integration status is not "mock" (it has a reviewed live implementation)
 *   4. credentials configured (checked in the client)
 */
export function liveEnabledGlobally(): boolean {
  return process.env.DATAFORSEO_LIVE_ENABLED === "true";
}

export function liveToolList(): string[] {
  return (process.env.DATAFORSEO_LIVE_TOOLS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function isToolLive(tool: ToolId): { live: boolean; reason: string } {
  if (getTool(tool).integration === "mock") return { live: false, reason: "This tool has no live integration yet." };
  if (!liveEnabledGlobally()) return { live: false, reason: "Live mode is off (DATAFORSEO_LIVE_ENABLED=false)." };
  if (!liveToolList().includes(tool)) return { live: false, reason: `"${tool}" is not listed in DATAFORSEO_LIVE_TOOLS.` };
  return { live: true, reason: "" };
}

export function apiBaseUrl(): string {
  // Development-only override so the pipeline can be tested against a local fake server.
  if (process.env.NODE_ENV !== "production" && process.env.DATAFORSEO_BASE_URL_OVERRIDE) return process.env.DATAFORSEO_BASE_URL_OVERRIDE;
  return process.env.DATAFORSEO_USE_SANDBOX === "true" ? "https://sandbox.dataforseo.com" : "https://api.dataforseo.com";
}
