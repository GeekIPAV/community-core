import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ESTADOS_RELATORIO,
  TIPOS_RELATORIO,
  estadoColor,
  type Relatorio,
  type RelatorioEstado,
} from "@/lib/relatorios/types";
import { RelatorioNovoSheet } from "@/components/relatorios/relatorio-novo-sheet";

export const Route = createFileRoute("/_app/_admin/relatorios/")({
  component: RelatoriosListPage,
});

type Row = Relatorio & { projeto_nome: string | null; criador_nome: string | null };

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-PT") : "—";

const periodoFmt = (a: string, b: string) =>
  `${new Date(a).toLocaleDateString("pt-PT", { month: "short", year: "numeric" })} → ${new Date(b).toLocaleDateString("pt-PT", { month: "short", year: "numeric" })}`;

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const diff = (new Date(d).getTime() - Date.now()) / 86400000;
  return Math.ceil(diff);
}

function RelatoriosListPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: relatorios, isLoading } = useQuery({
    queryKey: ["relatorios"],
    queryFn: async () => {
      const { data: rels, error } = await supabase
        .from("relatorios" as any)
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const arr = (rels ?? []) as unknown as Relatorio[];

      const projIds = Array.from(new Set(arr.map((r) => r.projeto_id).filter(Boolean) as string[]));
      const pessoaIds = Array.from(new Set(arr.map((r) => r.criado_por_id).filter(Boolean) as string[]));
      const [pj, ps] = await Promise.all([
        projIds.length
          ? supabase.from("projetos").select("id, nome").in("id", projIds)
          : Promise.resolve({ data: [] as any[] }),
        pessoaIds.length
          ? supabase.from("pessoas").select("id, nome_completo").in("id", pessoaIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const pjMap = new Map<string, string>(((pj as any).data ?? []).map((p: any) => [p.id, p.nome]));
      const psMap = new Map<string, string>(((ps as any).data ?? []).map((p: any) => [p.id, p.nome_completo]));
      return arr.map<Row>((r) => ({
        ...r,
        projeto_nome: r.projeto_id ? pjMap.get(r.projeto_id) ?? null : null,
        criador_nome: r.criado_por_id ? psMap.get(r.criado_por_id) ?? null : null,
      }));
    },
  });

  const stats = useMemo(() => {
    const arr = relatorios ?? [];
    const today = new Date();
    const in14 = new Date(today.getTime() + 14 * 86400000);
    const yyyy = today.getFullYear();
    return {
      rascunhos: arr.filter((r) => r.estado === "Rascunho").length,
      revisao: arr.filter((r) => r.estado === "Em revisão").length,
      a_submeter: arr.filter((r) => r.data_submissao_prevista && new Date(r.data_submissao_prevista) <= in14 && r.estado !== "Submetido").length,
      submetidos: arr.filter((r) => r.estado === "Submetido" && r.data_submissao_real && new Date(r.data_submissao_real).getFullYear() === yyyy).length,
    };
  }, [relatorios]);

  const proximosUrgentes = useMemo(() => {
    if (!relatorios) return [];
    const limit = new Date(Date.now() + 7 * 86400000);
    return relatorios.filter(
      (r) => r.estado !== "Submetido" && r.data_submissao_prevista && new Date(r.data_submissao_prevista) <= limit,
    );
  }, [relatorios]);

  const financiadores = useMemo(
    () => Array.from(new Set((relatorios ?? []).map((r) => r.financiador).filter(Boolean))).sort(),
    [relatorios],
  );

  const projetosOpts = useMemo(
    () => Array.from(new Set((relatorios ?? []).map((r) => r.projeto_nome).filter(Boolean) as string[])).sort(),
    [relatorios],
  );

  const columns = useMemo<SmartColumnDef<Row>[]>(() => [
    {
      id: "titulo", accessorKey: "titulo", header: "Título", size: 280,
      meta: { label: "Título", filterVariant: "text" },
      cell: ({ row }) => <span className="font-medium">{row.original.titulo}</span>,
    },
    {
      id: "financiador", accessorKey: "financiador", header: "Financiador", size: 180,
      meta: { label: "Financiador", filterVariant: "select", filterOptions: financiadores },
      cell: ({ getValue }) => <span className="font-semibold text-sm">{String(getValue() ?? "")}</span>,
    },
    {
      id: "projeto", accessorFn: (r) => r.projeto_nome ?? "", header: "Projeto", size: 160,
      meta: { label: "Projeto", filterVariant: "select", filterOptions: projetosOpts },
      cell: ({ row }) =>
        row.original.projeto_nome
          ? <Badge variant="outline" className="font-normal">{row.original.projeto_nome}</Badge>
          : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      id: "tipo", accessorKey: "tipo", header: "Tipo", size: 110,
      meta: { label: "Tipo", filterVariant: "select", filterOptions: TIPOS_RELATORIO as unknown as string[] },
      cell: ({ getValue }) => <Badge variant="secondary" className="font-normal">{String(getValue())}</Badge>,
    },
    {
      id: "periodo", header: "Período", size: 170, enableSorting: false,
      accessorFn: (r) => `${r.periodo_inicio}|${r.periodo_fim}`,
      meta: { label: "Período" },
      cell: ({ row }) => <span className="text-xs">{periodoFmt(row.original.periodo_inicio, row.original.periodo_fim)}</span>,
    },
    {
      id: "estado", accessorKey: "estado", header: "Estado", size: 130,
      meta: { label: "Estado", filterVariant: "select", filterOptions: ESTADOS_RELATORIO as unknown as string[] },
      cell: ({ getValue }) => {
        const v = getValue() as RelatorioEstado;
        return <span className={cn("inline-flex px-2 py-0.5 rounded-md text-xs font-medium", estadoColor[v])}>{v}</span>;
      },
    },
    {
      id: "submissao", accessorKey: "data_submissao_prevista", header: "Submissão prevista", size: 160,
      meta: { label: "Submissão prevista" },
      cell: ({ row }) => {
        const r = row.original;
        if (r.estado === "Submetido") return <span className="text-xs text-muted-foreground">Submetido {fmtDate(r.data_submissao_real)}</span>;
        const d = daysUntil(r.data_submissao_prevista);
        if (d == null) return <span className="text-xs text-muted-foreground">—</span>;
        if (d < 0) return <span className="text-xs font-semibold text-red-600">Atrasado · {Math.abs(d)}d</span>;
        if (d <= 7) return <span className="text-xs font-semibold text-amber-600">{fmtDate(r.data_submissao_prevista)} · em {d}d</span>;
        return <span className="text-xs text-muted-foreground">{fmtDate(r.data_submissao_prevista)}</span>;
      },
    },
    {
      id: "criador", accessorFn: (r) => r.criador_nome ?? "", header: "Criado por", size: 140,
      meta: { label: "Criado por", hideOnMobile: true },
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.criador_nome ?? "—"}</span>,
    },
  ], [financiadores, projetosOpts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Gera, edita e submete relatórios de impacto para financiadores.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Rascunhos" value={stats.rascunhos} />
        <StatCard label="Em revisão" value={stats.revisao} tone={stats.revisao > 0 ? "warn" : undefined} />
        <StatCard label="A submeter (14 dias)" value={stats.a_submeter} tone={stats.a_submeter > 0 ? "warn" : undefined} />
        <StatCard label="Submetidos (ano)" value={stats.submetidos} tone="ok" />
      </div>

      {proximosUrgentes.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200 dark:border-red-900">
          <AlertTriangle className="h-4 w-4" />
          <strong>{proximosUrgentes.length}</strong> relatório(s) com prazo em menos de 7 dias
        </div>
      )}

      <SmartTable
        tableId="relatorios-v1"
        columns={columns}
        data={relatorios}
        isLoading={isLoading}
        defaultGroupBy="estado"
        onRowClick={(r) => navigate({ to: "/relatorios/$id", params: { id: r.id } })}
        toolbarActions={
          <Button size="sm" onClick={() => setOpen(true)} className="h-9">
            <Plus className="me-2 h-4 w-4" /> Novo relatório
          </Button>
        }
        emptyMessage="Sem relatórios. Cria o primeiro."
      />

      <RelatorioNovoSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "warn" | "ok" }) {
  return (
    <div className={cn(
      "rounded-lg border p-3",
      tone === "warn" && "border-amber-300 bg-amber-50 dark:bg-amber-950/20",
      tone === "ok" && "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20",
    )}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}