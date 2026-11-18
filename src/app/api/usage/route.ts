import { NextResponse } from "next/server";
import { usageSummary } from "@/lib/dataforseo/usage";
import { getSpendingLimits } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const [usage, limits] = await Promise.all([usageSummary(), getSpendingLimits()]);
  return NextResponse.json({ usage, limits });
}
