import { NextResponse, type NextRequest } from "next/server";
import { getCrawl } from "@/lib/server/site-audit";
import { requireDb, routeError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Crawl status + report. Polls the provider (free) while the crawl is running. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireDb();
    const { id } = await ctx.params;
    return NextResponse.json(await getCrawl(id));
  } catch (e) {
    return routeError(e);
  }
}
