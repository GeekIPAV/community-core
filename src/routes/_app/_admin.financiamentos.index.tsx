import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";
import { InlineMultiSelect } from "@/components/inline-edit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/_admin/financiamentos/")({
  component: FinanciamentosListPage,
});

export type Financiamento = {
  id: string;
  nome: string;
  financiador: string;
  financiador_id: string | null;
  tipo: "Grant" | "Prémio" | "Contrato" | "Donativo";
  valor_total: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  estado:
    | "Candidatura submetida"
    | "Aprovado"
    | "Em execução"
    | "Encerrado"
    | "Rejeitado";
  referencia: string | null;
  responsavel: string | null;
  notas: string | null;
  created_at: string;
  cluster: string | null;
  centros_custos: string | null;
  candidatura_url: string | null;
  contrato_url: string | null;
  distribuicao_url: string | null;
  aprovado_valor: number | null;
  orcamento_valor: number | null;
  incluido_orcamento: boolean | null;
  metricas: string | null;
  obrigacoes: string | null;
  mais_informacoes: string | null;
  status_externo: string | null;
};

export type FinanciamentoRow = Financiamento & {
  projetos: { id: string; nome: string }[];
  financiador_nome: string;
};

export const TIPOS: Financiamento["tipo"][] = ["Grant", "Prémio", "Contrato", "Donativo"];
export const ESTADOS: Financiamento["estado"][] = [
  "Candidatura submetida",
  "Aprovado",
  "Em execução",
  "Encerrado",
  "Rejeitado",
];

export const estadoVariant = (
  estado: Financiamento["estado"],
): "default" | "secondary" | "outline" | "destructive" => {
  switch (estado) {
    case "Aprovado":
    case "Em execução":
      return "default";
    case "Encerrado":
      return "secondary";
    case "Rejeitado":
      return "destructive";
    default:
      return "outline";
  }
};

export const formatEuro = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-PT", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(v);

export const formatPeriodo = (inicio: string | null, fim: string | null) => {
  const fmt = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("pt-PT", { month: "short", year: "numeric" })
      : "—";
  return `${fmt(inicio)} → ${fmt(fim)}`;
};

function FinanciamentosListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanciamentoRow | null>(null);
  const [deleting, setDeleting] = useState<FinanciamentoRow | null>(null);

  const { data: financiamentos, isLoading } = useQuery({
    queryKey: ["financiamentos", "with-projetos"],
    queryFn: async () => {
      const [{ data: fin, error: e1 }, { data: links, error: e2 }, { data: prj, error: e3 }, { data: ent, error: e4 }] = await Promise.all([
        supabase.from("financiamentos" as any).select("*").order("data_inicio", { ascending: false }),
        supabase.from("financiamento_projetos" as any).select("financiamento_id, projeto_id"),
        supabase.from("projetos").select("id, nome"),
        supabase.from("parceiros").select("id, nome"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      if (e4) throw e4;
      const projMap = new Map<string, { id: string; nome: string }>();
      for (const p of (prj ?? []) as { id: string; nome: string }[]) projMap.set(p.id, p);
      const entMap = new Map<string, string>();
      for (const p of (ent ?? []) as { id: string; nome: string }[]) entMap.set(p.id, p.nome);
      const byFin = new Map<string, { id: string; nome: string }[]>();
      for (const l of ((links ?? []) as unknown as { financiamento_id: string; projeto_id: string }[])) {
        const p = projMap.get(l.projeto_id);
        if (!p) continue;
        const arr = byFin.get(l.financiamento_id) ?? [];
        arr.push(p);
        byFin.set(l.financiamento_id, arr);
      }
      return ((fin ?? []) as unknown as Financiamento[]).map((f) => ({
        ...f,
        projetos: (byFin.get(f.id) ?? []).sort((a, b) => a.nome.localeCompare(b.nome)),
        financiador_nome: (f.financiador_id && entMap.get(f.financiador_id)) || f.financiador || "—",
      })) as FinanciamentoRow[];
    },
  });

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (f: FinanciamentoRow) => { setEditing(f); setOpen(true); };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("financiamento_projetos" as any).delete().eq("financiamento_id", id);
      const { error } = await supabase.from("financiamentos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Financiamento eliminado");
      qc.invalidateQueries({ queryKey: ["financiamentos"] });
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao eliminar"),
  });

  const columns = useMemo<SmartColumnDef<FinanciamentoRow>[]>(() => [
    {
      id: "nome",
      accessorKey: "nome",
      header: "Nome",
      size: 240,
      meta: { label: "Nome", filterVariant: "text" },
      cell: ({ row }) => (
        <Link
          to="/financiamentos/$financiamentoId"
          params={{ financiamentoId: row.original.id }}
          className="font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.nome}
        </Link>
      ),
    },
    {
      id: "financiador",
      accessorFn: (r) => r.financiador_nome,
      header: "Financiador",
      size: 200,
      meta: { label: "Financiador", filterVariant: "text" },
      cell: ({ row }) => {
        const r = row.original;
        if (r.financiador_id) {
          return (
            <Link
              to="/parceiros/$parceiroId"
              params={{ parceiroId: r.financiador_id }}
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {r.financiador_nome}
            </Link>
          );
        }
        return <span>{r.financiador_nome}</span>;
      },
    },
    {
      id: "tipo",
      accessorKey: "tipo",
      header: "Tipo",
      size: 120,
      meta: { label: "Tipo", filterVariant: "select", filterOptions: TIPOS as unknown as string[] },
      cell: ({ getValue }) => <Badge variant="secondary">{String(getValue() ?? "")}</Badge>,
    },
    {
      id: "valor_total",
      accessorKey: "valor_total",
      header: "Valor",
      size: 130,
      meta: { label: "Valor", filterVariant: "number" },
      cell: ({ getValue }) => (
        <span className="tabular-nums">{formatEuro(getValue() as number | null)}</span>
      ),
    },
    {
      id: "periodo",
      header: "Período",
      size: 180,
      enableSorting: false,
      accessorFn: (r) => `${r.data_inicio ?? ""}|${r.data_fim ?? ""}`,
      meta: { label: "Período", hideOnMobile: true },
      cell: ({ row }) => (
        <span className="text-sm">{formatPeriodo(row.original.data_inicio, row.original.data_fim)}</span>
      ),
    },
    {
      id: "estado",
      accessorKey: "estado",
      header: "Estado",
      size: 160,
      meta: { label: "Estado", filterVariant: "select", filterOptions: ESTADOS as unknown as string[] },
      cell: ({ getValue }) => {
        const v = getValue() as Financiamento["estado"];
        return <Badge variant={estadoVariant(v)} className="font-normal">{v}</Badge>;
      },
    },
    {
      id: "projetos",
      header: "Projetos",
      size: 220,
      enableSorting: false,
      accessorFn: (r) => r.projetos.map((p) => p.nome).join(", "),
      meta: { label: "Projetos", hideOnMobile: true, noTruncate: true },
      cell: ({ row }) => {
        const ps = row.original.projetos;
        if (ps.length === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {ps.map((p) => (
              <Badge key={p.id} variant="outline" className="font-normal">{p.nome}</Badge>
            ))}
          </div>
        );
      },
    },
    {
      id: "referencia",
      accessorKey: "referencia",
      header: "Referência",
      size: 140,
      meta: { label: "Referência", filterVariant: "text", hideOnMobile: true },
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{(getValue() as string) ?? "—"}</span>
      ),
    },
    {
      id: "_actions",
      header: "",
      size: 80,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: { label: "Ações", noTruncate: true },
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); openEdit(row.original); }}
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); setDeleting(row.original); }}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Financiamentos</h1>
          <p className="text-sm text-muted-foreground">
            Gestão de financiamentos e ligação aos indicadores M&amp;A.
          </p>
        </div>
      </div>

      <SmartTable
        tableId="financiamentos-v2"
        columns={columns}
        data={financiamentos}
        isLoading={isLoading}
        defaultGroupBy="estado"
        defaultCollapsedGroups={["Encerrado"]}
        onRowClick={(r) => navigate({ to: "/financiamentos/$financiamentoId", params: { financiamentoId: r.id } })}
        toolbarActions={
          <Button size="sm" onClick={openNew} className="h-9">
            <Plus className="mr-2 h-4 w-4" /> Novo financiamento
          </Button>
        }
        emptyMessage="Sem financiamentos registados"
      />

      <FinanciamentoDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["financiamentos"] })}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar financiamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O financiamento "{deleting?.nome}" e as suas ligações a projetos serão eliminados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleting) deleteMutation.mutate(deleting.id); }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "A eliminar…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function FinanciamentoDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: FinanciamentoRow | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Financiamento>>({});
  const [projetoIds, setProjetoIds] = useState<string[]>([]);
  const set = (k: keyof Financiamento, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const { data: projetos } = useQuery({
    queryKey: ["projetos", "lista-financiamento"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const { data: entidades } = useQuery({
    queryKey: ["parceiros", "lista-financiador"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parceiros")
        .select("id, nome, tipo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; tipo: string | null }[];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        nome: editing.nome,
        financiador: editing.financiador,
        financiador_id: editing.financiador_id ?? null,
        tipo: editing.tipo,
        valor_total: editing.valor_total,
        data_inicio: editing.data_inicio,
        data_fim: editing.data_fim,
        estado: editing.estado,
        referencia: editing.referencia,
        responsavel: editing.responsavel,
        notas: editing.notas,
        cluster: editing.cluster,
        centros_custos: editing.centros_custos,
        candidatura_url: editing.candidatura_url,
        contrato_url: editing.contrato_url,
        distribuicao_url: editing.distribuicao_url,
        aprovado_valor: editing.aprovado_valor,
        orcamento_valor: editing.orcamento_valor,
        incluido_orcamento: editing.incluido_orcamento,
        metricas: editing.metricas,
        obrigacoes: editing.obrigacoes,
        mais_informacoes: editing.mais_informacoes,
        status_externo: editing.status_externo,
      });
      setProjetoIds(editing.projetos.map((p) => p.id));
    } else {
      setForm({ tipo: "Grant", estado: "Candidatura submetida", incluido_orcamento: false, financiador_id: null });
      setProjetoIds([]);
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      let id = editing?.id;
      if (editing) {
        const { error } = await supabase
          .from("financiamentos" as any)
          .update(form as any)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("financiamentos" as any)
          .insert(form as any)
          .select("id")
          .single();
        if (error) throw error;
        id = (data as any).id as string;
      }
      if (id) {
        await supabase.from("financiamento_projetos" as any).delete().eq("financiamento_id", id);
        if (projetoIds.length > 0) {
          const { error } = await supabase
            .from("financiamento_projetos" as any)
            .insert(projetoIds.map((pid) => ({ financiamento_id: id!, projeto_id: pid })));
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Financiamento atualizado" : "Financiamento criado");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar financiamento" : "Novo financiamento"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="col-span-2 space-y-1">
            <Label>Nome</Label>
            <Input value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Financiador</Label>
            <Select
              value={form.financiador_id ?? "__none"}
              onValueChange={(v) => {
                if (v === "__none") {
                  set("financiador_id", null);
                } else {
                  const ent = (entidades ?? []).find((e) => e.id === v);
                  set("financiador_id", v);
                  if (ent) set("financiador", ent.nome);
                }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecionar entidade…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— sem entidade —</SelectItem>
                {(entidades ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}{e.tipo ? ` · ${e.tipo}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Valor total (€)</Label>
            <Input type="number" value={form.valor_total ?? ""} onChange={(e) => set("valor_total", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <Select value={form.estado} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Data início</Label>
            <Input type="date" value={form.data_inicio ?? ""} onChange={(e) => set("data_inicio", e.target.value || null)} />
          </div>
          <div className="space-y-1">
            <Label>Data fim</Label>
            <Input type="date" value={form.data_fim ?? ""} onChange={(e) => set("data_fim", e.target.value || null)} />
          </div>
          <div className="space-y-1">
            <Label>Referência</Label>
            <Input value={form.referencia ?? ""} onChange={(e) => set("referencia", e.target.value || null)} />
          </div>
          <div className="space-y-1">
            <Label>Responsável</Label>
            <Input value={form.responsavel ?? ""} onChange={(e) => set("responsavel", e.target.value || null)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Candidatura (URL)</Label>
            <Input value={form.candidatura_url ?? ""} onChange={(e) => set("candidatura_url", e.target.value || null)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Contrato (URL)</Label>
            <Input value={form.contrato_url ?? ""} onChange={(e) => set("contrato_url", e.target.value || null)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Métricas</Label>
            <Textarea value={form.metricas ?? ""} onChange={(e) => set("metricas", e.target.value || null)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Obrigações</Label>
            <Textarea value={form.obrigacoes ?? ""} onChange={(e) => set("obrigacoes", e.target.value || null)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Mais informações</Label>
            <Textarea value={form.mais_informacoes ?? ""} onChange={(e) => set("mais_informacoes", e.target.value || null)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Projetos associados</Label>
            <InlineMultiSelect
              values={projetoIds}
              options={(projetos ?? []).map((p) => ({ value: p.id, label: p.nome }))}
              onSave={(v) => setProjetoIds(v)}
              placeholder="Sem projetos"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Notas</Label>
            <Textarea value={form.notas ?? ""} onChange={(e) => set("notas", e.target.value || null)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!form.nome || save.isPending}>
            {save.isPending ? "A guardar…" : editing ? "Guardar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}