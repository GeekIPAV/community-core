import { useState } from "react";
import type {
  ColumnFiltersState,
  ColumnSizingState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import { useLocalStorage } from "@/hooks/use-local-storage";

export interface SmartTableStateOptions {
  defaultGroupBy?: string;
  defaultSortBy?: SortingState;
  defaultColumnVisibility?: VisibilityState;
  defaultCollapsedGroups?: string[];
}

/**
 * Consolidated SmartTable state. All identity-stable values
 * (sorting / visibility / sizing / grouping / edit mode) persist to
 * localStorage under `smarttable:${tableId}:*`; transient values
 * (search, column filters, expanded collapse map) stay in memory.
 */
export function useSmartTableState(tableId: string, options: SmartTableStateOptions = {}) {
  const ns = (k: string) => `smarttable:${tableId}:${k}`;

  const [sorting, setSorting] = useLocalStorage<SortingState>(
    ns("sort"),
    options.defaultSortBy ?? [],
  );
  const [columnVisibility, setColumnVisibility] = useLocalStorage<VisibilityState>(
    ns("visibility"),
    options.defaultColumnVisibility ?? {},
  );
  const [columnSizing, setColumnSizing] = useLocalStorage<ColumnSizingState>(
    ns("sizing"),
    {},
  );
  const [groupBy, setGroupBy] = useLocalStorage<string>(
    ns("groupBy"),
    options.defaultGroupBy ?? "",
  );
  const [editMode, setEditMode] = useLocalStorage<boolean>(ns("edit"), false);

  const [globalSearch, setGlobalSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of options.defaultCollapsedGroups ?? []) init[g] = true;
    return init;
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  return {
    sorting, setSorting,
    columnVisibility, setColumnVisibility,
    columnSizing, setColumnSizing,
    groupBy, setGroupBy,
    editMode, setEditMode,
    globalSearch, setGlobalSearch,
    columnFilters, setColumnFilters,
    collapsedGroups, setCollapsedGroups,
    pageIndex, setPageIndex,
    pageSize, setPageSize,
  };
}