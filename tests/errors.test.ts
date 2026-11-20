import { describe, expect, it } from "vitest";
import { mapProviderStatus, NO_RESULTS_CODES } from "@/lib/dataforseo/errors";

describe("mapProviderStatus (per DataForSEO appendix/errors)", () => {
  it.each([
    [20000, null], [20100, null], [40106, null],
    [40100, "NOT_CONFIGURED"], [40104, "NOT_CONFIGURED"], [40201, "NOT_CONFIGURED"], [40207, "NOT_CONFIGURED"],
    [40101, "API_UNAVAILABLE"], [40103, "API_UNAVAILABLE"], [40107, "API_UNAVAILABLE"], [50000, "API_UNAVAILABLE"], [50301, "API_UNAVAILABLE"],
    [40202, "RATE_LIMITED"], [40205, "RATE_LIMITED"], [40209, "RATE_LIMITED"],
    [40200, "INSUFFICIENT_FUNDS"], [40210, "INSUFFICIENT_FUNDS"], [40203, "BUDGET_EXCEEDED"],
    [40501, "PROVIDER_ERROR"], [40400, "PROVIDER_ERROR"], [40105, "PROVIDER_ERROR"],
  ])("%i → %s", (code, expected) => {
    expect(mapProviderStatus(code, "")).toBe(expected);
  });
  it("treats 40102 (no search results) as empty data, not an error", () => {
    expect(NO_RESULTS_CODES.has(40102)).toBe(true);
  });
});

import { isToolLive, liveEnabledGlobally, liveToolList } from "@/lib/dataforseo/mode";
describe("live-mode env parsing (dashboard-typed values)", () => {
  it("accepts quoted / cased / padded values", () => {
    for (const v of ["true", '"true"', "'true'", " TRUE ", "1", "yes"]) {
      process.env.DATAFORSEO_LIVE_ENABLED = v;
      expect(liveEnabledGlobally()).toBe(true);
    }
    for (const v of ["false", '"false"', "", "nope"]) {
      process.env.DATAFORSEO_LIVE_ENABLED = v;
      expect(liveEnabledGlobally()).toBe(false);
    }
  });
  it("parses tool lists with quotes, spaces, newlines and casing", () => {
    process.env.DATAFORSEO_LIVE_TOOLS = '"Domain-Overview, keyword-overview\nkeyword-gap"';
    expect(liveToolList()).toEqual(["domain-overview", "keyword-overview", "keyword-gap"]);
  });
  it("explains why a tool is mock, including the value it saw", () => {
    process.env.DATAFORSEO_LIVE_ENABLED = "false";
    expect(isToolLive("domain-overview").reason).toContain('"false"');
    delete process.env.DATAFORSEO_LIVE_ENABLED;
    expect(isToolLive("domain-overview").reason).toContain("not set");
    process.env.DATAFORSEO_LIVE_ENABLED = "true";
    process.env.DATAFORSEO_LIVE_TOOLS = "keyword-overview";
    expect(isToolLive("domain-overview").reason).toContain("currently: keyword-overview");
    expect(isToolLive("keyword-overview").live).toBe(true);
  });
});
