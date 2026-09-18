// Tipos e constantes partilhados da ficha de família.

export const STATUS_OPTS = [
  "Sem estado",
  "Em espera",
  "No programa",
  "Não interessada",
  "Concluído",
  "Fora do País",
] as const;
export type FamiliaStatus = typeof STATUS_OPTS[number];

export const STATUS_GROUPS: { label: string; options: FamiliaStatus[] }[] = [
  { label: "A fazer", options: ["Sem estado", "Em espera"] },
  { label: "Em andamento", options: ["No programa"] },
  { label: "Concluídos", options: ["Não interessada", "Concluído", "Fora do País"] },
];

export type Familia = {
  id: string;
  nome: string;
  notas: string | null;
  status: FamiliaStatus;
  contacto_meeru_id: string | null;
  direito_bolsa?: boolean | null;
  direito_mapa_km?: boolean | null;
  updated_at: string | null;
};

type Membro = {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  status: string;
  genero: string | null;
  cidade_residencia: string | null;
  nacionalidade: string | null;
  religiao: string | null;
  nif: string | null;
  projeto_ids: string[] | null;
  is_voluntario: boolean | null;
};
