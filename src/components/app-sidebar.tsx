import { Link, useRouterState } from "@tanstack/react-router";
import { User, Users, Users2, AlertTriangle, CalendarDays, Globe, Shield, Briefcase } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";

const publicItems = [
  { title: "Portal Público", url: "/", icon: Globe },
  { title: "O Meu Perfil", url: "/perfil", icon: User },
];

const participantesItems = [
  { title: "Participantes", url: "/participantes", icon: Users, page: "participantes" as const },
  { title: "Famílias", url: "/familias", icon: Users2, page: "familias" as const },
  { title: "Projetos", url: "/projetos", icon: Briefcase, page: "projetos" as const },
  { title: "Duplicados", url: "/duplicados", icon: AlertTriangle, page: "duplicados" as const },
];

const acoesItems = [
  { title: "Ações", url: "/acoes", icon: CalendarDays, page: "acoes" as const },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, hasPage } = useAuth();

  const isActive = (url: string) => pathname === url;
  const visibleParticipantes = participantesItems.filter((i) => hasPage(i.page));
  const visibleAcoes = acoesItems.filter((i) => hasPage(i.page));

  return (
    <Sidebar collapsible="none">
      <SidebarContent className="gap-1 px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Comunidade
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
              Gestão de Participantes
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
              Gestão de Ações
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
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/tipos-user")}>
                    <Link to="/tipos-user" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span>Tipos de Utilizador</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}