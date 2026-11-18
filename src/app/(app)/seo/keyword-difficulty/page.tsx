"use client";
import { Suspense, useMemo } from "react";
import type { KeywordDifficultyReport } from "@/lib/reports/types";
import { ReportView } from "@/components/report/report-view";
import { Section } from "@/components/report/section";
import { keywordMetricColumns, keywordMetricFilters } from "@/components/report/columns";
import { BarList } from "@/components/charts/bar-list";
import { DataTable } from "@/components/data/data-table";
import { kdBand } from "@/components/data/cells";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearchState } from "@/lib/client/use-search-state";
import { useState } from "react";

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

const BANDS = ["Very hard", "Hard", "Difficult", "Possible", "Easy", "Very easy"];

function Inner() {
  const { q, setParams, market } = useSearchState();
  const cols = useMemo(() => keywordMetricColumns(market.id, { trend: false }), [market.id]);
  const filters = useMemo(() => keywordMetricFilters(), []);
  const [text, setText] = useState(q.split(",").join("\n"));
  const form = (
    <Card className="p-4">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); setParams({ q: text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).join(",") }); }}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="One keyword per line (up to 100)" rows={4} />
        <Button type="submit" className="sm:self-start">Analyze</Button>
      </form>
    </Card>
  );
  return (
    <ReportView<KeywordDifficultyReport> tool="keyword-difficulty" above={form} isEmpty={(d) => d.keywords.length === 0}>
      {(d, meta) => {
        const counts = BANDS.map((b) => ({ label: b, value: d.keywords.filter((k) => k.keywordDifficulty != null && kdBand(k.keywordDifficulty).label === b).length }));
        const colors = BANDS.map((b) => kdBand([90, 75, 55, 35, 20, 5][BANDS.indexOf(b)]).color);
        return (
          <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
            <Section title="Difficulty distribution" mock={meta.source === "mock"} className="h-fit">
              <BarList items={counts} colors={colors} valueFormatter={(v) => String(v)} />
            </Section>
            <Card className="min-w-0 pt-4">
              <DataTable data={d.keywords} columns={cols} filters={filters} searchText={(r) => r.keyword} exportName="keyword_difficulty" initialSort={[{ id: "keywordDifficulty", desc: true }]} countLabel={(n) => `${n} keywords`} />
            </Card>
          </div>
        );
      }}
    </ReportView>
  );
}
