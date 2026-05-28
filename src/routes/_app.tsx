import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const { pessoa } = useAuth();

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
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        A carregar…
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
          <header className="flex h-14 items-center justify-between border-b border-border/60 bg-background px-4 md:px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="hidden md:inline-flex" />
              <span className="text-sm font-bold tracking-tight text-foreground">Meeru</span>
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            </div>
            <div className="flex items-center gap-2">
              {pessoa && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {pessoa.nome_completo ?? pessoa.email}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="hidden text-muted-foreground hover:text-foreground md:inline-flex"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/", replace: true });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </Button>
            </div>
          </header>
          <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 md:px-10 md:py-10">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}