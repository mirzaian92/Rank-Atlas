import "server-only";
import { createHash } from "node:crypto";
import { dbAvailable, prisma } from "@/lib/server/db";

/** Stable key: sha256(path + canonical JSON payload). Key order must not change the hash. */
export function cacheKey(path: string, payload: unknown): string {
  return createHash("sha256").update(path + "|" + canonical(payload)).digest("hex");
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object).sort().map((k) => JSON.stringify(k) + ":" + canonical((v as Record<string, unknown>)[k])).join(",")}}`;
  }
  return JSON.stringify(v);
}

// Small in-memory layer in front of Postgres (also used when the DB is unavailable).
const mem = new Map<string, { value: unknown; expires: number }>();
const MEM_MAX = 500;

export async function cacheGet<T>(key: string): Promise<{ value: T; costUsd: number } | null> {
  const m = mem.get(key);
  if (m && m.expires > Date.now()) return { value: m.value as T, costUsd: 0 };
  if (!(await dbAvailable())) return null;
  const row = await prisma.apiCache.findUnique({ where: { key } });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  prisma.apiCache.update({ where: { key }, data: { hits: { increment: 1 } } }).catch(() => {});
  remember(key, row.response, row.expiresAt.getTime());
  return { value: row.response as T, costUsd: Number(row.costUsd) };
}

export async function cacheSet(key: string, endpoint: string, payload: unknown, response: unknown, ttlSec: number, costUsd: number) {
  if (ttlSec <= 0) return;
  const expiresAt = new Date(Date.now() + ttlSec * 1000);
  remember(key, response, expiresAt.getTime());
  if (!(await dbAvailable())) return;
  const data = { endpoint, payload: payload as object, response: response as object, costUsd, expiresAt };
  await prisma.apiCache.upsert({ where: { key }, create: { key, ...data }, update: { ...data, createdAt: new Date(), hits: 0 } });
}

export async function cachePurgeExpired() {
  if (!(await dbAvailable())) return 0;
  const { count } = await prisma.apiCache.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}

export async function cacheClear() {
  mem.clear();
  if (!(await dbAvailable())) return 0;
  const { count } = await prisma.apiCache.deleteMany({});
  return count;
}

function remember(key: string, value: unknown, expires: number) {
  if (mem.size >= MEM_MAX) mem.delete(mem.keys().next().value as string);
  mem.set(key, { value, expires });
}
