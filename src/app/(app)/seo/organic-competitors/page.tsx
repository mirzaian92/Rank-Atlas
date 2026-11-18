"use client";
import { Suspense } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { CompetitorRow, OrganicCompetitors } from "@/lib/reports/types";
import { ReportView } from "@/components/report/report-view";
import { Section } from "@/components/report/section";
import { ScatterMap } from "@/components/charts/scatter-map";
import { DataTable } from "@/components/data/data-table";
import { ShareBar } from "@/components/data/cells";
import { Card } from "@/components/ui/card";
import { useSearchState } from "@/lib/client/use-search-state";
import { fmtCompact, fmtNumber } from "@/lib/utils";

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  const { market } = useSearchState();
  return (
    <ReportView<OrganicCompetitors> tool="organic-competitors" isEmpty={(d) => d.competitors.length === 0}>
      {(d, meta) => {
        const mock = meta.source === "mock";
        const max = Math.max(...d.competitors.map((c) => c.competitionLevel), 0.0001);
        const cols: ColumnDef<CompetitorRow>[] = [
          { accessorKey: "domain", header: "Domain", cell: ({ getValue }) => <Link className="font-medium text-brand hover:underline" href={`/seo/domain-overview?q=${getValue<string>()}&db=${market.id}`}>{getValue<string>()}</Link> },
          { accessorKey: "competitionLevel", header: "Competition level", cell: ({ row }) => <div className="flex items-center gap-2"><div className="w-24"><ShareBar value={row.original.competitionLevel} max={max} /></div><span className="text-xs text-ink-3 tabular">{(row.original.competitionLevel * 100).toFixed(1)}%</span></div> },
          { accessorKey: "commonKeywords", header: "Common keywords", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
          { accessorKey: "organicKeywords", header: "Their keywords", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
          { accessorKey: "organicEtv", header: "Traffic (est.)", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
          { accessorKey: "avgPosition", header: "Avg. position", cell: ({ getValue }) => getValue<number | null>() ?? "—", meta: { align: "right", label: "Average position on common keywords" } },
          { id: "gap", header: "", cell: ({ row }) => <Link className="text-xs text-brand hover:underline" href={`/seo/keyword-gap?q=${d.domain},${row.original.domain}&db=${market.id}`}>Keyword gap →</Link>, enableSorting: false, meta: { noExport: true } },
        ];
        return (
          <div className="space-y-4">
            <Section title="Competitive positioning map" mock={mock} info="Horizontal: organic keywords. Vertical: estimated organic traffic (log scales). Bubble size: keywords shared with the target.">
              <ScatterMap
                highlight={d.domain}
                height={340}
                points={[{ name: d.domain, x: Math.max(1, d.target.organicKeywords), y: Math.max(1, d.target.organicEtv), z: d.target.organicKeywords }, ...d.competitors.slice(0, 20).map((c) => ({ name: c.domain, x: Math.max(1, c.organicKeywords), y: Math.max(1, c.organicEtv), z: c.commonKeywords }))]}
              />
            </Section>
            <Card className="pt-4">
              <DataTable
                data={d.competitors}
                columns={cols}
                searchText={(r) => r.domain}
                searchPlaceholder="Filter by domain"
                filters={[
                  { id: "common", label: "Common keywords", type: "range", accessor: (r) => r.commonKeywords },
                  { id: "traffic", label: "Traffic", type: "range", accessor: (r) => r.organicEtv },
                ]}
                exportName={`${d.domain}_organic_competitors`}
                initialSort={[{ id: "competitionLevel", desc: true }]}
                countLabel={(n) => `${n} competitors · target has ${fmtCompact(d.target.organicKeywords)} keywords`}
              />
            </Card>
          </div>
        );
      }}
    </ReportView>
  );
}
