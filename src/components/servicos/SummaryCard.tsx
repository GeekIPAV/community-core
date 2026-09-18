export function SummaryCard({ label, value, variant }: { label: string; value: string; variant?: "warning" | "info" | "success" }) {
  const tone =
    variant === "warning" ? "text-amber-600 dark:text-amber-400" :
    variant === "info" ? "text-blue-600 dark:text-blue-400" :
    variant === "success" ? "text-emerald-600 dark:text-emerald-400" :
    "text-foreground";
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
