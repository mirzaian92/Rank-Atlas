import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
vi.mock("@prisma/client", () => ({ PrismaClient: class { $queryRaw = queryRaw; } }));

describe("dbAvailable", () => {
  beforeEach(() => {
    vi.resetModules();
    queryRaw.mockReset();
    process.env.DATABASE_URL = "postgresql://x";
    (globalThis as { prisma?: unknown }).prisma = undefined;
  });

  it("concurrent callers on a cold start all wait for the same check (regression)", async () => {
    queryRaw.mockImplementation(() => new Promise((r) => setTimeout(() => r([1]), 20)));
    const { dbAvailable } = await import("@/lib/server/db");
    const results = await Promise.all(Array.from({ length: 5 }, () => dbAvailable()));
    expect(results).toEqual([true, true, true, true, true]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("caches the result and reports false when the query fails", async () => {
    queryRaw.mockRejectedValue(new Error("down"));
    const { dbAvailable } = await import("@/lib/server/db");
    expect(await dbAvailable()).toBe(false);
    expect(await dbAvailable()).toBe(false);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("is false without DATABASE_URL", async () => {
    delete process.env.DATABASE_URL;
    const { dbAvailable } = await import("@/lib/server/db");
    expect(await dbAvailable()).toBe(false);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
