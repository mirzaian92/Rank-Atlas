import "server-only";
import { z } from "zod";
import { prisma } from "./db";
import { dfsBatch, dfsCall, isTaskPending } from "@/lib/dataforseo/client";
import { isToolLive } from "@/lib/dataforseo/mode";
import { getCredentials } from "@/lib/dataforseo/credentials";
import type { DfsKeywordItem, DfsLabsItemsResult, DfsSerpResult } from "@/lib/dataforseo/types";
import { ReportError } from "@/lib/reports/envelope";
import { TRACK_DEPTHS, buildTrackingReport, matchesDomain } from "@/lib/reports/tracking";
import { MARKETS } from "@/lib/config/markets";
import { looksLikeDomain, normalizeDomain } from "@/lib/utils";
import { hashString } from "@/lib/mock/rng";

const TOOL = "position-tracking" as const;
export const MAX_KEYWORDS_PER_PROJECT = 500;

const keywordList = z
  .array(z.string().trim().toLowerCase().min(1).max(80))
  .max(MAX_KEYWORDS_PER_PROJECT)
  .transform((a) => [...new Set(a)]);

export const projectInput = z.object({
  name: z.string().trim().min(1).max(100),
  domain: z.string().transform(normalizeDomain).refine(looksLikeDomain, "Enter a valid domain"),
  locationCode: z.number().int().refine((c) => MARKETS.some((m) => m.locationCode === c), "Unsupported market"),
  languageCode: z.string().min(2).max(8),
  device: z.enum(["desktop", "mobile"]).default("desktop"),
  depth: z.number().int().refine((d) => (TRACK_DEPTHS as readonly number[]).includes(d), "Invalid depth").default(100),
  keywords: keywordList.default([]),
  tags: z.array(z.string().trim().min(1).max(30)).max(5).default([]),
});
export const projectPatch = projectInput.pick({ name: true, device: true, depth: true }).partial();
export const keywordsInput = z.object({ keywords: keywordList.pipe(z.array(z.string()).min(1)), tags: z.array(z.string().trim().min(1).max(30)).max(5).default([]) });

/** Live when the tool is enabled for live mode and credentials exist; otherwise checks are labelled mock data. */
export async function trackingMode(): Promise<"live" | "mock"> {
  return isToolLive(TOOL).live && (await getCredentials()) ? "live" : "mock";
}

export async function listProjects() {
  const rows = await prisma.trackingProject.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { keywords: true } } } });
  return rows.map((p) => ({
    id: p.id, name: p.name, domain: p.domain, locationCode: p.locationCode, languageCode: p.languageCode, device: p.device, depth: p.depth,
    keywordCount: p._count.keywords, createdAt: p.createdAt.toISOString(), lastCheckedAt: p.lastCheckedAt?.toISOString() ?? null,
  }));
}

async function getProject(id: string) {
  const p = await prisma.trackingProject.findUnique({ where: { id } });
  if (!p) throw new ReportError("NOT_FOUND", "Tracking project not found.", 404);
  return p;
}

/** Search volumes for new keywords (live only; one keyword_overview request per 700 keywords). Failures leave volume empty. */
async function fillVolumes(projectId: string) {
  if ((await trackingMode()) !== "live") return;
  const p = await getProject(projectId);
  const missing = await prisma.trackedKeyword.findMany({ where: { projectId, searchVolume: null }, take: 700 });
  if (!missing.length) return;
  try {
    const r = await dfsCall<DfsLabsItemsResult<DfsKeywordItem>>("keywordOverview", {
      keywords: missing.map((k) => k.keyword), location_code: p.locationCode, language_code: p.languageCode,
    }, { tool: TOOL });
    const vol = new Map((r.result[0]?.items ?? []).map((i) => [i.keyword.toLowerCase(), i.keyword_info?.search_volume ?? null]));
    await prisma.$transaction(missing.filter((k) => vol.get(k.keyword) != null).map((k) => prisma.trackedKeyword.update({ where: { id: k.id }, data: { searchVolume: vol.get(k.keyword)! } })));
  } catch (e) {
    console.warn("[tracking] search volume lookup failed", e instanceof Error ? e.message : e);
  }
}

export async function createProject(input: z.infer<typeof projectInput>) {
  const p = await prisma.trackingProject.create({
    data: {
      name: input.name, domain: input.domain, locationCode: input.locationCode, languageCode: input.languageCode, device: input.device, depth: input.depth,
      keywords: { create: input.keywords.map((keyword) => ({ keyword, tags: input.tags })) },
    },
  });
  await fillVolumes(p.id);
  return p;
}

export async function updateProject(id: string, patch: z.infer<typeof projectPatch>) {
  await getProject(id);
  return prisma.trackingProject.update({ where: { id }, data: patch });
}

export async function deleteProject(id: string) {
  await prisma.trackingProject.deleteMany({ where: { id } });
}

export async function addKeywords(projectId: string, keywords: string[], tags: string[]) {
  await getProject(projectId);
  const count = await prisma.trackedKeyword.count({ where: { projectId } });
  if (count + keywords.length > MAX_KEYWORDS_PER_PROJECT) {
    throw new ReportError("VALIDATION_ERROR", `A project can track up to ${MAX_KEYWORDS_PER_PROJECT} keywords (${count} already).`, 400);
  }
  const res = await prisma.trackedKeyword.createMany({ data: keywords.map((keyword) => ({ projectId, keyword, tags })), skipDuplicates: true });
  await fillVolumes(projectId);
  return res.count;
}

export async function removeKeyword(projectId: string, keywordId: string) {
  await prisma.trackedKeyword.deleteMany({ where: { id: keywordId, projectId } });
}

const startOfUtcDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** MOCK position for a keyword on a day: deterministic drift around a per-keyword baseline. */
function mockPosition(keyword: string, domain: string, day: Date, depth: number): number | null {
  const h = hashString(`${domain}|${keyword}`);
  const dayNum = Math.floor(day.getTime() / 864e5);
  if ((h + dayNum) % 13 === 0) return null;
  const base = 1 + (h % 60);
  const p = Math.max(1, Math.round(base + Math.sin(dayNum / 3 + (h % 7)) * 3));
  return p <= depth ? p : null;
}

/**
 * Check every keyword that has no pending/completed check today (UTC). Live: SERP task_post in
 * batches of 100 (standard queue), results collected later. Mock: positions written immediately.
 */
export async function runChecks(projectId: string) {
  const p = await getProject(projectId);
  const today = startOfUtcDay();
  const keywords = await prisma.trackedKeyword.findMany({
    where: { projectId, ranks: { none: { checkedAt: { gte: today }, status: { in: ["pending", "done"] } } } },
  });
  if (!keywords.length) return { posted: 0, mode: await trackingMode(), costUsd: 0, alreadyChecked: true };
  const mode = await trackingMode();

  if (mode === "mock") {
    const now = new Date();
    await prisma.rankSnapshot.createMany({
      data: keywords.map((k) => {
        const position = mockPosition(k.keyword, p.domain, now, p.depth);
        return { keywordId: k.id, status: "done", source: "mock", position, url: position ? `https://${p.domain}/${k.keyword.replace(/\s+/g, "-")}` : null, serpFeatures: [] };
      }),
    });
    await prisma.trackingProject.update({ where: { id: p.id }, data: { lastCheckedAt: now } });
    return { posted: keywords.length, mode, costUsd: 0, alreadyChecked: false };
  }

  let costUsd = 0;
  for (let i = 0; i < keywords.length; i += 100) {
    const chunk = keywords.slice(i, i + 100);
    const { tasks } = await dfsBatch<unknown>("serpOrganicTaskPost", chunk.map((k) => ({
      keyword: k.keyword, location_code: p.locationCode, language_code: p.languageCode, device: p.device, depth: p.depth, tag: k.id,
    })), { tool: TOOL });
    const byTag = new Map(tasks.map((t) => [t.tag, t]));
    await prisma.rankSnapshot.createMany({
      data: chunk.map((k) => {
        const t = byTag.get(k.id);
        const ok = t && t.id && (t.statusCode === 20100 || t.statusCode === 20000);
        costUsd += t?.costUsd ?? 0;
        return {
          keywordId: k.id, status: ok ? "pending" : "failed", source: "live", taskId: ok ? t!.id : null, serpFeatures: [],
          costUsd: t?.costUsd ?? 0, error: ok ? null : t ? `${t.statusMessage} (${t.statusCode})` : "Task not created",
        };
      }),
    });
  }
  await prisma.trackingProject.update({ where: { id: p.id }, data: { lastCheckedAt: new Date() } });
  return { posted: keywords.length, mode, costUsd, alreadyChecked: false };
}

/**
 * Collect finished SERP tasks (task_get/advanced is free). Pending tasks younger than 30 s are
 * skipped; tasks still pending after 24 h are marked failed.
 */
export async function collectResults(opts: { projectId?: string; limit?: number } = {}) {
  const pending = await prisma.rankSnapshot.findMany({
    where: {
      status: "pending", taskId: { not: null }, checkedAt: { lt: new Date(Date.now() - 30_000) },
      ...(opts.projectId ? { keyword: { projectId: opts.projectId } } : {}),
    },
    include: { keyword: { include: { project: true } } },
    orderBy: { checkedAt: "asc" },
    take: opts.limit ?? 200,
  });
  let done = 0, stillPending = 0, failed = 0;
  for (const s of pending) {
    try {
      const r = await dfsCall<DfsSerpResult>("serpOrganicTaskGetAdvanced", null, { pathSuffix: `/${s.taskId}` });
      const serp = r.result[0];
      const items = serp?.items ?? [];
      const hit = items.find((it) => it.type === "organic" && matchesDomain(it.domain, s.keyword.project.domain));
      await prisma.rankSnapshot.update({
        where: { id: s.id },
        data: {
          status: "done",
          position: hit?.rank_group ?? null,
          url: hit?.url ?? null,
          serpFeatures: [...new Set((serp?.item_types ?? []).filter((t) => t !== "organic"))],
        },
      });
      done++;
    } catch (e) {
      if (isTaskPending(e) && Date.now() - s.checkedAt.getTime() < 24 * 3600_000) {
        stillPending++;
        continue;
      }
      // Transient provider / network problems: retry on the next collection unless the task is stale.
      const stale = Date.now() - s.checkedAt.getTime() > 24 * 3600_000;
      const transient = !isTaskPending(e) && (e as { code?: string })?.code === "API_UNAVAILABLE";
      if (transient && !stale) {
        stillPending++;
        continue;
      }
      await prisma.rankSnapshot.update({ where: { id: s.id }, data: { status: "failed", error: e instanceof Error ? e.message.slice(0, 300) : "error" } });
      failed++;
    }
  }
  return { checked: pending.length, done, stillPending, failed };
}

export async function getTrackingReport(projectId: string, days = 30) {
  const p = await getProject(projectId);
  // Opportunistically collect this project's finished tasks (free) before building the report.
  if (await prisma.rankSnapshot.count({ where: { status: "pending", keyword: { projectId } } })) {
    await collectResults({ projectId, limit: 100 }).catch((e) => console.warn("[tracking] collect failed", e));
  }
  const since = new Date(Date.now() - days * 864e5);
  const keywords = await prisma.trackedKeyword.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
  const snapshots = await prisma.rankSnapshot.findMany({
    where: { keyword: { projectId }, checkedAt: { gte: since } },
    select: { keywordId: true, checkedAt: true, status: true, position: true, url: true, source: true },
  });
  const failedToday = await prisma.rankSnapshot.count({ where: { keyword: { projectId }, status: "failed", checkedAt: { gte: startOfUtcDay() } } });
  const report = buildTrackingReport(
    { id: p.id, name: p.name, domain: p.domain, device: p.device, keywordCount: keywords.length, createdAt: p.createdAt.toISOString() },
    keywords.map((k) => ({ id: k.id, keyword: k.keyword, tags: k.tags, searchVolume: k.searchVolume })),
    snapshots,
    days,
  );
  return {
    ...report,
    keywordIds: Object.fromEntries(keywords.map((k) => [k.keyword, k.id])),
    settings: { locationCode: p.locationCode, languageCode: p.languageCode, depth: p.depth, lastCheckedAt: p.lastCheckedAt?.toISOString() ?? null },
    failedToday,
    mode: await trackingMode(),
  };
}

/** Daily job: check every project not yet checked today, then collect anything finished. */
export async function runDailyTracking() {
  const today = startOfUtcDay();
  const due = await prisma.trackingProject.findMany({ where: { OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: today } }] } });
  const results: { projectId: string; posted?: number; error?: string }[] = [];
  for (const p of due) {
    try {
      const r = await runChecks(p.id);
      results.push({ projectId: p.id, posted: r.posted });
    } catch (e) {
      results.push({ projectId: p.id, error: e instanceof Error ? e.message : "error" });
    }
  }
  const collected = await collectResults({ limit: 500 });
  return { due: due.length, results, collected };
}
