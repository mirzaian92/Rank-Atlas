import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { TOOLS } from "@/lib/config/tools";
import { dbAvailable, prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

const body = z.object({
  tool: z.enum(TOOLS.map((t) => t.id) as [string, ...string[]]),
  query: z.string().trim().min(1).max(500),
  queryType: z.enum(["domain", "keyword", "url", "list"]),
  locationCode: z.number().int(),
  languageCode: z.string().min(2).max(8),
  label: z.string().max(120).optional(),
});

const unavailable = () => NextResponse.json({ error: { code: "INTERNAL", message: "Database is not reachable; saved searches are disabled." } }, { status: 503 });

export async function GET() {
  if (!(await dbAvailable())) return NextResponse.json({ items: [], databaseAvailable: false });
  const items = await prisma.savedSearch.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ items, databaseAvailable: true });
}

export async function POST(req: NextRequest) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } }, { status: 400 });
  if (!(await dbAvailable())) return unavailable();
  const d = parsed.data;
  const item = await prisma.savedSearch.upsert({
    where: { tool_query_locationCode_languageCode: { tool: d.tool, query: d.query, locationCode: d.locationCode, languageCode: d.languageCode } },
    create: d,
    update: { label: d.label, lastRunAt: new Date() },
  });
  return NextResponse.json({ item });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "id required" } }, { status: 400 });
  if (!(await dbAvailable())) return unavailable();
  await prisma.savedSearch.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
