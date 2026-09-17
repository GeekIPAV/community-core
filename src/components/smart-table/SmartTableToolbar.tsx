import { Search, Group, Pencil, Lock, Layers, X, Download, Trash2, PencilLine } from "lucide-react";
import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AdvancedTableFilters } from "@/components/advanced-table-filters";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { SavedViews } from "@/components/saved-views";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  selectedCount = 0,
  onClearSelection,
  onExport,
  onExportSelected,
  onBulkEditClick,
  onBulkDeleteClick,
  bulkActionsNode,
  hasBulkEdit,
  hasBulkDelete,
  disableExport,
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
  selectedCount?: number;
  onClearSelection?: () => void;
  onExport?: () => void;
  onExportSelected?: () => void;
  onBulkEditClick?: () => void;
  onBulkDeleteClick?: () => void;
  bulkActionsNode?: React.ReactNode;
  hasBulkEdit?: boolean;
  hasBulkDelete?: boolean;
  disableExport?: boolean;
}) {
  const groupable =
    groupByOptions ??
    table
      .getAllLeafColumns()
      .filter((c) => typeof c.accessorFn !== "undefined" && c.getIsVisible() && c.id !== "__select")
      .map((c) => ({ value: c.id, label: labelOf(c) }));

  const activeGroupLabel = groupBy
    ? groupable.find((o) => o.value === groupBy)?.label ?? groupBy
    : null;

  const hasSelection = selectedCount > 0;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="border-b border-border/40 bg-background px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
        {!hideSearch && (
          <div className="relative min-w-44 flex-1 sm:max-w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 border-transparent bg-muted/45 pl-8 pr-7 shadow-none hover:bg-muted/65 focus-visible:border-ring"
              data-smart-table-search
            />
            {search && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label="Limpar pesquisa"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Limpar pesquisa</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        <div className="flex min-w-0 items-center gap-0.5">
          <AdvancedTableFilters table={table} />
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant={groupBy ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label={activeGroupLabel ? `Agrupado por ${activeGroupLabel}` : "Agrupar"}
                  >
                    <Layers className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>{activeGroupLabel ? `Agrupado por ${activeGroupLabel}` : "Agrupar"}</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-64 p-2">
              <div className="mb-2 px-1 text-xs font-medium text-muted-foreground">Agrupar por…</div>
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
        </div>

        <div className="ml-auto flex items-center gap-0.5 border-l border-border/50 pl-1.5">
          {hasEditableColumns && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editMode ? "default" : "outline"}
                  size="icon"
                  onClick={() => onEditModeChange(!editMode)}
                  className="h-8 w-8"
                  aria-label={editMode ? "Terminar edição na tabela" : "Editar na tabela"}
                >
                  {editMode ? <Lock className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{editMode ? "Terminar edição na tabela" : "Editar na tabela"}</TooltipContent>
            </Tooltip>
          )}
          <DataTableViewOptions table={table} />
          {!disableExport && onExport && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onExport} aria-label="Exportar CSV">
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar CSV</TooltipContent>
            </Tooltip>
          )}
        </div>

        {toolbarActions && (
          <div className="flex items-center gap-1 border-l border-border/50 pl-1.5">
            {toolbarActions}
          </div>
        )}
        <div className="flex items-center pl-1">
          <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{rowCount} resultados</span>
        </div>
        </div>
        {savedViewsKey && (
          <div className="mt-1.5 min-w-0 border-t border-border/30 pt-1">
            <SavedViews table={table} storageKey={savedViewsKey} />
          </div>
        )}
      </div>
      {hasSelection && (
        <div className="flex flex-wrap items-center gap-2 border-b border-primary/40 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium">{selectedCount} selecionadas</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {bulkActionsNode}
            {hasBulkEdit && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onBulkEditClick}>
                <PencilLine className="h-3.5 w-3.5" />
                Editar em massa
              </Button>
            )}
            {onExportSelected && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onExportSelected}>
                <Download className="h-3.5 w-3.5" />
                Exportar
              </Button>
            )}
            {hasBulkDelete && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-destructive hover:text-destructive"
                onClick={onBulkDeleteClick}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={onClearSelection}>
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}
