import type { CidadeBolsa } from "@/lib/bolsa-transporte";

export type Cidade = CidadeBolsa;

export type BolsaPagamento = {
  id: string;
  inscricao_id: string;
  pessoa_id: string;
  acao_id: string;
  valor: number;
  estado: "por_pagar" | "pago" | "cancelado";
  metodo_pagamento: string | null;
  notas: string | null;
  data_pagamento: string | null;
};

export type InscricaoComBolsa = {
  inscricao_id: string;
  pessoa_id: string;
  pessoa_nome: string;
  familia_id: string | null;
  familia_nome: string | null;
  cidade_residencia: string | null;
  acao_id: string;
  acao_nome: string;
  acao_data: string | null;
  acao_local: string | null;
  viatura_propria: boolean;
  viatura_km: number | null;
  viatura_grupo: string | null;
  isDuplicateGrupo: boolean;
  valor_calculado: number;
  pagamento: BolsaPagamento | null;
};

export type AcaoGrupo = {
  id: string;
  nome: string;
  data_inicio: string | null;
  local: string | null;
  inscricoes: InscricaoComBolsa[];
  faltantes: Faltante[];
  totalValor: number;
  nPago: number;
  nPorPagar: number;
};

// Pessoa elegível (presente + tipo Membro) que ainda não tem registo de bolsa
export type Faltante = {
  inscricao_id: string;
  pessoa_id: string;
  pessoa_nome: string;
  acao_id: string;
  familia_id: string | null;
  familia_nome: string | null;
  valor_calculado: number;
};

export type FamiliaResumo = {
  familia_id: string;
  familia_nome: string;
  totalRecebido: number;
  totalPorReceber: number;
  nPagamentos: number;
  inscricoes: InscricaoComBolsa[];
};

export type MapaKmRow = {
  id: string;
  familia_id: string;
  familia_nome?: string;
  acao_id?: string | null;
  acao_nome?: string | null;
  data: string;
  motivo: string;
  km: number;
  matricula: string | null;
  n_carros: number;
  valor: number;
  estado: "por_pagar" | "pago" | "cancelado";
  metodo_pagamento: string | null;
  notas: string | null;
  data_pagamento: string | null;
};

export type FamiliaSubgrupo = {
  key: string;
  nome: string;
  isFamilia: boolean;
  inscricoes: InscricaoComBolsa[];
};
