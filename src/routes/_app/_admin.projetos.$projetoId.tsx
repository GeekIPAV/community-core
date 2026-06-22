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
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ClipboardCopy, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { InlineText } from "@/components/inline-edit";

export const Route = createFileRoute("/_app/_admin/projetos/$projetoId")({
  component: ProjetoDetailPage,
});

type Projeto = { id: string; nome: string; descricao: string | null };
type Kpi = {
  id: string;
  projeto_id: string;
  nome: string;
  meta: number;
  unidade: string;
  fonte: "acoes" | "atividades" | "participantes" | "manual";
  narrativa: string | null;
  valor_manual: number | null;
  position: number;
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
        </TabsList>
        <TabsContent value="geral" className="mt-6">
          <ProjetoGeralTab projeto={projeto} />
        </TabsContent>
        <TabsContent value="indicadores" className="mt-6">
          <IndicadoresTab projeto={projeto} />
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
      return (data ?? []) as Kpi[];
    },
  });

  const { data: calcCounts } = useQuery({
    queryKey: ["projeto-kpi-counts", projeto.id],
    queryFn: async () => {
      const [acoesRes, pessoasRes, familiasRes] = await Promise.all([
        supabase
          .from("acoes")
          .select("id", { count: "exact", head: true })
          .contains("projeto_ids", [projeto.id]),
        supabase
          .from("pessoas")
          .select("id", { count: "exact", head: true })
          .contains("projeto_ids", [projeto.id])
          .eq("status", "ativo"),
        supabase
          .from("pessoas")
          .select("familia_id")
          .contains("projeto_ids", [projeto.id])
          .eq("status", "ativo")
          .not("familia_id", "is", null),
      ]);
      const famIds = Array.from(
        new Set(((familiasRes.data ?? []) as { familia_id: string | null }[]).map((r) => r.familia_id).filter(Boolean) as string[]),
      );
      let atividades = 0;
      if (famIds.length > 0) {
        const { count } = await supabase
          .from("familia_atividades")
          .select("id", { count: "exact", head: true })
          .in("familia_id", famIds);
        atividades = count ?? 0;
      }
      return {
        acoes: acoesRes.count ?? 0,
        participantes: pessoasRes.count ?? 0,
        atividades,
      };
    },
  });

  const valorAtual = (k: Kpi): number => {
    if (k.fonte === "manual") return Number(k.valor_manual ?? 0);
    if (k.fonte === "acoes") return calcCounts?.acoes ?? 0;
    if (k.fonte === "participantes") return calcCounts?.participantes ?? 0;
    if (k.fonte === "atividades") return calcCounts?.atividades ?? 0;
    return 0;
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["projeto-kpis", projeto.id] });

  const updateField = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Kpi> }) => {
      const { error } = await supabase.from("projeto_kpis").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
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
              {(kpis ?? []).map((k) => {
                const v = valorAtual(k);
                const pct = k.meta > 0 ? Math.min(100, Math.round((v / k.meta) * 100)) : 0;
                const color =
                  pct >= 100
                    ? "bg-emerald-500"
                    : pct >= 50
                    ? "bg-amber-500"
                    : "bg-red-500";
                return (
                  <TableRow key={k.id}>
                    <TableCell>
                      <InlineText
                        value={k.nome}
                        onSave={(val) => updateField.mutateAsync({ id: k.id, patch: { nome: val ?? "" } })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <InlineText
                        value={String(k.meta)}
                        onSave={(val) => updateField.mutateAsync({ id: k.id, patch: { meta: Number(val ?? 0) || 0 } })}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {k.fonte === "manual" ? (
                        <InlineText
                          value={String(k.valor_manual ?? 0)}
                          onSave={(val) => updateField.mutateAsync({ id: k.id, patch: { valor_manual: Number(val ?? 0) || 0 } })}
                        />
                      ) : (
                        <span title="Calculado automaticamente" className="inline-flex items-center gap-1 text-muted-foreground">
                          {v}
                          <RefreshCw className="h-3 w-3 opacity-60" />
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <InlineText
                        value={k.unidade}
                        onSave={(val) => updateField.mutateAsync({ id: k.id, patch: { unidade: val ?? "" } })}
                      />
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
                      <Badge variant="secondary">{FONTE_LABELS[k.fonte]}</Badge>
                    </TableCell>
                    <TableCell>
                      <NarrativaCell
                        value={k.narrativa}
                        onSave={(val) => updateField.mutateAsync({ id: k.id, patch: { narrativa: val } })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(k)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { if (confirm(`Remover o indicador "${k.nome}"?`)) remove.mutate(k.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
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

  useMemo(() => {
    if (open) {
      setNome(editing?.nome ?? "");
      setMeta(editing ? String(editing.meta) : "");
      setUnidade(editing?.unidade ?? "");
      setFonte(editing?.fonte ?? "manual");
      setValorManual(editing?.valor_manual != null ? String(editing.valor_manual) : "");
      setNarrativa(editing?.narrativa ?? "");
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        projeto_id: projetoId,
        nome: nome.trim(),
        meta: Number(meta) || 0,
        unidade: unidade.trim(),
        fonte,
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
            <Label>Fonte</Label>
            <Select value={fonte} onValueChange={(v) => setFonte(v as Kpi["fonte"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="acoes">Ações</SelectItem>
                <SelectItem value="atividades">Atividades</SelectItem>
                <SelectItem value="participantes">Participantes</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
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