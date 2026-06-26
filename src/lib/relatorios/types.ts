export type RelatorioTipo = "Intercalar" | "Final" | "Anual" | "Candidatura" | "Outro";
export type RelatorioEstado = "Rascunho" | "Em revisão" | "Aprovado" | "Submetido";

export type Relatorio = {
  id: string;
  titulo: string;
  financiador: string;
  projeto_id: string | null;
  projeto_ids: string[];
  geral: boolean;
  periodo_inicio: string;
  periodo_fim: string;
  tipo: RelatorioTipo;
  estado: RelatorioEstado;
  data_submissao_prevista: string | null;
  data_submissao_real: string | null;
  criado_por_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SecaoTipo =
  | "texto"
  | "indicadores"
  | "atividades"
  | "participantes"
  | "casos"
  | "citacao"
  | "separador";

export type SecaoConfig = {
  // indicadores
  kpi_ids?: string[];
  mostrar_meta?: boolean;
  mostrar_progresso?: boolean;
  // atividades / participantes / casos
  projeto_id?: string | null;
  projeto_ids?: string[];
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  mostrar_participantes?: boolean;
  group_by?: "none" | "month" | "type";
  breakdown_por?: "nacionalidade" | "genero" | "familia" | "projeto" | "faixa_etaria";
  // casos
  areas?: string[];
  estados?: string[];
  // citacao
  texto?: string;
  autor?: string;
};

export type Secao = {
  id: string;
  relatorio_id: string;
  tipo: SecaoTipo;
  titulo: string | null;
  conteudo_texto: string | null;
  config: SecaoConfig;
  position: number;
  created_at: string;
};

export const FINANCIADORES_SUGESTOES = [
  "Gulbenkian IGI",
  "BPI Solidário",
  "Help Alliance",
  "Porticus",
  "Portugal Inovação Social",
];

export const TIPOS_RELATORIO: RelatorioTipo[] = [
  "Intercalar",
  "Final",
  "Anual",
  "Candidatura",
  "Outro",
];

export const ESTADOS_RELATORIO: RelatorioEstado[] = [
  "Rascunho",
  "Em revisão",
  "Aprovado",
  "Submetido",
];

export const estadoColor: Record<RelatorioEstado, string> = {
  Rascunho: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  "Em revisão": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Aprovado: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  Submetido: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};