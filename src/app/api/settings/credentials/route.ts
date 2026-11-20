import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { credentialStatus, deleteCredentials, saveCredentials } from "@/lib/dataforseo/credentials";
import { dbAvailable, dbUrl } from "@/lib/server/db";
import { databaseEnvNames } from "@/lib/server/db-url";
import { encryptionConfigured } from "@/lib/server/crypto";

export const dynamic = "force-dynamic";

const body = z.object({ login: z.string().trim().min(3).max(200), password: z.string().trim().min(6).max(200) });

export async function PUT(req: NextRequest) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Enter your API login and API password." } }, { status: 400 });
  if (!(await dbAvailable())) return NextResponse.json({ error: { code: "INTERNAL", message: dbUrl ? `Database is not reachable (using ${dbUrl.name}). Check the connection string and that the database is running.` : `No database is connected (no Postgres URL found; database-like variables on this deployment: ${databaseEnvNames().join(", ") || "none"}), so credentials can't be saved here. Either add a Postgres database (on Vercel: Storage → Create Database, then redeploy), or set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD as environment variables (on Vercel: Settings → Environment Variables, then redeploy).` } }, { status: 503 });
  if (!encryptionConfigured()) return NextResponse.json({ error: { code: "INTERNAL", message: "APP_ENCRYPTION_KEY is missing or invalid; credentials cannot be stored securely." } }, { status: 503 });
  await saveCredentials(parsed.data.login, parsed.data.password);
  return NextResponse.json({ credentials: await credentialStatus() });
}

export async function DELETE() {
  if (await dbAvailable()) await deleteCredentials();
  return NextResponse.json({ credentials: await credentialStatus() });
}
