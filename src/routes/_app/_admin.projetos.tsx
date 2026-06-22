import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/_admin/projetos")({
  component: () => <Outlet />,
});