"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, Printer, TrendingDown, TrendingUp, Sparkle, CircleSlash } from "lucide-react";
import type { DomainOverview, RankedKeyword, CompetitorRow, DomainHistoryPoint } from "@/lib/reports/types";
import type { ReportMeta } from "@/lib/reports/envelope";
import { ReportView } from "@/components/report/report-view";
import { MetricCard } from "@/components/report/metric-card";
import { Section } from "@/components/report/section";
import { DateRangeControl, MonthPicker, sliceRange, type RangeValue } from "@/components/report/date-range";
import { TrendChart } from "@/components/charts/trend-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { BarList, SegmentBar } from "@/components/charts/bar-list";
import { DonutChart } from "@/components/charts/donut-chart";
import { ScatterMap } from "@/components/charts/scatter-map";
import { POSITION_RAMP, SERIES } from "@/components/charts/palette";
import { DataTable } from "@/components/data/data-table";
import { ExportMenu } from "@/components/data/export-menu";
import { IntentBadge, KdCell, PositionCell, ShareBar, UrlCell } from "@/components/data/cells";
import { EmptyState } from "@/components/states/states";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/tabs";
import { useSearchState } from "@/lib/client/use-search-state";
import { isGenericDomain } from "@/lib/reports/generic-domains";
import { fmtCompact, fmtCurrency, fmtDate, fmtNumber, fmtPercent, pctChange } from "@/lib/utils";
import { estimateHistoryCost } from "@/lib/reports/history";

export default function DomainOverviewPage() {
  return (
    <Suspense>
      <DomainOverviewInner />
    </Suspense>
  );
}

function DomainOverviewInner() {
  const { get, setParams } = useSearchState();
  const range = (get("range") as RangeValue) ?? "1y";
  // Optional, separately billed sections. Stored in the URL so the choice survives reloads and shared links.
  const extra: Record<string, string> = {};
  if (get("trend") === "1") extra.trend = "1";
  if (get("anchors") === "1") extra.anchors = "1";
  return (
    <ReportView<DomainOverview>
      tool="domain-overview"
      extraParams={extra}
      keepSubject
      isEmpty={(d) => d.summary.organicKeywords === 0 && d.summary.paidKeywords === 0 && !d.summary.backlinks}
      actions={
        <>
          <DateRangeControl value={range} onChange={(v) => setParams({ range: v }, { replace: true })} />
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer /> PDF</Button>
        </>
      }
    >
      {(data, meta) => <Dashboard data={data} meta={meta} range={range} />}
    </ReportView>
  );
}

const POSITION_LABEL: Record<string, string> = { "1-3": "Top 3", "4-10": "4–10", "11-20": "11–20", "21-50": "21–50", "51-100": "51–100" };

function Dashboard({ data, meta, range }: { data: DomainOverview; meta: ReportMeta; range: string }) {
  const { get, setParams, searchParams } = useSearchState();
  const mock = meta.source === "mock";
  const months = data.history.map((h) => h.date);
  const latest = months[months.length - 1];
  const month = get("month") && months.includes(get("month")!) ? get("month")! : latest;
  const isHistorical = Boolean(month && latest && month !== latest);
  const point = data.history.find((h) => h.date === month);
  const prevPoint = point ? data.history[data.history.indexOf(point) - 1] : undefined;

  // When a past month is selected, KPIs come from the historical series; otherwise the live summary.
  const s = data.summary;
  // Generic sites (Wikipedia, YouTube…) rank for everything; Organic Competitors has a toggle to show them.
  const competitors = data.competitors.filter((c) => !isGenericDomain(c.domain));
  const kpi = isHistorical && point
    ? { organicEtv: point.organicEtv, organicKeywords: point.organicKeywords, paidEtv: point.paidEtv, paidKeywords: point.paidKeywords }
    : { organicEtv: s.organicEtv, organicKeywords: s.organicKeywords, paidEtv: s.paidEtv, paidKeywords: s.paidKeywords };
  const prev = isHistorical ? prevPoint ?? null : data.previous;

  const series = useMemo(() => sliceRange(data.history, range), [data.history, range]);
  const spark = (k: keyof DomainHistoryPoint) => data.history.slice(-12).map((h) => Number(h[k]));
  const dist = isHistorical && point
    ? [point.pos1_3, point.pos4_10, point.pos11_20, point.pos21_50, point.pos51_100].map((count, i) => ({ bucket: data.positionDistribution[i]?.bucket ?? "", count }))
    : data.positionDistribution;

  const link = (href: string) => `${href}?${new URLSearchParams({ q: data.domain, db: searchParams.get("db") ?? "us", ...(searchParams.get("lang") ? { lang: searchParams.get("lang")! } : {}) })}`;

  return (
    <div className="space-y-4">
      {months.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MonthPicker months={months} value={month} onChange={(v) => setParams({ month: v === latest ? null : v }, { replace: true })} />
          {isHistorical && (
            <p className="text-xs text-[#7a5300]">
              Showing organic & paid summary for {fmtDate(month, { month: "long", year: "numeric" })} from historical data. Keyword, competitor and backlink tables reflect the latest data.
            </p>
          )}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Domain Rank" mock={mock}
          value={s.domainRank ?? "—"}
          info="DataForSEO's backlink-based authority score on a 0–100 scale. It is a provider metric, not a Google ranking factor."
          sub="Backlink authority, 0–100"
          href={link("/links/backlink-analytics")}
        />
        <MetricCard
          label="Organic traffic (est.)" mock={mock} accent={SERIES[0]}
          value={fmtCompact(kpi.organicEtv)}
          delta={prev ? pctChange(kpi.organicEtv, prev.organicEtv) : null}
          deltaLabel="vs previous month"
          info="Estimated monthly visits from Google organic results (ETV): rankings × search volume × expected CTR. Not Google Analytics or Search Console data."
          href={link("/seo/organic-research")}
        >
          <Sparkline values={spark("organicEtv")} color={SERIES[0]} />
        </MetricCard>
        <MetricCard
          label="Organic keywords" mock={mock} accent={SERIES[2]}
          value={fmtCompact(kpi.organicKeywords)}
          delta={prev ? pctChange(kpi.organicKeywords, prev.organicKeywords) : null}
          deltaLabel="vs previous month"
          info="Keywords for which the domain ranks in Google's top 100 organic results in this market."
          href={link("/seo/organic-research")}
        >
          <Sparkline values={spark("organicKeywords")} color={SERIES[2]} />
        </MetricCard>
        <MetricCard
          label="Organic traffic value" mock={mock}
          value={fmtCurrency(s.organicTrafficCost, 0)}
          info="What the estimated organic traffic would cost if bought through Google Ads at current CPCs."
          sub={isHistorical ? "Latest month" : "Monthly, USD"}
        />
        <MetricCard
          label="Paid traffic (est.)" mock={mock} accent={SERIES[1]}
          value={fmtCompact(kpi.paidEtv)}
          delta={prev ? pctChange(kpi.paidEtv, prev.paidEtv) : null}
          sub={`${fmtCompact(kpi.paidKeywords)} paid keywords`}
          info="Estimated monthly visits from Google Ads based on observed ad positions."
        >
          <Sparkline values={spark("paidEtv")} color={SERIES[1]} />
        </MetricCard>
        <MetricCard
          label="Backlinks" mock={mock}
          value={fmtCompact(s.backlinks)}
          sub={`${fmtCompact(s.referringDomains)} referring domains`}
          info="Live backlinks and unique referring domains found by the DataForSEO backlink index."
          href={link("/links/backlink-analytics")}
        />
      </div>

      {/* Trend + distribution */}
      <div className="grid gap-4 xl:grid-cols-3">
        {data.historyLoaded === false ? (
          <LoadOptional
            className="xl:col-span-2"
            title="Traffic & keyword trend"
            text="Monthly history is billed per month by DataForSEO, so it loads only when you ask. Month-over-month changes on the cards above need it too."
            cost={estimateHistoryCost(12) - 0.024}
            onLoad={() => setParams({ trend: "1" }, { replace: true })}
          />
        ) : (
          <TrafficTrend series={series} mock={mock} className="xl:col-span-2" />
        )}
        <Section title="Organic positions" mock={mock} info="Number of keywords ranking in each position range." description={isHistorical ? fmtDate(month, { month: "long", year: "numeric" }) : "Current month"}>
          <BarList
            items={dist.map((d) => ({ key: d.bucket, label: POSITION_LABEL[d.bucket] ?? d.bucket, value: d.count }))}
            colors={POSITION_RAMP}
          />
          <div className="mt-5 grid grid-cols-4 gap-2 border-t border-border pt-4">
            <Movement icon={Sparkle} label="New" value={data.movement.isNew} tone="brand" />
            <Movement icon={TrendingUp} label="Improved" value={data.movement.isUp} tone="good" />
            <Movement icon={TrendingDown} label="Declined" value={data.movement.isDown} tone="bad" />
            <Movement icon={CircleSlash} label="Lost" value={data.movement.isLost} tone="muted" />
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section className="xl:col-span-2" title="Keywords by position over time" mock={mock} info="Monthly count of ranking keywords by position range, from historical rank data.">
          {data.historyLoaded === false ? (
            <EmptyState compact title="History not loaded" description="Load the trend above to see positions over time." />
          ) : series.length > 1 ? (
            <TrendChart
              data={series}
              stacked
              series={[
                { key: "pos1_3", label: "Top 3", color: POSITION_RAMP[0] },
                { key: "pos4_10", label: "4–10", color: POSITION_RAMP[1] },
                { key: "pos11_20", label: "11–20", color: POSITION_RAMP[2] },
                { key: "pos21_50", label: "21–50", color: POSITION_RAMP[3] },
                { key: "pos51_100", label: "51–100", color: POSITION_RAMP[4] },
              ]}
            />
          ) : (
            <EmptyState compact title="No history available" description="The provider returned no monthly history for this domain and market." />
          )}
        </Section>
        <Section title="Search intent" mock={mock} info="Share of top keywords by the search intent the provider assigns to each query." description={`Top ${data.intentSampleSize} keywords by estimated traffic`}>
          {data.intents.some((i) => i.keywords > 0) ? (
            <DonutChart
              data={data.intents.map((i) => ({ name: i.intent[0].toUpperCase() + i.intent.slice(1), value: i.keywords }))}
              centerValue={fmtNumber(data.intentSampleSize)}
              centerLabel="keywords"
              valueFormatter={fmtNumber}
            />
          ) : (
            <EmptyState compact title="No intent data" />
          )}
        </Section>
      </div>

      {/* Keywords + competitors */}
      <div className="grid gap-4 xl:grid-cols-5">
        <Section
          flush
          className="xl:col-span-3"
          title="Top organic keywords"
          mock={mock}
          description={`${fmtNumber(data.topKeywordsTotal)} keywords in total`}
          actions={
            <>
              <ExportMenu
                name={`${data.domain}_top_keywords`}
                rows={() => data.topKeywords}
                columns={[
                  { header: "Keyword", value: (r) => r.keyword }, { header: "Position", value: (r) => r.position },
                  { header: "Search volume", value: (r) => r.searchVolume }, { header: "CPC (USD)", value: (r) => r.cpc },
                  { header: "Est. traffic", value: (r) => r.etv }, { header: "Traffic %", value: (r) => r.trafficShare }, { header: "URL", value: (r) => r.url },
                ]}
              />
              <Button asChild variant="outline" size="sm"><Link href={link("/seo/organic-research")}>View all <ArrowRight /></Link></Button>
            </>
          }
        >
          <DataTable compact data={data.topKeywords} columns={keywordColumns} initialSort={[{ id: "etv", desc: true }]} />
        </Section>
        <Section
          flush
          className="xl:col-span-2"
          title="Main organic competitors"
          mock={mock}
          info="Domains with the largest overlap in ranking keywords. Competition level = common keywords ÷ combined unique keywords."
          actions={<Button asChild variant="outline" size="sm"><Link href={link("/seo/organic-competitors")}>View all <ArrowRight /></Link></Button>}
        >
          <DataTable compact data={competitors.slice(0, 8)} columns={competitorColumns(competitors)} />
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Competitive positioning map" mock={mock} info="Each bubble is a domain: horizontal = organic keywords, vertical = estimated organic traffic (log scales). Bubble size = keywords shared with the analysed domain.">
          {competitors.length ? (
            <ScatterMap
              highlight={data.domain}
              points={[
                { name: data.domain, x: Math.max(1, s.organicKeywords), y: Math.max(1, s.organicEtv), z: s.organicKeywords },
                ...competitors.map((c) => ({ name: c.domain, x: Math.max(1, c.organicKeywords), y: Math.max(1, c.organicEtv), z: c.commonKeywords })),
              ]}
            />
          ) : <EmptyState compact title="No competitors found" />}
          <div className="mt-1 flex gap-4 text-xs text-ink-2">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: SERIES[1] }} />{data.domain}</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: SERIES[0] }} />Competitors</span>
          </div>
        </Section>
        <Section title="Top pages" mock={mock} info="Pages receiving the most estimated organic traffic." flush>
          {data.topPages.length ? (
            <DataTable compact data={data.topPages} columns={pageColumns(data.topPages)} />
          ) : <EmptyState compact title="No pages found" />}
        </Section>
      </div>

      {/* Backlinks */}
      <BacklinkBlock data={data} mock={mock} link={link} onLoadAnchors={() => setParams({ anchors: "1" }, { replace: true })} />

      {data.countries && data.countries.length > 0 && (
        <Section title="Organic traffic by country" mock={mock} info="Estimated organic traffic per Google market for this domain." flush>
          <DataTable compact data={data.countries} columns={countryColumns(data.countries)} />
        </Section>
      )}
    </div>
  );
}

function TrafficTrend({ series, mock, className }: { series: DomainHistoryPoint[]; mock: boolean; className?: string }) {
  const [metric, setMetric] = useState<"traffic" | "keywords">("traffic");
  return (
    <Section
      className={className}
      title={metric === "traffic" ? "Estimated traffic trend" : "Ranking keywords trend"}
      mock={mock}
      info="Monthly values from the provider's historical rank data. Organic and paid series share one axis and unit."
      actions={<Segmented value={metric} onChange={setMetric} options={[{ value: "traffic", label: "Traffic" }, { value: "keywords", label: "Keywords" }]} />}
    >
      {series.length > 1 ? (
        <TrendChart
          data={series}
          height={280}
          series={
            metric === "traffic"
              ? [{ key: "organicEtv", label: "Organic (est.)", color: SERIES[0] }, { key: "paidEtv", label: "Paid (est.)", color: SERIES[1] }]
              : [{ key: "organicKeywords", label: "Organic keywords", color: SERIES[0] }, { key: "paidKeywords", label: "Paid keywords", color: SERIES[1] }]
          }
        />
      ) : (
        <EmptyState compact title="No historical data" description="Monthly history is not available for this domain in this market." />
      )}
    </Section>
  );
}

/** Placeholder for an optional, separately billed section, with an explicit cost before loading. */
function LoadOptional({ title, text, cost, onLoad, className, bare }: { title: string; text: string; cost: number; onLoad: () => void; className?: string; bare?: boolean }) {
  const [loading, setLoading] = useState(false);
  const body = (
    <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center">
      {bare && <div className="text-[13px] font-semibold text-ink">{title}</div>}
      <p className="max-w-md text-[12.5px] text-ink-3">{text}</p>
      <Button size="sm" variant="outline" disabled={loading} onClick={() => { setLoading(true); onLoad(); }}>
        {loading ? "Loading…" : <>Load · ≈ {fmtCurrency(cost, 2)}</>}
      </Button>
      <p className="text-[11px] text-ink-3">The rest of this report is re-used from cache, so only this part is billed.</p>
    </div>
  );
  return bare ? body : <Section className={className} title={title}>{body}</Section>;
}

function Movement({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone: "brand" | "good" | "bad" | "muted" }) {
  const c = { brand: "text-brand", good: "text-good-text", bad: "text-[#b42318]", muted: "text-ink-3" }[tone];
  return (
    <div className="text-center">
      <div className={`mx-auto mb-1 flex items-center justify-center gap-1 text-[11px] font-medium ${c}`}><Icon className="size-3.5" />{label}</div>
      <div className="text-[15px] font-semibold text-ink tabular">{fmtCompact(value)}</div>
    </div>
  );
}

function BacklinkBlock({ data, mock, link, onLoadAnchors }: { data: DomainOverview; mock: boolean; link: (h: string) => string; onLoadAnchors: () => void }) {
  const bp = data.backlinkProfile;
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Section
        title="Backlink profile" mock={mock}
        info="Link attributes across all live backlinks to the domain."
        actions={<Button asChild variant="outline" size="sm"><Link href={link("/links/backlink-analytics")}>Backlinks <ArrowRight /></Link></Button>}
      >
        {bp ? (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Backlinks" value={fmtCompact(data.summary.backlinks)} />
              <Stat label="Ref. domains" value={fmtCompact(data.summary.referringDomains)} />
              <Stat label="Ref. IPs" value={fmtCompact(bp.referringIps)} />
            </div>
            <SegmentBar segments={[{ label: "Follow", value: bp.dofollow, color: SERIES[0] }, { label: "Nofollow", value: bp.nofollow, color: "#b7d3f6" }]} />
          </div>
        ) : <EmptyState compact title="Backlink data unavailable" />}
      </Section>
      <Section title="Top anchors" mock={mock} flush>
        {data.anchorsLoaded === false ? (
          <LoadOptional bare title="Anchors not loaded" text="Loaded on request to keep lookups cheap." cost={0.024} onLoad={onLoadAnchors} />
        ) : bp?.topAnchors.length ? (
          <DataTable compact data={bp.topAnchors} columns={anchorColumns} />
        ) : <EmptyState compact title="No anchors" />}
      </Section>
      <Section title="Referring domains by TLD" mock={mock}>
        {bp?.tlds.length ? (
          <BarList items={bp.tlds.map((t) => ({ key: t.tld, label: t.tld, value: t.referringDomains }))} />
        ) : <EmptyState compact title="No TLD data" />}
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11.5px] text-ink-3">{label}</div>
      <div className="text-lg font-semibold text-ink tabular">{value}</div>
    </div>
  );
}

// ---------- Column definitions ----------
const keywordColumns: ColumnDef<RankedKeyword>[] = [
  { accessorKey: "keyword", header: "Keyword", cell: ({ row }) => <span className="font-medium text-brand">{row.original.keyword}</span> },
  { accessorKey: "intent", header: "Intent", cell: ({ row }) => <IntentBadge intent={row.original.intent} />, enableSorting: false, meta: { align: "center" } },
  { accessorKey: "position", header: "Pos.", cell: ({ row }) => <PositionCell position={row.original.position} previous={row.original.previousPosition} isNew={row.original.isNew} />, meta: { align: "right" } },
  { accessorKey: "searchVolume", header: "Volume", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
  { accessorKey: "keywordDifficulty", header: "KD", cell: ({ getValue }) => <KdCell kd={getValue<number | null>()} />, meta: { align: "right" } },
  { accessorKey: "etv", header: "Traffic %", cell: ({ row }) => fmtPercent(row.original.trafficShare, 2), meta: { align: "right", label: "Traffic share" } },
];

function competitorColumns(all: CompetitorRow[]): ColumnDef<CompetitorRow>[] {
  const max = Math.max(...all.map((c) => c.competitionLevel), 0.0001);
  return [
    { accessorKey: "domain", header: "Competitor", cell: ({ row }) => <span className="font-medium text-brand">{row.original.domain}</span> },
    { accessorKey: "competitionLevel", header: "Com. level", cell: ({ getValue }) => <div className="w-20"><ShareBar value={getValue<number>()} max={max} /></div> },
    { accessorKey: "commonKeywords", header: "Common kw", cell: ({ getValue }) => fmtCompact(getValue<number>()), meta: { align: "right" } },
    { accessorKey: "organicEtv", header: "Est. traffic", cell: ({ getValue }) => fmtCompact(getValue<number>()), meta: { align: "right" } },
  ];
}

function pageColumns(all: DomainOverview["topPages"]): ColumnDef<DomainOverview["topPages"][number]>[] {
  const max = Math.max(...all.map((p) => p.etv), 1);
  return [
    { accessorKey: "url", header: "URL", cell: ({ getValue }) => <UrlCell url={getValue<string>()} max={48} /> },
    { accessorKey: "keywords", header: "Keywords", cell: ({ getValue }) => fmtCompact(getValue<number>()), meta: { align: "right" } },
    { accessorKey: "etv", header: "Est. traffic", cell: ({ getValue }) => fmtCompact(getValue<number>()), meta: { align: "right" } },
    { id: "share", header: "", cell: ({ row }) => <div className="w-24"><ShareBar value={row.original.etv} max={max} /></div>, enableSorting: false },
  ];
}

const anchorColumns: ColumnDef<{ anchor: string; backlinks: number; referringDomains: number }>[] = [
  { accessorKey: "anchor", header: "Anchor", cell: ({ getValue }) => <span className="block max-w-[200px] truncate" title={getValue<string>()}>{getValue<string>() || "(empty)"}</span> },
  { accessorKey: "referringDomains", header: "Domains", cell: ({ getValue }) => fmtCompact(getValue<number>()), meta: { align: "right" } },
  { accessorKey: "backlinks", header: "Backlinks", cell: ({ getValue }) => fmtCompact(getValue<number>()), meta: { align: "right" } },
];

function countryColumns(all: NonNullable<DomainOverview["countries"]>): ColumnDef<NonNullable<DomainOverview["countries"]>[number]>[] {
  const max = Math.max(...all.map((c) => c.organicEtv), 1);
  return [
    { accessorKey: "country", header: "Country" },
    { id: "bar", header: "Share", cell: ({ row }) => <div className="w-40"><ShareBar value={row.original.organicEtv} max={max} /></div>, enableSorting: false },
    { accessorKey: "organicEtv", header: "Est. traffic", cell: ({ getValue }) => fmtCompact(getValue<number>()), meta: { align: "right" } },
    { accessorKey: "organicKeywords", header: "Keywords", cell: ({ getValue }) => fmtCompact(getValue<number>()), meta: { align: "right" } },
  ];
}
