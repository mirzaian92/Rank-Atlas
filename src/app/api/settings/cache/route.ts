import { NextResponse, type NextRequest } from "next/server";
import { cacheSettingsSchema, setCacheSettings } from "@/lib/server/settings";
import { cacheClear } from "@/lib/dataforseo/cache";
import { dbAvailable } from "@/lib/server/db";

export async function PUT(req: NextRequest) {
  const parsed = cacheSettingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } }, { status: 400 });
  if (!(await dbAvailable())) return NextResponse.json({ error: { code: "INTERNAL", message: "Database is not reachable." } }, { status: 503 });
  await setCacheSettings(parsed.data);
  return NextResponse.json({ cache: parsed.data });
}

export async function DELETE() {
  const cleared = await cacheClear();
  return NextResponse.json({ cleared });
}
