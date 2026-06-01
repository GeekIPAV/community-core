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