import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ReportError, ERROR_HTTP_STATUS } from "@/lib/reports/envelope";
import { dbAvailable } from "./db";

/** Uniform JSON error response for API routes. */
export function routeError(e: unknown) {
  if (e instanceof ReportError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: ERROR_HTTP_STATUS[e.code] });
  if (e instanceof ZodError) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: e.issues[0]?.message ?? "Invalid input" } }, { status: 400 });
  console.error("[api]", e);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Unexpected error." } }, { status: 500 });
}

export async function requireDb() {
  if (!(await dbAvailable())) throw new ReportError("INTERNAL", "Database is not reachable. Position Tracking and Site Audit store their data in PostgreSQL.", 503);
}
