"use client";
import type { ColumnDef } from "@tanstack/react-table";
import type { SerpResult } from "@/lib/reports/types";
import { UrlCell } from "@/components/data/cells";
import { Badge } from "@/components/ui/badge";
import { fmtCompact } from "@/lib/utils";

export const serpColumns: ColumnDef<SerpResult>[] = [
  { accessorKey: "rank", header: "#", meta: { align: "right", width: 40 } },
  { accessorKey: "type", header: "Type", cell: ({ getValue }) => <Badge variant={getValue<string>() === "organic" ? "muted" : "default"}>{getValue<string>().replace(/_/g, " ")}</Badge> },
  {
    accessorKey: "title", header: "Result",
    cell: ({ row }) => (
      <div className="min-w-[260px] max-w-[460px]">
        <div className="truncate font-medium text-ink">{row.original.title}</div>
        {row.original.url && <UrlCell url={row.original.url} max={56} />}
      </div>
    ),
  },
  { accessorKey: "domain", header: "Domain", cell: ({ getValue }) => getValue<string>() || "—" },
  { accessorKey: "domainRank", header: "Domain Rank", cell: ({ getValue }) => getValue<number | null>() ?? "—", meta: { align: "right" } },
  { accessorKey: "backlinks", header: "Backlinks", cell: ({ getValue }) => fmtCompact(getValue<number | null>()), meta: { align: "right" } },
  { accessorKey: "etv", header: "Traffic (est.)", cell: ({ getValue }) => fmtCompact(getValue<number | null>()), meta: { align: "right" } },
];
