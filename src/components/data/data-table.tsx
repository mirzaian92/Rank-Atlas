"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState, type VisibilityState, type RowData,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/states/states";
import { ExportMenu } from "./export-menu";
import { FilterButton, applyFilters, isActive, type FilterDef, type FilterState } from "./filters";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "right" | "center";
    /** Header text used for export / column menu when header is a component. */
    label?: string;
    /** Export value override. Defaults to the column's accessor value. */
    exportValue?: (row: TData) => unknown;
    /** Exclude from export. */
    noExport?: boolean;
    width?: number | string;
  }
}

/** Table state owned by the parent when rows are paged / filtered / sorted on the server. */
export type RemoteState = { pageIndex: number; pageSize: number; sorting: SortingState; filters: FilterState; search: string };

export type RemoteControl = {
  /** Filtered total reported by the server. */
  total: number;
  state: RemoteState;
  onChange: (next: RemoteState) => void;
  /** True while a new page is loading (rows stay visible, dimmed). */
  fetching?: boolean;
  pageSizes?: readonly number[];
};

export type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  filters?: FilterDef<T>[];
  searchPlaceholder?: string;
  /** Text used by the quick search box. */
  searchText?: (row: T) => string;
  exportName?: string;
  exportNote?: string;
  pageSize?: number;
  initialSort?: SortingState;
  toolbar?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  /**
   * Remote mode: sorting, filters, search and paging are reported to the parent, which fetches
   * that page from the server. `data` must already be the current page.
   */
  remote?: RemoteControl;
  className?: string;
  /** Hide the toolbar for compact widget tables. */
  compact?: boolean;
  /** Summary text for the toolbar left side, e.g. "1,245 keywords". */
  countLabel?: (n: number) => string;
};

/**
 * Reusable report table: quick search, filters, sorting, column visibility, pagination, export.
 * Local mode filters/sorts/pages loaded rows in the browser; remote mode delegates all of that
 * to the server (see `remote`).
 */
export function DataTable<T>({
  data, columns, filters = [], searchPlaceholder = "Search", searchText, exportName, exportNote, pageSize = 25,
  initialSort = [], toolbar, emptyTitle = "No rows match", emptyDescription = "Try clearing filters or changing the search.", remote,
  className, compact, countLabel,
}: DataTableProps<T>) {
  const [localSorting, setLocalSorting] = useState<SortingState>(initialSort);
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const [localSearch, setLocalSearch] = useState("");
  const [localFilters, setLocalFilters] = useState<FilterState>({});
  const [localPagination, setLocalPagination] = useState({ pageIndex: 0, pageSize });

  // In remote mode the parent owns the state; the search box is debounced before reporting.
  const sorting = remote ? remote.state.sorting : localSorting;
  const filterState = remote ? remote.state.filters : localFilters;
  const pagination = remote ? { pageIndex: remote.state.pageIndex, pageSize: remote.state.pageSize } : localPagination;
  const [searchInput, setSearchInput] = useState(remote?.state.search ?? "");
  const search = remote ? remote.state.search : localSearch;
  const remoteRef = useRef(remote);
  remoteRef.current = remote;
  useEffect(() => {
    if (!remote) return;
    const t = setTimeout(() => {
      const r = remoteRef.current!;
      if (searchInput.trim() !== r.state.search) r.onChange({ ...r.state, search: searchInput.trim(), pageIndex: 0 });
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, remote]);

  const setSearch = (v: string) => {
    setSearchInput(v);
    if (!remote) {
      setLocalSearch(v);
      setLocalPagination((p) => ({ ...p, pageIndex: 0 }));
    }
  };
  const setFilters = (next: FilterState) => {
    if (remote) remote.onChange({ ...remote.state, filters: next, pageIndex: 0 });
    else {
      setLocalFilters(next);
      setLocalPagination((p) => ({ ...p, pageIndex: 0 }));
    }
  };

  const filtered = useMemo(() => {
    if (remote) return data;
    let rows = applyFilters(data, filters, filterState);
    const s = search.trim().toLowerCase();
    if (s && searchText) rows = rows.filter((r) => searchText(r).toLowerCase().includes(s));
    return rows;
  }, [data, filters, filterState, search, searchText, remote]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnVisibility: visibility, pagination },
    onSortingChange: (u) => {
      const next = typeof u === "function" ? u(sorting) : u;
      if (remote) remote.onChange({ ...remote.state, sorting: next, pageIndex: 0 });
      else setLocalSorting(next);
    },
    onColumnVisibilityChange: setVisibility,
    onPaginationChange: (u) => {
      const next = typeof u === "function" ? u(pagination) : u;
      if (remote) remote.onChange({ ...remote.state, pageIndex: next.pageIndex, pageSize: next.pageSize });
      else setLocalPagination(next);
    },
    manualPagination: Boolean(remote),
    manualSorting: Boolean(remote),
    enableMultiSort: !remote,
    rowCount: remote?.total,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: remote ? undefined : getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: remote ? undefined : getPaginationRowModel(),
    autoResetPageIndex: !remote,
  });

  const exportCols = table
    .getAllLeafColumns()
    .filter((c) => c.getIsVisible() && !c.columnDef.meta?.noExport && (c.accessorFn || c.columnDef.meta?.exportValue))
    .map((c) => ({
      header: c.columnDef.meta?.label ?? (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id),
      value: (row: T) => (c.columnDef.meta?.exportValue ? c.columnDef.meta.exportValue(row) : c.accessorFn!(row, 0)),
    }));

  const total = remote?.total ?? filtered.length;
  const activeFilters = filters.filter((f) => isActive(filterState[f.id])).length + ((remote ? searchInput : search) ? 1 : 0);
  const { pageIndex, pageSize: ps } = table.getState().pagination;
  const from = total === 0 ? 0 : pageIndex * ps + 1;
  const to = Math.min(total, (pageIndex + 1) * ps);

  return (
    <div className={cn("min-w-0", className)}>
      {!compact && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 pb-3">
          {searchText && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
              <Input
                value={remote ? searchInput : search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 w-[220px] pl-8 text-[13px]"
                aria-label={searchPlaceholder}
              />
            </div>
          )}
          {filters.map((f) => (
            <FilterButton
              key={f.id}
              def={f}
              value={filterState[f.id]}
              onChange={(v) => setFilters({ ...filterState, [f.id]: v })}
            />
          ))}
          {activeFilters > 0 && (
            <Button variant="link" size="xs" onClick={() => {
              setSearchInput("");
              if (remote) remote.onChange({ ...remote.state, filters: {}, search: "", pageIndex: 0 });
              else { setLocalFilters({}); setLocalSearch(""); setLocalPagination((p) => ({ ...p, pageIndex: 0 })); }
            }}>Clear all</Button>
          )}
          {toolbar}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[12.5px] text-ink-3 tabular">{countLabel ? countLabel(total) : `${total.toLocaleString()} rows`}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Choose columns"><Columns3 /> Columns</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                {table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => (
                  <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(Boolean(v))} onSelect={(e) => e.preventDefault()}>
                    {c.columnDef.meta?.label ?? (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {exportName && (
              <ExportMenu
                name={exportName}
                columns={exportCols}
                rows={() => table.getSortedRowModel().rows.map((r) => r.original)}
                note={exportNote ?? (remote ? "Exports the rows on this page. Live data is paged; increase rows per page to export more." : "Exports all rows matching current filters and sort.")}
              />
            )}
          </div>
        </div>
      )}

      <div className={cn("overflow-x-auto transition-opacity", remote?.fetching && "pointer-events-none opacity-50")} aria-busy={remote?.fetching || undefined}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-[#fafbfc]">
                {hg.headers.map((h) => {
                  const align = h.column.columnDef.meta?.align ?? "left";
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      style={{ width: h.column.columnDef.meta?.width }}
                      className={cn("whitespace-nowrap px-3 py-2 text-left text-[11.5px] font-semibold text-ink-2 first:pl-5 last:pr-5", align === "right" && "text-right", align === "center" && "text-center")}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    >
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button className={cn("inline-flex items-center gap-1 hover:text-ink", align === "right" && "flex-row-reverse", sorted && "text-ink")} onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-[#f7f9fc]">
                {row.getVisibleCells().map((cell) => {
                  const align = cell.column.columnDef.meta?.align ?? "left";
                  return (
                    <td key={cell.id} className={cn("px-3 py-2 align-middle text-ink first:pl-5 last:pr-5", align === "right" && "text-right tabular", align === "center" && "text-center")}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {table.getRowModel().rows.length === 0 && <EmptyState compact title={data.length === 0 ? "No data" : emptyTitle} description={data.length === 0 ? undefined : emptyDescription} />}
      </div>

      {!compact && total > Math.min(ps, 10) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-2.5 text-[12.5px] text-ink-2">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <Select value={String(ps)} onValueChange={(v) => table.setPageSize(Number(v))}>
              <SelectTrigger className="h-7 w-[72px] text-[12.5px]" aria-label="Rows per page"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(remote?.pageSizes ?? [10, 25, 50, 100]).map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-2 tabular">{from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} aria-label="First page"><ChevronsLeft /></Button>
            <Button variant="ghost" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page"><ChevronLeft /></Button>
            <span className="px-1 tabular">Page {pageIndex + 1} of {Math.max(1, table.getPageCount())}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page"><ChevronRight /></Button>
            <Button variant="ghost" size="icon-sm" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} aria-label="Last page"><ChevronsRight /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
