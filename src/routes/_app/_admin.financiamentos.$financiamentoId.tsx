import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ClipboardCopy, RefreshCw, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { InlineMultiSelect } from "@/components/inline-edit";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import {
  computeKpiValue,
  ESTADO_LABELS,
  ESTADO_VARIANTS,
  normalizeKpi,
  progressColor,
  type Kpi,
} from "@/lib/kpi";
import {
  ESTADOS,
  TIPOS,
  estadoVariant,
  formatEuro,
  formatPeriodo,
  type Financiamento,
} from "./_admin.financiamentos.index";

export const Route = createFileRoute("/_app/_admin/financiamentos/$financiamentoId")({
  component: FinanciamentoDetailPage,
});

type KpiWithProjeto = Kpi & { projeto_nome: string };

function FinanciamentoDetailPage() {
  const { financiamentoId } = useParams({ from: "/_app/_admin/financiamentos/$financiamentoId" });
  const qc = useQueryClient();

  const { data: financiamento } = useQuery({
    queryKey: ["financiamento", financiamentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financiamentos" as any)
        .select("*")
        .eq("id", financiamentoId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Financiamento | null;
    },
  });

  const { data: projetosAll } = useQuery({
    queryKey: ["projetos", "lista-financiamento-detail"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const { data: projetoIds } = useQuery({
    queryKey: ["financiamento-projetos", financiamentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financiamento_projetos" as any)
        .select("projeto_id")
        .eq("financiamento_id", financiamentoId);
      if (error) throw error;
      return ((data ?? []) as unknown as { projeto_id: string }[]).map((r) => r.projeto_id);
    },
  });

  const saveProjetos = useMutation({
    mutationFn: async (ids: string[]) => {
      await supabase.from("financiamento_projetos" as any).delete().eq("financiamento_id", financiamentoId);
      if (ids.length > 0) {
        const { error } = await supabase
          .from("financiamento_projetos" as any)
          .insert(ids.map((pid) => ({ financiamento_id: financiamentoId, projeto_id: pid })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Projetos atualizados");
      qc.invalidateQueries({ queryKey: ["financiamento-projetos", financiamentoId] });
      qc.invalidateQueries({ queryKey: ["financiamentos"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const { data: indicadores } = useQuery({
    queryKey: ["financiamento-kpis", financiamentoId],
    queryFn: async () => {
      const { data: links, error: e1 } = await supabase
        .from("financiamento_indicadores" as any)
        .select("indicador_id")
        .eq("financiamento_id", financiamentoId);
      if (e1) throw e1;
      const ids = ((links ?? []) as any[]).map((l) => l.indicador_id as string);
      if (ids.length === 0) return [] as KpiWithProjeto[];
      const { data, error } = await supabase
        .from("projeto_kpis")
        .select("*, projetos!inner(id, nome)")
        .in("id", ids);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...normalizeKpi(r),
        projeto_nome: r.projetos?.nome ?? "—",
      })) as KpiWithProjeto[];
    },
  });

  const [values, setValues] = useState<Record<string, number>>({});
  const handleComputed = (id: string, v: number) =>
    setValues((p) => (p[id] === v ? p : { ...p, [id]: v }));

  const valorAtual = (k: Kpi) =>
    k.fonte === "manual" ? Number(k.valor_manual ?? 0) : values[k.id] ?? 0;

  const list = indicadores ?? [];
  const total = list.length;
  const pctGlobal = useMemo(() => {
    if (total === 0) return 0;
    const sum = list.reduce((acc, k) => {
      const v = valorAtual(k);
      const p = k.meta > 0 ? Math.min(100, (v / k.meta) * 100) : 0;
      return acc + p;
    }, 0);
    return Math.round(sum / total);
  }, [list, values]);

  const chartData = list.map((k) => {
    const v = valorAtual(k);
    const pct = k.meta > 0 ? Math.min(100, Math.round((v / k.meta) * 100)) : 0;
    return { nome: k.nome.length > 28 ? k.nome.slice(0, 28) + "…" : k.nome, pct, fill: pctColor(pct) };
  });

  const update = useMutation({
    mutationFn: async (payload: Partial<Financiamento>) => {
      const { error } = await supabase
        .from("financiamentos" as any)
        .update(payload as any)
        .eq("id", financiamentoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: ["financiamento", financiamentoId] });
      qc.invalidateQueries({ queryKey: ["financiamentos"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const removeLink = useMutation({
    mutationFn: async (indicador_id: string) => {
      const { error } = await supabase
        .from("financiamento_indicadores" as any)
        .delete()
        .eq("financiamento_id", financiamentoId)
        .eq("indicador_id", indicador_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financiamento-kpis", financiamentoId] }),
  });

  const exportar = () => {
    if (!financiamento) return;
    const lines: string[] = [];
    lines.push("═════════════════════════════════════");
    lines.push(`RELATÓRIO — ${financiamento.nome.toUpperCase()}`);
    lines.push(`Financiador: ${financiamento.financiador}`);
    lines.push(`Período: ${formatPeriodo(financiamento.data_inicio, financiamento.data_fim)}`);
    lines.push(`Valor total: ${formatEuro(financiamento.valor_total)}`);
    lines.push(`Estado: ${financiamento.estado}`);
    lines.push(`Exportado em: ${new Date().toLocaleDateString("pt-PT")}`);
    lines.push("═════════════════════════════════════");
    lines.push(`Execução global: ${pctGlobal}% (${total} indicadores)`);
    lines.push("");
    for (const k of list) {
      const v = valorAtual(k);
      const pct = k.meta > 0 ? Math.min(100, Math.round((v / k.meta) * 100)) : 0;
      const full = Math.round((pct / 100) * 10);
      const bar = "█".repeat(full) + "░".repeat(10 - full);
      lines.push(`— ${k.nome}`);
      lines.push(`  Projeto: ${k.projeto_nome}`);
      lines.push(`  Estado: ${ESTADO_LABELS[k.estado]}`);
      lines.push(`  Meta: ${k.meta} ${k.unidade}`);
      lines.push(`  Valor atual: ${v} ${k.unidade} (${pct}%)`);
      lines.push(`  ${bar} ${pct}%`);
      lines.push(`  Narrativa: ${k.narrativa?.trim() || "(sem narrativa)"}`);
      lines.push("");
    }
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success(`Relatório copiado para ${financiamento.financiador} ✓`);
  };

  if (!financiamento) {
    return <div className="text-sm text-muted-foreground">A carregar…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/financiamentos">
            <ArrowLeft className="me-1 h-4 w-4" /> Financiamentos
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{financiamento.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {financiamento.financiador} · {formatPeriodo(financiamento.data_inicio, financiamento.data_fim)}
          </p>
        </div>
        <Button onClick={exportar} disabled={total === 0}>
          <ClipboardCopy className="me-2 h-4 w-4" />
          Exportar relatório para {financiamento.financiador}
        </Button>
      </div>

      {/* General data – inline editable */}
      <div className="rounded-md border p-4 grid gap-3 sm:grid-cols-3">
        <FieldText label="Nome" value={financiamento.nome} onSave={(v) => update.mutate({ nome: v })} />
        <FieldText label="Financiador" value={financiamento.financiador} onSave={(v) => update.mutate({ financiador: v })} />
        <FieldText label="Referência" value={financiamento.referencia ?? ""} onSave={(v) => update.mutate({ referencia: v || null })} />
        <FieldSelect label="Tipo" value={financiamento.tipo} options={TIPOS} onSave={(v) => update.mutate({ tipo: v as Financiamento["tipo"] })} />
        <FieldSelect label="Estado" value={financiamento.estado} options={ESTADOS} onSave={(v) => update.mutate({ estado: v as Financiamento["estado"] })} />
        <FieldText label="Responsável" value={financiamento.responsavel ?? ""} onSave={(v) => update.mutate({ responsavel: v || null })} />
        <FieldNumber label="Valor total (€)" value={financiamento.valor_total} onSave={(v) => update.mutate({ valor_total: v })} />
        <FieldDate label="Data início" value={financiamento.data_inicio} onSave={(v) => update.mutate({ data_inicio: v })} />
        <FieldDate label="Data fim" value={financiamento.data_fim} onSave={(v) => update.mutate({ data_fim: v })} />
        <div className="sm:col-span-3 space-y-1">
          <Label className="text-xs">Notas</Label>
          <TextareaInline value={financiamento.notas ?? ""} onSave={(v) => update.mutate({ notas: v || null })} />
        </div>
        <div className="sm:col-span-3 space-y-1">
          <Label className="text-xs">Projetos associados</Label>
          <InlineMultiSelect
            values={projetoIds ?? []}
            options={(projetosAll ?? []).map((p) => ({ value: p.id, label: p.nome }))}
            onSave={(v) => saveProjetos.mutate(v)}
            placeholder="Sem projetos"
          />
        </div>
      </div>

      {/* Extra details */}
      <div className="rounded-md border p-4 grid gap-3 sm:grid-cols-3">
        <FieldText label="Candidatura (URL)" value={financiamento.candidatura_url ?? ""} onSave={(v) => update.mutate({ candidatura_url: v || null })} />
        <FieldText label="Contrato (URL)" value={financiamento.contrato_url ?? ""} onSave={(v) => update.mutate({ contrato_url: v || null })} />
        <div className="sm:col-span-3 space-y-1">
          <Label className="text-xs">Métricas</Label>
          <TextareaInline value={financiamento.metricas ?? ""} onSave={(v) => update.mutate({ metricas: v || null })} />
        </div>
        <div className="sm:col-span-3 space-y-1">
          <Label className="text-xs">Obrigações</Label>
          <TextareaInline value={financiamento.obrigacoes ?? ""} onSave={(v) => update.mutate({ obrigacoes: v || null })} />
        </div>
        <div className="sm:col-span-3 space-y-1">
          <Label className="text-xs">Mais informações</Label>
          <TextareaInline value={financiamento.mais_informacoes ?? ""} onSave={(v) => update.mutate({ mais_informacoes: v || null })} />
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Indicadores" value={total} />
        <StatCard label="Em execução" value={list.filter((k) => k.estado === "em_execucao").length} />
        <StatCard label="Concluídos" value={list.filter((k) => k.estado === "concluido").length} />
        <StatCard label="% execução global" value={pctGlobal} suffix="%" />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-md border p-4">
          <p className="text-sm font-medium mb-3">Execução por indicador (%)</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="nome" width={180} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Bar dataKey="pct">
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Indicators list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Indicadores associados</h2>
          <AdicionarIndicadorDialog
            financiamentoId={financiamentoId}
            existingIds={list.map((k) => k.id)}
          />
        </div>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-48">Progresso</TableHead>
                <TableHead>Narrativa</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    Sem indicadores associados.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((k) => (
                  <KpiRow
                    key={k.id}
                    kpi={k}
                    onCompute={handleComputed}
                    onRemove={() => removeLink.mutate(k.id)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function pctColor(pct: number) {
  if (pct > 70) return "hsl(var(--primary))";
  if (pct >= 30) return "#f59e0b";
  return "#ef4444";
}

function StatCard({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {value}
        {suffix ?? ""}
      </p>
    </div>
  );
}

function KpiRow({
  kpi,
  onCompute,
  onRemove,
}: {
  kpi: KpiWithProjeto;
  onCompute: (id: string, v: number) => void;
  onRemove: () => void;
}) {
  const { data: computed } = useQuery({
    queryKey: ["kpi-value-fin", kpi.id, kpi.fonte, kpi.filtro, kpi.projeto_id],
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
      <TableCell className="text-sm font-medium">{kpi.nome}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{kpi.projeto_nome}</TableCell>
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
          <span className="inline-flex items-center gap-1 text-muted-foreground">
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
      <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={kpi.narrativa ?? ""}>
        {kpi.narrativa?.trim() || "—"}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" onClick={onRemove} title="Remover">
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function FieldText({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />
    </div>
  );
}
function FieldNumber({ label, value, onSave }: { label: string; value: number | null; onSave: (v: number | null) => void }) {
  const [v, setV] = useState(value?.toString() ?? "");
  useEffect(() => setV(value?.toString() ?? ""), [value]);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => {
        const n = v ? Number(v) : null;
        if (n !== value) onSave(n);
      }} />
    </div>
  );
}
function FieldDate({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string | null) => void }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="date" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => (v || null) !== value && onSave(v || null)} />
    </div>
  );
}
function FieldSelect({ label, value, options, onSave }: { label: string; value: string; options: readonly string[]; onSave: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onSave}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
function TextareaInline({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <Textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />;
}

function AdicionarIndicadorDialog({
  financiamentoId,
  existingIds,
}: {
  financiamentoId: string;
  existingIds: string[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: allKpis } = useQuery({
    queryKey: ["all-kpis-for-link"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_kpis")
        .select("id, nome, projetos!inner(nome)")
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id as string,
        nome: r.nome as string,
        projeto_nome: r.projetos?.nome ?? "—",
      }));
    },
    enabled: open,
  });

  const add = useMutation({
    mutationFn: async () => {
      const rows = Array.from(selected).map((id) => ({
        financiamento_id: financiamentoId,
        indicador_id: id,
      }));
      if (rows.length === 0) return;
      const { error } = await supabase.from("financiamento_indicadores" as any).insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Indicadores associados");
      qc.invalidateQueries({ queryKey: ["financiamento-kpis", financiamentoId] });
      setSelected(new Set());
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const disponiveis = (allKpis ?? []).filter((k) => !existingIds.includes(k.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="me-2 h-4 w-4" /> Associar indicador
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Associar indicadores</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto space-y-1 border rounded-md p-2">
          {disponiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3">
              Todos os indicadores existentes já estão associados.
            </p>
          ) : (
            disponiveis.map((k) => (
              <label key={k.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                <Checkbox
                  checked={selected.has(k.id)}
                  onCheckedChange={(c) => {
                    setSelected((p) => {
                      const next = new Set(p);
                      if (c) next.add(k.id); else next.delete(k.id);
                      return next;
                    });
                  }}
                />
                <span className="flex-1">{k.nome}</span>
                <span className="text-xs text-muted-foreground">{k.projeto_nome}</span>
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => add.mutate()} disabled={selected.size === 0}>
            Associar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}