import { describe, expect, it } from "vitest";
import { INITIAL_MEMORY_COUNT, matchesGalleryFilters } from "./acao-gallery";

const acao = { nome: "Oficina de culinária", local: "Porto", inscricoes_abertas: false, tipo_acao: { id: "oficina" } };
const defaults = { tipo: "", abertas: false, pesquisa: "" };
describe("filtros da galeria", () => {
  it("filtra pelo tipo de ação", () => {
    expect(matchesGalleryFilters(acao, { ...defaults, tipo: "oficina" })).toBe(true);
    expect(matchesGalleryFilters(acao, { ...defaults, tipo: "encontro" })).toBe(false);
  });
  it("mostra apenas inscrições abertas quando selecionado", () => {
    expect(matchesGalleryFilters(acao, { ...defaults, abertas: true })).toBe(false);
    expect(matchesGalleryFilters({ ...acao, inscricoes_abertas: true }, { ...defaults, abertas: true })).toBe(true);
  });
  it("pesquisa nome ou local", () => {
    expect(matchesGalleryFilters(acao, { ...defaults, pesquisa: "culinaria" })).toBe(true);
    expect(matchesGalleryFilters(acao, { ...defaults, pesquisa: "porto" })).toBe(true);
    expect(matchesGalleryFilters(acao, { ...defaults, pesquisa: "Braga" })).toBe(false);
  });
  it("limita a memória inicial a seis ações", () => {
    expect(Array.from({ length: 10 }, (_, i) => i).slice(0, INITIAL_MEMORY_COUNT)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});