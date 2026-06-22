import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ClipboardCopy, RefreshCw, Search } from "lucide-react";
import {
  computeKpiValue,
  ESTADO_LABELS,
  ESTADO_VARIANTS,
  FONTE_LABELS,
  normalizeKpi,
  progressColor,
  type Estado,
  type Fonte,
  type Kpi,
} from "@/lib/kpi";

type IndicadoresSearch = {
  projeto?: string;
  estado?: Estado;
  fonte?: Fonte;
  q?: string;
  financiamento?: string;
};

const ESTADOS_VALIDOS: Estado[] = ["por_iniciar", "em_execucao", "concluido"];
const FONTES_VALIDAS: Fonte[] = [
  "acoes",
  "atividades",
  "participantes",
  "manual",
  "inscricoes",
  "auto_total_unicos",
];

export const Route = createFileRoute("/_app/_admin/indicadores")({
  validateSearch: (raw: Record<string, unknown>): IndicadoresSearch => {
    const out: IndicadoresSearch = {};
    if (typeof raw.projeto === "string" && raw.projeto) out.projeto = raw.projeto;
    if (typeof raw.estado === "string" && (ESTADOS_VALIDOS as string[]).includes(raw.estado))
      out.estado = raw.estado as Estado;
    if (typeof raw.fonte === "string" && (FONTES_VALIDAS as string[]).includes(raw.fonte))
      out.fonte = raw.fonte as Fonte;
    if (typeof raw.q === "string" && raw.q) out.q = raw.q;
    if (typeof raw.financiamento === "string" && raw.financiamento) out.financiamento = raw.financiamento;
    return out;
  },
  component: IndicadoresGlobalPage,
});

type Projeto = { id: string; nome: string };
type KpiWithProjeto = Kpi & { projeto_nome: string };

function IndicadoresGlobalPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();

  const setSearch = (patch: Partial<IndicadoresSearch>) =>
    navigate({ search: (prev: IndicadoresSearch) => ({ ...prev, ...patch }) });

  const { data: projetos } = useQuery({
    queryKey: ["projetos-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as Projeto[];
    },
  });

  const { data: financiamentos } = useQuery({
    queryKey: ["financiamentos-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financiamentos" as any)
        .select("id, nome, financiador, data_inicio, data_fim, valor_total, estado")
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as unknown) as {
        id: string;
        nome: string;
        financiador: string;
        data_inicio: string | null;
        data_fim: string | null;
        valor_total: number | null;
        estado: string;
      }[];
    },
  });

  const { data: financiamentoLinks } = useQuery({
    queryKey: ["financiamento-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financiamento_indicadores" as any)
        .select("financiamento_id, indicador_id");
      if (error) throw error;
      return ((data ?? []) as unknown) as {
        financiamento_id: string;
        indicador_id: string;
      }[];
    },
  });

  const financiamentoSelecionado = useMemo(
    () => (financiamentos ?? []).find((f) => f.id === search.financiamento) ?? null,
    [financiamentos, search.financiamento],
  );

  const idsDoFinanciamento = useMemo(() => {
    if (!search.financiamento) return null;
    return new Set(
      (financiamentoLinks ?? [])
        .filter((l) => l.financiamento_id === search.financiamento)
        .map((l) => l.indicador_id),
    );
  }, [financiamentoLinks, search.financiamento]);

  const { data: kpis, isLoading } = useQuery({
    queryKey: ["indicadores-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_kpis")
        .select("*, projetos!inner(id, nome)")
        .order("projeto_id")
        .order("position");
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...normalizeKpi(r),
        projeto_nome: r.projetos?.nome ?? "—",
      })) as KpiWithProjeto[];
    },
  });

  // Filtered list
  const filtered = useMemo(() => {
    const q = (search.q ?? "").trim().toLowerCase();
    return (kpis ?? []).filter((k) => {
      if (search.projeto && k.projeto_id !== search.projeto) return false;
      if (search.estado && k.estado !== search.estado) return false;
      if (search.fonte && k.fonte !== search.fonte) return false;
      if (q && !k.nome.toLowerCase().includes(q)) return false;
      if (idsDoFinanciamento && !idsDoFinanciamento.has(k.id)) return false;
      return true;
    });
  }, [kpis, search.projeto, search.estado, search.fonte, search.q, idsDoFinanciamento]);

  // Computed values
  const [values, setValues] = useState<Record<string, number>>({});
  const handleComputed = (id: string, v: number) =>
    setValues((p) => (p[id] === v ? p : { ...p, [id]: v }));
  const valorAtual = (k: Kpi) =>
    k.fonte === "manual" ? Number(k.valor_manual ?? 0) : values[k.id] ?? 0;

  // Summary (across filtered set)
  const total = filtered.length;
  const emExec = filtered.filter((k) => k.estado === "em_execucao").length;
  const concluidos = filtered.filter((k) => k.estado === "concluido").length;
  const pctMedia =
    total === 0
      ? 0
      : Math.round(
          filtered.reduce((acc, k) => {
            const v = valorAtual(k);
            const p = k.meta > 0 ? Math.min(100, (v / k.meta) * 100) : 0;
            return acc + p;
          }, 0) / total,
        );

  // Group by projeto for export
  const groupedForExport = useMemo(() => {
    const map = new Map<string, { nome: string; kpis: KpiWithProjeto[] }>();
    for (const k of filtered) {
      const cur = map.get(k.projeto_id) ?? { nome: k.projeto_nome, kpis: [] };
      cur.kpis.push(k);
      map.set(k.projeto_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  }, [filtered]);

  const exportar = () => {
    const lines: string[] = [];
    lines.push("═════════════════════════════");
    lines.push("RELATÓRIO M&A — MEERU");
    lines.push(`Exportado em ${new Date().toLocaleDateString("pt-PT")}`);
    lines.push("═════════════════════════════");
    lines.push(`Resumo: ${total} indicadores · ${emExec} em execução · ${concluidos} concluídos · ${pctMedia}% média`);
    lines.push("");
    for (const g of groupedForExport) {
      lines.push(`── ${g.nome.toUpperCase()} ──`);
      lines.push("");
      for (const k of g.kpis) {
        const v = valorAtual(k);
        const pct = k.meta > 0 ? Math.min(100, Math.round((v / k.meta) * 100)) : 0;
        const full = Math.round((pct / 100) * 10);
        const bar = "█".repeat(full) + "░".repeat(10 - full);
        lines.push(k.nome);
        lines.push(`Estado: ${ESTADO_LABELS[k.estado]}`);
        lines.push(`Meta: ${k.meta} ${k.unidade}`);
        lines.push(`Valor atual: ${v} ${k.unidade} (${pct}%)`);
        lines.push(`${bar} ${pct}%`);
        lines.push("Narrativa: " + (k.narrativa?.trim() || "(sem narrativa)"));
        lines.push("");
      }
      lines.push("");
    }
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Relatório copiado para a área de transferência ✓");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Indicadores M&amp;A</h1>
          <p className="text-sm text-muted-foreground">
            Vista global dos indicadores de monitorização e avaliação em todos os projetos.
          </p>
        </div>
        <Button variant="outline" onClick={exportar} disabled={total === 0}>
          <ClipboardCopy className="me-2 h-4 w-4" /> Exportar relatório
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Total indicadores" value={total} />
        <StatCard label="Em execução" value={emExec} />
        <StatCard label="Concluídos" value={concluidos} />
        <StatCard label="% média execução" value={pctMedia} suffix="%" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search.q ?? ""}
            onChange={(e) => setSearch({ q: e.target.value || undefined })}
            placeholder="Pesquisar indicador…"
            className="ps-8"
          />
        </div>
        <Select
          value={search.projeto ?? "__all__"}
          onValueChange={(v) => setSearch({ projeto: v === "__all__" ? undefined : v })}
        >
          <SelectTrigger className="w-56"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os projetos</SelectItem>
            {(projetos ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.estado ?? "__all__"}
          onValueChange={(v) => setSearch({ estado: v === "__all__" ? undefined : (v as Estado) })}
        >
          <SelectTrigger className="w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os estados</SelectItem>
            <SelectItem value="por_iniciar">Por iniciar</SelectItem>
            <SelectItem value="em_execucao">Em execução</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={search.fonte ?? "__all__"}
          onValueChange={(v) => setSearch({ fonte: v === "__all__" ? undefined : (v as Fonte) })}
        >
          <SelectTrigger className="w-44"><SelectValue placeholder="Fonte" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as fontes</SelectItem>
            {Object.entries(FONTE_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search.projeto || search.estado || search.fonte || search.q) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ search: {} })}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
          Sem indicadores correspondentes aos filtros.
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Indicador</TableHead>
                <TableHead className="w-32">Estado</TableHead>
                <TableHead className="w-24 text-right">Meta</TableHead>
                <TableHead className="w-32 text-right">Valor</TableHead>
                <TableHead className="w-48">Progresso</TableHead>
                <TableHead className="w-32">Fonte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((k) => (
                <KpiGlobalRow key={k.id} kpi={k} onCompute={handleComputed} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {value}{suffix ?? ""}
      </p>
    </div>
  );
}

function KpiGlobalRow({
  kpi,
  onCompute,
}: {
  kpi: KpiWithProjeto;
  onCompute: (id: string, value: number) => void;
}) {
  const { data: computed } = useQuery({
    queryKey: ["kpi-value-global", kpi.id, kpi.fonte, kpi.filtro, kpi.projeto_id],
    queryFn: () => computeKpiValue(kpi, kpi.projeto_id),
  });
  const v = kpi.fonte === "manual" ? Number(kpi.valor_manual ?? 0) : computed ?? 0;

  useEffect(() => {
    if (computed != null) onCompute(kpi.id, computed);
  }, [computed, kpi.id, onCompute]);

  const pct = kpi.meta > 0 ? Math.min(100, Math.round((v / kpi.meta) * 100)) : 0;
  const color = progressColor(pct);

  return (
    <TableRow>
      <TableCell>
        <Link
          to="/projetos/$projetoId"
          params={{ projetoId: kpi.projeto_id }}
          className="text-sm font-medium hover:underline"
        >
          {kpi.projeto_nome}
        </Link>
      </TableCell>
      <TableCell className="text-sm">
        {kpi.nome}
        {kpi.narrativa && (
          <p className="text-xs text-muted-foreground truncate max-w-md" title={kpi.narrativa}>
            {kpi.narrativa}
          </p>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={ESTADO_VARIANTS[kpi.estado]} className="font-normal">
          {ESTADO_LABELS[kpi.estado]}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">{kpi.meta}</TableCell>
      <TableCell className="text-right tabular-nums">
        {kpi.fonte === "manual" ? (
          v
        ) : (
          <span title="Calculado automaticamente" className="inline-flex items-center gap-1 text-muted-foreground">
            {v}
            <RefreshCw className="h-3 w-3 opacity-60" />
          </span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs tabular-nums w-9 text-right">{pct}%</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{FONTE_LABELS[kpi.fonte]}</Badge>
      </TableCell>
    </TableRow>
  );
}