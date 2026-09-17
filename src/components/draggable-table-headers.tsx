import { flexRender, type Table } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function DraggableTableHeaders<T>({
  table,
}: {
  table: Table<T>;
  /** @deprecated reorder lives in the columns dropdown now */
  onOrderChange?: (order: string[]) => void;
}) {
  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  return (
    <>
      {headers.map((header) => {
        const canSort = header.column.getCanSort();
        const canResize = header.column.getCanResize();
        const sorted = header.column.getIsSorted();
        const size = header.getSize();
        return (
          <TableHead
            key={header.id}
            style={{ width: size, minWidth: size }}
            className={cn(
              "group/resize relative text-muted-foreground",
              sorted && "text-foreground",
            )}
          >
            {canSort ? (
              <button
                type="button"
                onClick={() => header.column.toggleSorting()}
                className="flex w-full items-center gap-1.5 truncate text-left font-semibold hover:text-foreground"
              >
                <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                {sorted === "asc" ? (
                  <ArrowUp className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : sorted === "desc" ? (
                  <ArrowDown className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                )}
              </button>
            ) : (
              flexRender(header.column.columnDef.header, header.getContext())
            )}
            {canResize && (
              <div
                onMouseDown={header.getResizeHandler()}
                onTouchStart={header.getResizeHandler()}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "absolute right-0 top-1/2 hidden h-6 w-1 -translate-y-1/2 cursor-col-resize select-none touch-none rounded-full bg-border transition-colors hover:bg-primary md:block",
                  header.column.getIsResizing() && "h-full bg-primary",
                )}
                aria-hidden
              />
            )}
          </TableHead>
        );
      })}
    </>
  );
}