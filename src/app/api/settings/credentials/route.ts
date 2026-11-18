import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { credentialStatus, deleteCredentials, saveCredentials } from "@/lib/dataforseo/credentials";
import { dbAvailable } from "@/lib/server/db";
import { encryptionConfigured } from "@/lib/server/crypto";

export const dynamic = "force-dynamic";

const body = z.object({ login: z.string().trim().min(3).max(200), password: z.string().min(6).max(200) });

export async function PUT(req: NextRequest) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Enter your API login and API password." } }, { status: 400 });
  if (!(await dbAvailable())) return NextResponse.json({ error: { code: "INTERNAL", message: "Database is not reachable. Check DATABASE_URL, or set DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD in .env." } }, { status: 503 });
  if (!encryptionConfigured()) return NextResponse.json({ error: { code: "INTERNAL", message: "APP_ENCRYPTION_KEY is missing or invalid; credentials cannot be stored securely." } }, { status: 503 });
  await saveCredentials(parsed.data.login, parsed.data.password);
  return NextResponse.json({ credentials: await credentialStatus() });
}

export async function DELETE() {
  if (await dbAvailable()) await deleteCredentials();
  return NextResponse.json({ credentials: await credentialStatus() });
}
