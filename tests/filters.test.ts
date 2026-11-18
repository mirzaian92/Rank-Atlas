import { describe, expect, it } from "vitest";
import { countConditions, rankedQueryToDfs, RANKED_FIELDS } from "@/lib/dataforseo/filters";
import { rankedQuerySchema } from "@/lib/reports/ranked-query";

const parse = (o: Record<string, unknown>) => rankedQuerySchema.parse(o);

describe("rankedQueryToDfs", () => {
  it("defaults: no filters, etv desc with stable secondary sort, first page", () => {
    const r = rankedQueryToDfs(parse({}));
    expect(r.filters).toBeUndefined();
    expect(r.order_by).toEqual([`${RANKED_FIELDS.etv},desc`, `${RANKED_FIELDS.searchVolume},desc`]);
    expect(r).toMatchObject({ limit: 50, offset: 0 });
  });

  it("computes offset from page and size", () => {
    expect(rankedQueryToDfs(parse({ page: "3", size: "100" }))).toMatchObject({ limit: 100, offset: 200 });
  });

  it("joins conditions with 'and' and maps fields", () => {
    const r = rankedQueryToDfs(parse({ posMin: "1", posMax: "10", volMin: "100", intent: "commercial,transactional", inc: "crm" }));
    expect(r.filters).toEqual([
      [RANKED_FIELDS.keyword, "ilike", "%crm%"], "and",
      [RANKED_FIELDS.position, ">=", 1], "and",
      [RANKED_FIELDS.position, "<=", 10], "and",
      [RANKED_FIELDS.searchVolume, ">=", 100], "and",
      [RANKED_FIELDS.intent, "in", ["commercial", "transactional"]],
    ]);
  });

  it("groups multiple SERP features with 'or'", () => {
    const r = rankedQueryToDfs(parse({ serp: "featured_snippet,video" }));
    expect(r.filters).toEqual([[[RANKED_FIELDS.serpTypes, "has", "featured_snippet"], "or", [RANKED_FIELDS.serpTypes, "has", "video"]]]);
    expect(countConditions(r.filters!)).toBe(2);
  });

  it("escapes LIKE wildcards in user text", () => {
    const r = rankedQueryToDfs(parse({ exc: "50%_off" }));
    expect(r.filters).toEqual([[RANKED_FIELDS.keyword, "not_ilike", "%50\\%\\_off%"]]);
  });

  it("does not add a duplicate secondary sort", () => {
    expect(rankedQueryToDfs(parse({ sort: "searchVolume", dir: "asc" })).order_by).toEqual([`${RANKED_FIELDS.searchVolume},asc`]);
  });

  it("rejects more than 8 conditions", () => {
    const q = parse({ inc: "a,b,c", exc: "d,e,f", posMin: "1", posMax: "5", volMin: "1" });
    expect(() => rankedQueryToDfs(q)).toThrow(/up to 8/);
  });
});

describe("rankedQuerySchema", () => {
  it("rejects unknown sorts, page sizes and intents", () => {
    expect(rankedQuerySchema.safeParse({ sort: "url" }).success).toBe(false);
    expect(rankedQuerySchema.safeParse({ size: "1000" }).success).toBe(false);
    expect(rankedQuerySchema.safeParse({ intent: "evil" }).success).toBe(false);
  });
  it("caps deep paging", () => {
    expect(rankedQuerySchema.safeParse({ page: "500", size: "100" }).success).toBe(false);
  });
  it("limits include words to 3 and lowercases them", () => {
    expect(parse({ inc: "A, B ,c,d" }).inc).toEqual(["a", "b", "c"]);
  });
});
