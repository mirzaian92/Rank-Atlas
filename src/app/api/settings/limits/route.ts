import { NextResponse, type NextRequest } from "next/server";
import { setSpendingLimits, spendingLimitsSchema } from "@/lib/server/settings";
import { dbAvailable } from "@/lib/server/db";

export async function PUT(req: NextRequest) {
  const parsed = spendingLimitsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } }, { status: 400 });
  if (!(await dbAvailable())) return NextResponse.json({ error: { code: "INTERNAL", message: "Database is not reachable." } }, { status: 503 });
  await setSpendingLimits(parsed.data);
  return NextResponse.json({ limits: parsed.data });
}
