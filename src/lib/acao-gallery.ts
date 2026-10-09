export const INITIAL_MEMORY_COUNT = 6;

export type GalleryFilters = { tipo: string; abertas: boolean; pesquisa: string };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function matchesGalleryFilters(acao: { nome: string; local: string | null; inscricoes_abertas: boolean; tipo_acao?: { id?: string } | null }, filters: GalleryFilters) {
  if (filters.tipo && acao.tipo_acao?.id !== filters.tipo) return false;
  if (filters.abertas && !acao.inscricoes_abertas) return false;
  return normalize(`${acao.nome} ${acao.local ?? ""}`).includes(normalize(filters.pesquisa.trim()));
}