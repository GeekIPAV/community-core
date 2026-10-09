export type AcaoQualityData = {
  data_inicio?: string | null; data_fim?: string | null; imagem_url?: string | null;
  local?: string | null; tipo_acao_id?: string | null; inscricoes_abertas?: boolean;
};

export const ACAO_GROUP_LABELS = { proximas: "Próximas", semData: "Data a definir", realizadas: "Realizadas" } as const;
export type AcaoGroup = keyof typeof ACAO_GROUP_LABELS;

// Preserve the existing management page's inclusive 24-hour grace period.
export function acaoManagementGroup(acao: AcaoQualityData, now = Date.now()): AcaoGroup {
  const date = acao.data_fim || acao.data_inicio;
  if (!date || Number.isNaN(new Date(date).getTime())) return "semData";
  return new Date(date).getTime() >= now - 86_400_000 ? "proximas" : "realizadas";
}

export function acaoQualityWarnings(acao: AcaoQualityData, now = Date.now()) {
  const warnings: { field: string; message: string }[] = [];
  if (!acao.data_inicio) warnings.push({ field: "data_inicio", message: "Sem data de início" });
  if (!acao.imagem_url?.trim()) warnings.push({ field: "imagem_url", message: "Sem imagem de capa" });
  if (!acao.local?.trim()) warnings.push({ field: "local", message: "Sem local" });
  if (!acao.tipo_acao_id) warnings.push({ field: "tipo_acao_id", message: "Sem tipo de ação" });
  const end = acao.data_fim || acao.data_inicio;
  if (acao.inscricoes_abertas && end && new Date(end).getTime() < now) {
    warnings.push({ field: "inscricoes_abertas", message: "Inscrições abertas numa ação já passada" });
  }
  return warnings;
}

export function acaoParticipantTotal(registered: number, extra?: number | null) {
  return registered + Math.max(0, Number(extra) || 0);
}

export function filterManagedAcoes<T extends AcaoQualityData & { nome: string; status: string; projeto_ids: string[] }>(
  acoes: T[], filters: { pesquisa: string; tipo: string; projeto: string; estado: string; periodo: string; atencao: boolean }, now = Date.now(),
) {
  const normalize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const query = normalize(filters.pesquisa.trim());
  return acoes.filter(a => (!query || normalize(`${a.nome} ${a.local ?? ""}`).includes(query))
    && (filters.tipo === "todos" || a.tipo_acao_id === filters.tipo)
    && (filters.projeto === "todos" || a.projeto_ids.includes(filters.projeto))
    && (filters.estado === "todos" || a.status === filters.estado)
    && (filters.periodo === "todos" || acaoManagementGroup(a, now) === filters.periodo)
    && (!filters.atencao || acaoQualityWarnings(a, now).length > 0));
}