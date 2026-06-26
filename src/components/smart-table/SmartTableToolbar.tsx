import { Search, Group, Pencil, Lock, Layers, X } from "lucide-react";
import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AdvancedTableFilters } from "@/components/advanced-table-filters";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { SavedViews } from "@/components/saved-views";
import { cn } from "@/lib/utils";
import type { SmartColumnMeta } from "./types";

function labelOf(col: any): string {
  const meta = (col.columnDef.meta ?? {}) as SmartColumnMeta;
  if (meta.label) return meta.label;
  const h = col.columnDef.header;
  if (typeof h === "string") return h;
  return String(col.id);
}

export function SmartTableToolbar<T>({
  table,
  search,
  onSearchChange,
  groupBy,
  onGroupByChange,
  editMode,
  onEditModeChange,
  hasEditableColumns,
  rowCount,
  toolbarActions,
  hideSearch,
  searchPlaceholder = "Pesquisar…",
  groupByOptions,
  savedViewsKey,
}: {
  table: Table<T>;
  search: string;
  onSearchChange: (v: string) => void;
  groupBy: string | null;
  onGroupByChange: (v: string | null) => void;
  editMode: boolean;
  onEditModeChange: (v: boolean) => void;
  hasEditableColumns: boolean;
  rowCount: number;
  toolbarActions?: React.ReactNode;
  hideSearch?: boolean;
  searchPlaceholder?: string;
  groupByOptions?: { value: string; label: string }[];
  savedViewsKey?: string;
}) {
  const groupable =
    groupByOptions ??
    table
      .getAllLeafColumns()
      .filter((c) => typeof c.accessorFn !== "undefined" && c.getIsVisible())
      .map((c) => ({ value: c.id, label: labelOf(c) }));

  const activeGroupLabel = groupBy
    ? groupable.find((o) => o.value === groupBy)?.label ?? groupBy
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-background px-4 py-3">
      {!hideSearch && (
        <div className="relative w-64 max-w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 pl-8 pr-7"
            data-smart-table-search
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Limpar pesquisa"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <AdvancedTableFilters table={table} />

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-9 gap-2", groupBy && "border-primary text-primary")}
          >
            <Layers className="h-4 w-4" />
            {activeGroupLabel ?? "Agrupar"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <div className="mb-2 px-1 text-xs font-medium text-muted-foreground">
            Agrupar por…
          </div>
          <button
            type="button"
            onClick={() => onGroupByChange(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
              !groupBy && "bg-muted",
            )}
          >
            <Group className="h-3.5 w-3.5 text-muted-foreground" />
            Sem agrupamento
          </button>
          <div className="my-1 h-px bg-border/60" />
          {groupable.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onGroupByChange(opt.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                groupBy === opt.value && "bg-muted",
              )}
            >
              {opt.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <div className="flex flex-wrap items-center gap-2">
        {savedViewsKey && <SavedViews table={table} storageKey={savedViewsKey} />}
        {hasEditableColumns && (
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={() => onEditModeChange(!editMode)}
            className={cn(
              "h-9 gap-2",
              editMode && "bg-amber-500 text-white hover:bg-amber-600",
            )}
          >
            {editMode ? <Lock className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {editMode ? "Bloquear edição" : "Editar"}
          </Button>
        )}
        <DataTableViewOptions table={table} />
        {toolbarActions}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {rowCount} resultados
        </span>
      </div>
    </div>
  );
}