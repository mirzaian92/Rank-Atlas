"use client";
import { MARKETS, getMarket, getLanguage } from "@/lib/config/markets";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rememberMarket } from "@/lib/client/use-search-state";
import { cn } from "@/lib/utils";

export function MarketSelector({ db, lang, onChange, className }: { db: string; lang: string; onChange: (db: string, lang: string) => void; className?: string }) {
  const market = getMarket(db);
  const language = getLanguage(market, lang);
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Select
        value={market.id}
        onValueChange={(v) => {
          const m = getMarket(v);
          rememberMarket(m.id, m.languages[0].code);
          onChange(m.id, m.languages[0].code);
        }}
      >
        <SelectTrigger aria-label="Search market (country)" className="h-9 w-[168px] text-[13px]">
          <SelectValue>
            <span className="mr-1.5">{market.flag}</span>
            {market.country}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MARKETS.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <span className="mr-1.5">{m.flag}</span>
              {m.country}
              <span className="ml-1.5 text-[11px] text-ink-3">{m.locationCode}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={language.code}
        onValueChange={(v) => {
          rememberMarket(market.id, v);
          onChange(market.id, v);
        }}
        disabled={market.languages.length < 2}
      >
        <SelectTrigger aria-label="Language" className="h-9 w-[84px] text-[13px] uppercase">
          <SelectValue>{language.code}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {market.languages.map((l) => (
            <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
