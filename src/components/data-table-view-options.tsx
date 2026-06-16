import type { Table } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

function getLabel(column: any): string {
  const meta = (column.columnDef.meta ?? {}) as { label?: string };
  if (meta.label) return meta.label;
  const header = column.columnDef.header;
  if (typeof header === "string") return header;
  return String(column.id);
}

export function DataTableViewOptions<T>({ table }: { table: Table<T> }) {
  const allLeaf = table.getAllLeafColumns();
  const orderedIds = allLeaf.map((c) => c.id);
  const columns = allLeaf.filter(
    (c) => typeof c.accessorFn !== "undefined" && c.getCanHide(),
  );

  const move = (id: string, dir: -1 | 1) => {
    const idx = orderedIds.indexOf(id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= orderedIds.length) return;
    const next = [...orderedIds];
    [next[idx], next[target]] = [next[target], next[idx]];
    table.setColumnOrder(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2">
          <Settings2 className="h-4 w-4" />
          Colunas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[260px]">
        <DropdownMenuLabel>Colunas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[320px] overflow-y-auto py-1">
          {columns.map((column) => {
            const idx = orderedIds.indexOf(column.id);
            const isFirst = idx <= 0;
            const isLast = idx === orderedIds.length - 1;
            return (
              <div
                key={column.id}
                className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded-sm"
              >
                <Checkbox
                  checked={column.getIsVisible()}
                  onCheckedChange={(v) => column.toggleVisibility(!!v)}
                />
                <span className="flex-1 truncate">{getLabel(column)}</span>
                <button
                  type="button"
                  onClick={() => move(column.id, -1)}
                  disabled={isFirst}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Mover para cima"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(column.id, 1)}
                  disabled={isLast}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Mover para baixo"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}