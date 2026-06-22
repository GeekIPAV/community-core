import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Plus, Trash2, Mail, Phone, Landmark, Receipt, Wallet } from "lucide-react";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";

export const Route = createFileRoute("/_app/_admin/servicos/colaborador/$id")({
  component: ColaboradorDetailPage,
});

type Colaborador = {
  id: string; nome_completo: string; email: string | null; telefone: string | null;
  iban: string | null; notas: string | null; ativo: boolean;
};
type Tipo = { id: string; nome: string; unidade: string; preco_unitario: number; ativo: boolean };
type Registo = {
  id: string; colaborador_id: string; tipo_servico_id: string;
  data_inicio: string; data_fim: string | null; descricao: string | null;
  quantidade: number; preco_unitario_override: number | null;
  outros_custos: number; outros_custos_descricao: string | null;
  km: number | null; estado: "pendente" | "aprovado" | "pago";
  submetido_pelo_colaborador: boolean; pagamento_id: string | null;
  notas_admin: string | null;
};
type Pagamento = {
  id: string; colaborador_id: string; data_pagamento: string;
  total: number; referencia: string | null; metodo: string | null; notas: string | null;
};

const ESTADOS: Registo["estado"][] = ["pendente", "aprovado", "pago"];
const fmtEUR = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
const estadoBadge = (e: Registo["estado"]) => {
  if (e === "pendente") return <Badge className="bg-amber-500 hover:bg-amber-500">Pendente</Badge>;
  if (e === "aprovado") return <Badge className="bg-blue-600 hover:bg-blue-600">Aprovado</Badge>;
  return <Badge className="bg-emerald-600 hover:bg-emerald-600">Pago</Badge>;
};

function ColaboradorDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Partial<Colaborador>>({});

  const { data: colab, isLoading } = useQuery({
    queryKey: ["colaborador", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id, nome_completo, email, telefone, iban, notas, ativo")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Colaborador | null;
    },
  });

  const { data: tipos } = useQuery({
    queryKey: ["tipos_servico_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tipos_servico").select("id, nome, unidade, preco_unitario, ativo").order("nome");
      if (error) throw error;
      return data as Tipo[];
    },
  });
  const tipoMap = useMemo(() => new Map((tipos ?? []).map((t) => [t.id, t])), [tipos]);

  const { data: registos } = useQuery({
    queryKey: ["registos_colab", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registos_servico")
        .select("id, colaborador_id, tipo_servico_id, data_inicio, data_fim, descricao, quantidade, preco_unitario_override, outros_custos, outros_custos_descricao, km, estado, submetido_pelo_colaborador, pagamento_id, notas_admin")
        .eq("colaborador_id", id)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as Registo[];
    },
  });

  const { data: pagamentos } = useQuery({
    queryKey: ["pagamentos_colab", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("id, colaborador_id, data_pagamento, total, referencia, metodo, notas")
        .eq("colaborador_id", id)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data as Pagamento[];
    },
  });

  const calcTotal = (r: Partial<Registo>): number => {
    const tipo = r.tipo_servico_id ? tipoMap.get(r.tipo_servico_id) : null;
    const preco = r.preco_unitario_override != null ? Number(r.preco_unitario_override) : (tipo?.preco_unitario ?? 0);
    const qtd = Number(r.quantidade ?? 1) || 0;
    return preco * qtd + (Number(r.outros_custos ?? 0) || 0);
  };

  const totals = useMemo(() => {
    const t = (registos ?? []).reduce((acc, r) => {
      const v = calcTotal(r);
      acc.total += v;
      if (r.estado === "pendente") acc.pendente += v;
      if (r.estado === "aprovado") acc.aprovado += v;
      if (r.estado === "pago") acc.pago += v;
      return acc;
    }, { total: 0, pendente: 0, aprovado: 0, pago: 0 });
    const pagoTotal = (pagamentos ?? []).reduce((s, p) => s + Number(p.total || 0), 0);
    return { ...t, pagoTotal };
  }, [registos, pagamentos, tipoMap]);

  const [filterEstado, setFilterEstado] = useState<string>("__all");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");

  const registosFiltered = useMemo(() => {
    let rows = registos ?? [];
    if (filterEstado !== "__all") rows = rows.filter((r) => r.estado === filterEstado);
    if (filterFrom) rows = rows.filter((r) => r.data_inicio >= filterFrom);
    if (filterTo) rows = rows.filter((r) => r.data_inicio <= filterTo);
    return rows;
  }, [registos, filterEstado, filterFrom, filterTo]);

  const updateRegisto = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: unknown }) => {
      const { error } = await supabase.from("registos_servico").update({ [field]: value } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registos_colab", id] });
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updatePagamento = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: unknown }) => {
      const { error } = await supabase.from("pagamentos").update({ [field]: value } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pagamentos_colab", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  type RegRow = Registo & { _tipo: string; _unidade: string; _preco: number; _calc: number; _total: number };
  const registosRows = useMemo<RegRow[]>(() => registosFiltered.map((r) => {
    const tipo = tipoMap.get(r.tipo_servico_id);
    const preco = r.preco_unitario_override ?? (tipo?.preco_unitario ?? 0);
    const calc = Number(preco) * Number(r.quantidade);
    return {
      ...r,
      _tipo: tipo?.nome ?? "—",
      _unidade: tipo?.unidade ?? "",
      _preco: Number(preco),
      _calc: calc,
      _total: calc + Number(r.outros_custos || 0),
    };
  }), [registosFiltered, tipoMap]);

  const registosColumns = useMemo<SmartColumnDef<RegRow>[]>(() => [
    { id: "data_inicio", accessorKey: "data_inicio", header: "Data", size: 130,
      meta: { label: "Data", filterVariant: "date" },
      cell: ({ getValue }) => <span className="text-sm whitespace-nowrap">{new Date(String(getValue())).toLocaleDateString("pt-PT")}</span> },
    { id: "_tipo", accessorKey: "_tipo", header: "Serviço", size: 260,
      meta: { label: "Serviço", filterVariant: "text" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{row.original._tipo}</div>
          {row.original.descricao && <div className="text-xs text-muted-foreground truncate">{row.original.descricao}</div>}
        </div>
      ) },
    { id: "quantidade", accessorKey: "quantidade", header: "Qtd", size: 100,
      meta: { label: "Qtd", filterVariant: "number", editType: "number" },
      cell: ({ row }) => <span className="block text-right tabular-nums">{Number(row.original.quantidade)} {row.original._unidade}</span> },
    { id: "_calc", accessorKey: "_calc", header: "Calc.", size: 110,
      meta: { label: "Calculado", filterVariant: "number", hideOnMobile: true },
      cell: ({ getValue }) => <span className="block text-right tabular-nums">{fmtEUR(Number(getValue() ?? 0))}</span> },
    { id: "outros_custos", accessorKey: "outros_custos", header: "Outros", size: 110,
      meta: { label: "Outros", filterVariant: "number", editType: "number", hideOnMobile: true },
      cell: ({ getValue }) => <span className="block text-right tabular-nums">{fmtEUR(Number(getValue() ?? 0))}</span> },
    { id: "_total", accessorKey: "_total", header: "Total", size: 120,
      meta: { label: "Total", filterVariant: "number" },
      cell: ({ getValue }) => <span className="block text-right tabular-nums font-semibold">{fmtEUR(Number(getValue() ?? 0))}</span> },
    { id: "estado", accessorKey: "estado", header: "Estado", size: 130,
      meta: { label: "Estado", filterVariant: "select", filterOptions: ESTADOS as unknown as string[],
        editType: "select", editSelectOptions: ESTADOS.map((e) => ({ value: e, label: e })) },
      cell: ({ getValue }) => estadoBadge(getValue() as Registo["estado"]) },
    { id: "_actions", header: "", size: 80, enableSorting: false, enableHiding: false, enableResizing: false,
      meta: { noTruncate: true },
      cell: ({ row }) => <DeleteRegisto id={row.original.id} colaboradorId={id} /> },
  ], [id]);

  type PagRow = Pagamento;
  const pagamentosColumns = useMemo<SmartColumnDef<PagRow>[]>(() => [
    { id: "data_pagamento", accessorKey: "data_pagamento", header: "Data", size: 130,
      meta: { label: "Data", filterVariant: "date", editType: "date" },
      cell: ({ getValue }) => <span className="text-sm whitespace-nowrap">{new Date(String(getValue())).toLocaleDateString("pt-PT")}</span> },
    { id: "referencia", accessorKey: "referencia", header: "Referência", size: 200,
      meta: { label: "Referência", filterVariant: "text", editType: "text" },
      cell: ({ getValue }) => <span>{(getValue() as string) ?? "—"}</span> },
    { id: "metodo", accessorKey: "metodo", header: "Método", size: 180,
      meta: { label: "Método", filterVariant: "text", editType: "text", hideOnMobile: true },
      cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span> },
    { id: "total", accessorKey: "total", header: "Total", size: 120,
      meta: { label: "Total", filterVariant: "number", editType: "number" },
      cell: ({ getValue }) => <span className="block text-right tabular-nums font-semibold">{fmtEUR(Number(getValue() ?? 0))}</span> },
    { id: "notas", accessorKey: "notas", header: "Notas", size: 260,
      meta: { label: "Notas", filterVariant: "text", editType: "text", hideOnMobile: true },
      cell: ({ getValue }) => <span className="text-muted-foreground text-xs">{(getValue() as string) ?? ""}</span> },
  ], []);

  const saveColab = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("colaboradores").update({
        nome_completo: form.nome_completo?.trim(),
        email: form.email?.trim() || null,
        telefone: form.telefone?.trim() || null,
        iban: form.iban?.trim() || null,
        notas: form.notas?.trim() || null,
        ativo: form.ativo ?? true,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: ["colaborador", id] });
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
      setEditOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!colab) {
    return (
      <div className="space-y-4">
        <Link to="/servicos" className="text-sm text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Voltar</Link>
        <p>Colaborador não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/servicos" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Voltar a Serviços
        </Link>
      </div>

      <div className="rounded-lg border p-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{colab.nome_completo}</h1>
            {colab.ativo ? <Badge>Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {colab.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{colab.email}</span>}
            {colab.telefone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{colab.telefone}</span>}
            {colab.iban && <span className="inline-flex items-center gap-1"><Landmark className="h-3.5 w-3.5" /><code className="font-mono text-xs">{colab.iban}</code></span>}
          </div>
          {colab.notas && <p className="text-sm text-muted-foreground max-w-xl">{colab.notas}</p>}
        </div>
        <Button variant="outline" onClick={() => { setForm(colab); setEditOpen(true); }}>
          <Pencil className="mr-2 h-4 w-4" />Editar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total acumulado" value={fmtEUR(totals.total)} />
        <SummaryCard label="Pendente" value={fmtEUR(totals.pendente)} tone="text-amber-600 dark:text-amber-400" />
        <SummaryCard label="Aprovado" value={fmtEUR(totals.aprovado)} tone="text-blue-600 dark:text-blue-400" />
        <SummaryCard label="Pago" value={fmtEUR(totals.pagoTotal)} tone="text-emerald-600 dark:text-emerald-400" />
      </div>

      <Tabs defaultValue="servicos">
        <TabsList>
          <TabsTrigger value="servicos"><Receipt className="mr-2 h-4 w-4" />Serviços</TabsTrigger>
          <TabsTrigger value="pagamentos"><Wallet className="mr-2 h-4 w-4" />Pagamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="servicos" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos</SelectItem>
                  {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">De</Label><Input type="date" className="h-9 w-40" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} /></div>
            <div><Label className="text-xs">Até</Label><Input type="date" className="h-9 w-40" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} /></div>
          </div>

          <SmartTable
            tableId={`registos_colab_${id}`}
            columns={registosColumns}
            data={registosRows}
            editableColumns={["quantidade", "outros_custos", "estado"]}
            onCellEdit={(rowId, columnId, value) => {
              let v: unknown = value;
              if (columnId === "quantidade" || columnId === "outros_custos") v = Number(value) || 0;
              return updateRegisto.mutateAsync({ id: rowId, field: columnId, value: v });
            }}
            toolbarActions={<RegistoButton colaboradorId={id} tipos={tipos ?? []} />}
            emptyMessage="Sem registos"
          />
        </TabsContent>

        <TabsContent value="pagamentos" className="space-y-4 mt-4">
          <SmartTable
            tableId={`pagamentos_colab_${id}`}
            columns={pagamentosColumns}
            data={pagamentos ?? []}
            editableColumns={["referencia", "metodo", "total", "data_pagamento", "notas"]}
            onCellEdit={(rowId, columnId, value) => {
              let v: unknown = value;
              if (columnId === "total") v = Number(value) || 0;
              return updatePagamento.mutateAsync({ id: rowId, field: columnId, value: v });
            }}
            toolbarActions={<PagamentoButton colaboradorId={id} tipos={tipos ?? []} />}
            emptyMessage="Sem pagamentos"
          />
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar colaborador</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome completo *</Label><Input value={form.nome_completo ?? ""} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
            <div><Label>IBAN</Label><Input value={form.iban ?? ""} onChange={(e) => setForm({ ...form, iban: e.target.value })} /></div>
            <div><Label>Notas</Label><Textarea value={form.notas ?? ""} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Checkbox id="ativo-edit" checked={form.ativo ?? true} onCheckedChange={(c) => setForm({ ...form, ativo: !!c })} />
              <Label htmlFor="ativo-edit">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveColab.mutate()} disabled={saveColab.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

function DeleteRegisto({ id, colaboradorId }: { id: string; colaboradorId: string }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("registos_servico").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["registos_colab", colaboradorId] });
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover registo?")) remove.mutate(); }}>
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

function RegistoButton({ colaboradorId, tipos }: { colaboradorId: string; tipos: Tipo[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Registo>>({
    data_inicio: new Date().toISOString().slice(0, 10),
    quantidade: 1, outros_custos: 0, estado: "pendente",
  });
  const tipoMap = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos]);
  const preco = form.preco_unitario_override ?? (form.tipo_servico_id ? tipoMap.get(form.tipo_servico_id)?.preco_unitario ?? 0 : 0);
  const calc = Number(preco) * Number(form.quantidade ?? 1);
  const total = calc + Number(form.outros_custos ?? 0);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.tipo_servico_id) throw new Error("Tipo de serviço obrigatório");
      const { error } = await supabase.from("registos_servico").insert({
        colaborador_id: colaboradorId,
        tipo_servico_id: form.tipo_servico_id,
        data_inicio: form.data_inicio!,
        data_fim: form.data_fim || null,
        descricao: form.descricao?.trim() || null,
        quantidade: Number(form.quantidade) || 1,
        preco_unitario_override: form.preco_unitario_override != null && (form.preco_unitario_override as unknown as string) !== "" ? Number(form.preco_unitario_override) : null,
        outros_custos: Number(form.outros_custos) || 0,
        outros_custos_descricao: form.outros_custos_descricao?.trim() || null,
        km: form.km != null && (form.km as unknown as string) !== "" ? Number(form.km) : null,
        estado: form.estado ?? "pendente",
        submetido_pelo_colaborador: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registo criado");
      qc.invalidateQueries({ queryKey: ["registos_colab", colaboradorId] });
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
      setOpen(false);
      setForm({ data_inicio: new Date().toISOString().slice(0, 10), quantidade: 1, outros_custos: 0, estado: "pendente" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Registar Serviço</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo registo de serviço</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Tipo de serviço *</Label>
              <Select value={form.tipo_servico_id ?? ""} onValueChange={(v) => setForm({ ...form, tipo_servico_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                <SelectContent>
                  {tipos.filter(t => t.ativo).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome} — {fmtEUR(t.preco_unitario)}/{t.unidade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Data início *</Label><Input type="date" value={form.data_inicio ?? ""} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
            <div><Label>Data fim</Label><Input type="date" value={form.data_fim ?? ""} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
            <div className="col-span-2"><Label>Descrição</Label><Textarea value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div><Label>Quantidade</Label><Input type="number" step="0.01" value={form.quantidade ?? 1} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} /></div>
            <div>
              <Label>Preço unitário (override)</Label>
              <Input type="number" step="0.01"
                placeholder={form.tipo_servico_id ? String(tipoMap.get(form.tipo_servico_id)?.preco_unitario ?? "") : "—"}
                value={form.preco_unitario_override ?? ""}
                onChange={(e) => setForm({ ...form, preco_unitario_override: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div><Label>Outros custos (€)</Label><Input type="number" step="0.01" value={form.outros_custos ?? 0} onChange={(e) => setForm({ ...form, outros_custos: Number(e.target.value) })} /></div>
            <div><Label>KM</Label><Input type="number" step="0.01" value={form.km ?? ""} onChange={(e) => setForm({ ...form, km: e.target.value === "" ? null : Number(e.target.value) })} /></div>
            <div className="col-span-2"><Label>Descrição outros custos</Label><Input value={form.outros_custos_descricao ?? ""} onChange={(e) => setForm({ ...form, outros_custos_descricao: e.target.value })} /></div>
            <div className="col-span-2">
              <Label>Estado</Label>
              <Select value={form.estado ?? "pendente"} onValueChange={(v) => setForm({ ...form, estado: v as Registo["estado"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{Number(form.quantidade ?? 1)} × {fmtEUR(Number(preco))}</span><span className="tabular-nums">{fmtEUR(calc)}</span></div>
              {Number(form.outros_custos ?? 0) > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>Outros custos</span><span className="tabular-nums">{fmtEUR(form.outros_custos)}</span></div>}
              <div className="flex justify-between font-semibold mt-1 pt-1 border-t"><span>Total</span><span className="tabular-nums">{fmtEUR(total)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PagamentoButton({ colaboradorId, tipos }: { colaboradorId: string; tipos: Tipo[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ data_pagamento: string; referencia: string; metodo: string; notas: string; selecionados: string[] }>({
    data_pagamento: new Date().toISOString().slice(0, 10), referencia: "", metodo: "Transferência Bancária", notas: "", selecionados: [],
  });
  const tipoMap = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos]);

  const { data: aprovados } = useQuery({
    queryKey: ["aprovados_para_pagar", colaboradorId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registos_servico")
        .select("id, data_inicio, quantidade, preco_unitario_override, outros_custos, tipo_servico_id")
        .eq("colaborador_id", colaboradorId).eq("estado", "aprovado").is("pagamento_id", null)
        .order("data_inicio");
      if (error) throw error;
      return data as Array<{ id: string; data_inicio: string; quantidade: number; preco_unitario_override: number | null; outros_custos: number; tipo_servico_id: string }>;
    },
  });

  const total = useMemo(() => {
    if (!aprovados) return 0;
    return aprovados.filter((r) => form.selecionados.includes(r.id)).reduce((s, r) => {
      const preco = r.preco_unitario_override ?? (tipoMap.get(r.tipo_servico_id)?.preco_unitario ?? 0);
      return s + Number(preco) * Number(r.quantidade) + Number(r.outros_custos ?? 0);
    }, 0);
  }, [aprovados, form.selecionados, tipoMap]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: ins, error } = await supabase.from("pagamentos").insert({
        colaborador_id: colaboradorId,
        data_pagamento: form.data_pagamento,
        total,
        referencia: form.referencia.trim() || null,
        metodo: form.metodo.trim() || null,
        notas: form.notas.trim() || null,
      }).select("id").single();
      if (error) throw error;
      if (form.selecionados.length > 0) {
        const { error: e2 } = await supabase.from("registos_servico")
          .update({ pagamento_id: ins.id, estado: "pago" }).in("id", form.selecionados);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success("Pagamento registado");
      qc.invalidateQueries({ queryKey: ["pagamentos_colab", colaboradorId] });
      qc.invalidateQueries({ queryKey: ["registos_colab", colaboradorId] });
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
      setOpen(false);
      setForm({ data_pagamento: new Date().toISOString().slice(0, 10), referencia: "", metodo: "Transferência Bancária", notas: "", selecionados: [] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) => {
    setForm({ ...form, selecionados: form.selecionados.includes(id) ? form.selecionados.filter(x => x !== id) : [...form.selecionados, id] });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Registar Pagamento</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Data *</Label><Input type="date" value={form.data_pagamento} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })} /></div>
              <div><Label>Referência</Label><Input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} /></div>
              <div><Label>Método</Label><Input value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value })} /></div>
            </div>
            <div><Label>Notas</Label><Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
            <div>
              <Label>Registos aprovados a liquidar</Label>
              <div className="rounded-md border max-h-60 overflow-y-auto">
                {(aprovados ?? []).length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Sem registos aprovados por liquidar.</p>
                ) : (aprovados ?? []).map((r) => {
                  const preco = r.preco_unitario_override ?? (tipoMap.get(r.tipo_servico_id)?.preco_unitario ?? 0);
                  const v = Number(preco) * Number(r.quantidade) + Number(r.outros_custos ?? 0);
                  return (
                    <label key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 border-b last:border-0 cursor-pointer hover:bg-muted/40">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={form.selecionados.includes(r.id)} onCheckedChange={() => toggle(r.id)} />
                        <div className="text-sm">
                          <div>{new Date(r.data_inicio).toLocaleDateString("pt-PT")} — {tipoMap.get(r.tipo_servico_id)?.nome ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{Number(r.quantidade)} × {fmtEUR(Number(preco))}</div>
                        </div>
                      </div>
                      <span className="tabular-nums text-sm font-medium">{fmtEUR(v)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-between rounded-md border bg-muted/40 p-3 text-sm">
              <span>Total do pagamento</span>
              <span className="font-semibold tabular-nums">{fmtEUR(total)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || form.selecionados.length === 0}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}