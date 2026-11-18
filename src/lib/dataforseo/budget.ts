import "server-only";
import { getSpendingLimits } from "@/lib/server/settings";
import { spendThisMonth, spendToday } from "./usage";
import { providerError } from "./errors";

/** Throws BUDGET_EXCEEDED when the estimated request would cross a configured limit. */
export async function assertWithinBudget(estimateUsd: number) {
  const limits = await getSpendingLimits();
  if (!limits.hardStop) return;
  if (estimateUsd > limits.maxRequestUsd) {
    throw providerError("BUDGET_EXCEEDED", `Estimated cost $${estimateUsd.toFixed(4)} exceeds the per-request limit of $${limits.maxRequestUsd.toFixed(4)}.`);
  }
  const [today, month] = await Promise.all([spendToday(), spendThisMonth()]);
  if (today + estimateUsd > limits.dailyUsd) {
    throw providerError("BUDGET_EXCEEDED", `Daily spending limit of $${limits.dailyUsd.toFixed(2)} reached ($${today.toFixed(2)} spent today).`);
  }
  if (month + estimateUsd > limits.monthlyUsd) {
    throw providerError("BUDGET_EXCEEDED", `Monthly spending limit of $${limits.monthlyUsd.toFixed(2)} reached ($${month.toFixed(2)} spent this month).`);
  }
}
