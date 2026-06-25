export type CidadeBolsa = { id: string; nome: string; valor_sentido: number; ativo: boolean };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A cidade da pessoa "casa" com uma cidade da tabela se algum alias
// (separado por "/" ou ",") for substring da residência (ou vice-versa).
export function matchCidade(cidadeResidencia: string | null | undefined, cidades: CidadeBolsa[]): CidadeBolsa | null {
  if (!cidadeResidencia) return null;
  const residencia = normalize(cidadeResidencia);
  if (!residencia) return null;
  for (const c of cidades) {
    if (!c.ativo) continue;
    const aliases = c.nome.split(/[\/,]/).map((a) => normalize(a)).filter(Boolean);
    for (const alias of aliases) {
      if (residencia === alias || residencia.includes(alias) || alias.includes(residencia)) {
        return c;
      }
    }
  }
  return null;
}

export function formatEuro(v: number): string {
  return `${v.toFixed(2).replace(".", ",")}€`;
}

// Valor pago por km percorrido com viatura própria (por sentido).
export const KM_RATE = 0.36;
// As bolsas são calculadas para ida e volta.
export const TRIP_FACTOR = 2;

export type ViaturaInfo = {
  viatura_propria?: boolean;
  viatura_km?: number | string | null;
  viatura_grupo?: string | null;
};

export function parseViatura(valores: any): ViaturaInfo {
  if (!valores || typeof valores !== "object") return {};
  const km = valores._viatura_km;
  const kmNum = typeof km === "number" ? km : km != null ? Number(String(km).replace(",", ".")) : NaN;
  return {
    viatura_propria: !!valores._viatura_propria,
    viatura_km: Number.isFinite(kmNum) ? kmNum : null,
    viatura_grupo: valores._viatura_grupo ? String(valores._viatura_grupo) : null,
  };
}

export function normalizeGrupo(s: string | null | undefined): string {
  return (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}