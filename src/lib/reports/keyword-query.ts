/**
 * Query spec for paged keyword-list tables (Keyword Magic Tool).
 * Shared by the browser (URL params), the mock handler (applyKeywordQuery) and the DataForSEO
 * translator (keywordQueryToDfs in lib/dataforseo/filters.ts), so mock and live behave the same.
 */
import { z } from "zod";
import type { KeywordMetrics } from "./types";
import { INTENTS, PAGE_SIZES } from "./ranked-query";

export const KEYWORD_SORTS = ["searchVolume", "keywordDifficulty", "cpc", "competition"] as const;
export type KeywordSort = (typeof KEYWORD_SORTS)[number];

export const MAGIC_MODES = ["broad", "phrase", "related", "questions", "ideas"] as const;
export type MagicMode = (typeof MAGIC_MODES)[number];

/** Keywords that start with a question word (used by the Questions mode in mock and live). */
export const QUESTION_WORDS = ["how", "what", "why", "when", "where", "who", "which", "can", "is", "are", "does", "do", "should", "will"] as const;
// \b (word boundary) rather than a trailing space: DataForSEO trims the value, so "^(…|do) " matched "download".
export const QUESTION_REGEX = `^(${QUESTION_WORDS.join("|")})\\b`;
export const isQuestion = (k: string) => new RegExp(QUESTION_REGEX).test(k.toLowerCase());

const optNum = (min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
    .pipe(z.number().min(min).max(max).optional());

const words = z
  .string()
  .max(200)
  .optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 3) : []));

export const keywordQuerySchema = z
  .object({
    mode: z.enum(MAGIC_MODES).default("broad"),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    size: z.coerce.number().int().refine((n) => (PAGE_SIZES as readonly number[]).includes(n), "Invalid page size").default(50),
    sort: z.enum(KEYWORD_SORTS).default("searchVolume"),
    dir: z.enum(["asc", "desc"]).default("desc"),
    inc: words,
    exc: words,
    volMin: optNum(0, 1e9), volMax: optNum(0, 1e9),
    kdMin: optNum(0, 100), kdMax: optNum(0, 100),
    cpcMin: optNum(0, 1e4), cpcMax: optNum(0, 1e4),
    intent: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []))
      .pipe(z.array(z.enum(INTENTS as unknown as [string, ...string[]]))),
  })
  .refine((q) => q.page * q.size <= 10000, "Results are limited to the first 10,000 keywords. Narrow the filters.");

export type KeywordQuery = z.infer<typeof keywordQuerySchema>;

/** Mock / fallback: filter, sort and page keyword rows in memory. */
export function applyKeywordQuery(rows: KeywordMetrics[], q: KeywordQuery): { rows: KeywordMetrics[]; total: number } {
  const inRange = (v: number | null, min?: number, max?: number) =>
    (min === undefined && max === undefined) || (v != null && (min === undefined || v >= min) && (max === undefined || v <= max));
  const filtered = rows.filter((r) => {
    const kw = r.keyword.toLowerCase();
    return (
      q.inc.every((w) => kw.includes(w)) &&
      !q.exc.some((w) => kw.includes(w)) &&
      inRange(r.searchVolume, q.volMin, q.volMax) &&
      inRange(r.keywordDifficulty, q.kdMin, q.kdMax) &&
      inRange(r.cpc, q.cpcMin, q.cpcMax) &&
      (q.intent.length === 0 || (r.intent != null && q.intent.includes(r.intent)))
    );
  });
  const sign = q.dir === "asc" ? 1 : -1;
  filtered.sort((a, b) => {
    const av = a[q.sort] ?? -Infinity;
    const bv = b[q.sort] ?? -Infinity;
    return av === bv ? a.keyword.localeCompare(b.keyword) : (av < bv ? -1 : 1) * sign;
  });
  const start = (q.page - 1) * q.size;
  return { rows: filtered.slice(start, start + q.size), total: filtered.length };
}

const STOP = new Set(["the", "for", "and", "with", "how", "what", "why", "when", "where", "who", "which", "can", "does", "should", "will", "are", "best", "you", "your", "near", "from"]);

/**
 * Common words across the given rows (excluding the seed's own words and stop words).
 * In the UI this is labelled as describing the loaded rows only — it is not a count over all results.
 */
export function wordGroups(rows: KeywordMetrics[], seed: string, max = 30) {
  const seedWords = new Set(seed.toLowerCase().split(/\s+/));
  const groups = new Map<string, { count: number; volume: number }>();
  for (const r of rows) {
    for (const w of new Set(r.keyword.toLowerCase().split(/\s+/))) {
      if (seedWords.has(w) || w.length < 3 || STOP.has(w)) continue;
      const g = groups.get(w) ?? { count: 0, volume: 0 };
      g.count++;
      g.volume += r.searchVolume;
      groups.set(w, g);
    }
  }
  return [...groups.entries()]
    .map(([term, g]) => ({ term, ...g }))
    .filter((g) => g.count > 1)
    .sort((a, b) => b.count - a.count || b.volume - a.volume)
    .slice(0, max);
}
