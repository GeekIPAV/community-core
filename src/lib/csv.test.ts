import { describe, it, expect } from "vitest";
import { toCSV } from "./csv";

describe("toCSV", () => {
  it("devolve string vazia para lista vazia sem colunas", () => {
    expect(toCSV([])).toBe("");
  });

  it("devolve só o cabeçalho para lista vazia com colunas", () => {
    expect(toCSV([], ["nome", "email"])).toBe("nome,email");
  });

  it("gera cabeçalho a partir das chaves da primeira linha", () => {
    const csv = toCSV([{ nome: "Ana", km: 12 }]);
    expect(csv).toBe("nome,km\nAna,12");
  });

  it("respeita a ordem e o subconjunto de colunas indicado", () => {
    const csv = toCSV([{ nome: "Ana", km: 12, extra: "x" }], ["km", "nome"]);
    expect(csv).toBe("km,nome\n12,Ana");
  });

  it("escapa vírgulas, aspas e quebras de linha", () => {
    const csv = toCSV([
      { campo: "Porto, Portugal" },
      { campo: 'diz "olá"' },
      { campo: "linha1\nlinha2" },
    ]);
    expect(csv).toBe(
      'campo\n"Porto, Portugal"\n"diz ""olá"""\n"linha1\nlinha2"',
    );
  });

  it("trata null e undefined como campo vazio", () => {
    const csv = toCSV([{ a: null, b: undefined, c: 0 }]);
    expect(csv).toBe("a,b,c\n,,0");
  });

  it("preenche vazio quando uma linha não tem a coluna", () => {
    const csv = toCSV([{ a: 1, b: 2 }, { a: 3 }], ["a", "b"]);
    expect(csv).toBe("a,b\n1,2\n3,");
  });
});
