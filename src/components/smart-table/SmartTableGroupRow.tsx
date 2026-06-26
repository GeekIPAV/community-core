import { ChevronDown, ChevronRight } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function SmartTableGroupRow({
  label,
  value,
  count,
  collapsed,
  onToggle,
  colSpan,
}: {
  label: string;
  value: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  colSpan: number;
}) {
  return (
    <TableRow
      className="bg-muted/20 hover:bg-muted/30 border-b border-border/60 cursor-pointer"
      onClick={onToggle}
    >
      <TableCell colSpan={colSpan} className="px-3 py-2">
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {label}:
          </span>
          <span className="text-sm font-medium">{value || "—"}</span>
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
            {count}
          </Badge>
        </div>
      </TableCell>
    </TableRow>
  );
}