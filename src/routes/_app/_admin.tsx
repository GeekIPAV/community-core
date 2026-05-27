import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/_admin")({
  component: AdminGuard,
});

function AdminGuard() {
  const { loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate({ to: "/", replace: true });
    }
  }, [loading, isAdmin, navigate]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">A carregar…</div>;
  }
  if (!isAdmin) return null;
  return <Outlet />;
}