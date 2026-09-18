export type Colaborador = {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  iban: string | null;
  notas: string | null;
  ativo: boolean;
  pessoa_id: string | null;
};

export type TipoServico = {
  id: string;
  nome: string;
  descricao: string | null;
  unidade: string;
  preco_unitario: number;
  ativo: boolean;
};

export type Registo = {
  id: string;
  colaborador_id: string;
  tipo_servico_id: string;
  data_inicio: string;
  data_fim: string | null;
  descricao: string | null;
  quantidade: number;
  preco_unitario_override: number | null;
  outros_custos: number;
  outros_custos_descricao: string | null;
  km: number | null;
  estado: "pendente" | "aprovado" | "pago";
  submetido_pelo_colaborador: boolean;
  pagamento_id: string | null;
  notas_admin: string | null;
  sessao_id: string | null;
};

export type Pagamento = {
  id: string;
  colaborador_id: string;
  data_pagamento: string;
  total: number;
  referencia: string | null;
  metodo: string | null;
  notas: string | null;
};

export type SessaoRow = {
  id: string;
  nome: string;
  tipo_servico_id: string;
  data_inicio: string;
  data_fim: string | null;
  local: string | null;
  descricao: string | null;
  quantidade_por_colaborador: number;
  preco_unitario_override: number | null;
};

export type PessoaLite = { id: string; nome_completo: string; email: string | null };

export const UNIDADES = ["hora", "sessão", "página", "km", "dia", "unidade"];
export const ESTADOS: Registo["estado"][] = ["pendente", "aprovado", "pago"];

export const fmtEUR = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
