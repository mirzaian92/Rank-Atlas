import { NextResponse, type NextRequest } from "next/server";
import { addKeywords, keywordsInput, removeKeyword } from "@/lib/server/tracking";
import { requireDb, routeError } from "@/lib/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    await requireDb();
    const { id } = await ctx.params;
    const { keywords, tags } = keywordsInput.parse(await req.json().catch(() => ({})));
    return NextResponse.json({ added: await addKeywords(id, keywords, tags) });
  } catch (e) {
    return routeError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    await requireDb();
    const { id } = await ctx.params;
    const keywordId = req.nextUrl.searchParams.get("keywordId");
    if (!keywordId) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "keywordId required" } }, { status: 400 });
    await removeKeyword(id, keywordId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return routeError(e);
  }
}
