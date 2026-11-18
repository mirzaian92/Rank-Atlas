"use client";
/** Client-side table export (CSV / JSON) of already-loaded rows. */
export type ExportColumn<T> = { header: string; value: (row: T) => unknown };

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = Array.isArray(v) ? v.join("; ") : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], cols: ExportColumn<T>[]): string {
  const head = cols.map((c) => csvCell(c.header)).join(",");
  const body = rows.map((r) => cols.map((c) => csvCell(c.value(r))).join(",")).join("\n");
  return "﻿" + head + "\n" + body; // BOM so Excel opens UTF-8 correctly
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportFilename(base: string, ext: string) {
  const safe = base.replace(/[^a-z0-9.-]+/gi, "_").replace(/^_+|_+$/g, "");
  return `${safe}_${new Date().toISOString().slice(0, 10)}.${ext}`;
}
