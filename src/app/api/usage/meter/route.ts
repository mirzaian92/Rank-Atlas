import { NextResponse } from "next/server";
import { usageMeter } from "@/lib/dataforseo/usage";
import { getSpendingLimits } from "@/lib/server/settings";
import { credentialStatus } from "@/lib/dataforseo/credentials";
import { liveEnabledGlobally, liveToolList } from "@/lib/dataforseo/mode";

export const dynamic = "force-dynamic";

/** Lightweight spend snapshot for the header meter. Never includes secrets. */
export async function GET() {
  const [meter, limits, creds] = await Promise.all([usageMeter(), getSpendingLimits(), credentialStatus()]);
  return NextResponse.json({
    meter,
    limits,
    balance: { usd: creds.lastBalanceUsd, checkedAt: creds.lastVerifiedAt },
    live: { enabled: liveEnabledGlobally() && creds.configured, sandbox: process.env.DATAFORSEO_USE_SANDBOX === "true", tools: liveToolList() },
    databaseAvailable: creds.databaseAvailable,
  });
}
