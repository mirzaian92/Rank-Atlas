import { NextResponse, type NextRequest } from "next/server";
import { runDailyTracking } from "@/lib/server/tracking";
import { finalizePendingCrawls } from "@/lib/server/site-audit";
import { requireDb, routeError } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily job (Vercel Cron, see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
 * Without CRON_SECRET the endpoint only runs in development.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret ? req.headers.get("authorization") === `Bearer ${secret}` : process.env.NODE_ENV !== "production";
  if (!authorized) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  try {
    await requireDb();
    const [tracking, audits] = await Promise.all([runDailyTracking(), finalizePendingCrawls()]);
    return NextResponse.json({ ranAt: new Date().toISOString(), tracking, audits });
  } catch (e) {
    return routeError(e);
  }
}
