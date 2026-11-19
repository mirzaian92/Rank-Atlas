import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

let lastCheck = 0;
let lastOk = false;
let pending: Promise<boolean> | null = null;

/**
 * Cheap, memoized (10 s) DB reachability check so mock mode works without Postgres.
 * Concurrent callers share one in-flight check. (Previously the timestamp was set before the
 * query finished, so parallel requests on a cold start saw a stale "unavailable" and treated
 * saved credentials as missing.)
 */
export async function dbAvailable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  if (pending) return pending;
  if (lastCheck !== 0 && Date.now() - lastCheck < 10_000) return lastOk;
  pending = (async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      lastOk = true;
    } catch {
      lastOk = false;
    } finally {
      lastCheck = Date.now();
      pending = null;
    }
    return lastOk;
  })();
  return pending;
}
