// Build entry for Vercel (`vercel-build` script).
// Applies pending Prisma migrations when a database is configured, then builds Next.js.
// Without DATABASE_URL (mock-only deploy) it skips migrations so the build still succeeds.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (process.env.DATABASE_URL) {
  console.log("[vercel-build] DATABASE_URL set — applying migrations");
  run("npx prisma migrate deploy");
} else {
  console.log("[vercel-build] DATABASE_URL not set — skipping migrations (mock-only deploy)");
}
run("npx next build");
