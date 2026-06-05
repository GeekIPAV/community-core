import { Link, useRouterState } from "@tanstack/react-router";
import { User, Users, Users2, AlertTriangle, CalendarDays, Globe, UserCog, Briefcase, BarChart3, Languages, Bus, Activity } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { LANGUAGES, useDir } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, hasPage } = useAuth();
  const { t, i18n } = useTranslation();
  const dir = useDir();

  const publicItems = [
    { title: t("nav.publicPortal"), url: "/", icon: Globe },
    { title: t("nav.results"), url: "/resultados", icon: BarChart3 },
    { title: t("nav.myProfile"), url: "/perfil", icon: User },
  ];
  const participantesItems = [
    { title: t("nav.participants"), url: "/participantes", icon: Users, page: "participantes" as const },
    { title: t("nav.families"), url: "/familias", icon: Users2, page: "familias" as const },
    { title: t("nav.projects"), url: "/projetos", icon: Briefcase, page: "projetos" as const },
    { title: t("nav.duplicates"), url: "/duplicados", icon: AlertTriangle, page: "duplicados" as const },
  ];
  const acoesItems = [
    { title: t("nav.actions"), url: "/acoes", icon: CalendarDays, page: "acoes" as const },
  ];

  const isActive = (url: string) => pathname === url;
  const visibleParticipantes = participantesItems.filter((i) => hasPage(i.page));
  const visibleAcoes = acoesItems.filter((i) => hasPage(i.page));

  return (
    <Sidebar collapsible="icon" side={dir === "rtl" ? "right" : "left"}>
      <SidebarContent className="gap-1 px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            {t("nav.community")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {publicItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleParticipantes.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {t("nav.participantsMgmt")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleParticipantes.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleAcoes.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {t("nav.actionsMgmt")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAcoes.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {t("nav.admin")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/bolsas-transporte")}>
                    <Link to="/bolsas-transporte" className="flex items-center gap-2">
                      <Bus className="h-4 w-4" />
                      <span>Bolsa de Transporte</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/atividades")}>
                    <Link to="/atividades" className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      <span>Atividades</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/tipos-user")}>
                    <Link to="/tipos-user" className="flex items-center gap-2">
                      <UserCog className="h-4 w-4" />
                      <span>{t("nav.userTypes")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="px-3 py-3 border-t">
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