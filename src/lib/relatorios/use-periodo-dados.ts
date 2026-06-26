import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PeriodoDados = {
  pessoas_total: number;
  pessoas_novas: number;
  familias_total: number;
  acoes_total: number;
  inscricoes_total: number;
  participantes_unicos: number;
  casos_abertos: number;
  casos_concluidos: number;
  por_projeto: { id: string; nome: string; count: number }[];
  por_nacionalidade: { nome: string; count: number }[];
  por_area_caso: { nome: string; count: number }[];
};

export function periodoQueryKey(
  inicio: string | null | undefined,
  fim: string | null | undefined,
  projetoIds?: string[] | null,
) {
  return ["relatorio-periodo", inicio ?? "", fim ?? "", (projetoIds ?? []).slice().sort().join(",")];
}

export function useRelatorioPeriodData(
  inicio: string | null | undefined,
  fim: string | null | undefined,
  projetoIds?: string[] | null,
) {
  return useQuery({
    queryKey: periodoQueryKey(inicio, fim, projetoIds),
    enabled: !!inicio && !!fim,
    queryFn: () => fetchPeriodoDados(inicio!, fim!, projetoIds ?? null),
  });
}

export async function fetchPeriodoDados(
  inicio: string,
  fim: string,
  projetoIds: string[] | null,
): Promise<PeriodoDados> {
  const projFilter = projetoIds && projetoIds.length > 0 ? projetoIds : null;

  // Ações no período
  let acoesQ = supabase
    .from("acoes")
    .select("id, nome, projeto_ids, data_inicio")
    .gte("data_inicio", inicio)
    .lte("data_inicio", fim);
  if (projFilter) acoesQ = acoesQ.overlaps("projeto_ids", projFilter);
  const { data: acoes } = await acoesQ;
  const acaoIds = (acoes ?? []).map((a: any) => a.id);

  // Inscrições nestas ações
  let inscricoes: { pessoa_id: string; acao_id: string }[] = [];
  if (acaoIds.length > 0) {
    const { data } = await supabase
      .from("inscricoes")
      .select("pessoa_id, acao_id, status")
      .in("acao_id", acaoIds)
      .neq("status", "cancelada");
    inscricoes = (data ?? []) as any[];
  }

  const participantesSet = new Set(inscricoes.map((i) => i.pessoa_id));

  // Pessoas novas no período
  const { count: pessoasNovas } = await supabase
    .from("pessoas")
    .select("id", { count: "exact", head: true })
    .eq("status", "ativo")
    .gte("created_at", inicio)
    .lte("created_at", `${fim}T23:59:59`);

  // Total pessoas (filtradas por projeto se aplicável)
  let pessoasTotalQ = supabase
    .from("pessoas")
    .select("id", { count: "exact", head: true })
    .eq("status", "ativo");
  if (projFilter) pessoasTotalQ = pessoasTotalQ.overlaps("projeto_ids", projFilter);
  const { count: pessoasTotal } = await pessoasTotalQ;

  const { count: familiasTotal } = await supabase
    .from("familias")
    .select("id", { count: "exact", head: true });

  // Casos
  const { data: casos } = await supabase
    .from("casos_apoio" as any)
    .select("id, area, estado, data_abertura")
    .gte("data_abertura", inicio)
    .lte("data_abertura", fim);
  const casosArr = (casos ?? []) as any[];
  const casosAbertos = casosArr.length;
  const casosConcluidos = casosArr.filter((c) => c.estado === "Concluído" || c.estado === "Encerrado").length;

  // Breakdown por projeto (de ações)
  const projCount = new Map<string, number>();
  for (const a of (acoes ?? []) as any[]) {
    for (const pid of (a.projeto_ids ?? [])) {
      projCount.set(pid, (projCount.get(pid) ?? 0) + 1);
    }
  }
  let porProjeto: PeriodoDados["por_projeto"] = [];
  if (projCount.size > 0) {
    const { data: projs } = await supabase
      .from("projetos")
      .select("id, nome")
      .in("id", Array.from(projCount.keys()));
    porProjeto = ((projs ?? []) as any[]).map((p) => ({ id: p.id, nome: p.nome, count: projCount.get(p.id) ?? 0 }));
    porProjeto.sort((a, b) => b.count - a.count);
  }

  // Breakdown por nacionalidade (entre participantes únicos do período)
  let porNacionalidade: PeriodoDados["por_nacionalidade"] = [];
  const pessoaIds = Array.from(participantesSet);
  if (pessoaIds.length > 0) {
    const { data: ps } = await supabase
      .from("pessoas")
      .select("nacionalidade")
      .in("id", pessoaIds);
    const counts = new Map<string, number>();
    for (const p of (ps ?? []) as any[]) {
      const n = (p.nacionalidade ?? "").trim() || "(sem dados)";
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    porNacionalidade = Array.from(counts.entries())
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  // Por área de caso
  const areaCount = new Map<string, number>();
  for (const c of casosArr) {
    const a = (c.area ?? "").trim() || "(sem área)";
    areaCount.set(a, (areaCount.get(a) ?? 0) + 1);
  }
  const porAreaCaso = Array.from(areaCount.entries())
    .map(([nome, count]) => ({ nome, count }))
    .sort((a, b) => b.count - a.count);

  return {
    pessoas_total: pessoasTotal ?? 0,
    pessoas_novas: pessoasNovas ?? 0,
    familias_total: familiasTotal ?? 0,
    acoes_total: (acoes ?? []).length,
    inscricoes_total: inscricoes.length,
    participantes_unicos: participantesSet.size,
    casos_abertos: casosAbertos,
    casos_concluidos: casosConcluidos,
    por_projeto: porProjeto,
    por_nacionalidade: porNacionalidade,
    por_area_caso: porAreaCaso,
  };
}