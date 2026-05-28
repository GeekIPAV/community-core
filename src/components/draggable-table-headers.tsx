import { flexRender, type Table } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
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
        const sort = header.column.getIsSorted();
        const canSort = header.column.getCanSort();
        return (
          <TableHead key={header.id}>
            {canSort ? (
              <button
                type="button"
                onClick={() => header.column.toggleSorting()}
                className="flex items-center gap-1 font-medium hover:text-foreground"
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {sort === "asc" ? (
                  <ArrowUp className="h-3 w-3" />
                ) : sort === "desc" ? (
                  <ArrowDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                )}
              </button>
            ) : (
              flexRender(header.column.columnDef.header, header.getContext())
            )}
          </TableHead>
        );
      })}
    </>
  );
}