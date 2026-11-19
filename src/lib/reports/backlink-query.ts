/**
 * Query spec for the paged Backlink Analytics tables (backlinks / referring domains / anchors)
 * and Backlink Gap tabs. Shared by browser, mock handler and DataForSEO translator.
 */
import { z } from "zod";
import type { AnchorRow, BacklinkRow, ReferringDomainRow } from "./types";
import { PAGE_SIZES } from "./ranked-query";

export const BL_VIEWS = ["summary", "backlinks", "domains", "anchors"] as const;
export type BlView = (typeof BL_VIEWS)[number];

/** Sorts each table can ask the server for. */
export const BL_SORTS = {
  backlinks: ["domainRank", "firstSeen", "lastSeen"],
  domains: ["domainRank", "backlinks", "firstSeen"],
  anchors: ["backlinks", "referringDomains"],
} as const;
export const BL_LINK_TYPES = ["anchor", "image", "redirect", "canonical"] as const;

const optNum = (min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
    .pipe(z.number().min(min).max(max).optional());

export const blQuerySchema = z
  .object({
    view: z.enum(BL_VIEWS).default("summary"),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    size: z.coerce.number().int().refine((n) => (PAGE_SIZES as readonly number[]).includes(n), "Invalid page size").default(50),
    sort: z.string().optional(),
    dir: z.enum(["asc", "desc"]).default("desc"),
    /** Contains-text search (URL/anchor, domain, or anchor depending on view). */
    search: z.string().trim().max(100).optional(),
    status: z.enum(["live", "new", "lost"]).default("live"),
    attr: z.enum(["follow", "nofollow"]).optional(),
    type: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(",").filter(Boolean) : []))
      .pipe(z.array(z.enum(BL_LINK_TYPES))),
    drMin: optNum(0, 100),
    drMax: optNum(0, 100),
    spamMax: optNum(0, 100),
  })
  .superRefine((q, ctx) => {
    if (q.view === "summary" || !q.sort) return;
    if (!(BL_SORTS[q.view] as readonly string[]).includes(q.sort)) ctx.addIssue({ code: "custom", path: ["sort"], message: `Can't sort ${q.view} by "${q.sort}"` });
  })
  .refine((q) => q.page * q.size <= 20000, "Results are limited to the first 20,000 rows. Narrow the filters.");

export type BlQuery = z.infer<typeof blQuerySchema>;

export function defaultBlSort(view: Exclude<BlView, "summary">): string {
  return view === "anchors" ? "backlinks" : "domainRank";
}

// ---------- mock implementations (same semantics as the DataForSEO translation) ----------
const inRange = (v: number | null, min?: number, max?: number) =>
  (min === undefined && max === undefined) || (v != null && (min === undefined || v >= min) && (max === undefined || v <= max));
const has = (s: string | null | undefined, q?: string) => !q || (s ?? "").toLowerCase().includes(q.toLowerCase());

function sortPage<T>(rows: T[], q: BlQuery, key: (r: T) => number | string | null) {
  const sign = q.dir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const av = key(a) ?? -Infinity;
    const bv = key(b) ?? -Infinity;
    return av === bv ? 0 : (av < bv ? -1 : 1) * sign;
  });
  const start = (q.page - 1) * q.size;
  return { rows: rows.slice(start, start + q.size), total: rows.length };
}

export function applyBacklinkQuery(rows: BacklinkRow[], q: BlQuery) {
  const f = rows.filter(
    (r) =>
      (q.status === "lost" ? r.isLost : !r.isLost) &&
      (q.status !== "new" || r.isNew) &&
      (!q.attr || (q.attr === "follow") === r.dofollow) &&
      (q.type.length === 0 || (q.type as string[]).includes(r.type)) &&
      inRange(r.sourceDomainRank, q.drMin, q.drMax) &&
      (has(r.sourceUrl, q.search) || has(r.anchor, q.search)),
  );
  const s = q.sort ?? "domainRank";
  return sortPage(f, q, (r) => (s === "firstSeen" ? r.firstSeen : s === "lastSeen" ? r.lastSeen : r.sourceDomainRank));
}

export function applyDomainQuery(rows: ReferringDomainRow[], q: BlQuery) {
  const f = rows.filter((r) => inRange(r.domainRank, q.drMin, q.drMax) && inRange(r.spamScore, undefined, q.spamMax) && has(r.domain, q.search));
  const s = q.sort ?? "domainRank";
  return sortPage(f, q, (r) => (s === "backlinks" ? r.backlinks : s === "firstSeen" ? r.firstSeen : r.domainRank));
}

export function applyAnchorQuery(rows: AnchorRow[], q: BlQuery) {
  const f = rows.filter((r) => has(r.anchor, q.search));
  const s = q.sort ?? "backlinks";
  return sortPage(f, q, (r) => (s === "referringDomains" ? r.referringDomains : r.backlinks));
}

// ---------- Backlink Gap ----------
export const BL_GAP_TABS = ["best", "untapped", "shared", "unique"] as const;
export const BL_GAP_TAB_INFO = {
  best: { label: "Best", tip: "Link to every competitor, but not to you" },
  untapped: { label: "Untapped", tip: "Link to at least one competitor, but not to you" },
  shared: { label: "Shared", tip: "Link to every domain, including you" },
  unique: { label: "Unique", tip: "Link to you, but to none of the competitors" },
} as const;

export const blGapQuerySchema = z.object({
  tab: z.enum(BL_GAP_TABS).default("best"),
  page: z.coerce.number().int().min(1).max(200).default(1),
  size: z.coerce.number().int().refine((n) => (PAGE_SIZES as readonly number[]).includes(n), "Invalid page size").default(50),
  drMin: optNum(0, 100),
});
export type BlGapQuery = z.infer<typeof blGapQuerySchema>;
