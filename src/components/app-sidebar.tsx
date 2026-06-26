import { useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { LANGUAGES, useDir } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImpersonationPicker } from "@/components/impersonation-picker";
import { renderIcon } from "@/components/sidebar-icons";
import { cn } from "@/lib/utils";

export type SidebarGroupRow = {
  id: string;
  key: string;
  label: string;
  icon: string | null;
  position: number;
  is_visible: boolean;
  visible_to: string[];
  is_system?: boolean;
};
export type SidebarItemRow = {
  id: string;
  group_id: string;
  key: string;
  label: string;
  url: string;
  icon: string;
  position: number;
  is_visible: boolean;
  visible_to: string[];
  badge_query: string | null;
  sub_group: string | null;
  is_system?: boolean;
};

// ---------- Hardcoded fallback (rendered before query resolves / on error) ----------
const FALLBACK_GROUPS: SidebarGroupRow[] = [
  { id: "g1", key: "community", label: "Comunidade", icon: null, position: 1, is_visible: true, visible_to: ["admin","staff","user"] },
  { id: "g2", key: "participantes", label: "Gestão de Participantes", icon: null, position: 2, is_visible: true, visible_to: ["admin","staff"] },
  { id: "g3", key: "acoes", label: "GESTÃO", icon: null, position: 3, is_visible: true, visible_to: ["admin","staff"] },
  { id: "g5", key: "admin", label: "Administração", icon: null, position: 5, is_visible: true, visible_to: ["admin"] },
];
const FALLBACK_ITEMS: SidebarItemRow[] = [
  { id:"i1", group_id:"g1", key:"portal", label:"Portal Público", url:"/", icon:"Globe", position:1, is_visible:true, visible_to:["admin","staff","user"], badge_query:null, sub_group:null },
  { id:"i2", group_id:"g1", key:"resultados", label:"Resultados", url:"/resultados", icon:"BarChart3", position:2, is_visible:true, visible_to:["admin","staff","user"], badge_query:null, sub_group:null },
  { id:"i3", group_id:"g1", key:"perfil", label:"O Meu Perfil", url:"/perfil", icon:"User", position:3, is_visible:true, visible_to:["admin","staff","user"], badge_query:null, sub_group:null },
  { id:"i5", group_id:"g2", key:"participantes", label:"Participantes", url:"/participantes", icon:"Users", position:1, is_visible:true, visible_to:["admin","staff"], badge_query:null, sub_group:null },
  { id:"i6", group_id:"g2", key:"familias", label:"Famílias", url:"/familias", icon:"Users2", position:2, is_visible:true, visible_to:["admin","staff"], badge_query:null, sub_group:null },
  { id:"i7", group_id:"g2", key:"projetos", label:"Projetos", url:"/projetos", icon:"Briefcase", position:3, is_visible:true, visible_to:["admin","staff"], badge_query:null, sub_group:null },
  { id:"i8", group_id:"g2", key:"duplicados", label:"Duplicados", url:"/duplicados", icon:"AlertTriangle", position:4, is_visible:true, visible_to:["admin","staff"], badge_query:"count_duplicates", sub_group:null },
  { id:"i9", group_id:"g3", key:"acoes", label:"Ações", url:"/acoes", icon:"CalendarDays", position:1, is_visible:true, visible_to:["admin","staff"], badge_query:null, sub_group:null },
  { id:"i10", group_id:"g3", key:"atividades", label:"Atividades", url:"/atividades", icon:"Activity", position:2, is_visible:true, visible_to:["admin","staff"], badge_query:null, sub_group:null },
  { id:"i11", group_id:"g3", key:"servicos-painel", label:"Serviços & Pagamentos", url:"/servicos", icon:"Wallet", position:3, is_visible:true, visible_to:["admin","staff"], badge_query:null, sub_group:null },
  { id:"i14", group_id:"g3", key:"curriculos", label:"Currículos", url:"/curriculos", icon:"FileText", position:4, is_visible:true, visible_to:["admin","staff"], badge_query:null, sub_group:null },
  { id:"i14b", group_id:"g3", key:"relatorios", label:"Relatórios", url:"/relatorios", icon:"FileBarChart", position:14, is_visible:true, visible_to:["admin","staff"], badge_query:"count_relatorios_pendentes", sub_group:null },
  { id:"i12", group_id:"g5", key:"dashboard", label:"Painel", url:"/dashboard", icon:"LayoutDashboard", position:1, is_visible:true, visible_to:["admin","staff"], badge_query:null, sub_group:null },
  { id:"i13", group_id:"g5", key:"menu", label:"Gestão do Menu", url:"/menu", icon:"Settings2", position:6, is_visible:true, visible_to:["admin"], badge_query:null, sub_group:null },
];

// ---------- Hooks ----------
export function useSidebarConfig() {
  return useQuery({
    queryKey: ["sidebar-config"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [g, i] = await Promise.all([
        supabase.from("sidebar_groups").select("*").order("position"),
        supabase.from("sidebar_items").select("*").order("position"),
      ]);
      if (g.error) throw g.error;
      if (i.error) throw i.error;
      return {
        groups: (g.data ?? []) as SidebarGroupRow[],
        items: (i.data ?? []) as SidebarItemRow[],
      };
    },
  });
}

export function useEffectiveRoles(): string[] {
  const { isAdmin, isStaff, session } = useAuth();
  const roles: string[] = [];
  if (session) roles.push("user");
  if (isStaff) roles.push("staff");
  if (isAdmin) roles.push("admin");
  return roles;
}

function canSee(visibleTo: string[], roles: string[]) {
  if (!visibleTo || visibleTo.length === 0) return true;
  if (roles.includes("admin")) return true;
  return visibleTo.some((r) => roles.includes(r));
}

// ---------- Badge for items with badge_query ----------
function BadgeCount({ rpc }: { rpc: string }) {
  const { data } = useQuery({
    queryKey: ["sidebar-badge", rpc],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(rpc as never);
      if (error) return 0;
      return typeof data === "number" ? data : 0;
    },
  });
  if (!data || data <= 0) return null;
  const tone = data > 10
    ? "bg-destructive text-destructive-foreground"
    : rpc === "count_duplicates"
      ? "bg-amber-500 text-white"
      : "bg-primary text-primary-foreground";
  return (
    <Badge className={cn("ml-auto h-5 min-w-5 px-1.5 text-[10px] border-transparent", tone)}>
      {data}
    </Badge>
  );
}

// ---------- Item link ----------
function ItemLink({ item, pathname, sub = false }: { item: SidebarItemRow; pathname: string; sub?: boolean }) {
  const active = pathname === item.url;
  if (sub) {
    return (
      <SidebarMenuSubButton asChild isActive={active}>
        <Link to={item.url} className="flex items-center gap-2">
          {renderIcon(item.icon)}
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge_query ? <BadgeCount rpc={item.badge_query} /> : null}
        </Link>
      </SidebarMenuSubButton>
    );
  }
  return (
    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
      <Link to={item.url} className="flex items-center gap-2">
        {renderIcon(item.icon)}
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge_query ? <BadgeCount rpc={item.badge_query} /> : null}
      </Link>
    </SidebarMenuButton>
  );
}

// ---------- Group renderer ----------
function GroupBlock({
  group, items, pathname,
}: {
  group: SidebarGroupRow;
  items: SidebarItemRow[];
  pathname: string;
}) {
  const anyActive = items.some((it) => it.url === pathname);

  // Bucket by sub_group preserving order
  const buckets: { sub: string | null; items: SidebarItemRow[] }[] = [];
  for (const it of items) {
    const last = buckets[buckets.length - 1];
    if (last && (last.sub ?? "") === (it.sub_group ?? "")) {
      last.items.push(it);
    } else {
      buckets.push({ sub: it.sub_group ?? null, items: [it] });
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel
        className={cn(
          "px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80",
          anyActive && "text-foreground"
        )}
      >
        {group.label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {buckets.map((b, bi) => {
            if (!b.sub) {
              return b.items.map((it) => (
                <SidebarMenuItem key={it.id}>
                  <ItemLink item={it} pathname={pathname} />
                </SidebarMenuItem>
              ));
            }
            const subActive = b.items.some((it) => it.url === pathname);
            return <SubMenu key={`sub-${bi}`} label={b.sub} items={b.items} pathname={pathname} defaultOpen={subActive} />;
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function SubMenu({
  label, items, pathname, defaultOpen,
}: {
  label: string;
  items: SidebarItemRow[];
  pathname: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const firstIcon = items[0]?.icon ?? "Folder";
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/coll">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={label}>
            {renderIcon(firstIcon)}
            <span className="flex-1 truncate">{label}</span>
            {open ? <ChevronDown className="h-3.5 w-3.5 opacity-60" /> : <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((it) => (
              <SidebarMenuSubItem key={it.id}>
                <ItemLink item={it} pathname={pathname} sub />
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// ---------- Main ----------
export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { realIsAdmin } = useAuth();
  const { t, i18n } = useTranslation();
  const dir = useDir();
  const roles = useEffectiveRoles();
  const { data } = useSidebarConfig();

  const { groups, itemsByGroup } = useMemo(() => {
    const src = data ?? { groups: FALLBACK_GROUPS, items: FALLBACK_ITEMS };
    const visibleGroups = src.groups
      .filter((g) => g.is_visible && canSee(g.visible_to, roles))
      .sort((a, b) => a.position - b.position);
    const itemsByGroup = new Map<string, SidebarItemRow[]>();
    for (const g of visibleGroups) {
      const its = src.items
        .filter((i) => i.group_id === g.id && i.is_visible && canSee(i.visible_to, roles))
        .sort((a, b) => a.position - b.position);
      if (its.length > 0) itemsByGroup.set(g.id, its);
    }
    return { groups: visibleGroups.filter((g) => itemsByGroup.has(g.id)), itemsByGroup };
  }, [data, roles]);

  return (
    <Sidebar collapsible="icon" side={dir === "rtl" ? "right" : "left"}>
      <SidebarContent className="gap-1 px-2 py-4">
        {groups.map((g) => (
          <GroupBlock key={g.id} group={g} items={itemsByGroup.get(g.id) ?? []} pathname={pathname} />
        ))}
      </SidebarContent>
      <SidebarFooter className="px-3 py-3 border-t">
        {realIsAdmin && (
          <div className="pb-2">
            <ImpersonationPicker />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={i18n.language?.split("-")[0] ?? "pt"} onValueChange={(v) => i18n.changeLanguage(v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={t("common.language")} />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code} className="text-xs">
                  <span className="me-1">{l.flag}</span> {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}