import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
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
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-border/60 bg-card/80 px-6 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-foreground">Meeru</span>
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            </div>
            <div className="flex items-center gap-2">
              {pessoa && (
                <div className="hidden items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 sm:flex">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {(pessoa.nome_completo ?? pessoa.email ?? "?")
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {pessoa.nome_completo ?? pessoa.email}
                  </span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/", replace: true });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </Button>
            </div>
          </header>
          <main className="flex-1 px-6 py-8 md:px-10 md:py-10">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}