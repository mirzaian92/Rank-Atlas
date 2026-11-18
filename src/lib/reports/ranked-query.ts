/**
 * Query spec for paged ranked-keyword tables (Organic Research → Positions).
 *
 * One definition is shared by:
 *   - the browser (serializes table state into URL params),
 *   - the mock handler (applies it in JS),
 *   - the DataForSEO service (translates it to `filters` / `order_by` / `limit` / `offset`).
 * That keeps mock and live behaviour identical.
 */
import { z } from "zod";
import type { RankedKeyword, SearchIntent } from "./types";

export const RANKED_SORTS = ["etv", "position", "searchVolume", "keywordDifficulty", "cpc"] as const;
export type RankedSort = (typeof RANKED_SORTS)[number];

export const PAGE_SIZES = [25, 50, 100] as const;

const csv = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []))
    .pipe(z.array(z.enum(values as unknown as [T, ...T[]])));

const optNum = (min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
    .pipe(z.number().min(min).max(max).optional());

const text = z
  .string()
  .max(200)
  .optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 3) : []));

export const INTENTS: SearchIntent[] = ["informational", "navigational", "commercial", "transactional"];
export const SERP_FEATURE_FILTERS = [
  "featured_snippet", "people_also_ask", "images", "video", "local_pack", "top_stories", "knowledge_graph", "sitelinks", "shopping",
] as const;

export const rankedQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    size: z.coerce.number().int().refine((n) => (PAGE_SIZES as readonly number[]).includes(n), "Invalid page size").default(50),
    sort: z.enum(RANKED_SORTS).default("etv"),
    dir: z.enum(["asc", "desc"]).default("desc"),
    /** keyword must contain all of these (comma separated, max 3) */
    inc: text,
    /** keyword must contain none of these (comma separated, max 3) */
    exc: text,
    posMin: optNum(1, 100), posMax: optNum(1, 100),
    volMin: optNum(0, 1e9), volMax: optNum(0, 1e9),
    kdMin: optNum(0, 100), kdMax: optNum(0, 100),
    cpcMin: optNum(0, 1e4), cpcMax: optNum(0, 1e4),
    intent: csv(INTENTS),
    serp: csv(SERP_FEATURE_FILTERS),
  })
  .refine((q) => q.page * q.size <= 20000, "Results are limited to the first 20,000 rows. Narrow the filters.");

export type RankedQuery = z.infer<typeof rankedQuerySchema>;

/** Client: table state → URL params (only non-default values). */
export function rankedQueryToParams(q: Partial<Record<keyof RankedQuery, unknown>>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length) out[k] = v.join(",");
    } else out[k] = String(v);
  }
  return out;
}

/** Mock / fallback: apply the query to rows in memory. Returns the page plus the filtered total. */
export function applyRankedQuery(rows: RankedKeyword[], q: RankedQuery): { rows: RankedKeyword[]; total: number } {
  const inRange = (v: number | null, min?: number, max?: number) =>
    (min === undefined && max === undefined) || (v != null && (min === undefined || v >= min) && (max === undefined || v <= max));
  const filtered = rows.filter((r) => {
    const kw = r.keyword.toLowerCase();
    return (
      q.inc.every((w) => kw.includes(w)) &&
      !q.exc.some((w) => kw.includes(w)) &&
      inRange(r.position, q.posMin, q.posMax) &&
      inRange(r.searchVolume, q.volMin, q.volMax) &&
      inRange(r.keywordDifficulty, q.kdMin, q.kdMax) &&
      inRange(r.cpc, q.cpcMin, q.cpcMax) &&
      (q.intent.length === 0 || (r.intent != null && q.intent.includes(r.intent))) &&
      (q.serp.length === 0 || q.serp.some((f) => r.serpFeatures.includes(f)))
    );
  });
  const key = q.sort;
  const sign = q.dir === "asc" ? 1 : -1;
  filtered.sort((a, b) => {
    const av = a[key] ?? -Infinity;
    const bv = b[key] ?? -Infinity;
    return av === bv ? a.keyword.localeCompare(b.keyword) : (av < bv ? -1 : 1) * sign;
  });
  const start = (q.page - 1) * q.size;
  return { rows: filtered.slice(start, start + q.size), total: filtered.length };
}
