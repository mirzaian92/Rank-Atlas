/**
 * Translate app query specs into DataForSEO Labs `filters` / `order_by` arrays.
 *
 * DataForSEO filter syntax (Labs): a flat array alternating conditions and logical operators,
 *   [["field", "op", value], "and", ["field", "op", value]]
 * Conditions may be nested arrays for grouped OR logic. Max 8 conditions per request.
 * Operators used here: <=, >=, ilike, not_ilike, in, has.
 * VERIFY against https://docs.dataforseo.com/v3/dataforseo_labs/filters/ (field names, `has` on arrays, nesting).
 */
import type { RankedQuery, RankedSort } from "@/lib/reports/ranked-query";
import type { KeywordQuery, KeywordSort } from "@/lib/reports/keyword-query";
import { QUESTION_REGEX } from "@/lib/reports/keyword-query";


export type DfsCondition = [string, string, unknown];
export type DfsFilter = (DfsCondition | "and" | "or" | DfsFilter)[];

export const MAX_FILTER_CONDITIONS = 8;

/** Field paths inside ranked_keywords items. */
export const RANKED_FIELDS = {
  keyword: "keyword_data.keyword",
  position: "ranked_serp_element.serp_item.rank_group",
  etv: "ranked_serp_element.serp_item.etv",
  searchVolume: "keyword_data.keyword_info.search_volume",
  cpc: "keyword_data.keyword_info.cpc",
  keywordDifficulty: "keyword_data.keyword_properties.keyword_difficulty",
  intent: "keyword_data.search_intent_info.main_intent",
  serpTypes: "ranked_serp_element.serp_item_types",
} as const;

const SORT_FIELD: Record<RankedSort, string> = {
  etv: RANKED_FIELDS.etv,
  position: RANKED_FIELDS.position,
  searchVolume: RANKED_FIELDS.searchVolume,
  keywordDifficulty: RANKED_FIELDS.keywordDifficulty,
  cpc: RANKED_FIELDS.cpc,
};

export class FilterLimitError extends Error {}

/** Count leaf conditions (nested groups count each member). */
export function countConditions(f: DfsFilter): number {
  return f.reduce<number>((n, x) => {
    if (x === "and" || x === "or") return n;
    if (Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "string" && x.length === 3) return n + 1;
    return n + countConditions(x as DfsFilter);
  }, 0);
}

function joinAnd(parts: (DfsCondition | DfsFilter)[]): DfsFilter {
  const out: DfsFilter = [];
  parts.forEach((p, i) => {
    if (i > 0) out.push("and");
    out.push(p);
  });
  return out;
}

function range(field: string, min?: number, max?: number): DfsCondition[] {
  const c: DfsCondition[] = [];
  if (min !== undefined) c.push([field, ">=", min]);
  if (max !== undefined) c.push([field, "<=", max]);
  return c;
}

/** Escape LIKE wildcards in user text so "50%" matches literally. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export function rankedQueryToDfs(q: RankedQuery): { filters?: DfsFilter; order_by: string[]; limit: number; offset: number } {
  const parts: (DfsCondition | DfsFilter)[] = [
    ...q.inc.map((w): DfsCondition => [RANKED_FIELDS.keyword, "ilike", `%${likeEscape(w)}%`]),
    ...q.exc.map((w): DfsCondition => [RANKED_FIELDS.keyword, "not_ilike", `%${likeEscape(w)}%`]),
    ...range(RANKED_FIELDS.position, q.posMin, q.posMax),
    ...range(RANKED_FIELDS.searchVolume, q.volMin, q.volMax),
    ...range(RANKED_FIELDS.keywordDifficulty, q.kdMin, q.kdMax),
    ...range(RANKED_FIELDS.cpc, q.cpcMin, q.cpcMax),
  ];
  if (q.intent.length) parts.push([RANKED_FIELDS.intent, "in", q.intent]);
  if (q.serp.length === 1) parts.push([RANKED_FIELDS.serpTypes, "has", q.serp[0]]);
  else if (q.serp.length > 1) {
    const group: DfsFilter = [];
    q.serp.forEach((f, i) => {
      if (i > 0) group.push("or");
      group.push([RANKED_FIELDS.serpTypes, "has", f]);
    });
    parts.push(group);
  }

  const filters = parts.length ? joinAnd(parts) : undefined;
  if (filters && countConditions(filters) > MAX_FILTER_CONDITIONS) {
    throw new FilterLimitError(`Too many filter conditions (${countConditions(filters)}). DataForSEO allows up to ${MAX_FILTER_CONDITIONS}.`);
  }

  // Secondary sort keeps paging stable when the primary value ties.
  const order_by = [`${SORT_FIELD[q.sort]},${q.dir}`];
  if (q.sort !== "searchVolume") order_by.push(`${RANKED_FIELDS.searchVolume},desc`);

  return { ...(filters ? { filters } : {}), order_by, limit: q.size, offset: (q.page - 1) * q.size };
}

// ---------------------------------------------------------------------------
// Keyword lists (keyword_suggestions / keyword_ideas / related_keywords)
// ---------------------------------------------------------------------------

/**
 * Field paths for keyword-list endpoints. keyword_suggestions / keyword_ideas items have these at
 * the top level; related_keywords nests them under `keyword_data.` (pass that as `prefix`).
 */
export function keywordFields(prefix = "") {
  return {
    keyword: `${prefix}keyword`,
    searchVolume: `${prefix}keyword_info.search_volume`,
    cpc: `${prefix}keyword_info.cpc`,
    competition: `${prefix}keyword_info.competition`,
    keywordDifficulty: `${prefix}keyword_properties.keyword_difficulty`,
    intent: `${prefix}search_intent_info.main_intent`,
  };
}

export function keywordQueryToDfs(q: KeywordQuery, prefix = ""): { filters?: DfsFilter; order_by: string[]; limit: number; offset: number } {
  const f = keywordFields(prefix);
  const parts: (DfsCondition | DfsFilter)[] = [
    ...(q.mode === "questions" ? [[f.keyword, "regex", QUESTION_REGEX] as DfsCondition] : []),
    ...q.inc.map((w): DfsCondition => [f.keyword, "ilike", `%${likeEscape(w)}%`]),
    ...q.exc.map((w): DfsCondition => [f.keyword, "not_ilike", `%${likeEscape(w)}%`]),
    ...range(f.searchVolume, q.volMin, q.volMax),
    ...range(f.keywordDifficulty, q.kdMin, q.kdMax),
    ...range(f.cpc, q.cpcMin, q.cpcMax),
  ];
  if (q.intent.length) parts.push([f.intent, "in", q.intent]);
  const filters = parts.length ? joinAnd(parts) : undefined;
  if (filters && countConditions(filters) > MAX_FILTER_CONDITIONS) {
    throw new FilterLimitError(`Too many filter conditions (${countConditions(filters)}). DataForSEO allows up to ${MAX_FILTER_CONDITIONS}.`);
  }
  const sortField: Record<KeywordSort, string> = { searchVolume: f.searchVolume, keywordDifficulty: f.keywordDifficulty, cpc: f.cpc, competition: f.competition };
  const order_by = [`${sortField[q.sort]},${q.dir}`];
  if (q.sort !== "searchVolume") order_by.push(`${f.searchVolume},desc`);
  return { ...(filters ? { filters } : {}), order_by, limit: q.size, offset: (q.page - 1) * q.size };
}
