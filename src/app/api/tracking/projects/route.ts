import { NextResponse, type NextRequest } from "next/server";
import { createProject, listProjects, projectInput, trackingMode } from "@/lib/server/tracking";
import { requireDb, routeError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireDb();
    return NextResponse.json({ projects: await listProjects(), mode: await trackingMode() });
  } catch (e) {
    return routeError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireDb();
    const input = projectInput.parse(await req.json().catch(() => ({})));
    const p = await createProject(input);
    return NextResponse.json({ project: { id: p.id } }, { status: 201 });
  } catch (e) {
    return routeError(e);
  }
}
