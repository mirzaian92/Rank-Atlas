/**
 * Backlink Audit risk heuristics (shared by mock and live). These are local rules on provider
 * metrics — not a Google penalty prediction. The UI says to review before disavowing.
 */
import type { ReferringDomainRow, RiskLevel } from "./types";

const LOW_QUALITY_TLDS = /\.(xyz|info|top|click|loan|work|gq|tk|ml|cf|ga|buzz|rest)$/i;

export function assessRisk(d: ReferringDomainRow): { risk: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];
  const s = d.spamScore ?? 0;
  if (s >= 60) reasons.push("High spam score");
  else if (s >= 30) reasons.push("Elevated spam score");
  if (LOW_QUALITY_TLDS.test(d.domain)) reasons.push("Low-quality TLD");
  if (d.domainRank != null && d.domainRank < 5) reasons.push("Very low domain rank");
  // Sitewide links are normal from established sites; they're a risk signal from weak domains.
  if (d.backlinks > 1000 && d.dofollow / d.backlinks > 0.95 && (d.domainRank ?? 0) < 30) reasons.push("Sitewide links from a low-authority domain");
  const strong = reasons.filter((r) => r !== "Elevated spam score").length;
  const risk: RiskLevel = s >= 60 || strong >= 2 ? "toxic" : s >= 30 || strong === 1 ? "suspicious" : "healthy";
  return { risk, reasons };
}

export const SPAM_RANGES = ["0–10", "11–20", "21–30", "31–40", "41–50", "51–60", "61–70", "71–80", "81–90", "91–100"];

export function spamDistribution(scores: (number | null)[]) {
  const counts = SPAM_RANGES.map(() => 0);
  for (const s of scores) if (s != null) counts[Math.min(9, Math.floor(Math.max(0, s - 1) / 10))]++;
  return SPAM_RANGES.map((range, i) => ({ range, count: counts[i] }));
}

export const AUDIT_SAMPLES = [500, 1000] as const;
/** referring_domains (≈$0.02 + $0.00003/row) + bulk_spam_score (≈$0.02 + $0.00003/target). */
export function estimateAuditCost(sample: number) {
  return 0.02 + 0.00003 * sample + 0.02 + 0.00003 * sample;
}
