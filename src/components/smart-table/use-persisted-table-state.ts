import { useEffect, useState } from "react";
import type { SortingState, VisibilityState, ColumnSizingState } from "@tanstack/react-table";

const NS = "smarttable";
const key = (tableId: string, k: string) => `${NS}:${tableId}:${k}`;

function read<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(k);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function write(k: string, v: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore quota errors */
  }
}

export function usePersistedSorting(tableId: string) {
  const k = key(tableId, "sort");
  const [sorting, setSorting] = useState<SortingState>(() => read<SortingState>(k, []));
  useEffect(() => write(k, sorting), [k, sorting]);
  return [sorting, setSorting] as const;
}

export function usePersistedVisibility(tableId: string) {
  const k = key(tableId, "visibility");
  const [v, setV] = useState<VisibilityState>(() => read<VisibilityState>(k, {}));
  useEffect(() => write(k, v), [k, v]);
  return [v, setV] as const;
}

export function usePersistedSizing(tableId: string) {
  const k = key(tableId, "sizing");
  const [s, setS] = useState<ColumnSizingState>(() => read<ColumnSizingState>(k, {}));
  useEffect(() => write(k, s), [k, s]);
  return [s, setS] as const;
}

export function usePersistedFlag(tableId: string, name: string, fallback = false) {
  const k = key(tableId, name);
  const [v, setV] = useState<boolean>(() => read<boolean>(k, fallback));
  useEffect(() => write(k, v), [k, v]);
  return [v, setV] as const;
}

export function usePersistedString(tableId: string, name: string, fallback = "") {
  const k = key(tableId, name);
  const [v, setV] = useState<string>(() => read<string>(k, fallback));
  useEffect(() => write(k, v), [k, v]);
  return [v, setV] as const;
}