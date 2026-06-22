export type PageKey =
  | "participantes"
  | "familias"
  | "acoes"
  | "atividades"
  | "curriculos"
  | "dashboard"
  | "eliminados"
  | "emails"
  | "security"
  | "style-guide"
  | "duplicados"
  | "projetos"
  | "bolsas-transporte"
  | "localizacoes"
  | "tipos-user"
  | "servicos";

export const AVAILABLE_PAGES: { key: PageKey; label: string; path: string }[] = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard" },
  { key: "participantes", label: "Gestão de Participantes", path: "/participantes" },
  { key: "familias", label: "Gestão de Famílias", path: "/familias" },
  { key: "acoes", label: "Gestão de Ações", path: "/acoes" },
  { key: "atividades", label: "Atividades", path: "/atividades" },
  { key: "curriculos", label: "Currículos", path: "/curriculos" },
  { key: "projetos", label: "Projetos", path: "/projetos" },
  { key: "bolsas-transporte", label: "Bolsa de Transporte", path: "/bolsas-transporte" },
  { key: "localizacoes", label: "Localizações", path: "/localizacoes" },
  { key: "emails", label: "Emails", path: "/emails" },
  { key: "duplicados", label: "Duplicados", path: "/duplicados" },
  { key: "eliminados", label: "Eliminados", path: "/eliminados" },
  { key: "security", label: "Segurança (admin)", path: "/security" },
  { key: "style-guide", label: "Style Guide (admin)", path: "/style-guide" },
  { key: "tipos-user", label: "Tipos de Utilizador (admin)", path: "/tipos-user" },
  { key: "servicos", label: "Serviços & Pagamentos", path: "/servicos" },
];

export function pageKeyFromPath(pathname: string): PageKey | null {
  const match = AVAILABLE_PAGES.find((p) => pathname === p.path || pathname.startsWith(p.path + "/"));
  return match?.key ?? null;
}