"use client";
import { Suspense } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileDown } from "lucide-react";
import type { BacklinkAudit } from "@/lib/reports/types";
import { ReportView } from "@/components/report/report-view";
import { MetricCard } from "@/components/report/metric-card";
import { Section } from "@/components/report/section";
import { VBarChart } from "@/components/charts/bar-chart";
import { SegmentBar } from "@/components/charts/bar-list";
import { STATUS } from "@/components/charts/palette";
import { DataTable } from "@/components/data/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { download, exportFilename } from "@/lib/client/export";
import { fmtNumber } from "@/lib/utils";

type Row = BacklinkAudit["domains"][number];

const cols: ColumnDef<Row>[] = [
  { accessorKey: "domain", header: "Referring domain", cell: ({ getValue }) => <span className="font-medium text-brand">{getValue<string>()}</span> },
  { accessorKey: "risk", header: "Risk", cell: ({ getValue }) => { const r = getValue<Row["risk"]>(); return <Badge variant={r === "toxic" ? "critical" : r === "suspicious" ? "warning" : "good"}>{r}</Badge>; } },
  { accessorKey: "spamScore", header: "Spam score", cell: ({ getValue }) => getValue<number | null>() ?? "—", meta: { align: "right" } },
  { accessorKey: "domainRank", header: "Domain Rank", cell: ({ getValue }) => getValue<number | null>() ?? "—", meta: { align: "right" } },
  { accessorKey: "backlinks", header: "Backlinks", cell: ({ getValue }) => fmtNumber(getValue<number>()), meta: { align: "right" } },
  { accessorKey: "reasons", header: "Signals", cell: ({ row }) => <span className="text-xs text-ink-2">{row.original.reasons.join(" · ") || "—"}</span>, enableSorting: false, meta: { exportValue: (r) => r.reasons.join("; ") } },
];

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  return (
    <ReportView<BacklinkAudit> tool="backlink-audit" isEmpty={(d) => d.domains.length === 0}>
      {(d, meta) => {
        const mock = meta.source === "mock";
        const s = d.summary;
        const disavow = () => {
          const lines = [`# Disavow candidates for ${d.target} — review manually before uploading`, ...d.domains.filter((x) => x.risk === "toxic").map((x) => `domain:${x.domain}`)];
          download(exportFilename(`${d.target}_disavow`, "txt"), lines.join("\n"), "text/plain");
        };
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <MetricCard mock={mock} label="Referring domains analysed" value={fmtNumber(s.referringDomains)} />
              <MetricCard mock={mock} label="Toxic" value={fmtNumber(s.toxic)} accent={STATUS.critical} />
              <MetricCard mock={mock} label="Suspicious" value={fmtNumber(s.suspicious)} accent={STATUS.warning} />
              <MetricCard mock={mock} label="Healthy" value={fmtNumber(s.healthy)} accent={STATUS.good} />
              <MetricCard mock={mock} label="Avg. spam score" value={s.avgSpamScore} info="Mean provider spam score (0–100) across referring domains." />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Section title="Risk breakdown" mock={mock}>
                <SegmentBar valueFormatter={fmtNumber} segments={[{ label: "Toxic", value: s.toxic, color: STATUS.critical }, { label: "Suspicious", value: s.suspicious, color: STATUS.warning }, { label: "Healthy", value: s.healthy, color: STATUS.good }]} />
                <p className="mt-4 text-xs text-ink-3">Risk labels are heuristics from spam score, TLD and link patterns. Always review before disavowing.</p>
              </Section>
              <Section className="xl:col-span-2" title="Spam score distribution" mock={mock}>
                <VBarChart data={d.distribution} xKey="range" series={[{ key: "count", label: "Referring domains" }]} height={200} />
              </Section>
            </div>
            <Card className="pt-4">
              <DataTable
                data={d.domains} columns={cols} searchText={(r) => r.domain}
                filters={[
                  { id: "risk", label: "Risk", type: "multi", accessor: (r) => r.risk, options: [{ value: "toxic", label: "Toxic" }, { value: "suspicious", label: "Suspicious" }, { value: "healthy", label: "Healthy" }] },
                  { id: "spam", label: "Spam score", type: "range", accessor: (r) => r.spamScore },
                ]}
                toolbar={<Button variant="outline" size="sm" onClick={disavow}><FileDown /> Disavow file</Button>}
                exportName={`${d.target}_backlink_audit`} initialSort={[{ id: "spamScore", desc: true }]} countLabel={(n) => `${n} domains`}
              />
            </Card>
          </div>
        );
      }}
    </ReportView>
  );
}
