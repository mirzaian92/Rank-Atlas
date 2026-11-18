"use client";
import { useQuery } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { toolByPath } from "@/lib/config/tools";
import { useSearchState } from "@/lib/client/use-search-state";
import { UniversalSearch } from "./universal-search";
import { MarketSelector } from "./market-selector";
import { Button } from "@/components/ui/button";
import { UsageMeter } from "./usage-meter";

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
        <UsageMeter />
      </div>
      <div className="flex items-center gap-2 border-t border-border px-4 py-2 sm:hidden">
        <MarketSelector db={market.id} lang={language.code} onChange={(db, lang) => setParams({ db, lang }, { replace: true })} />
        <UsageMeter className="ml-auto flex" />
      </div>
    </header>
  );
}
