"use client";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getTool, type ToolId } from "@/lib/config/tools";
import { useReport } from "@/lib/client/use-report";
import { useSearchState } from "@/lib/client/use-search-state";
import type { ReportMeta } from "@/lib/reports/envelope";
import { DashboardSkeleton, EmptyState, ErrorState } from "@/components/states/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Hint } from "@/components/ui/tooltip";
import { SourceBadge } from "./source-badge";
import { ToolLanding } from "./tool-landing";
import { fmtCurrency } from "@/lib/utils";

/**
 * Wraps every report page: header, query/market from the URL, loading / error / empty
 * handling, and the data-source label. Pages only implement `children(data, meta)`.
 */
export function ReportView<T>({ tool, extraParams, actions, children, isEmpty, skeleton, subtitle, landing, above }: {
  tool: ToolId;
  extraParams?: Record<string, string | undefined>;
  actions?: React.ReactNode;
  children: (data: T, meta: ReportMeta) => React.ReactNode;
  isEmpty?: (data: T) => boolean;
  skeleton?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Replaces the default landing (shown when there is no query). */
  landing?: React.ReactNode;
  /** Rendered between the header and the results (e.g. a multi-input form). */
  above?: React.ReactNode;
}) {
  const def = getTool(tool);
  const { q, market, language, baseParams, get } = useSearchState();
  const sim = get("__state");
  const params = { ...baseParams, ...extraParams, ...(sim ? { __state: sim } : {}) };
  const query = useReport<T>(tool, params, Boolean(q));

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <PageHeader
        title={def.label}
        subject={q || undefined}
        market={`${market.flag} ${market.country} · ${language.name}`}
        meta={query.data?.meta}
        actions={q ? <>{actions}<SaveSearchButton tool={tool} query={q} kind={def.query} /></> : null}
        description={!q ? def.description : subtitle}
      />
      {q && above}
      {!q ? (
        landing ?? <ToolLanding tool={def} />
      ) : query.isPending ? (
        skeleton ?? <DashboardSkeleton />
      ) : query.isError ? (
        <ErrorState code={query.error.code} message={query.error.message} onRetry={() => query.refetch()} />
      ) : isEmpty?.(query.data.data) ? (
        <Card>
          <EmptyState title="No data for this query" description={`The provider returned no results for "${q}" in ${market.country}. Try another market or check the spelling.`} />
        </Card>
      ) : (
        <>
          {query.data.meta.notes && query.data.meta.notes.length > 0 && (
            <ul className="space-y-0.5 text-[12px] text-ink-3">
              {query.data.meta.notes.map((n) => <li key={n}>• {n}</li>)}
            </ul>
          )}
          {children(query.data.data, query.data.meta)}
        </>
      )}
    </div>
  );
}

export function PageHeader({ title, subject, market, meta, actions, description }: {
  title: string; subject?: string; market?: string; meta?: ReportMeta; actions?: React.ReactNode; description?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">
            {title}
            {subject && <span className="text-ink-2">: <span className="text-ink">{subject}</span></span>}
          </h1>
          {meta && <SourceBadge source={meta.source} />}
          {meta?.source === "mock" && meta.mockReason && (
            <Hint content={<span>{meta.mockReason} <span className="opacity-80">Details in Settings → Integrations.</span></span>}>
              <a href="/settings?tab=integrations" className="text-[12px] text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink">Why mock data?</a>
            </Hint>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
          {subject && market && <span>{market}</span>}
          {meta && <span>Updated {new Date(meta.fetchedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>}
          {meta && meta.source !== "mock" && <span>Cost {fmtCurrency(meta.costUsd, 4)}</span>}
          {description && <span className="text-ink-2">{description}</span>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

function SaveSearchButton({ tool, query, kind }: { tool: ToolId; query: string; kind: string }) {
  const { market, language } = useSearchState();
  const [saved, setSaved] = useState(false);
  async function save() {
    const res = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool, query, queryType: kind === "domain" ? "domain" : kind === "keyword" ? "keyword" : "list",
        locationCode: market.locationCode, languageCode: language.code,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return toast.error(body?.error?.message ?? "Could not save search");
    setSaved(true);
    toast.success("Search saved", { description: "Find it on the Home page." });
  }
  return (
    <Hint content="Save this search">
      <Button variant="outline" size="sm" onClick={save} aria-label="Save search">
        <Star className={saved ? "fill-[#eda100] text-[#eda100]" : undefined} />
        {saved ? "Saved" : "Save"}
      </Button>
    </Hint>
  );
}
