import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "../src/lib/server/db-url";
const pg = "postgresql://u:p@h/db";
describe("resolveDatabaseUrl", () => {
  it("prefers DATABASE_URL", () => expect(resolveDatabaseUrl({ DATABASE_URL: pg, POSTGRES_URL: "postgres://x" })?.name).toBe("DATABASE_URL"));
  it("falls back to Vercel Postgres names", () => expect(resolveDatabaseUrl({ POSTGRES_URL: pg })?.name).toBe("POSTGRES_URL"));
  it("finds custom integration prefixes, skipping unpooled", () => {
    expect(resolveDatabaseUrl({ STORAGE_URL_UNPOOLED: pg, STORAGE_URL: pg })?.name).toBe("STORAGE_URL");
    expect(resolveDatabaseUrl({ RANKATLAS_DATABASE_URL: pg })?.name).toBe("RANKATLAS_DATABASE_URL");
  });
  it("strips quotes and ignores non-postgres values", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: `"${pg}"` })?.url).toBe(pg);
    expect(resolveDatabaseUrl({ DATABASE_URL: "" , NEXT_URL: "https://x" })).toBeNull();
  });
});
