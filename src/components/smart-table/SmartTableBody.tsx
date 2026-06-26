import { Fragment } from "react";
import { flexRender, type Row } from "@tanstack/react-table";
import { Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { SmartTableGroupRow } from "./SmartTableGroupRow";
import type { SmartColumnMeta } from "./types";

function getMeta(col: any): SmartColumnMeta {
  return (col.columnDef?.meta ?? {}) as SmartColumnMeta;
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
      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
      className={cn(
        "h-10 border-b border-border/40 text-sm text-foreground hover:bg-muted/40 transition-colors",
        onRowClick && "cursor-pointer",
        getRowClassName?.(row.original),
      )}
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

export interface SmartTableBodyProps<T> {
  isLoading?: boolean;
  emptyMessage: string;
  emptyIcon?: React.ReactNode;
  search: string;
  colSpan: number;
  rows: Row<T>[];
  /** When set, rows are rendered grouped by this label; map is "value -> rows". */
  groups: { label: string; entries: [string, Row<T>[]][] } | null;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  onRowClick?: (r: T) => void;
  getRowClassName?: (r: T) => string | undefined;
}

export function SmartTableBody<T>({
  isLoading,
  emptyMessage,
  emptyIcon,
  search,
  colSpan,
  rows,
  groups,
  collapsedGroups,
  onToggleGroup,
  onRowClick,
  getRowClassName,
}: SmartTableBodyProps<T>) {
  if (isLoading) {
    return (
      <>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={`sk-${i}`} className="h-10">
            {Array.from({ length: colSpan }).map((__, j) => (
              <TableCell key={j} className="px-3 py-2">
                <Skeleton className="h-4 w-3/4" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </>
    );
  }

  if (rows.length === 0) {
    return (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={colSpan} className="h-32 text-center text-sm text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            {emptyIcon ?? <Inbox className="h-8 w-8 opacity-40" />}
            <p>{emptyMessage}</p>
            {search.trim() && (
              <p className="text-xs">Sem resultados para "{search.trim()}"</p>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (groups) {
    return (
      <>
        {groups.entries.map(([key, gRows]) => {
          const collapsed = !!collapsedGroups[key];
          return (
            <Fragment key={key}>
              <SmartTableGroupRow
                label={groups.label}
                value={key}
                count={gRows.length}
                collapsed={collapsed}
                onToggle={() => onToggleGroup(key)}
                colSpan={colSpan}
              />
              {!collapsed &&
                gRows.map((row) => (
                  <DataRow
                    key={row.id}
                    row={row}
                    onRowClick={onRowClick}
                    getRowClassName={getRowClassName}
                  />
                ))}
            </Fragment>
          );
        })}
      </>
    );
  }

  return (
    <>
      {rows.map((row) => (
        <DataRow
          key={row.id}
          row={row}
          onRowClick={onRowClick}
          getRowClassName={getRowClassName}
        />
      ))}
    </>
  );
}