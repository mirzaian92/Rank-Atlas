import "server-only";
import { z } from "zod";
import { dbAvailable, prisma } from "./db";

export const spendingLimitsSchema = z.object({
  dailyUsd: z.number().min(0).max(10000),
  monthlyUsd: z.number().min(0).max(100000),
  maxRequestUsd: z.number().min(0).max(1000),
  /** Block live requests entirely once a limit is reached (true) or only warn (false). */
  hardStop: z.boolean(),
});
export type SpendingLimits = z.infer<typeof spendingLimitsSchema>;

export const DEFAULT_LIMITS: SpendingLimits = { dailyUsd: 5, monthlyUsd: 50, maxRequestUsd: 0.5, hardStop: true };

export const cacheSettingsSchema = z.object({
  /** Multiplier applied to every endpoint's default TTL (1 = defaults). */
  ttlMultiplier: z.number().min(0.1).max(30),
  enabled: z.boolean(),
});
export type CacheSettings = z.infer<typeof cacheSettingsSchema>;
export const DEFAULT_CACHE: CacheSettings = { ttlMultiplier: 1, enabled: true };

async function read<T>(key: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  if (!(await dbAvailable())) return fallback;
  const row = await prisma.appSetting.findUnique({ where: { key } });
  const parsed = schema.safeParse(row?.value);
  return parsed.success ? parsed.data : fallback;
}

async function write<T>(key: string, value: T) {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value: value as object }, update: { value: value as object } });
}

export const getSpendingLimits = () => read("spending_limits", spendingLimitsSchema, DEFAULT_LIMITS);
export const setSpendingLimits = (v: SpendingLimits) => write("spending_limits", v);
export const getCacheSettings = () => read("cache_settings", cacheSettingsSchema, DEFAULT_CACHE);
export const setCacheSettings = (v: CacheSettings) => write("cache_settings", v);
