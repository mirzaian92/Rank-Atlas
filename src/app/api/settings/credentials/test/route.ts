import { NextResponse } from "next/server";
import { dfsUserData } from "@/lib/dataforseo/client";
import { ReportError } from "@/lib/reports/envelope";
import { dbAvailable, prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/**
 * Verifies credentials with GET /v3/appendix/user_data — a free endpoint that returns the
 * account balance. Runs only when the user clicks "Test connection".
 */
export async function POST() {
  try {
    const { result } = await dfsUserData();
    const u = result[0];
    if (await dbAvailable()) {
      await prisma.providerCredential.updateMany({
        where: { provider: "dataforseo" },
        data: { lastVerifiedAt: new Date(), lastBalanceUsd: u?.money?.balance ?? null },
      });
    }
    return NextResponse.json({ ok: true, login: u?.login ?? null, balanceUsd: u?.money?.balance ?? null });
  } catch (e) {
    if (e instanceof ReportError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
    return NextResponse.json({ error: { code: "INTERNAL", message: "Connection test failed." } }, { status: 500 });
  }
}
