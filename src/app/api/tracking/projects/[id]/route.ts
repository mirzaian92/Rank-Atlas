import { NextResponse, type NextRequest } from "next/server";
import { deleteProject, getTrackingReport, projectPatch, updateProject } from "@/lib/server/tracking";
import { requireDb, routeError } from "@/lib/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Report built from stored checks (also collects this project's finished tasks — free). */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireDb();
    const { id } = await ctx.params;
    const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get("days")) || 30));
    return NextResponse.json(await getTrackingReport(id, days));
  } catch (e) {
    return routeError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    await requireDb();
    const { id } = await ctx.params;
    await updateProject(id, projectPatch.parse(await req.json().catch(() => ({}))));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return routeError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireDb();
    const { id } = await ctx.params;
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return routeError(e);
  }
}
