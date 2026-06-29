import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Row,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { advancedFilterFn } from "@/components/advanced-table-filters";
import { SmartTableToolbar } from "./SmartTableToolbar";
import { SmartTableBody } from "./SmartTableBody";
import { EditableCell } from "./SmartTableCell";
import { useSmartTableState } from "./useSmartTableState";
import { BulkEditDialog } from "./BulkEditDialog";
import { downloadCSV } from "@/lib/download-csv";
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
  defaultCollapsedGroups,
  onRowClick,
  getRowId,
  className,
  hideSearch,
  emptyMessage,
  emptyIcon,
  searchPlaceholder,
  groupByOptions,
  defaultSortBy,
  defaultColumnVisibility,
  getRowClassName,
  pageSize = null,
  savedViewsKey,
  enableSelection,
  onBulkEdit,
  onBulkDelete,
  bulkActions,
  exportFilename,
  disableExport,
}: SmartTableProps<T>) {
  const isMobile = useIsMobile();
  const {
    sorting, setSorting,
    columnVisibility, setColumnVisibility,
    columnSizing, setColumnSizing,
    editMode, setEditMode,
    groupBy, setGroupBy,
    collapsedGroups, setCollapsedGroups,
    globalSearch, setGlobalSearch,
    columnFilters, setColumnFilters,
    pageIndex, setPageIndex,
    pageSize: stPageSize, setPageSize: setStPageSize,
  } = useSmartTableState(tableId, {
    defaultGroupBy,
    defaultSortBy,
    defaultColumnVisibility,
    defaultCollapsedGroups,
  });

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [busyBulk, setBusyBulk] = useState(false);

  const editable = new Set(editableColumns ?? []);

  // Inject sizing/edit wrapper on columns.
  const enhancedColumns = useMemo(() => {
    const mapped = columns.map((c) => {
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
    if (enableSelection) {
      const selCol: any = {
        id: "__select",
        enableSorting: false,
        enableResizing: false,
        enableHiding: false,
        enableColumnFilter: false,
        size: 40,
        minSize: 40,
        header: ({ table }: any) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Selecionar tudo"
          />
        ),
        cell: ({ row }: any) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(v) => row.toggleSelected(!!v)}
              aria-label="Selecionar linha"
            />
          </div>
        ),
        meta: { noTruncate: true },
      };
      return [selCol, ...mapped];
    }
    return mapped;
  }, [columns, editMode, editable, onCellEdit, enableSelection]);

  const table = useReactTable({
    data: data ?? [],
    columns: enhancedColumns,
    state: { sorting, columnVisibility, columnSizing, columnFilters, rowSelection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: !!enableSelection,
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

  const selectedIds = useMemo(() => Object.keys(rowSelection).filter((k) => rowSelection[k]), [rowSelection]);
  const clearSelection = useCallback(() => setRowSelection({}), []);

  const buildCsvRow = useCallback(
    (r: Row<T>) => {
      const out: Record<string, unknown> = {};
      for (const col of table.getVisibleLeafColumns()) {
        if (col.id === "__select") continue;
        if (typeof (col as any).accessorFn === "undefined") continue;
        const meta = (col.columnDef.meta ?? {}) as SmartColumnMeta;
        const label = meta.label ?? (typeof col.columnDef.header === "string" ? col.columnDef.header : col.id);
        let v: unknown;
        if (meta.textValue) {
          try { v = meta.textValue(r.original); } catch { v = ""; }
        } else {
          v = r.getValue(col.id);
        }
        if (v instanceof Date) v = v.toISOString();
        else if (v && typeof v === "object") v = JSON.stringify(v);
        out[String(label)] = v ?? "";
      }
      return out;
    },
    [table],
  );

  const doExport = useCallback(
    (rows: Row<T>[]) => {
      if (rows.length === 0) return;
      const data = rows.map(buildCsvRow);
      const cols = Object.keys(data[0] ?? {});
      downloadCSV(`${exportFilename ?? tableId}.csv`, data, cols);
    },
    [buildCsvRow, exportFilename, tableId],
  );

  const handleBulkEdit = async (patch: Record<string, unknown>) => {
    if (!onBulkEdit) return;
    setBusyBulk(true);
    try {
      await onBulkEdit(selectedIds, patch);
      clearSelection();
    } finally {
      setBusyBulk(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!onBulkDelete) return;
    setBusyBulk(true);
    try {
      await onBulkDelete(selectedIds);
      clearSelection();
      setBulkDeleteOpen(false);
    } finally {
      setBusyBulk(false);
    }
  };

  // Virtualização: ativada quando há muitas linhas e não estamos a agrupar.
  const paginationActive =
    !groups && typeof pageSize === "number" && pageSize > 0;
  const effectivePageSize = paginationActive ? (stPageSize || pageSize!) : 0;
  const totalPages = paginationActive
    ? Math.max(1, Math.ceil(filteredRows.length / effectivePageSize))
    : 1;

  useEffect(() => {
    setPageIndex(0);
  }, [globalSearch, columnFilters, groupBy, setPageIndex]);

  const paginatedRows = useMemo(() => {
    if (!paginationActive) return filteredRows;
    const start = pageIndex * effectivePageSize;
    return filteredRows.slice(start, start + effectivePageSize);
  }, [paginationActive, filteredRows, pageIndex, effectivePageSize]);

  const VIRTUAL_THRESHOLD = 80;
  const ROW_HEIGHT = 40; // h-10
  const shouldVirtualize =
    !groups && !paginationActive && filteredRows.length > VIRTUAL_THRESHOLD;
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
        searchPlaceholder={searchPlaceholder}
        groupByOptions={groupByOptions}
        savedViewsKey={savedViewsKey}
        selectedCount={selectedIds.length}
        onClearSelection={clearSelection}
        onExport={disableExport ? undefined : () => doExport(filteredRows)}
        onExportSelected={
          disableExport || selectedIds.length === 0
            ? undefined
            : () => doExport(filteredRows.filter((r) => rowSelection[r.id]))
        }
        hasBulkEdit={!!onBulkEdit && hasEditable}
        hasBulkDelete={!!onBulkDelete}
        onBulkEditClick={() => setBulkEditOpen(true)}
        onBulkDeleteClick={() => setBulkDeleteOpen(true)}
        bulkActionsNode={bulkActions ? bulkActions(selectedIds, clearSelection) : null}
        disableExport={disableExport}
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
            {shouldVirtualize ? (
              <>
                {paddingTop > 0 && (
                  <tr aria-hidden style={{ height: paddingTop }} />
                )}
                {virtualItems.map((vi) => {
                  const row = filteredRows[vi.index];
                  return (
                    <DataRow
                      key={row.id}
                      row={row}
                      onRowClick={onRowClick}
                      getRowClassName={getRowClassName}
                    />
                  );
                })}
                {paddingBottom > 0 && (
                  <tr aria-hidden style={{ height: paddingBottom }} />
                )}
              </>
            ) : (
              <SmartTableBody
                isLoading={isLoading}
                emptyMessage={emptyMessage ?? "Sem resultados"}
                emptyIcon={emptyIcon}
                search={globalSearch}
                colSpan={colSpan}
                rows={paginatedRows}
                groups={
                  groups
                    ? { label: labelOf(groupCol!), entries: groups }
                    : null
                }
                collapsedGroups={collapsedGroups}
                onToggleGroup={(k) =>
                  setCollapsedGroups((p) => ({ ...p, [k]: !p[k] }))
                }
                onRowClick={onRowClick}
                getRowClassName={getRowClassName}
              />
            )}
          </TableBody>
        </Table>
      </div>

      {paginationActive && (
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
          <span>
            {filteredRows.length === 0
              ? "0"
              : `${pageIndex * effectivePageSize + 1}–${Math.min(
                  (pageIndex + 1) * effectivePageSize,
                  filteredRows.length,
                )}`}{" "}
            de {filteredRows.length} resultados
          </span>
          <div className="flex items-center gap-1">
            <Select
              value={String(effectivePageSize)}
              onValueChange={(v) => {
                setStPageSize(Number(v));
                setPageIndex(0);
              }}
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100, 200].map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s} / pág.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-1">
              Pág. {pageIndex + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={pageIndex >= totalPages - 1}
              onClick={() =>
                setPageIndex(Math.min(totalPages - 1, pageIndex + 1))
              }
              aria-label="Página seguinte"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {enableSelection && onBulkEdit && (
        <BulkEditDialog
          open={bulkEditOpen}
          onOpenChange={setBulkEditOpen}
          table={table}
          editableColumns={editableColumns ?? []}
          selectedIds={selectedIds}
          onConfirm={handleBulkEdit}
        />
      )}
      {enableSelection && onBulkDelete && (
        <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar {selectedIds.length} linhas?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser revertida.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busyBulk}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkDelete} disabled={busyBulk}>
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function DataRow<T>({
  row,
  onRowClick,
  getRowClassName,
}: {
  row: Row<T>;
  onRowClick?: (r: T) => void;
  getRowClassName?: (r: T) => string | undefined;
}) {
  return (
    <TableRow
      className={cn(
        "h-10 border-b border-border/40 text-sm text-foreground hover:bg-muted/40",
        onRowClick && "cursor-pointer",
        getRowClassName?.(row.original),
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