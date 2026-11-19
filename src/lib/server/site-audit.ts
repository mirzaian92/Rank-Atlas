import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { dfsCall, isTaskPending } from "@/lib/dataforseo/client";
import { isToolLive } from "@/lib/dataforseo/mode";
import { getCredentials } from "@/lib/dataforseo/credentials";
import type { DfsOnPagePage, DfsOnPageSummary } from "@/lib/dataforseo/types";
import { normalizeOnPage } from "@/lib/dataforseo/normalize/on-page";
import { ReportError } from "@/lib/reports/envelope";
import type { SiteAudit } from "@/lib/reports/types";
import { AUDIT_PAGE_LIMITS } from "@/lib/reports/site-audit";
import { mockSiteAudit } from "@/lib/mock/links-site";
import { looksLikeDomain, normalizeDomain } from "@/lib/utils";

const TOOL = "site-audit" as const;

export const crawlInput = z.object({
  target: z.string().transform(normalizeDomain).refine(looksLikeDomain, "Enter a valid domain"),
  maxPages: z.number().int().refine((n) => (AUDIT_PAGE_LIMITS as readonly number[]).includes(n), "Invalid page limit").default(100),
});

export async function auditMode(): Promise<"live" | "mock"> {
  return isToolLive(TOOL).live && (await getCredentials()) ? "live" : "mock";
}

type CrawlRow = Awaited<ReturnType<typeof prisma.siteAuditCrawl.findUniqueOrThrow>>;

function publicCrawl(c: CrawlRow) {
  const progress = (c.progress ?? null) as { pagesCrawled?: number; pagesInQueue?: number } | null;
  return {
    id: c.id, target: c.target, source: c.source, status: c.status, maxPages: c.maxPages,
    createdAt: c.createdAt.toISOString(), finishedAt: c.finishedAt?.toISOString() ?? null,
    pagesCrawled: progress?.pagesCrawled ?? (c.summary as SiteAudit | null)?.crawl.pagesCrawled ?? 0,
    pagesInQueue: progress?.pagesInQueue ?? 0,
    costUsd: Number(c.costUsd), error: c.error,
  };
}
export type PublicCrawl = ReturnType<typeof publicCrawl>;

/** Start a crawl. Live: on_page/task_post (≈ $0.000125/page). Mock: an instantly "finished" labelled mock crawl. */
export async function startCrawl(input: z.infer<typeof crawlInput>) {
  const running = await prisma.siteAuditCrawl.findFirst({ where: { target: input.target, status: { in: ["queued", "crawling"] } } });
  if (running) throw new ReportError("VALIDATION_ERROR", "A crawl for this domain is already running.", 409);

  if ((await auditMode()) === "mock") {
    const report = { ...mockSiteAudit(input.target), crawl: { ...mockSiteAudit(input.target).crawl, maxPages: input.maxPages } };
    const c = await prisma.siteAuditCrawl.create({
      data: { target: input.target, source: "mock", status: "finished", maxPages: input.maxPages, finishedAt: new Date(), summary: report as unknown as Prisma.InputJsonValue },
    });
    return publicCrawl(c);
  }

  const r = await dfsCall<unknown>("onPageTaskPost", {
    target: input.target, max_crawl_pages: input.maxPages, load_resources: false, enable_javascript: false, store_raw_html: false,
  }, { tool: TOOL });
  if (!r.taskId) throw new ReportError("PROVIDER_ERROR", "DataForSEO did not return a task id.", 502);
  const c = await prisma.siteAuditCrawl.create({
    data: { target: input.target, taskId: r.taskId, source: "live", status: "crawling", maxPages: input.maxPages, costUsd: r.costUsd },
  });
  return publicCrawl(c);
}

/** Poll a live crawl (summary is free); when finished, fetch pages (free) and store the report. */
async function refresh(c: CrawlRow): Promise<CrawlRow> {
  if (c.source !== "live" || !c.taskId || !["queued", "crawling"].includes(c.status)) return c;
  try {
    const s = await dfsCall<DfsOnPageSummary>("onPageSummary", null, { pathSuffix: `/${c.taskId}` });
    const summary = s.result[0] ?? null;
    const progress = { pagesCrawled: summary?.crawl_status?.pages_crawled ?? 0, pagesInQueue: summary?.crawl_status?.pages_in_queue ?? 0, at: new Date().toISOString() };
    if (summary?.crawl_progress !== "finished") {
      return prisma.siteAuditCrawl.update({ where: { id: c.id }, data: { status: "crawling", progress } });
    }
    const pages = await dfsCall<{ items?: DfsOnPagePage[] | null }>("onPagePages", { id: c.taskId, limit: 1000, order_by: ["onpage_score,asc"] });
    const report = normalizeOnPage(c.target, summary, pages.result[0]?.items ?? [], c.maxPages);
    return prisma.siteAuditCrawl.update({
      where: { id: c.id },
      data: { status: "finished", finishedAt: new Date(), progress, summary: report as unknown as Prisma.InputJsonValue },
    });
  } catch (e) {
    const stale = Date.now() - c.createdAt.getTime() > 24 * 3600_000;
    if ((isTaskPending(e) || (e as { code?: string })?.code === "API_UNAVAILABLE") && !stale) return c;
    return prisma.siteAuditCrawl.update({ where: { id: c.id }, data: { status: "failed", error: e instanceof Error ? e.message.slice(0, 300) : "error" } });
  }
}

export async function listCrawls(target: string) {
  const rows = await prisma.siteAuditCrawl.findMany({ where: { target: normalizeDomain(target) }, orderBy: { createdAt: "desc" }, take: 20 });
  return rows.map(publicCrawl);
}

export async function getCrawl(id: string) {
  const c = await prisma.siteAuditCrawl.findUnique({ where: { id } });
  if (!c) throw new ReportError("NOT_FOUND", "Crawl not found.", 404);
  const fresh = await refresh(c);
  return { crawl: publicCrawl(fresh), report: (fresh.summary ?? null) as SiteAudit | null };
}

/** Daily job: finish crawls nobody has looked at since they started. */
export async function finalizePendingCrawls() {
  const pending = await prisma.siteAuditCrawl.findMany({ where: { status: { in: ["queued", "crawling"] }, source: "live" }, take: 50 });
  const after = await Promise.all(pending.map(refresh));
  return { checked: pending.length, finished: after.filter((c) => c.status === "finished").length, failed: after.filter((c) => c.status === "failed").length };
}
