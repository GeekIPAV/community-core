import { describe, expect, it } from "vitest";
import { acaoManagementGroup, acaoParticipantTotal, acaoQualityWarnings, filterManagedAcoes } from "./acao-management";

const now = new Date("2026-10-09T12:00:00Z").getTime();
const complete = { nome: "Encontro", status: "ativa", projeto_ids: ["p1"], data_inicio: "2026-10-10T12:00:00Z", data_fim: null, imagem_url: "cover.jpg", local: "Porto", tipo_acao_id: "t1", inscricoes_abertas: true };
describe("gestão de ações", () => {
  it("assinala ações sem data", () => expect(acaoQualityWarnings({ ...complete, data_inicio: null }, now).map(w => w.field)).toContain("data_inicio"));
  it("assinala ações sem capa", () => expect(acaoQualityWarnings({ ...complete, imagem_url: "" }, now).map(w => w.field)).toContain("imagem_url"));
  it("assinala ações sem local", () => expect(acaoQualityWarnings({ ...complete, local: " " }, now).map(w => w.field)).toContain("local"));
  it("assinala ações sem tipo", () => expect(acaoQualityWarnings({ ...complete, tipo_acao_id: null }, now).map(w => w.field)).toContain("tipo_acao_id"));
  it("assinala inscrições abertas após o fim", () => expect(acaoQualityWarnings({ ...complete, data_inicio: "2026-10-01" }, now).map(w => w.field)).toContain("inscricoes_abertas"));
  it("não assinala inscrições fechadas após o fim", () => expect(acaoQualityWarnings({ ...complete, data_inicio: "2026-10-01", inscricoes_abertas: false }, now)).toEqual([]));
  it("soma participantes não registados ao total não cancelado", () => expect(acaoParticipantTotal(8, 3)).toBe(11));
  it("mantém grupos de próximos, realizados e sem data", () => {
    expect(acaoManagementGroup(complete, now)).toBe("proximas");
    expect(acaoManagementGroup({ data_inicio: "2026-10-01" }, now)).toBe("realizadas");
    expect(acaoManagementGroup({}, now)).toBe("semData");
  });
  it("combina filtros de nome/local, tipo, projeto, estado e período", () => {
    const filters = { pesquisa: "porto", tipo: "t1", projeto: "p1", estado: "ativa", periodo: "proximas", atencao: false };
    expect(filterManagedAcoes([complete, { ...complete, projeto_ids: ["p2"] }], filters, now)).toEqual([complete]);
    expect(filterManagedAcoes([complete], { ...filters, estado: "cancelada" }, now)).toEqual([]);
  });
  it("o filtro de atenção exclui ações completas", () => {
    expect(filterManagedAcoes([complete, { ...complete, local: "" }], { pesquisa: "", tipo: "todos", projeto: "todos", estado: "todos", periodo: "todos", atencao: true }, now)).toHaveLength(1);
  });
});