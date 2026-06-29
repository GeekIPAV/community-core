import { toCSV } from "./csv";

/** Trigger a CSV download in the browser from an array of plain objects. */
export function downloadCSV(
  filename: string,
  rows: Record<string, unknown>[],
  columns?: string[],
) {
  const csv = toCSV(rows, columns);
  // BOM so Excel detects UTF-8.
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}