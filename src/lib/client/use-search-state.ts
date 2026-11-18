"use client";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getLanguage, getMarket } from "@/lib/config/markets";

const MARKET_KEY = "ra.market";

export function rememberMarket(db: string, lang: string) {
  try {
    localStorage.setItem(MARKET_KEY, JSON.stringify({ db, lang }));
  } catch {}
}
export function recallMarket(): { db: string; lang: string } | null {
  try {
    const v = localStorage.getItem(MARKET_KEY);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

/** URL is the source of truth for report state: ?q=&db=&lang=&... */
export function useSearchState() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const market = getMarket(sp.get("db"));
  const language = getLanguage(market, sp.get("lang"));
  const q = sp.get("q") ?? "";

  const setParams = useCallback(
    (patch: Record<string, string | null | undefined>, opts: { path?: string; replace?: boolean } = {}) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const url = `${opts.path ?? pathname}?${next.toString()}`;
      if (opts.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [sp, router, pathname],
  );

  const get = useCallback((k: string) => sp.get(k) ?? undefined, [sp]);
  const baseParams = useMemo(() => ({ q, db: market.id, lang: language.code }), [q, market.id, language.code]);

  return { q, market, language, setParams, get, baseParams, searchParams: sp, pathname };
}
