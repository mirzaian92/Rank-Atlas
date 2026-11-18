import { z } from "zod";
import { MARKETS } from "@/lib/config/markets";
import { looksLikeDomain, normalizeDomain } from "@/lib/utils";

export const domainSchema = z
  .string()
  .trim()
  .min(3, "Enter a domain")
  .max(253)
  .transform(normalizeDomain)
  .refine((v) => looksLikeDomain(v), "Enter a valid domain, e.g. example.com");

export const keywordSchema = z
  .string()
  .trim()
  .min(1, "Enter a keyword")
  .max(80, "Keywords are limited to 80 characters")
  .transform((v) => v.toLowerCase().replace(/\s+/g, " "));

export const keywordListSchema = z
  .string()
  .transform((v) => v.split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean))
  .pipe(z.array(z.string().max(80)).min(1, "Enter at least one keyword").max(100, "Up to 100 keywords per request"))
  .transform((arr) => [...new Set(arr)]);

export const domainListSchema = z
  .string()
  .transform((v) => v.split(/[,\s]+/).map((s) => normalizeDomain(s)).filter(Boolean))
  .pipe(z.array(z.string().refine(looksLikeDomain, "Invalid domain")).min(2, "Enter at least two domains").max(5, "Up to 5 domains"));

export const marketSchema = z.object({
  db: z.string().default("us"),
  lang: z.string().optional(),
}).transform(({ db, lang }) => {
  const m = MARKETS.find((x) => x.id === db) ?? MARKETS[0];
  const l = m.languages.find((x) => x.code === lang) ?? m.languages[0];
  return { market: m.id, locationCode: m.locationCode, languageCode: l.code };
});
