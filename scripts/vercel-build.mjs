// Build entry for Vercel (`vercel-build` script).
// Applies pending Prisma migrations when a database is configured, then builds Next.js.
// Without DATABASE_URL (mock-only deploy) it skips migrations so the build still succeeds.
//
// Vercel's Postgres integrations (e.g. Neon) set DATABASE_URL to a *pooled* connection, which can
// break migrations; they also set DATABASE_URL_UNPOOLED (direct). Migrations use the direct URL
// when it exists; the running app keeps using the pooled DATABASE_URL.
import { execSync } from "node:child_process";

const run = (cmd, env = process.env) => execSync(cmd, { stdio: "inherit", env });

if (process.env.DATABASE_URL) {
  const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
  console.log(`[vercel-build] applying migrations (${direct ? "direct connection" : "DATABASE_URL"})`);
  run("npx prisma migrate deploy", direct ? { ...process.env, DATABASE_URL: direct } : process.env);
} else {
  console.log("[vercel-build] DATABASE_URL not set — skipping migrations (mock-only deploy)");
}
run("npx next build");
