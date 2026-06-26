import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Common icons used in the sidebar; pickable in /menu admin UI.
export const PICKABLE_ICONS: string[] = [
  "Globe", "BarChart3", "User", "Users", "Users2", "Briefcase",
  "AlertTriangle", "CalendarDays", "CalendarCheck", "Activity",
  "Wallet", "CreditCard", "ClipboardList", "Settings2", "Settings",
  "LayoutDashboard", "Bus", "MapPin", "FileText", "FileSpreadsheet", "FileBarChart", "Handshake",
  "Mail", "UserCog", "Trash2", "ShieldAlert", "Palette", "ChartBar",
  "Folder", "Star", "Heart", "Tag",
];

export function renderIcon(name?: string | null, className = "h-4 w-4") {
  const key = (name || "Circle") as keyof typeof Icons;
  const Component = (Icons[key] as LucideIcon | undefined) ?? Icons.Circle;
  return <Component className={className} />;
}