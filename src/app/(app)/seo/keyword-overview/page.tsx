"use client";
import { Suspense, useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { KeywordOverview } from "@/lib/reports/types";
import { ReportView } from "@/components/report/report-view";
import { MetricCard } from "@/components/report/metric-card";
import { Section } from "@/components/report/section";
import { keywordMetricColumns } from "@/components/report/columns";
import { serpColumnsFor } from "@/components/report/serp-columns";
import { VBarChart } from "@/components/charts/bar-chart";
import { DataTable } from "@/components/data/data-table";
import { IntentBadge, kdBand, SerpFeatureList } from "@/components/data/cells";
import { Button } from "@/components/ui/button";
import { useSearchState } from "@/lib/client/use-search-state";
import { fmtCompact, fmtCurrency, fmtNumber } from "@/lib/utils";

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  const { market } = useSearchState();
  const cols = useMemo(() => keywordMetricColumns(market.id, { features: false }), [market.id]);
  return (
    <ReportView<KeywordOverview> tool="keyword-overview" isEmpty={(d) => !d.keyword}>
      {(d, meta) => {
        const mock = meta.source === "mock";
        const k = d.keyword;
        const band = k.keywordDifficulty != null ? kdBand(k.keywordDifficulty) : null;
        const magic = `/seo/keyword-magic-tool?q=${encodeURIComponent(k.keyword)}&db=${market.id}`;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <MetricCard mock={mock} label="Search volume" value={fmtNumber(k.searchVolume)} sub="Avg. monthly, last 12 months" info="Average monthly Google searches in this market (Google Ads data via the provider)." />
              <MetricCard mock={mock} label="Keyword difficulty" value={k.keywordDifficulty != null ? `${k.keywordDifficulty}%` : "n/a"} sub={band?.label} info="Provider estimate (0–100) of how hard it is to rank in the top 10, based on the backlink profiles of ranking pages.">
                {k.keywordDifficulty != null && band && <div className="h-1.5 rounded-full bg-[#eceef2]"><div className="h-full rounded-full" style={{ width: `${k.keywordDifficulty}%`, background: band.color }} /></div>}
              </MetricCard>
              <MetricCard mock={mock} label="CPC" value={fmtCurrency(k.cpc)} sub="Avg. cost per click, USD" />
              <MetricCard mock={mock} label="Paid competition" value={k.competition?.toFixed(2) ?? "—"} sub="0 (low) – 1 (high)" info="Advertiser competition from Google Ads. Not organic difficulty." />
              <MetricCard mock={mock} label="Intent" value={<span className="flex items-center gap-2 text-lg capitalize"><IntentBadge intent={k.intent} />{k.intent ?? "—"}</span>} sub="Provider's search intent classification" />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Section className="xl:col-span-2" title="Search volume trend" mock={mock} info="Monthly searches for the last 12 months.">
                <VBarChart data={k.monthlySearches} xKey="date" isDate series={[{ key: "searchVolume", label: "Searches" }]} height={240} />
              </Section>
              <Section title="SERP features" mock={mock} info="Special result types present on the results page for this keyword.">
                <SerpFeatureList features={k.serpFeatures} />
              </Section>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Section flush title="Keyword variations" mock={mock} actions={<Button asChild variant="outline" size="sm"><Link href={magic}>View all <ArrowRight /></Link></Button>}>
                <DataTable compact data={d.variations.slice(0, 8)} columns={cols.filter((c) => ["keyword", "searchVolume", "keywordDifficulty", "cpc"].includes((c as { accessorKey?: string }).accessorKey ?? ""))} />
              </Section>
              <Section flush title="Questions" mock={mock} actions={<Button asChild variant="outline" size="sm"><Link href={`${magic}&mode=questions`}>View all <ArrowRight /></Link></Button>}>
                <DataTable compact data={d.questions.slice(0, 8)} columns={cols.filter((c) => ["keyword", "searchVolume", "keywordDifficulty", "cpc"].includes((c as { accessorKey?: string }).accessorKey ?? ""))} />
              </Section>
            </div>
            <Section flush title="SERP analysis" mock={mock} description="Top Google results" actions={<Button asChild variant="outline" size="sm"><Link href={`/site/serp-analysis?q=${encodeURIComponent(k.keyword)}&db=${market.id}`}>Full SERP <ArrowRight /></Link></Button>}>
              <DataTable compact data={d.serp} columns={serpColumnsFor(d.serp)} emptyTitle="SERP unavailable" />
            </Section>
          </div>
        );
      }}
    </ReportView>
  );
}
