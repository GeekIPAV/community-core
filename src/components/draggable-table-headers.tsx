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
        return (
          <TableHead key={header.id}>
            {canSort ? (
              <button
                type="button"
                onClick={() => header.column.toggleSorting()}
                className="font-medium hover:text-foreground"
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
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