"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Menu, Database, FlaskConical } from "lucide-react";
import { toolByPath } from "@/lib/config/tools";
import { useSearchState } from "@/lib/client/use-search-state";
import { UniversalSearch } from "./universal-search";
import { MarketSelector } from "./market-selector";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";

type SettingsSummary = { live: { enabled: boolean; sandbox: boolean; tools: { id: string; listed: boolean; integration: string }[] }; credentials: { configured: boolean } };

export function useSettingsSummary() {
  return useQuery<SettingsSummary>({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
    staleTime: 60_000,
  });
}

export function AppHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { q, market, language, setParams, pathname } = useSearchState();
  const current = toolByPath(pathname);
  const { data: settings } = useSettingsSummary();
  const live = settings?.live.enabled && settings.credentials.configured;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onOpenMenu} aria-label="Open navigation">
          <Menu />
        </Button>
        <UniversalSearch current={current} q={q} db={market.id} lang={language.code} />
        <MarketSelector
          className="max-sm:hidden"
          db={market.id}
          lang={language.code}
          onChange={(db, lang) => setParams({ db, lang }, { replace: true })}
        />
        <Hint content={live ? (settings?.live.sandbox ? "Live mode against the DataForSEO sandbox" : "Live DataForSEO requests are enabled for listed tools") : "All reports use labelled mock data. Configure live mode in Settings."}>
          <Link
            href="/settings"
            className={live ? "hidden items-center gap-1.5 rounded-md border border-[#a9dca9] bg-[#e3f6e3] px-2.5 py-1.5 text-xs font-semibold text-good-text md:flex" : "hidden items-center gap-1.5 rounded-md border border-[#f3d27a] bg-[#fff4d6] px-2.5 py-1.5 text-xs font-semibold text-[#7a5300] md:flex"}
          >
            {live ? <Database className="size-3.5" /> : <FlaskConical className="size-3.5" />}
            {live ? (settings?.live.sandbox ? "Sandbox" : "Live") : "Mock data"}
          </Link>
        </Hint>
      </div>
      <div className="flex items-center gap-2 border-t border-border px-4 py-2 sm:hidden">
        <MarketSelector db={market.id} lang={language.code} onChange={(db, lang) => setParams({ db, lang }, { replace: true })} />
      </div>
    </header>
  );
}
