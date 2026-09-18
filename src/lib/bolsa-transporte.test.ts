import { describe, it, expect } from "vitest";
import {
  KM_RATE,
  TRIP_FACTOR,
  matchCidade,
  parseViatura,
  formatEuro,
  normalizeGrupo,
  type CidadeBolsa,
} from "./bolsa-transporte";

const cidade = (nome: string, valor_sentido: number, ativo = true): CidadeBolsa => ({
  id: nome,
  nome,
  valor_sentido,
  ativo,
});

// Fórmula usada nas páginas de bolsa: km × taxa × ida e volta, arredondado a cêntimos.
const valorViatura = (km: number) => Math.round(km * KM_RATE * TRIP_FACTOR * 100) / 100;
const valorCidade = (c: CidadeBolsa | null) =>
  c ? Math.round(c.valor_sentido * TRIP_FACTOR * 100) / 100 : 0;

describe("constantes", () => {
  it("mantém a taxa por km e o fator de ida e volta", () => {
    expect(KM_RATE).toBe(0.36);
    expect(TRIP_FACTOR).toBe(2);
  });
});

describe("cálculo do valor da bolsa", () => {
  it("calcula o valor de uma distância típica (ida e volta)", () => {
    expect(valorViatura(50)).toBe(36);
  });

  it("arredonda a cêntimos", () => {
    // 12.345 * 0.36 * 2 = 8.8884 → 8.89
    expect(valorViatura(12.345)).toBe(8.89);
  });

  it("devolve 0 para 0 km", () => {
    expect(valorViatura(0)).toBe(0);
  });

  it("devolve 0 quando não há cidade correspondente", () => {
    expect(valorCidade(null)).toBe(0);
  });

  it("duplica o valor por sentido da cidade", () => {
    expect(valorCidade(cidade("Porto", 3.7))).toBe(7.4);
  });
});

describe("matchCidade", () => {
  const cidades = [
    cidade("Porto", 3.7),
    cidade("Vila Nova de Gaia/Gaia", 4.1),
    cidade("Braga", 6, false),
  ];

  it("faz correspondência exata ignorando acentos e maiúsculas", () => {
    expect(matchCidade("PÔRTO", cidades)?.nome).toBe("Porto");
  });

  it("faz correspondência por alias separado por barra", () => {
    expect(matchCidade("Gaia", cidades)?.nome).toBe("Vila Nova de Gaia/Gaia");
  });

  it("ignora cidades inativas", () => {
    expect(matchCidade("Braga", cidades)).toBeNull();
  });

  it("devolve null para residência vazia ou desconhecida", () => {
    expect(matchCidade(null, cidades)).toBeNull();
    expect(matchCidade("   ", cidades)).toBeNull();
    expect(matchCidade("Lisboa", cidades)).toBeNull();
  });
});

describe("parseViatura", () => {
  it("devolve objeto vazio para valores inválidos", () => {
    expect(parseViatura(null)).toEqual({});
    expect(parseViatura("texto")).toEqual({});
  });

  it("lê km numéricos e o grupo", () => {
    expect(parseViatura({ _viatura_propria: true, _viatura_km: 30, _viatura_grupo: "a1" })).toEqual({
      viatura_propria: true,
      viatura_km: 30,
      viatura_grupo: "a1",
    });
  });

  it("aceita km com vírgula decimal em texto", () => {
    expect(parseViatura({ _viatura_km: "12,5" }).viatura_km).toBe(12.5);
  });

  it("devolve km nulo quando o valor não é numérico", () => {
    expect(parseViatura({ _viatura_km: "abc" }).viatura_km).toBeNull();
    expect(parseViatura({}).viatura_km).toBeNull();
  });
});

describe("formatEuro", () => {
  it("formata com duas casas decimais e vírgula", () => {
    expect(formatEuro(7.4)).toBe("7,40€");
    expect(formatEuro(0)).toBe("0,00€");
    expect(formatEuro(0.365)).toBe("0,37€");
  });
});

describe("normalizeGrupo", () => {
  it("põe em maiúsculas e remove separadores", () => {
    expect(normalizeGrupo(" grupo-a 1 ")).toBe("GRUPOA1");
  });

  it("devolve vazio para null ou undefined", () => {
    expect(normalizeGrupo(null)).toBe("");
    expect(normalizeGrupo(undefined)).toBe("");
  });
});
