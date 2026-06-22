import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ClipboardCopy, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { InlineText } from "@/components/inline-edit";

export const Route = createFileRoute("/_app/_admin/projetos/$projetoId")({
  component: ProjetoDetailPage,
});

type Projeto = { id: string; nome: string; descricao: string | null };
type Fonte = "acoes" | "atividades" | "participantes" | "manual" | "inscricoes" | "auto_total_unicos";
type Estado = "por_iniciar" | "em_execucao" | "concluido";
type KpiFiltro = {
  imigrante?: boolean;
  voluntario?: boolean;
  mulheres?: boolean;
  regular?: number;
  categoria?: string;
  projeto_ids?: string[];
};
type Kpi = {
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

const CATEGORIAS_ACAO: { value: string; label: string }[] = [
  { value: "workshop", label: "Workshop" },
  { value: "jantar", label: "Jantar de Proximidade" },
  { value: "intercultural", label: "Evento Intercultural" },
  { value: "evento_comunitario", label: "Evento Comunitário" },
  { value: "mediacao", label: "Mediação / Encaminhamento" },
  { value: "mca", label: "MEERU Convida Amigos" },
  { value: "outro", label: "Outro" },
];
const categoriaLabel = (v: string | null | undefined) =>
  CATEGORIAS_ACAO.find((c) => c.value === v)?.label ?? "—";

const ESTADO_LABELS: Record<Estado, string> = {
  por_iniciar: "Por iniciar",
  em_execucao: "Em execução",
  concluido: "Concluído",
};
const ESTADO_VARIANTS: Record<Estado, "secondary" | "default" | "outline"> = {
  por_iniciar: "outline",
  em_execucao: "secondary",
  concluido: "default",
};

const UNIDADES_SUGESTOES = [
  "participantes",
  "horas",
  "jantares",
  "sessões",
  "famílias",
  "ações",
];

const FONTE_LABELS: Record<Kpi["fonte"], string> = {
  acoes: "Ações",
  atividades: "Atividades",
  participantes: "Participantes",
  manual: "Manual",
  inscricoes: "Inscrições",
  auto_total_unicos: "Total únicos",
};

function ProjetoDetailPage() {
  const { projetoId } = Route.useParams();
  const navigate = useNavigate();

  const { data: projeto, isLoading } = useQuery({
    queryKey: ["projeto", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome, descricao")
        .eq("id", projetoId)
        .maybeSingle();
      if (error) throw error;
      return data as Projeto | null;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/projetos" })}>
          <ArrowLeft className="me-1 h-4 w-4" /> Voltar
        </Button>
        <p className="text-muted-foreground">Projeto não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link to="/projetos" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="me-1 h-3 w-3" /> Projetos
          </Link>
          <h1 className="text-2xl font-semibold">{projeto.nome}</h1>
          {projeto.descricao && (
            <p className="text-sm text-muted-foreground max-w-2xl">{projeto.descricao}</p>
          )}
        </div>
      </div>

      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          <TabsTrigger value="acoes">Ações</TabsTrigger>
        </TabsList>
        <TabsContent value="geral" className="mt-6">
          <ProjetoGeralTab projeto={projeto} />
        </TabsContent>
        <TabsContent value="indicadores" className="mt-6">
          <IndicadoresTab projeto={projeto} />
        </TabsContent>
        <TabsContent value="acoes" className="mt-6">
          <AcoesProjetoTab projeto={projeto} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProjetoGeralTab({ projeto }: { projeto: Projeto }) {
  const { data: counts } = useQuery({
    queryKey: ["projeto-detail-counts", projeto.id],
    queryFn: async () => {
      const [pessoasRes, acoesRes] = await Promise.all([
        supabase
          .from("pessoas")
          .select("id", { count: "exact", head: true })
          .contains("projeto_ids", [projeto.id])
          .eq("status", "ativo"),
        supabase
          .from("acoes")
          .select("id", { count: "exact", head: true })
          .contains("projeto_ids", [projeto.id]),
      ]);
      return {
        pessoas: pessoasRes.count ?? 0,
        acoes: acoesRes.count ?? 0,
      };
    },
  });

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard label="Participantes ativos" value={counts?.pessoas ?? 0} />
      <StatCard label="Ações associadas" value={counts?.acoes ?? 0} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function IndicadoresTab({ projeto }: { projeto: Projeto }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Kpi | null>(null);

  const { data: kpis, isLoading } = useQuery({
    queryKey: ["projeto-kpis", projeto.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_kpis")
        .select("*")
        .eq("projeto_id", projeto.id)
        .order("position")
        .order("created_at");
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        filtro: (r.filtro ?? {}) as KpiFiltro,
        estado: (r.estado ?? "em_execucao") as Estado,
      })) as Kpi[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["projeto-kpis", projeto.id] });
  const invalidateAllValues = () => qc.invalidateQueries({ queryKey: ["projeto-kpi-value"] });

  const updateField = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Kpi> }) => {
      const { error } = await supabase.from("projeto_kpis").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); invalidateAllValues(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projeto_kpis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Indicador removido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [computedValues, setComputedValues] = useState<Record<string, number>>({});
  const handleComputed = (id: string, value: number) => {
    setComputedValues((p) => (p[id] === value ? p : { ...p, [id]: value }));
  };
  const valorAtual = (k: Kpi): number =>
    k.fonte === "manual" ? Number(k.valor_manual ?? 0) : computedValues[k.id] ?? 0;

  const exportar = () => {
    const lines: string[] = [];
    lines.push("─────────────────────────────");
    lines.push(`INDICADORES — ${projeto.nome}`);
    lines.push(`Exportado em ${new Date().toLocaleDateString("pt-PT")}`);
    lines.push("─────────────────────────────");
    lines.push("");
    for (const k of kpis ?? []) {
      const v = valorAtual(k);
      const pct = k.meta > 0 ? Math.min(100, Math.round((v / k.meta) * 100)) : 0;
      const full = Math.round((pct / 100) * 10);
      const bar = "█".repeat(full) + "░".repeat(10 - full);
      lines.push(k.nome);
      lines.push(`Estado: ${ESTADO_LABELS[k.estado]}`);
      lines.push(`Meta: ${k.meta} ${k.unidade}`);
      lines.push(`Valor atual: ${v} ${k.unidade} (${pct}%)`);
      lines.push(`${bar} ${pct}%`);
      lines.push("");
      lines.push("Narrativa:");
      lines.push(k.narrativa?.trim() || "(sem narrativa)");
      lines.push("");
      lines.push("─────────────────────────────");
    }
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Relatório copiado para a área de transferência ✓");
  };

  // Summary metrics
  const total = kpis?.length ?? 0;
  const emExec = (kpis ?? []).filter((k) => k.estado === "em_execucao").length;
  const concluidos = (kpis ?? []).filter((k) => k.estado === "concluido").length;
  const pctMedia =
    total === 0
      ? 0
      : Math.round(
          (kpis ?? []).reduce((acc, k) => {
            const v = valorAtual(k);
            const p = k.meta > 0 ? Math.min(100, (v / k.meta) * 100) : 0;
            return acc + p;
          }, 0) / total,
        );

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (k: Kpi) => { setEditing(k); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Indicadores de M&amp;A</h2>
          <p className="text-sm text-muted-foreground">{kpis?.length ?? 0} indicadores</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportar} disabled={(kpis?.length ?? 0) === 0}>
            <ClipboardCopy className="me-2 h-4 w-4" /> Exportar para relatório
          </Button>
          <Button onClick={openNew}>
            <Plus className="me-2 h-4 w-4" /> Adicionar indicador
          </Button>
        </div>
      </div>

      {total > 0 && (
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Total indicadores" value={total} />
          <StatCard label="Em execução" value={emExec} />
          <StatCard label="Concluídos" value={concluidos} />
          <StatCard label="% média execução" value={pctMedia} />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (kpis?.length ?? 0) === 0 ? (
        <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
          Sem indicadores. Clica em "Adicionar indicador" para começar.
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                <TableHead className="w-32">Estado</TableHead>
                <TableHead className="w-24 text-right">Meta</TableHead>
                <TableHead className="w-32 text-right">Valor Atual</TableHead>
                <TableHead className="w-32">Unidade</TableHead>
                <TableHead className="w-48">Progresso</TableHead>
                <TableHead className="w-32">Fonte</TableHead>
                <TableHead>Narrativa</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(kpis ?? []).map((k) => (
                <KpiRow
                  key={k.id}
                  kpi={k}
                  projeto={projeto}
                  onCompute={handleComputed}
                  onUpdate={(patch) => updateField.mutateAsync({ id: k.id, patch })}
                  onEdit={() => openEdit(k)}
                  onRemove={() => { if (confirm(`Remover o indicador "${k.nome}"?`)) remove.mutate(k.id); }}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <KpiDialog
        open={open}
        onOpenChange={setOpen}
        projetoId={projeto.id}
        editing={editing}
        onSaved={invalidate}
      />
    </div>
  );
}

function useKpiValue(kpi: Kpi, projeto: Projeto) {
  return useQuery({
    queryKey: ["projeto-kpi-value", kpi.id, kpi.fonte, kpi.filtro, kpi.projeto_id],
    queryFn: async () => {
      const f = kpi.filtro ?? {};
      if (kpi.fonte === "manual") return Number(kpi.valor_manual ?? 0);

      // ACOES — count actions linked to this projeto, optional categoria filter
      if (kpi.fonte === "acoes") {
        let q = supabase
          .from("acoes")
          .select("id", { count: "exact", head: true })
          .contains("projeto_ids", [projeto.id]);
        if (f.categoria) q = q.eq("categoria", f.categoria);
        const { count } = await q;
        return count ?? 0;
      }

      // INSCRICOES — count inscricoes for acoes filtered by projeto_ids (default this projeto) + categoria
      if (kpi.fonte === "inscricoes") {
        const scopeProjetos = f.projeto_ids?.length ? f.projeto_ids : [projeto.id];
        let aq = supabase.from("acoes").select("id").overlaps("projeto_ids", scopeProjetos);
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

      // PARTICIPANTES — pessoas with projeto_ids contains this projeto + optional filters
      if (kpi.fonte === "participantes") {
        let q = supabase
          .from("pessoas")
          .select("id, familia_id, genero, nacionalidade, is_voluntario")
          .contains("projeto_ids", [projeto.id])
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
        // Regular threshold: count pessoas whose familia has >= N atividades
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

      // ATIVIDADES — total familia_atividades para familias deste projeto
      if (kpi.fonte === "atividades") {
        const { data: pessoasData } = await supabase
          .from("pessoas")
          .select("familia_id")
          .contains("projeto_ids", [projeto.id])
          .eq("status", "ativo")
          .not("familia_id", "is", null);
        const famIds = Array.from(new Set(((pessoasData ?? []) as any[]).map((p) => p.familia_id).filter(Boolean)));
        if (famIds.length === 0) return 0;
        const { count } = await supabase
          .from("familia_atividades")
          .select("id", { count: "exact", head: true })
          .in("familia_id", famIds);
        return count ?? 0;
      }

      // AUTO TOTAL UNICOS — pessoas únicas em qualquer projeto (somatório global)
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
    },
  });
}

function KpiRow({
  kpi,
  projeto,
  onCompute,
  onUpdate,
  onEdit,
  onRemove,
}: {
  kpi: Kpi;
  projeto: Projeto;
  onCompute: (id: string, value: number) => void;
  onUpdate: (patch: Partial<Kpi>) => Promise<void> | void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { data: computed } = useKpiValue(kpi, projeto);
  const v = kpi.fonte === "manual" ? Number(kpi.valor_manual ?? 0) : computed ?? 0;
  // Surface upward for summary calc + export
  useEffect(() => {
    if (computed != null) onCompute(kpi.id, computed);
  }, [computed, kpi.id, onCompute]);
  const pct = kpi.meta > 0 ? Math.min(100, Math.round((v / kpi.meta) * 100)) : 0;
  const color = pct > 70 ? "bg-emerald-500" : pct >= 30 ? "bg-amber-500" : "bg-red-500";

  return (
    <TableRow>
      <TableCell>
        <InlineText value={kpi.nome} onSave={(val) => onUpdate({ nome: val ?? "" })} />
      </TableCell>
      <TableCell>
        <Select value={kpi.estado} onValueChange={(val) => onUpdate({ estado: val as Estado })}>
          <SelectTrigger className="h-8">
            <Badge variant={ESTADO_VARIANTS[kpi.estado]} className="font-normal">
              {ESTADO_LABELS[kpi.estado]}
            </Badge>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="por_iniciar">Por iniciar</SelectItem>
            <SelectItem value="em_execucao">Em execução</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right">
        <InlineText
          value={String(kpi.meta)}
          onSave={(val) => onUpdate({ meta: Number(val ?? 0) || 0 })}
        />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {kpi.fonte === "manual" ? (
          <InlineText
            value={String(kpi.valor_manual ?? 0)}
            onSave={(val) => onUpdate({ valor_manual: Number(val ?? 0) || 0 })}
          />
        ) : (
          <span title="Calculado automaticamente" className="inline-flex items-center gap-1 text-muted-foreground">
            {v}
            <RefreshCw className="h-3 w-3 opacity-60" />
          </span>
        )}
      </TableCell>
      <TableCell>
        <InlineText value={kpi.unidade} onSave={(val) => onUpdate({ unidade: val ?? "" })} />
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
      <TableCell>
        <NarrativaCell
          value={kpi.narrativa}
          onSave={(val) => onUpdate({ narrativa: val })}
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function AcoesProjetoTab({ projeto }: { projeto: Projeto }) {
  const qc = useQueryClient();
  const { data: acoes, isLoading } = useQuery({
    queryKey: ["projeto-acoes", projeto.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes")
        .select("id, nome, tipo, status, data_inicio, categoria")
        .contains("projeto_ids", [projeto.id])
        .order("data_inicio", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as { id: string; nome: string; tipo: string; status: string; data_inicio: string | null; categoria: string | null }[];
    },
  });

  const updateCategoria = useMutation({
    mutationFn: async ({ id, categoria }: { id: string; categoria: string | null }) => {
      const { error } = await supabase.from("acoes").update({ categoria } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projeto-acoes", projeto.id] });
      qc.invalidateQueries({ queryKey: ["projeto-kpi-value"] });
      toast.success("Categoria atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!acoes || acoes.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        Sem ações associadas a este projeto.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        A categoria define como as ações contam nos indicadores M&amp;A (ex.: workshop, jantar, intercultural).
      </p>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ação</TableHead>
              <TableHead className="w-32">Data</TableHead>
              <TableHead className="w-56">Categoria</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {acoes.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="font-medium">{a.nome}</div>
                  <div className="text-xs text-muted-foreground capitalize">{a.tipo} · {a.status}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {a.data_inicio ? new Date(a.data_inicio).toLocaleDateString("pt-PT") : "—"}
                </TableCell>
                <TableCell>
                  <Select
                    value={a.categoria ?? "__none__"}
                    onValueChange={(v) => updateCategoria.mutate({ id: a.id, categoria: v === "__none__" ? null : v })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Sem categoria">{categoriaLabel(a.categoria)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem categoria</SelectItem>
                      {CATEGORIAS_ACAO.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NarrativaCell({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string | null) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const trunc = (value ?? "").length > 60 ? `${value!.slice(0, 60)}…` : value ?? "";
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setVal(value ?? ""); }}>
      <PopoverTrigger asChild>
        <button type="button" className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-muted/50">
          <span className="flex-1 truncate text-muted-foreground">
            {trunc || <span className="opacity-50">—</span>}
          </span>
          <Pencil className="h-3 w-3 opacity-40 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 space-y-2" align="end">
        <Label>Narrativa</Label>
        <Textarea rows={6} value={val} onChange={(e) => setVal(e.target.value)} />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={async () => {
              await onSave(val.trim() ? val : null);
              setOpen(false);
              toast.success("Narrativa guardada");
            }}
          >
            Guardar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function KpiDialog({
  open,
  onOpenChange,
  projetoId,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projetoId: string;
  editing: Kpi | null;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [meta, setMeta] = useState("");
  const [unidade, setUnidade] = useState("");
  const [fonte, setFonte] = useState<Kpi["fonte"]>("manual");
  const [valorManual, setValorManual] = useState("");
  const [narrativa, setNarrativa] = useState("");
  const [estado, setEstado] = useState<Estado>("em_execucao");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("__none__");
  const [filtroImigrante, setFiltroImigrante] = useState(false);
  const [filtroVoluntario, setFiltroVoluntario] = useState(false);
  const [filtroMulheres, setFiltroMulheres] = useState(false);
  const [filtroRegular, setFiltroRegular] = useState("");

  useMemo(() => {
    if (open) {
      setNome(editing?.nome ?? "");
      setMeta(editing ? String(editing.meta) : "");
      setUnidade(editing?.unidade ?? "");
      setFonte(editing?.fonte ?? "manual");
      setValorManual(editing?.valor_manual != null ? String(editing.valor_manual) : "");
      setNarrativa(editing?.narrativa ?? "");
      setEstado(editing?.estado ?? "em_execucao");
      const f = editing?.filtro ?? {};
      setFiltroCategoria(f.categoria ?? "__none__");
      setFiltroImigrante(!!f.imigrante);
      setFiltroVoluntario(!!f.voluntario);
      setFiltroMulheres(!!f.mulheres);
      setFiltroRegular(f.regular ? String(f.regular) : "");
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const filtro: KpiFiltro = {};
      if (fonte === "acoes" || fonte === "inscricoes") {
        if (filtroCategoria !== "__none__") filtro.categoria = filtroCategoria;
      }
      if (fonte === "participantes") {
        if (filtroImigrante) filtro.imigrante = true;
        if (filtroVoluntario) filtro.voluntario = true;
        if (filtroMulheres) filtro.mulheres = true;
        const r = Number(filtroRegular);
        if (r > 0) filtro.regular = r;
      }
      const payload = {
        projeto_id: projetoId,
        nome: nome.trim(),
        meta: Number(meta) || 0,
        unidade: unidade.trim(),
        fonte,
        estado,
        filtro: filtro as any,
        valor_manual: fonte === "manual" ? Number(valorManual) || 0 : null,
        narrativa: narrativa.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("projeto_kpis").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projeto_kpis").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Indicador atualizado" : "Indicador criado");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar indicador" : "Novo indicador"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do indicador</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Participantes únicos" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Meta</Label>
              <Input type="number" value={meta} onChange={(e) => setMeta(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Input
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                list="unidade-suggestions"
                placeholder="participantes"
              />
              <datalist id="unidade-suggestions">
                {UNIDADES_SUGESTOES.map((u) => <option key={u} value={u} />)}
              </datalist>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v as Estado)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="por_iniciar">Por iniciar</SelectItem>
                <SelectItem value="em_execucao">Em execução</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Fonte</Label>
            <Select value={fonte} onValueChange={(v) => setFonte(v as Kpi["fonte"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="acoes">Ações</SelectItem>
                <SelectItem value="inscricoes">Inscrições</SelectItem>
                <SelectItem value="atividades">Atividades</SelectItem>
                <SelectItem value="participantes">Participantes</SelectItem>
                <SelectItem value="auto_total_unicos">Total únicos (todos os projetos)</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(fonte === "acoes" || fonte === "inscricoes") && (
            <div className="space-y-1.5">
              <Label>Filtrar por categoria de ação</Label>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Todas</SelectItem>
                  {CATEGORIAS_ACAO.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {fonte === "participantes" && (
            <div className="space-y-2 rounded-md border p-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Filtros de participantes</Label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={filtroImigrante} onChange={(e) => setFiltroImigrante(e.target.checked)} />
                Imigrantes (nacionalidade ≠ portuguesa)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={filtroVoluntario} onChange={(e) => setFiltroVoluntario(e.target.checked)} />
                Voluntários
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={filtroMulheres} onChange={(e) => setFiltroMulheres(e.target.checked)} />
                Apenas mulheres
              </label>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Mín. atividades (regular):</Label>
                <Input
                  type="number"
                  className="h-8 w-20"
                  value={filtroRegular}
                  onChange={(e) => setFiltroRegular(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          )}
          {fonte === "manual" && (
            <div className="space-y-1.5">
              <Label>Valor atual</Label>
              <Input type="number" value={valorManual} onChange={(e) => setValorManual(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Narrativa</Label>
            <Textarea
              rows={4}
              value={narrativa}
              onChange={(e) => setNarrativa(e.target.value)}
              placeholder="Descreve o progresso, contexto e observações para o relatório..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!nome.trim() || !unidade.trim() || save.isPending}>
            {save.isPending ? "A guardar…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}