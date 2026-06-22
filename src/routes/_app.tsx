import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Search } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "react-i18next";
import { NotificationsBell } from "@/components/notifications-bell";
import { CommandPalette } from "@/components/command-palette";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { pessoa } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        navigate({ to: "/login", replace: true });
      } else {
        setReady(true);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/login", replace: true });
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (!ready) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
        suppressHydrationWarning
      >
        {t("common.loading")}
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-auto min-h-14 flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background px-4 py-2 md:px-6">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger className="hidden md:inline-flex" />
              <span className="text-sm font-bold tracking-tight text-foreground">Meeru</span>
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="ms-2 hidden md:inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors min-w-[260px]"
                aria-label="Pesquisar"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="flex-1 text-start">Procurar páginas, ações, participantes…</span>
                <kbd className="hidden lg:inline-flex h-5 items-center gap-0.5 rounded border border-border/60 bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
                  ⌘K
                </kbd>
              </button>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                aria-label="Pesquisar"
              >
                <Search className="h-4 w-4" />
              </button>
              {pessoa && (
                <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                  {pessoa.nome_completo ?? pessoa.email}
                </span>
              )}
              <NotificationsBell />
              <Button
                variant="ghost"
                size="sm"
                className="hidden text-muted-foreground hover:text-foreground md:inline-flex"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/", replace: true });
                }}
              >
                <LogOut className="me-2 h-4 w-4" /> {t("common.signOut")}
              </Button>
            </div>
          </header>
          <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 md:px-10 md:py-10">
            <Outlet />
          </main>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </div>
      </div>
    </SidebarProvider>
  );
}