// Build entry for Vercel (`vercel-build` script).
// Applies pending Prisma migrations when a database is configured, then builds Next.js.
// Without DATABASE_URL (mock-only deploy) it skips migrations so the build still succeeds.
//
// Vercel's Postgres integrations (e.g. Neon) set DATABASE_URL to a *pooled* connection, which can
// break migrations; they also set DATABASE_URL_UNPOOLED (direct). Migrations use the direct URL
// when it exists; the running app keeps using the pooled DATABASE_URL.
import { execSync } from "node:child_process";
import { resolveDatabaseUrl, resolveDirectUrl } from "./resolve-db-url.mjs";

const run = (cmd, env = process.env) => execSync(cmd, { stdio: "inherit", env });

const db = resolveDatabaseUrl();
if (db) {
  const direct = resolveDirectUrl();
  console.log(`[vercel-build] database found in ${db.name}; applying migrations (${direct ? "direct connection" : "pooled"})`);
  run("npx prisma migrate deploy", { ...process.env, DATABASE_URL: direct || db.url });
} else {
  const names = Object.keys(process.env).filter((n) => /DATABASE|POSTGRES|^PG|NEON|STORAGE/.test(n));
  console.log(`[vercel-build] no Postgres URL found — skipping migrations (mock-only deploy). DB-like vars present: ${names.join(", ") || "none"}`);
}
run("npx next build");
