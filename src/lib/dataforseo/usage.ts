import "server-only";
import { dbAvailable, prisma } from "@/lib/server/db";

export type UsageEntry = {
  api: string;
  endpoint: string;
  tool?: string;
  cacheKey?: string;
  cacheHit?: boolean;
  httpStatus?: number;
  statusCode?: number;
  statusMessage?: string;
  costUsd?: number;
  estimatedUsd?: number;
  durationMs?: number;
  resultCount?: number;
  error?: string;
};

export async function logUsage(e: UsageEntry) {
  if (!(await dbAvailable())) {
    console.warn("[dataforseo] usage not persisted (database unavailable)", e.endpoint, e.costUsd);
    return;
  }
  await prisma.apiRequestLog.create({ data: { ...e, costUsd: e.costUsd ?? 0, estimatedUsd: e.estimatedUsd ?? 0 } }).catch((err) => {
    console.error("[dataforseo] failed to log usage", err);
  });
}

function startOfDayUtc(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function startOfMonthUtc(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function spendSince(since: Date): Promise<number> {
  if (!(await dbAvailable())) return 0;
  const agg = await prisma.apiRequestLog.aggregate({ _sum: { costUsd: true }, where: { createdAt: { gte: since }, cacheHit: false } });
  return Number(agg._sum.costUsd ?? 0);
}

export const spendToday = () => spendSince(startOfDayUtc());
export const spendThisMonth = () => spendSince(startOfMonthUtc());

export async function usageSummary() {
  if (!(await dbAvailable())) return null;
  const monthStart = startOfMonthUtc();
  const [today, month, requests, cacheHits, byTool, byEndpoint, recent, daily] = await Promise.all([
    spendToday(),
    spendThisMonth(),
    prisma.apiRequestLog.count({ where: { createdAt: { gte: monthStart }, cacheHit: false } }),
    prisma.apiRequestLog.count({ where: { createdAt: { gte: monthStart }, cacheHit: true } }),
    prisma.apiRequestLog.groupBy({ by: ["tool"], where: { createdAt: { gte: monthStart } }, _sum: { costUsd: true }, _count: { _all: true } }),
    prisma.apiRequestLog.groupBy({ by: ["endpoint"], where: { createdAt: { gte: monthStart } }, _sum: { costUsd: true }, _count: { _all: true } }),
    prisma.apiRequestLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.$queryRaw<{ day: Date; cost: number; requests: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COALESCE(SUM("costUsd"),0)::float AS cost, COUNT(*) AS requests
      FROM "ApiRequestLog" WHERE "createdAt" >= NOW() - INTERVAL '30 days' AND "cacheHit" = false
      GROUP BY 1 ORDER BY 1`,
  ]);
  return {
    todayUsd: today,
    monthUsd: month,
    requestsThisMonth: requests,
    cacheHitsThisMonth: cacheHits,
    byTool: byTool.map((t) => ({ tool: t.tool ?? "—", costUsd: Number(t._sum.costUsd ?? 0), requests: t._count._all })),
    byEndpoint: byEndpoint.map((t) => ({ endpoint: t.endpoint, costUsd: Number(t._sum.costUsd ?? 0), requests: t._count._all })),
    daily: daily.map((d) => ({ date: d.day.toISOString().slice(0, 10), costUsd: d.cost, requests: Number(d.requests) })),
    recent: recent.map((r) => ({
      id: r.id, createdAt: r.createdAt.toISOString(), endpoint: r.endpoint, tool: r.tool, cacheHit: r.cacheHit,
      statusCode: r.statusCode, costUsd: Number(r.costUsd), durationMs: r.durationMs, error: r.error,
    })),
  };
}
