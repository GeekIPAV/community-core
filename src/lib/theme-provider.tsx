import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const EDITABLE_TOKENS = [
  { key: "background", label: "Background", group: "Surface" },
  { key: "foreground", label: "Foreground", group: "Surface" },
  { key: "card", label: "Card", group: "Surface" },
  { key: "muted", label: "Muted", group: "Surface" },
  { key: "border", label: "Border", group: "Surface" },
  { key: "primary", label: "Primary", group: "Brand" },
  { key: "primary-foreground", label: "Primary FG", group: "Brand" },
  { key: "secondary", label: "Secondary", group: "Brand" },
  { key: "accent", label: "Accent", group: "Brand" },
  { key: "destructive", label: "Destructive", group: "Semantic" },
  { key: "ring", label: "Ring", group: "Semantic" },
  { key: "sidebar", label: "Sidebar", group: "Sidebar" },
  { key: "sidebar-primary", label: "Sidebar Primary", group: "Sidebar" },
] as const;

export type TokenKey = (typeof EDITABLE_TOKENS)[number]["key"];

export type DesignTokens = Partial<Record<TokenKey, string>> & {
  radius?: string;
  "font-sans"?: string;
};

export function applyTokens(tokens: DesignTokens) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(tokens)) {
    if (!v) continue;
    if (k === "font-sans") {
      root.style.setProperty(
        "--font-sans",
        `"${v}", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
      );
    } else if (k === "radius") {
      root.style.setProperty("--radius", v);
    } else {
      root.style.setProperty(`--${k}`, v);
    }
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ["design_tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("design_tokens")
        .select("tokens")
        .maybeSingle();
      if (error) throw error;
      return (data?.tokens ?? {}) as DesignTokens;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data) applyTokens(data);
  }, [data]);

  return <>{children}</>;
}
