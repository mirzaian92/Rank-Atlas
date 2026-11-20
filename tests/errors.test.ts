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
