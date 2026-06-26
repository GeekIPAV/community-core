import type { ColumnDef, ColumnMeta, SortingState, VisibilityState } from "@tanstack/react-table";
import type { ReactNode } from "react";

export type SmartEditType = "text" | "number" | "date" | "select";

export interface SmartColumnMeta<TData = unknown, TValue = unknown> extends ColumnMeta<TData, TValue> {
  /** Pretty label used in toolbar/group menus (defaults to column.id) */
  label?: string;
  /** Hide this column on viewports below md (768px). */
  hideOnMobile?: boolean;
  /** Inline-edit kind when SmartTable's edit mode is enabled. */
  editType?: SmartEditType;
  /** Options for editType "select". */
  editSelectOptions?: { value: string; label: string }[];
  /** Override the default truncate+tooltip rendering. */
  noTruncate?: boolean;
  /** Plain-text value used by global search and group-by; defaults to the cell value. */
  textValue?: (row: TData) => string;
  /** Custom group-by accessor (defaults to row[column.id]). */
  groupValue?: (row: TData) => string;
  // Re-export of filter meta from advanced-table-filters (kept loose to avoid circular types).
  filterVariant?: "text" | "number" | "date" | "select";
  filterOptions?: string[];
}

export type SmartColumnDef<TData, TValue = unknown> = ColumnDef<TData, TValue> & {
  meta?: SmartColumnMeta<TData, TValue>;
};

export interface SmartTableProps<TData> {
  /** Stable identifier used to namespace localStorage keys (widths, visibility, sort, edit-mode). */
  tableId: string;
  columns: SmartColumnDef<TData, any>[];
  data: TData[] | undefined;
  isLoading?: boolean;
  /** Column ids that become inline-editable when edit mode is ON. */
  editableColumns?: string[];
  /** Called when an editable cell is committed. */
  onCellEdit?: (rowId: string, columnId: string, value: unknown) => void | Promise<void>;
  /** Extra buttons rendered on the right of the toolbar. */
  toolbarActions?: ReactNode;
  /** Initial group-by column id (user can change it). */
  defaultGroupBy?: string;
  /** Group values that start collapsed (only when grouping is active). */
  defaultCollapsedGroups?: string[];
  /** Click handler for a row (ignored when clicking inside an editable cell in edit mode). */
  onRowClick?: (row: TData) => void;
  /** Stable id extractor; defaults to (row as any).id. */
  getRowId?: (row: TData) => string;
  /** Optional className on the outer container. */
  className?: string;
  /** Hide the global search input. */
  hideSearch?: boolean;
  /** Override the empty-state message. */
  emptyMessage?: string;
  /** Override the empty-state icon. */
  emptyIcon?: ReactNode;
  /** Placeholder for the global search input (default: "Pesquisar…"). */
  searchPlaceholder?: string;
  /**
   * Explicit list of columns offered in the "Agrupar" menu. When omitted,
   * SmartTable falls back to every visible accessor column.
   */
  groupByOptions?: { value: string; label: string }[];
  /** Initial sorting state (only applied on the very first render). */
  defaultSortBy?: SortingState;
  /** Initial column visibility state (only applied on the very first render). */
  defaultColumnVisibility?: VisibilityState;
  /** Extra className per row, based on the underlying record. */
  getRowClassName?: (row: TData) => string | undefined;
  /**
   * Page size for the optional pagination footer. Pass `null` (or omit) to
   * disable pagination and show every row at once (the historical default).
   */
  pageSize?: number | null;
  /** Enable the SavedViews component when set; value is the storage namespace. */
  savedViewsKey?: string;
}