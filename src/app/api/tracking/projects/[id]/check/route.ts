import { NextResponse, type NextRequest } from "next/server";
import { runChecks } from "@/lib/server/tracking";
import { requireDb, routeError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** "Check now": checks keywords not yet checked today (UTC). Live checks are posted to the queue. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireDb();
    const { id } = await ctx.params;
    return NextResponse.json(await runChecks(id));
  } catch (e) {
    return routeError(e);
  }
}
