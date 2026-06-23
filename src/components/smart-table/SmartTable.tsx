import { useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type Row,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight, Inbox } from "lucide-react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { advancedFilterFn } from "@/components/advanced-table-filters";
import { SmartTableToolbar } from "./SmartTableToolbar";
import { EditableCell } from "./SmartTableCell";
import {
  usePersistedFlag,
  usePersistedSizing,
  usePersistedSorting,
  usePersistedString,
  usePersistedVisibility,
} from "./use-persisted-table-state";
import type { SmartColumnMeta, SmartTableProps } from "./types";

const MOBILE_QUERY = "(max-width: 767px)";

function useIsMobile() {
  const [m, setM] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY).matches : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const fn = () => setM(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return m;
}

function getMeta(col: any): SmartColumnMeta {
  return (col.columnDef?.meta ?? {}) as SmartColumnMeta;
}
function labelOf(col: any): string {
  const m = getMeta(col);
  if (m.label) return m.label;
  const h = col.columnDef?.header;
  if (typeof h === "string") return h;
  return String(col.id);
}
function rawText(row: any, col: any): string {
  const meta = getMeta(col);
  if (meta.textValue) {
    try { return meta.textValue(row.original) ?? ""; } catch { /* */ }
  }
  const v = row.getValue(col.id);
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function groupValueOf(row: any, col: any): string {
  const meta = getMeta(col);
  if (meta.groupValue) {
    try { return meta.groupValue(row.original) ?? ""; } catch { /* */ }
  }
  const v = row.getValue(col.id);
  if (v == null || v === "") return "—";
  return String(v);
}

export function SmartTable<T>({
  tableId,
  columns,
  data,
  isLoading,
  editableColumns,
  onCellEdit,
  toolbarActions,
  defaultGroupBy,
  onRowClick,
  getRowId,
  className,
  hideSearch,
  emptyMessage,
}: SmartTableProps<T>) {
  const isMobile = useIsMobile();
  const [sorting, setSorting] = usePersistedSorting(tableId);
  const [columnVisibility, setColumnVisibility] = usePersistedVisibility(tableId);
  const [columnSizing, setColumnSizing] = usePersistedSizing(tableId);
  const [editMode, setEditMode] = usePersistedFlag(tableId, "edit", false);
  const [groupBy, setGroupBy] = usePersistedString(tableId, "groupBy", defaultGroupBy ?? "");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [globalSearch, setGlobalSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const editable = new Set(editableColumns ?? []);

  // Inject sizing/edit wrapper on columns.
  const enhancedColumns = useMemo(() => {
    return columns.map((c) => {
      const out: any = { enableResizing: true, enableSorting: true, ...c };
      out.minSize = (c as any).minSize ?? 60;
      out.size = (c as any).size ?? 160;
      const meta = (c.meta ?? {}) as SmartColumnMeta;
      const originalCell = c.cell;
      const colId = (c as any).id ?? (c as any).accessorKey;
      if (editable.has(colId) && onCellEdit) {
        out.cell = (ctx: any) => {
          if (!editMode) {
            return originalCell ? flexRender(originalCell, ctx) : ctx.getValue() ?? "";
          }
          return (
            <EditableCell
              value={ctx.getValue()}
              meta={meta}
              onCommit={(v) => onCellEdit(ctx.row.id, ctx.column.id, v)}
            />
          );
        };
      }
      return out;
    });
  }, [columns, editMode, editable, onCellEdit]);

  const table = useReactTable({
    data: data ?? [],
    columns: enhancedColumns,
    state: { sorting, columnVisibility, columnSizing, columnFilters },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onColumnFiltersChange: setColumnFilters,
    enableMultiSort: true,
    isMultiSortEvent: (e: any) => e?.shiftKey === true,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    defaultColumn: { filterFn: advancedFilterFn as any },
    getRowId: getRowId
      ? (row, idx) => getRowId(row) ?? String(idx)
      : (row: any, idx) => (row?.id != null ? String(row.id) : String(idx)),
  });

  // Auto-hide mobile-hidden columns based on viewport.
  useEffect(() => {
    if (!isMobile) return;
    const patch: Record<string, boolean> = {};
    for (const col of table.getAllLeafColumns()) {
      if (getMeta(col).hideOnMobile) patch[col.id] = false;
    }
    if (Object.keys(patch).length) {
      setColumnVisibility((prev) => ({ ...prev, ...patch }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  const rows = table.getRowModel().rows;

  // Global search (matches across visible accessor columns).
  const filteredRows = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return rows;
    const visibleCols = table.getVisibleLeafColumns().filter((c) => typeof c.accessorFn !== "undefined");
    return rows.filter((r) => visibleCols.some((c) => rawText(r, c).toLowerCase().includes(q)));
  }, [rows, globalSearch, table]);

  // Grouping
  const groupCol = groupBy ? table.getColumn(groupBy) : null;
  const groups = useMemo(() => {
    if (!groupCol) return null;
    const map = new Map<string, Row<T>[]>();
    for (const r of filteredRows) {
      const k = groupValueOf(r, groupCol);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredRows, groupCol]);

  const visibleLeaf = table.getVisibleLeafColumns();
  const colSpan = visibleLeaf.length || 1;
  const hasEditable = editable.size > 0 && !!onCellEdit;

  // Virtualização: ativada quando há muitas linhas e não estamos a agrupar.
  // Mantém o markup <table>; apenas insere "spacer rows" no topo/fundo.
  const VIRTUAL_THRESHOLD = 80;
  const ROW_HEIGHT = 40; // h-10
  const shouldVirtualize = !groups && filteredRows.length > VIRTUAL_THRESHOLD;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? filteredRows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });
  const virtualItems = shouldVirtualize ? virtualizer.getVirtualItems() : [];
  const totalSize = shouldVirtualize ? virtualizer.getTotalSize() : 0;
  const paddingTop = virtualItems.length ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length
    ? totalSize - virtualItems[virtualItems.length - 1].end
    : 0;

  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-border/60 bg-background shadow-sm", className)}>
      {editMode && hasEditable && (
        <div className="h-0.5 w-full bg-amber-400" aria-hidden />
      )}
      <SmartTableToolbar
        table={table}
        search={globalSearch}
        onSearchChange={setGlobalSearch}
        groupBy={groupBy || null}
        onGroupByChange={(v) => setGroupBy(v ?? "")}
        editMode={editMode}
        onEditModeChange={setEditMode}
        hasEditableColumns={hasEditable}
        rowCount={filteredRows.length}
        toolbarActions={toolbarActions}
        hideSearch={hideSearch}
      />

      <div
        ref={scrollRef}
        className={cn(
          "w-full overflow-x-auto",
          shouldVirtualize && "max-h-[70vh] overflow-y-auto",
        )}
      >
        <Table className="table-fixed">
          <TableHeader className={cn(shouldVirtualize && "sticky top-0 z-10 bg-background")}>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {table.getHeaderGroups()[0]?.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const canResize = header.column.getCanResize();
                const sorted = header.column.getIsSorted();
                const size = header.getSize();
                return (
                  <TableHead
                    key={header.id}
                    style={{ width: size, minWidth: header.column.columnDef.minSize ?? 60 }}
                    className="group/h relative h-9 select-none px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex w-full items-center gap-1.5 truncate text-left hover:text-foreground"
                          title={String(labelOf(header.column))}
                        >
                          <span className="truncate">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {sorted === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-foreground shrink-0" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3 w-3 text-foreground shrink-0" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40 shrink-0" />
                          )}
                        </button>
                      ) : (
                        <span className="truncate">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}
                    </div>
                    {canResize && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "absolute right-0 top-0 hidden h-full w-1 cursor-col-resize touch-none select-none md:block",
                          "bg-transparent group-hover/h:bg-border",
                          header.column.getIsResizing() && "bg-primary",
                        )}
                        aria-hidden
                      />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`sk-${i}`} className="h-10">
                  {visibleLeaf.map((c) => (
                    <TableCell key={c.id} className="px-3 py-2">
                      <Skeleton className="h-4 w-3/4" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Inbox className="h-6 w-6 opacity-40" />
                    <span>
                      {globalSearch.trim()
                        ? `Sem resultados para "${globalSearch.trim()}"`
                        : (emptyMessage ?? "Sem resultados")}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : groups ? (
              groups.map(([groupKey, gRows]) => {
                const isCollapsed = !!collapsed[groupKey];
                return (
                  <GroupRows
                    key={groupKey}
                    label={labelOf(groupCol!)}
                    value={groupKey}
                    count={gRows.length}
                    collapsed={isCollapsed}
                    onToggle={() =>
                      setCollapsed((p) => ({ ...p, [groupKey]: !p[groupKey] }))
                    }
                    colSpan={colSpan}
                    rows={gRows}
                    onRowClick={onRowClick}
                  />
                );
              })
            ) : shouldVirtualize ? (
              <>
                {paddingTop > 0 && (
                  <tr aria-hidden style={{ height: paddingTop }} />
                )}
                {virtualItems.map((vi) => {
                  const row = filteredRows[vi.index];
                  return <DataRow key={row.id} row={row} onRowClick={onRowClick} />;
                })}
                {paddingBottom > 0 && (
                  <tr aria-hidden style={{ height: paddingBottom }} />
                )}
              </>
            ) : (
              filteredRows.map((row) => (
                <DataRow key={row.id} row={row} onRowClick={onRowClick} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DataRow<T>({ row, onRowClick }: { row: Row<T>; onRowClick?: (r: T) => void }) {
  return (
    <TableRow
      className={cn(
        "h-10 border-b border-border/40 text-sm text-foreground hover:bg-muted/40",
        onRowClick && "cursor-pointer",
      )}
      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
    >
      {row.getVisibleCells().map((cell) => {
        const meta = getMeta(cell.column);
        const rendered = flexRender(cell.column.columnDef.cell, cell.getContext());
        const v = cell.getValue();
        const titleAttr =
          !meta.noTruncate && (typeof v === "string" || typeof v === "number")
            ? String(v ?? "")
            : undefined;
        return (
          <TableCell
            key={cell.id}
            style={{ width: cell.column.getSize() }}
            className={cn("px-3 py-2 align-middle", !meta.noTruncate && "truncate")}
            title={titleAttr}
          >
            {rendered}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

function GroupRows<T>({
  label,
  value,
  count,
  collapsed,
  onToggle,
  colSpan,
  rows,
  onRowClick,
}: {
  label: string;
  value: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  colSpan: number;
  rows: Row<T>[];
  onRowClick?: (r: T) => void;
}) {
  return (
    <>
      <TableRow className="bg-muted/20 hover:bg-muted/30">
        <TableCell
          colSpan={colSpan}
          className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          onClick={onToggle}
        >
          <span className="inline-flex items-center gap-2">
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            <span className="text-muted-foreground/80 normal-case">{label}:</span>
            <span className="text-foreground normal-case">{value}</span>
            <span className="text-muted-foreground/70 normal-case">
              ({count} {count === 1 ? "registo" : "registos"})
            </span>
          </span>
        </TableCell>
      </TableRow>
      {!collapsed &&
        rows.map((row) => <DataRow key={row.id} row={row} onRowClick={onRowClick} />)}
    </>
  );
}