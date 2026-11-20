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
/** Env values as typed in dashboards often keep quotes ("true") or odd casing/spacing — normalize them. */
const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();

export function liveEnabledGlobally(): boolean {
  return ["true", "1", "yes", "on"].includes(clean(process.env.DATAFORSEO_LIVE_ENABLED).toLowerCase());
}

export function liveToolList(): string[] {
  return clean(process.env.DATAFORSEO_LIVE_TOOLS)
    .split(/[\s,;]+/)
    .map((s) => s.replace(/^["']|["']$/g, "").trim().toLowerCase())
    .filter(Boolean);
}

/** What the server actually sees — shown in Settings so env mistakes are visible. */
export function liveEnvDiagnostics() {
  return {
    liveEnabledRaw: process.env.DATAFORSEO_LIVE_ENABLED ?? null,
    liveEnabled: liveEnabledGlobally(),
    liveToolsRaw: process.env.DATAFORSEO_LIVE_TOOLS ?? null,
    liveTools: liveToolList(),
  };
}

export function isToolLive(tool: ToolId): { live: boolean; reason: string } {
  if (getTool(tool).integration === "mock") return { live: false, reason: "This tool has no live integration yet." };
  if (!liveEnabledGlobally()) {
    const raw = process.env.DATAFORSEO_LIVE_ENABLED;
    return {
      live: false,
      reason: raw == null || raw === ""
        ? "Live mode is off: DATAFORSEO_LIVE_ENABLED is not set on the server (on Vercel, add it and redeploy)."
        : `Live mode is off: DATAFORSEO_LIVE_ENABLED is "${raw}" — set it to true and restart / redeploy.`,
    };
  }
  if (!liveToolList().includes(tool)) {
    const list = liveToolList();
    return { live: false, reason: `"${tool}" is not listed in DATAFORSEO_LIVE_TOOLS (currently: ${list.length ? list.join(", ") : "empty"}).` };
  }
  return { live: true, reason: "" };
}

export function apiBaseUrl(): string {
  // Development-only override so the pipeline can be tested against a local fake server.
  if (process.env.NODE_ENV !== "production" && process.env.DATAFORSEO_BASE_URL_OVERRIDE) return process.env.DATAFORSEO_BASE_URL_OVERRIDE;
  return process.env.DATAFORSEO_USE_SANDBOX === "true" ? "https://sandbox.dataforseo.com" : "https://api.dataforseo.com";
}
