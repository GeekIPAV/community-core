import { useEffect, useRef } from "react";
import type { Table, VisibilityState } from "@tanstack/react-table";
import { useIsMobile } from "./use-mobile";

/**
 * On mobile viewports, hides every leaf column except those whose id is in
 * `visibleOnMobile`. Restores the previous visibility state when returning to
 * desktop. The user can still re-enable columns via the "Colunas" dropdown.
 */
export function useMobileColumnVisibility<T>(
  table: Table<T>,
  visibleOnMobile: string[],
) {
  const isMobile = useIsMobile();
  const prevRef = useRef<VisibilityState | null>(null);
  const appliedRef = useRef(false);

  useEffect(() => {
    if (isMobile) {
      if (!appliedRef.current) {
        prevRef.current = table.getState().columnVisibility;
      }
      const next: VisibilityState = {};
      table.getAllLeafColumns().forEach((c) => {
        next[c.id] = visibleOnMobile.includes(c.id);
      });
      table.setColumnVisibility(next);
      appliedRef.current = true;
    } else if (appliedRef.current) {
      table.setColumnVisibility(prevRef.current ?? {});
      prevRef.current = null;
      appliedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);
}