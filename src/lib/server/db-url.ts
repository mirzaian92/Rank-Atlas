// Finds the Postgres URL under the names Vercel/Neon integrations use (mirrors scripts/resolve-db-url.mjs).
const isPg = (v: string | undefined) => typeof v === "string" && /^postgres(ql)?:\/\//i.test(v.trim().replace(/^["']/, ""));
const clean = (v: string) => v.trim().replace(/^["']|["']$/g, "");
const CUSTOM = /(_|^)(DATABASE|POSTGRES|PG|STORAGE|NEON)\w*_URL$|^\w+_DATABASE_URL$|^STORAGE_URL$/;

export function resolveDatabaseUrl(env: Record<string, string | undefined> = process.env): { url: string; name: string } | null {
  for (const k of ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"]) if (isPg(env[k])) return { url: clean(env[k]!), name: k };
  const k = Object.keys(env).sort().find((n) => CUSTOM.test(n) && !/UNPOOLED|NON_POOLING|NO_SSL/.test(n) && isPg(env[n]));
  return k ? { url: clean(env[k]!), name: k } : null;
}

/** Names (never values) of env vars that look database-related — for diagnostics. */
export function databaseEnvNames(env: Record<string, string | undefined> = process.env): string[] {
  return Object.keys(env).filter((n) => /DATABASE|POSTGRES|^PG|NEON|STORAGE/.test(n)).sort();
}
