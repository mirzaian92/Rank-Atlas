import { NextResponse } from "next/server";
import { credentialStatus } from "@/lib/dataforseo/credentials";
import { getCacheSettings, getSpendingLimits } from "@/lib/server/settings";
import { liveEnabledGlobally, liveToolList } from "@/lib/dataforseo/mode";
import { TOOLS } from "@/lib/config/tools";

export const dynamic = "force-dynamic";

/** Safe-to-display settings snapshot. Never returns secrets. */
export async function GET() {
  const [credentials, limits, cache] = await Promise.all([credentialStatus(), getSpendingLimits(), getCacheSettings()]);
  const liveTools = liveToolList();
  return NextResponse.json({
    credentials,
    limits,
    cache,
    live: {
      enabled: liveEnabledGlobally(),
      sandbox: process.env.DATAFORSEO_USE_SANDBOX === "true",
      tools: TOOLS.map((t) => ({ id: t.id, label: t.label, order: t.order, integration: t.integration, listed: liveTools.includes(t.id), endpoints: t.endpoints })),
    },
  });
}
