import { NextResponse, type NextRequest } from "next/server";
import { auditMode, crawlInput, listCrawls, startCrawl } from "@/lib/server/site-audit";
import { requireDb, routeError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** GET ?target=domain → crawl history for that domain. */
export async function GET(req: NextRequest) {
  try {
    await requireDb();
    const target = req.nextUrl.searchParams.get("target") ?? "";
    return NextResponse.json({ crawls: target ? await listCrawls(target) : [], mode: await auditMode() });
  } catch (e) {
    return routeError(e);
  }
}

/** POST { target, maxPages } → starts a crawl (paid when live). */
export async function POST(req: NextRequest) {
  try {
    await requireDb();
    const crawl = await startCrawl(crawlInput.parse(await req.json().catch(() => ({}))));
    return NextResponse.json({ crawl }, { status: 201 });
  } catch (e) {
    return routeError(e);
  }
}
