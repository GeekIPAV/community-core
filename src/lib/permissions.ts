export type PageKey =
  | "participantes"
  | "familias"
  | "acoes"
  | "duplicados"
  | "projetos"
  | "bolsas-transporte"
  | "tipos-user";

export const AVAILABLE_PAGES: { key: PageKey; label: string; path: string }[] = [
  { key: "participantes", label: "Gestão de Participantes", path: "/participantes" },
  { key: "familias", label: "Gestão de Famílias", path: "/familias" },
  { key: "acoes", label: "Gestão de Ações", path: "/acoes" },
  { key: "duplicados", label: "Duplicados", path: "/duplicados" },
  { key: "projetos", label: "Projetos", path: "/projetos" },
  { key: "bolsas-transporte", label: "Bolsa de Transporte", path: "/bolsas-transporte" },
  { key: "tipos-user", label: "Tipos de Utilizador (admin)", path: "/tipos-user" },
];

export function pageKeyFromPath(pathname: string): PageKey | null {
  const match = AVAILABLE_PAGES.find((p) => pathname === p.path || pathname.startsWith(p.path + "/"));
  return match?.key ?? null;
}