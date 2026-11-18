import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/tooltip";
import type { DataSource } from "@/lib/reports/envelope";

const COPY: Record<DataSource, { label: string; tip: string; variant: "mock" | "live" | "muted" }> = {
  mock: { label: "MOCK DATA", tip: "Generated placeholder values for interface design. Not real SEO data.", variant: "mock" },
  live: { label: "LIVE · DataForSEO", tip: "Fetched from DataForSEO just now.", variant: "live" },
  cache: { label: "CACHED · DataForSEO", tip: "DataForSEO data served from the local cache to control API costs.", variant: "live" },
  snapshot: { label: "STORED SNAPSHOT", tip: "Values captured from earlier provider responses.", variant: "muted" },
};

export function SourceBadge({ source, className }: { source: DataSource; className?: string }) {
  const c = COPY[source];
  return (
    <Hint content={c.tip}>
      <span className={className}><Badge variant={c.variant} className="cursor-help">{c.label}</Badge></span>
    </Hint>
  );
}

/** Small inline tag for individual metrics/cards when data is mock. */
export function MockTag() {
  return <Badge variant="mock" className="px-1 py-[1px] text-[9.5px]">MOCK</Badge>;
}
