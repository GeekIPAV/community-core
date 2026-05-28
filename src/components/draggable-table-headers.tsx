import { flexRender, type Table } from "@tanstack/react-table";
import { TableHead } from "@/components/ui/table";

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
        const size = header.getSize();
        return (
          <TableHead
            key={header.id}
            style={{ width: size, minWidth: size }}
            className="relative group/resize"
          >
            {canSort ? (
              <button
                type="button"
                onClick={() => header.column.toggleSorting()}
                className="font-medium hover:text-foreground truncate text-left w-full"
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
              </button>
            ) : (
              flexRender(header.column.columnDef.header, header.getContext())
            )}
            {canResize && (
              <div
                onMouseDown={header.getResizeHandler()}
                onTouchStart={header.getResizeHandler()}
                onClick={(e) => e.stopPropagation()}
                className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none bg-transparent hover:bg-primary/40 ${header.column.getIsResizing() ? "bg-primary" : ""} hidden md:block`}
                aria-hidden
              />
            )}
          </TableHead>
        );
      })}
    </>
  );
}