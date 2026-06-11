import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { pageKeyFromPath } from "@/lib/permissions";

export const Route = createFileRoute("/_app/_admin")({
  component: AdminGuard,
});

function AdminGuard() {
  const { loading, isAdmin, hasPage } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pageKey = pageKeyFromPath(pathname);
  const isDashboard = pathname === "/dashboard";
  // Tipos de utilizador é só para admins; restantes seguem permissões.
  const allowed = isAdmin || isDashboard || (pageKey !== null && pageKey !== "tipos-user" && hasPage(pageKey));

  useEffect(() => {
    if (!loading && !allowed) {
      navigate({ to: "/", replace: true });
    }
  }, [loading, allowed, navigate]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">A carregar…</div>;
  }
  if (!allowed) return null;
  return <Outlet />;
}