// Finds the Postgres connection string under the names Vercel/Neon/Supabase integrations use.
// Shared by the build script and the app (src/lib/server/db-url.ts mirrors this logic).
const isPg = (v) => typeof v === "string" && /^postgres(ql)?:\/\//i.test(v.trim().replace(/^["']/, ""));
const clean = (v) => v.trim().replace(/^["']|["']$/g, "");

export function resolveDatabaseUrl(env = process.env) {
  const pooled = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"];
  for (const k of pooled) if (isPg(env[k])) return { url: clean(env[k]), name: k };
  // Custom prefixes chosen when connecting the integration, e.g. STORAGE_URL, NEON_DATABASE_URL.
  const k = Object.keys(env).sort().find((n) => /(_|^)(DATABASE|POSTGRES|PG|STORAGE|NEON)\w*_URL$|^\w+_DATABASE_URL$|^STORAGE_URL$/.test(n) && !/UNPOOLED|NON_POOLING|NO_SSL/.test(n) && isPg(env[n]));
  return k ? { url: clean(env[k]), name: k } : null;
}

export function resolveDirectUrl(env = process.env) {
  const k = Object.keys(env).sort().find((n) => /UNPOOLED|NON_POOLING/.test(n) && isPg(env[n]));
  return k ? clean(env[k]) : null;
}
