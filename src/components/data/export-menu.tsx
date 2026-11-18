"use client";
import { Download, FileJson, FileSpreadsheet, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { download, exportFilename, toCsv, type ExportColumn } from "@/lib/client/export";

export function ExportMenu<T>({ name, rows, columns, note }: { name: string; rows: () => T[]; columns: ExportColumn<T>[]; note?: string }) {
  const csv = () => toCsv(rows(), columns);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><Download /> Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Export {rows().length.toLocaleString()} rows</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => download(exportFilename(name, "csv"), csv(), "text/csv;charset=utf-8")}>
          <FileSpreadsheet /> CSV (Excel, Sheets)
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            const data = rows().map((r) => Object.fromEntries(columns.map((c) => [c.header, c.value(r)])));
            download(exportFilename(name, "json"), JSON.stringify(data, null, 2), "application/json");
          }}
        >
          <FileJson /> JSON
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            const tsv = [columns.map((c) => c.header).join("\t"), ...rows().map((r) => columns.map((c) => String(c.value(r) ?? "")).join("\t"))].join("\n");
            await navigator.clipboard.writeText(tsv);
            toast.success("Copied to clipboard");
          }}
        >
          <Copy /> Copy as TSV
        </DropdownMenuItem>
        {note && (
          <>
            <DropdownMenuSeparator />
            <p className="px-2 py-1 text-[11px] leading-snug text-ink-3">{note}</p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
