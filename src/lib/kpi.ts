import { supabase } from "@/integrations/supabase/client";

export type Fonte =
  | "acoes"
  | "atividades"
  | "participantes"
  | "manual"
  | "inscricoes"
  | "auto_total_unicos";
export type Estado = "por_iniciar" | "em_execucao" | "concluido";
export type KpiFiltro = {
  imigrante?: boolean;
  voluntario?: boolean;
  mulheres?: boolean;
  regular?: number;
  categoria?: string;
  projeto_ids?: string[];
};
export type Kpi = {
  id: string;
  projeto_id: string;
  nome: string;
  meta: number;
  unidade: string;
  fonte: Fonte;
  filtro: KpiFiltro;
  estado: Estado;
  narrativa: string | null;
  valor_manual: number | null;
  position: number;
};

export const CATEGORIAS_ACAO: { value: string; label: string }[] = [
  { value: "workshop", label: "Workshop" },
  { value: "jantar", label: "Jantar de Proximidade" },
  { value: "intercultural", label: "Evento Intercultural" },
  { value: "evento_comunitario", label: "Evento Comunitário" },
  { value: "mediacao", label: "Mediação / Encaminhamento" },
  { value: "mca", label: "MEERU Convida Amigos" },
  { value: "outro", label: "Outro" },
];
export const categoriaLabel = (v: string | null | undefined) =>
  CATEGORIAS_ACAO.find((c) => c.value === v)?.label ?? "—";

export const ESTADO_LABELS: Record<Estado, string> = {
  por_iniciar: "Por iniciar",
  em_execucao: "Em execução",
  concluido: "Concluído",
};
export const ESTADO_VARIANTS: Record<Estado, "secondary" | "default" | "outline"> = {
  por_iniciar: "outline",
  em_execucao: "secondary",
  concluido: "default",
};

export const FONTE_LABELS: Record<Fonte, string> = {
  acoes: "Ações",
  atividades: "Atividades",
  participantes: "Participantes",
  manual: "Manual",
  inscricoes: "Inscrições",
  auto_total_unicos: "Total únicos",
};

export function progressColor(pct: number): string {
  if (pct > 70) return "bg-emerald-500";
  if (pct >= 30) return "bg-amber-500";
  return "bg-red-500";
}

/** Compute current KPI value by fonte + filtro. Uses the current Supabase client (RLS as user). */
export async function computeKpiValue(kpi: Kpi, projetoId: string): Promise<number> {
  const f = kpi.filtro ?? {};
  if (kpi.fonte === "manual") return Number(kpi.valor_manual ?? 0);

  if (kpi.fonte === "acoes") {
    let q = supabase
      .from("acoes")
      .select("id", { count: "exact", head: true })
      .contains("projeto_ids", [projetoId]);
    if (f.categoria) q = q.eq("categoria", f.categoria);
    const { count } = await q;
    return count ?? 0;
  }

  if (kpi.fonte === "inscricoes") {
    const scope = f.projeto_ids?.length ? f.projeto_ids : [projetoId];
    let aq = supabase.from("acoes").select("id").overlaps("projeto_ids", scope);
    if (f.categoria) aq = aq.eq("categoria", f.categoria);
    const { data: acoesData } = await aq;
    const acaoIds = (acoesData ?? []).map((a: any) => a.id as string);
    if (acaoIds.length === 0) return 0;
    const { count } = await supabase
      .from("inscricoes")
      .select("id", { count: "exact", head: true })
      .in("acao_id", acaoIds)
      .neq("status", "cancelada");
    return count ?? 0;
  }

  if (kpi.fonte === "participantes") {
    let q = supabase
      .from("pessoas")
      .select("id, familia_id, genero, nacionalidade, is_voluntario")
      .contains("projeto_ids", [projetoId])
      .eq("status", "ativo");
    if (f.voluntario) q = q.eq("is_voluntario", true);
    if (f.mulheres) q = q.eq("genero", "Feminino");
    if (f.imigrante) {
      q = q
        .not("nacionalidade", "is", null)
        .neq("nacionalidade", "")
        .not("nacionalidade", "ilike", "Portugu%");
    }
    const { data: pessoasData } = await q;
    const pessoas = (pessoasData ?? []) as any[];
    if (!f.regular || f.regular <= 0) return pessoas.length;
    const famIds = Array.from(new Set(pessoas.map((p) => p.familia_id).filter(Boolean)));
    if (famIds.length === 0) return 0;
    const { data: ativData } = await supabase
      .from("familia_atividades")
      .select("familia_id")
      .in("familia_id", famIds);
    const counts = new Map<string, number>();
    for (const r of (ativData ?? []) as any[]) {
      counts.set(r.familia_id, (counts.get(r.familia_id) ?? 0) + 1);
    }
    const okFams = new Set(
      Array.from(counts.entries()).filter(([, c]) => c >= (f.regular ?? 0)).map(([id]) => id),
    );
    return pessoas.filter((p) => p.familia_id && okFams.has(p.familia_id)).length;
  }

  if (kpi.fonte === "atividades") {
    const { data: pessoasData } = await supabase
      .from("pessoas")
      .select("familia_id")
      .contains("projeto_ids", [projetoId])
      .eq("status", "ativo")
      .not("familia_id", "is", null);
    const famIds = Array.from(
      new Set(((pessoasData ?? []) as any[]).map((p) => p.familia_id).filter(Boolean)),
    );
    if (famIds.length === 0) return 0;
    const { count } = await supabase
      .from("familia_atividades")
      .select("id", { count: "exact", head: true })
      .in("familia_id", famIds);
    return count ?? 0;
  }

  if (kpi.fonte === "auto_total_unicos") {
    const { data: projetosData } = await supabase.from("projetos").select("id");
    const ids = ((projetosData ?? []) as any[]).map((p) => p.id);
    if (ids.length === 0) return 0;
    const { count } = await supabase
      .from("pessoas")
      .select("id", { count: "exact", head: true })
      .eq("status", "ativo")
      .overlaps("projeto_ids", ids);
    return count ?? 0;
  }

  return 0;
}

export function normalizeKpi(row: any): Kpi {
  return {
    ...row,
    filtro: (row.filtro ?? {}) as KpiFiltro,
    estado: (row.estado ?? "em_execucao") as Estado,
  } as Kpi;
}