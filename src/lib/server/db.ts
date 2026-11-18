import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

let lastCheck = 0;
let lastOk = false;

/** Cheap, memoized (10s) DB reachability check so mock mode works without Postgres. */
export async function dbAvailable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  if (Date.now() - lastCheck < 10_000) return lastOk;
  lastCheck = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    lastOk = true;
  } catch {
    lastOk = false;
  }
  return lastOk;
}
