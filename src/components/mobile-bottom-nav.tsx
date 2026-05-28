import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  BarChart3,
  User,
  Menu,
  Users,
  Users2,
  Briefcase,
  AlertTriangle,
  CalendarDays,
  Shield,
  LogOut,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

const primary = [
  { title: "Início", url: "/", icon: Home },
  { title: "Resultados", url: "/resultados", icon: BarChart3 },
  { title: "Perfil", url: "/perfil", icon: User },
];

const adminItems = [
  { title: "Participantes", url: "/participantes", icon: Users, page: "participantes" as const },
  { title: "Famílias", url: "/familias", icon: Users2, page: "familias" as const },
  { title: "Projetos", url: "/projetos", icon: Briefcase, page: "projetos" as const },
  { title: "Duplicados", url: "/duplicados", icon: AlertTriangle, page: "duplicados" as const },
  { title: "Ações", url: "/acoes", icon: CalendarDays, page: "acoes" as const },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, hasPage, pessoa } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const visibleAdmin = adminItems.filter((i) => hasPage(i.page));
  const isActive = (url: string) => pathname === url;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
      <div className="flex h-16 items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {primary.map((item) => (
          <Link
            key={item.url}
            to={item.url}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[11px]",
              isActive(item.url) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.title}</span>
          </Link>
        ))}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground"
            >
              <Menu className="h-5 w-5" />
              <span>Mais</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-6">
              {pessoa && (
                <div className="text-xs text-muted-foreground">
                  {pessoa.nome_completo ?? pessoa.email}
                </div>
              )}
              {visibleAdmin.length > 0 && (
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Gestão
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {visibleAdmin.map((item) => (
                      <Link
                        key={item.url}
                        to={item.url}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-md border border-border p-3 text-sm",
                          isActive(item.url) && "bg-muted",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {isAdmin && (
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Administração
                  </div>
                  <Link
                    to="/tipos-user"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border border-border p-3 text-sm",
                      isActive("/tipos-user") && "bg-muted",
                    )}
                  >
                    <Shield className="h-4 w-4" />
                    Tipos de Utilizador
                  </Link>
                </div>
              )}
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setOpen(false);
                  navigate({ to: "/", replace: true });
                }}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-border p-3 text-sm text-muted-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}