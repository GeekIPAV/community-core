import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Check, Wallet, Receipt, Users as UsersIcon, Tag, Download, ExternalLink, UserPlus, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";
import { BulkImportDialog } from "@/components/servicos/BulkImportDialog";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/_app/_admin/servicos")({
  component: ServicosPage,
});

type Colaborador = {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  iban: string | null;
  notas: string | null;
  ativo: boolean;
  pessoa_id: string | null;
};

type TipoServico = {
  id: string;
  nome: string;
  descricao: string | null;
  unidade: string;
  preco_unitario: number;
  ativo: boolean;
};

type Registo = {
  id: string;
  colaborador_id: string;
  tipo_servico_id: string;
  data_inicio: string;
  data_fim: string | null;
  descricao: string | null;
  quantidade: number;
  preco_unitario_override: number | null;
  outros_custos: number;
  outros_custos_descricao: string | null;
  km: number | null;
  estado: "pendente" | "aprovado" | "pago";
  submetido_pelo_colaborador: boolean;
  pagamento_id: string | null;
  notas_admin: string | null;
};

type Pagamento = {
  id: string;
  colaborador_id: string;
  data_pagamento: string;
  total: number;
  referencia: string | null;
  metodo: string | null;
  notas: string | null;
};

const UNIDADES = ["hora", "sessão", "página", "km", "dia", "unidade"];
const ESTADOS: Registo["estado"][] = ["pendente", "aprovado", "pago"];

const fmtEUR = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

function ServicosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Serviços &amp; Pagamentos</h1>
        <p className="text-sm text-muted-foreground">
          Gere colaboradores, tipos de serviço, registos prestados e pagamentos.
        </p>
      </div>
      <Tabs defaultValue="registos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="registos"><Receipt className="mr-2 h-4 w-4" />Registos</TabsTrigger>
          <TabsTrigger value="pagamentos"><Wallet className="mr-2 h-4 w-4" />Pagamentos</TabsTrigger>
          <TabsTrigger value="colaboradores"><UsersIcon className="mr-2 h-4 w-4" />Colaboradores</TabsTrigger>
          <TabsTrigger value="tipos"><Tag className="mr-2 h-4 w-4" />Tipos de serviço</TabsTrigger>
        </TabsList>
        <TabsContent value="registos" className="mt-6"><RegistosTab /></TabsContent>
        <TabsContent value="pagamentos" className="mt-6"><PagamentosTab /></TabsContent>
        <TabsContent value="colaboradores" className="mt-6"><ColaboradoresTab /></TabsContent>
        <TabsContent value="tipos" className="mt-6"><TiposServicoTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// =========================================================
// COLABORADORES
// =========================================================
function ColaboradoresTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Colaborador | null>(null);
  const [form, setForm] = useState<Partial<Colaborador>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id, nome_completo, email, telefone, iban, notas, ativo, pessoa_id, pessoa:pessoas!colaboradores_pessoa_id_fkey(id, nome_completo)")
        .order("nome_completo");
      if (error) throw error;
      return data as (Colaborador & { pessoa: { id: string; nome_completo: string } | null })[];
    },
  });

  const reset = () => { setEditing(null); setForm({ ativo: true }); };
  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (c: Colaborador) => { setEditing(c); setForm(c); setOpen(true); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.nome_completo?.trim()) throw new Error("Nome obrigatório");
      const payload = {
        nome_completo: form.nome_completo.trim(),
        email: form.email?.trim() || null,
        telefone: form.telefone?.trim() || null,
        iban: form.iban?.trim() || null,
        notas: form.notas?.trim() || null,
        ativo: form.ativo ?? true,
        pessoa_id: form.pessoa_id ?? null,
      };
      if (editing) {
        const { error } = await supabase.from("colaboradores").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("colaboradores").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Colaborador atualizado" : "Colaborador criado");
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("colaboradores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["colaboradores"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: unknown }) => {
      const { error } = await supabase.from("colaboradores").update({ [field]: value } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["colaboradores"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  type ColabRow = Colaborador & { _status: string; pessoa: { id: string; nome_completo: string } | null };
  const rows = useMemo<ColabRow[]>(
    () => (data ?? []).map((c) => ({ ...c, _status: c.ativo ? "Ativos" : "Inativos" })),
    [data],
  );

  const columns = useMemo<SmartColumnDef<ColabRow>[]>(() => [
    {
      id: "nome_completo",
      accessorKey: "nome_completo",
      header: "Nome",
      size: 240,
      meta: { label: "Nome", filterVariant: "text", editType: "text" },
      cell: ({ row }) => (
        <Link to="/colaboradoras/$colaboradoraId" params={{ colaboradoraId: row.original.id }} className="inline-flex items-center gap-1 truncate font-medium hover:underline">
          <span className="truncate">{row.original.nome_completo}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
        </Link>
      ),
    },
    {
      id: "email", accessorKey: "email", header: "Email", size: 240,
      meta: { label: "Email", filterVariant: "text", editType: "text", hideOnMobile: true },
      cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span>,
    },
    {
      id: "telefone", accessorKey: "telefone", header: "Telefone", size: 140,
      meta: { label: "Telefone", filterVariant: "text", editType: "text", hideOnMobile: true },
      cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span>,
    },
    {
      id: "iban", accessorKey: "iban", header: "IBAN", size: 220,
      meta: { label: "IBAN", filterVariant: "text", editType: "text", hideOnMobile: true },
      cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{(getValue() as string) ?? "—"}</span>,
    },
    {
      id: "pessoa", accessorKey: "pessoa_id", header: "Participante", size: 220,
      meta: { label: "Participante", hideOnMobile: true },
      cell: ({ row }) => (
        <ParticipantePicker
          value={row.original.pessoa_id}
          label={row.original.pessoa?.nome_completo ?? null}
          onChange={(pid) => updateField.mutateAsync({ id: row.original.id, field: "pessoa_id", value: pid })}
        />
      ),
    },
    {
      id: "ativo", accessorKey: "ativo", header: "Estado", size: 100,
      meta: {
        label: "Estado", filterVariant: "select", filterOptions: ["true", "false"],
        editType: "select", editSelectOptions: [{ value: "true", label: "Ativo" }, { value: "false", label: "Inativo" }],
      },
      cell: ({ getValue }) => (getValue() ? <Badge>Ativo</Badge> : <Badge variant="outline">Inativo</Badge>),
    },
    {
      id: "_status", accessorKey: "_status", header: "Grupo", size: 100,
      enableHiding: false,
      meta: { label: "Grupo" },
      cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{String(getValue())}</span>,
    },
    {
      id: "_actions", header: "", size: 96, enableSorting: false, enableHiding: false, enableResizing: false,
      meta: { noTruncate: true },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row.original); }}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm(`Remover ${row.original.nome_completo}?`)) remove.mutate(row.original.id); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ], [remove]);

  return (
    <div className="space-y-4">
      <SmartTable
        tableId="colaboradores"
        columns={columns}
        data={rows}
        isLoading={isLoading}
        defaultGroupBy="_status"
        editableColumns={["nome_completo", "email", "telefone", "iban", "ativo"]}
        onCellEdit={(rowId, columnId, value) => {
          let v: unknown = value;
          if (columnId === "ativo") v = value === "true" || value === true;
          return updateField.mutateAsync({ id: rowId, field: columnId, value: v });
        }}
        toolbarActions={
          <Button size="sm" onClick={openNew} className="h-9">
            <Plus className="mr-2 h-4 w-4" />Novo colaborador
          </Button>
        }
        emptyMessage="Sem colaboradores"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar colaborador" : "Novo colaborador"}</DialogTitle>
            <DialogDescription>Dados de identificação e pagamento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome completo *</Label><Input value={form.nome_completo ?? ""} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
            <div><Label>IBAN</Label><Input value={form.iban ?? ""} onChange={(e) => setForm({ ...form, iban: e.target.value })} /></div>
            <div>
              <Label>Participante associado</Label>
              <ParticipantePicker
                value={form.pessoa_id ?? null}
                label={null}
                onChange={(pid) => { setForm({ ...form, pessoa_id: pid }); }}
                inline
              />
              <p className="text-xs text-muted-foreground mt-1">Liga este colaborador a um participante para que ele veja os seus serviços e pagamentos em "Os meus serviços".</p>
            </div>
            <div><Label>Notas</Label><Textarea value={form.notas ?? ""} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Checkbox id="ativo-c" checked={form.ativo ?? true} onCheckedChange={(c) => setForm({ ...form, ativo: !!c })} />
              <Label htmlFor="ativo-c">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =========================================================
// TIPOS DE SERVIÇO
// =========================================================
function TiposServicoTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TipoServico | null>(null);
  const [form, setForm] = useState<Partial<TipoServico>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["tipos_servico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_servico")
        .select("id, nome, descricao, unidade, preco_unitario, ativo")
        .order("nome");
      if (error) throw error;
      return data as TipoServico[];
    },
  });

  const reset = () => { setEditing(null); setForm({ ativo: true, unidade: "hora", preco_unitario: 0 }); };
  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (t: TipoServico) => { setEditing(t); setForm(t); setOpen(true); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.nome?.trim()) throw new Error("Nome obrigatório");
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao?.trim() || null,
        unidade: form.unidade || "hora",
        preco_unitario: Number(form.preco_unitario) || 0,
        ativo: form.ativo ?? true,
      };
      if (editing) {
        const { error } = await supabase.from("tipos_servico").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tipos_servico").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Tipo atualizado" : "Tipo criado");
      qc.invalidateQueries({ queryKey: ["tipos_servico"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tipos_servico").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["tipos_servico"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: unknown }) => {
      const { error } = await supabase.from("tipos_servico").update({ [field]: value } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tipos_servico"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const columns = useMemo<SmartColumnDef<TipoServico>[]>(() => [
    { id: "nome", accessorKey: "nome", header: "Nome", size: 240,
      meta: { label: "Nome", filterVariant: "text", editType: "text" },
      cell: ({ getValue }) => <span className="font-medium truncate">{String(getValue() ?? "")}</span> },
    { id: "descricao", accessorKey: "descricao", header: "Descrição", size: 320,
      meta: { label: "Descrição", filterVariant: "text", editType: "text", hideOnMobile: true },
      cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span> },
    { id: "unidade", accessorKey: "unidade", header: "Unidade", size: 110,
      meta: { label: "Unidade", filterVariant: "select", filterOptions: UNIDADES,
        editType: "select", editSelectOptions: UNIDADES.map((u) => ({ value: u, label: u })) },
      cell: ({ getValue }) => <Badge variant="outline">{String(getValue() ?? "")}</Badge> },
    { id: "preco_unitario", accessorKey: "preco_unitario", header: "Preço", size: 110,
      meta: { label: "Preço", filterVariant: "number", editType: "number" },
      cell: ({ getValue }) => <span className="tabular-nums text-right block">{fmtEUR(Number(getValue() ?? 0))}</span> },
    { id: "ativo", accessorKey: "ativo", header: "Estado", size: 100,
      meta: { label: "Estado", filterVariant: "select", filterOptions: ["true", "false"],
        editType: "select", editSelectOptions: [{ value: "true", label: "Ativo" }, { value: "false", label: "Inativo" }] },
      cell: ({ getValue }) => getValue() ? <Badge>Ativo</Badge> : <Badge variant="outline">Inativo</Badge> },
    { id: "_actions", header: "", size: 96, enableSorting: false, enableHiding: false, enableResizing: false,
      meta: { noTruncate: true },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row.original); }}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm(`Remover ${row.original.nome}?`)) remove.mutate(row.original.id); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) },
  ], [remove]);

  return (
    <div className="space-y-4">
      <SmartTable
        tableId="tipos_servico"
        columns={columns}
        data={data}
        isLoading={isLoading}
        editableColumns={["nome", "descricao", "unidade", "preco_unitario", "ativo"]}
        onCellEdit={(rowId, columnId, value) => {
          let v: unknown = value;
          if (columnId === "ativo") v = value === "true" || value === true;
          if (columnId === "preco_unitario") v = Number(value) || 0;
          return updateField.mutateAsync({ id: rowId, field: columnId, value: v });
        }}
        toolbarActions={
          <Button size="sm" onClick={openNew} className="h-9">
            <Plus className="mr-2 h-4 w-4" />Novo tipo
          </Button>
        }
        emptyMessage="Sem tipos de serviço"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tipo de serviço" : "Novo tipo de serviço"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Mediação Online" /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unidade</Label>
                <Select value={form.unidade ?? "hora"} onValueChange={(v) => setForm({ ...form, unidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Preço por unidade (€)</Label><Input type="number" step="0.01" value={form.preco_unitario ?? 0} onChange={(e) => setForm({ ...form, preco_unitario: Number(e.target.value) })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ativo-t" checked={form.ativo ?? true} onCheckedChange={(c) => setForm({ ...form, ativo: !!c })} />
              <Label htmlFor="ativo-t">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =========================================================
// REGISTOS
// =========================================================
function RegistosTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Registo | null>(null);
  const [form, setForm] = useState<Partial<Registo>>({});
  const [filterEstado, setFilterEstado] = useState<string>("__all");
  const [filterColab, setFilterColab] = useState<string>("__all");
  const [bulkOpen, setBulkOpen] = useState(false);

  const { data: colabs } = useQuery({
    queryKey: ["colaboradores_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores").select("id, nome_completo, ativo").order("nome_completo");
      if (error) throw error;
      return data as { id: string; nome_completo: string; ativo: boolean }[];
    },
  });
  const { data: tipos } = useQuery({
    queryKey: ["tipos_servico_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tipos_servico").select("id, nome, unidade, preco_unitario, ativo").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; unidade: string; preco_unitario: number; ativo: boolean }[];
    },
  });
  const { data, isLoading } = useQuery({
    queryKey: ["registos_servico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registos_servico")
        .select("id, colaborador_id, tipo_servico_id, data_inicio, data_fim, descricao, quantidade, preco_unitario_override, outros_custos, outros_custos_descricao, km, estado, submetido_pelo_colaborador, pagamento_id, notas_admin")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as Registo[];
    },
  });

  const colabMap = useMemo(() => new Map((colabs ?? []).map((c) => [c.id, c.nome_completo])), [colabs]);
  const tipoMap = useMemo(() => new Map((tipos ?? []).map((t) => [t.id, t])), [tipos]);

  const calcTotal = (r: Partial<Registo>): { calc: number; total: number } => {
    const tipo = r.tipo_servico_id ? tipoMap.get(r.tipo_servico_id) : null;
    const preco = r.preco_unitario_override != null ? Number(r.preco_unitario_override) : (tipo?.preco_unitario ?? 0);
    const qtd = Number(r.quantidade ?? 1) || 0;
    const calc = preco * qtd;
    const outros = Number(r.outros_custos ?? 0) || 0;
    return { calc, total: calc + outros };
  };

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (filterEstado !== "__all") rows = rows.filter((r) => r.estado === filterEstado);
    if (filterColab !== "__all") rows = rows.filter((r) => r.colaborador_id === filterColab);
    return rows;
  }, [data, filterEstado, filterColab]);

  const totals = useMemo(() => {
    return filtered.reduce((acc, r) => {
      const { total } = calcTotal(r);
      acc.total += total;
      if (r.estado === "pendente") acc.pendente += total;
      if (r.estado === "aprovado") acc.aprovado += total;
      if (r.estado === "pago") acc.pago += total;
      return acc;
    }, { total: 0, pendente: 0, aprovado: 0, pago: 0 });
  }, [filtered, tipoMap]);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    const activeSet = new Set((colabs ?? []).filter((c) => c.ativo).map((c) => c.id));
    for (const r of filtered) {
      if (!activeSet.has(r.colaborador_id)) continue;
      const name = colabMap.get(r.colaborador_id) ?? "—";
      map.set(name, (map.get(name) ?? 0) + calcTotal(r).total);
    }
    return Array.from(map.entries())
      .map(([nome, total]) => ({ nome, total: Number(total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [filtered, colabMap, tipoMap, colabs]);

  const exportCSV = () => {
    const headers = ["Data", "Colaborador", "Tipo", "Unidade", "Quantidade", "Preço un.", "Outros custos", "Total", "Estado", "Descrição"];
    const rows = filtered.map((r) => {
      const tipo = tipoMap.get(r.tipo_servico_id);
      const preco = r.preco_unitario_override ?? (tipo?.preco_unitario ?? 0);
      const { total } = calcTotal(r);
      return [
        r.data_inicio,
        colabMap.get(r.colaborador_id) ?? "",
        tipo?.nome ?? "",
        tipo?.unidade ?? "",
        String(r.quantidade),
        String(preco),
        String(r.outros_custos ?? 0),
        total.toFixed(2),
        r.estado,
        (r.descricao ?? "").replace(/\n/g, " "),
      ];
    });
    const csv = [headers, ...rows]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registos-servico-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setEditing(null);
    setForm({
      data_inicio: new Date().toISOString().slice(0, 10),
      quantidade: 1,
      outros_custos: 0,
      estado: "pendente",
      submetido_pelo_colaborador: false,
    });
  };
  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (r: Registo) => { setEditing(r); setForm(r); setOpen(true); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.colaborador_id) throw new Error("Colaborador obrigatório");
      if (!form.tipo_servico_id) throw new Error("Tipo de serviço obrigatório");
      if (!form.data_inicio) throw new Error("Data de início obrigatória");
      const payload = {
        colaborador_id: form.colaborador_id,
        tipo_servico_id: form.tipo_servico_id,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        descricao: form.descricao?.trim() || null,
        quantidade: Number(form.quantidade) || 1,
        preco_unitario_override: form.preco_unitario_override != null && form.preco_unitario_override !== ("" as any) ? Number(form.preco_unitario_override) : null,
        outros_custos: Number(form.outros_custos) || 0,
        outros_custos_descricao: form.outros_custos_descricao?.trim() || null,
        km: form.km != null && form.km !== ("" as any) ? Number(form.km) : null,
        estado: (form.estado ?? "pendente") as Registo["estado"],
        submetido_pelo_colaborador: form.submetido_pelo_colaborador ?? false,
        notas_admin: form.notas_admin?.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("registos_servico").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("registos_servico").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Registo atualizado" : "Registo criado");
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setEstado = useMutation({
    mutationFn: async (v: { id: string; estado: Registo["estado"] }) => {
      const { error } = await supabase.from("registos_servico").update({ estado: v.estado }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["registos_servico"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("registos_servico").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Registo removido"); qc.invalidateQueries({ queryKey: ["registos_servico"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: unknown }) => {
      const { error } = await supabase.from("registos_servico").update({ [field]: value } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registos_servico"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  type RegistoRow = Registo & { _colab: string; _tipo: string; _total: number; _unidade: string };
  const rowsData = useMemo<RegistoRow[]>(() => filtered.map((r) => {
    const tipo = tipoMap.get(r.tipo_servico_id);
    return {
      ...r,
      _colab: colabMap.get(r.colaborador_id) ?? "—",
      _tipo: tipo?.nome ?? "—",
      _unidade: tipo?.unidade ?? "",
      _total: calcTotal(r).total,
    };
  }), [filtered, colabMap, tipoMap]);

  const columns = useMemo<SmartColumnDef<RegistoRow>[]>(() => [
    { id: "data_inicio", accessorKey: "data_inicio", header: "Data", size: 150,
      meta: { label: "Data", filterVariant: "date" },
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {new Date(row.original.data_inicio).toLocaleDateString("pt-PT")}
          {row.original.data_fim && row.original.data_fim !== row.original.data_inicio && (
            <span className="text-muted-foreground"> → {new Date(row.original.data_fim).toLocaleDateString("pt-PT")}</span>
          )}
        </span>
      ) },
    { id: "_colab", accessorKey: "_colab", header: "Colaborador", size: 200,
      meta: { label: "Colaborador", filterVariant: "text" },
      cell: ({ row }) => (
        <Link to="/colaboradoras/$colaboradoraId" params={{ colaboradoraId: row.original.colaborador_id }} className="font-medium hover:underline truncate block">
          {row.original._colab}
        </Link>
      ) },
    { id: "_tipo", accessorKey: "_tipo", header: "Serviço", size: 260,
      meta: { label: "Serviço", filterVariant: "text" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate">{row.original._tipo}</div>
          {row.original.descricao && <div className="text-xs text-muted-foreground truncate">{row.original.descricao}</div>}
        </div>
      ) },
    { id: "quantidade", accessorKey: "quantidade", header: "Qtd", size: 100,
      meta: { label: "Quantidade", filterVariant: "number", editType: "number" },
      cell: ({ row }) => (
        <span className="block text-right tabular-nums">{Number(row.original.quantidade)} {row.original._unidade}</span>
      ) },
    { id: "_total", accessorKey: "_total", header: "Total", size: 110,
      meta: { label: "Total", filterVariant: "number" },
      cell: ({ getValue }) => <span className="block text-right tabular-nums font-medium">{fmtEUR(Number(getValue() ?? 0))}</span> },
    { id: "estado", accessorKey: "estado", header: "Estado", size: 130,
      meta: { label: "Estado", filterVariant: "select", filterOptions: ESTADOS as unknown as string[] },
      cell: ({ row }) => (
        <Select value={row.original.estado} onValueChange={(v) => setEstado.mutate({ id: row.original.id, estado: v as Registo["estado"] })}>
          <SelectTrigger className="h-8 w-28" onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
          <SelectContent>{ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
        </Select>
      ) },
    { id: "submetido_pelo_colaborador", accessorKey: "submetido_pelo_colaborador", header: "Origem", size: 120,
      meta: { label: "Origem", filterVariant: "select", filterOptions: ["true", "false"], hideOnMobile: true },
      cell: ({ getValue }) => getValue() ? <Badge variant="outline">Self-service</Badge> : <Badge variant="secondary">Admin</Badge> },
    { id: "_actions", header: "", size: 96, enableSorting: false, enableHiding: false, enableResizing: false,
      meta: { noTruncate: true },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row.original); }}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm("Remover registo?")) remove.mutate(row.original.id); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) },
  ], [setEstado, remove]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total filtrado" value={fmtEUR(totals.total)} />
        <SummaryCard label="Pendente" value={fmtEUR(totals.pendente)} variant="warning" />
        <SummaryCard label="Aprovado" value={fmtEUR(totals.aprovado)} variant="info" />
        <SummaryCard label="Pago" value={fmtEUR(totals.pago)} variant="success" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os estados</SelectItem>
              {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterColab} onValueChange={setFilterColab}>
            <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Colaborador" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os colaboradores</SelectItem>
              {(colabs ?? []).filter((c) => c.ativo).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium mb-3">Total por colaborador (filtro atual)</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="nome" angle={-25} textAnchor="end" height={60} fontSize={11} interval={0} />
                <YAxis fontSize={11} tickFormatter={(v) => `€${v}`} />
                <Tooltip
                  formatter={(v: number) => fmtEUR(v)}
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <SmartTable
        tableId="registos_servico"
        columns={columns}
        data={rowsData}
        isLoading={isLoading}
        editableColumns={["quantidade", "estado"]}
        onCellEdit={(rowId, columnId, value) => {
          let v: unknown = value;
          if (columnId === "quantidade") v = Number(value) || 0;
          return updateField.mutateAsync({ id: rowId, field: columnId, value: v });
        }}
        toolbarActions={
          <>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0} className="h-9">
              <Download className="mr-2 h-4 w-4" />Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} className="h-9">
              <Upload className="mr-2 h-4 w-4" />Importar em massa
            </Button>
            <Button size="sm" onClick={openNew} className="h-9">
              <Plus className="mr-2 h-4 w-4" />Novo registo
            </Button>
          </>
        }
        emptyMessage="Sem registos"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar registo" : "Novo registo"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 md:col-span-1">
              <Label>Colaborador *</Label>
              <Select value={form.colaborador_id ?? ""} onValueChange={(v) => setForm({ ...form, colaborador_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                <SelectContent>{(colabs ?? []).filter(c => c.ativo).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <Label>Tipo de serviço *</Label>
              <Select value={form.tipo_servico_id ?? ""} onValueChange={(v) => setForm({ ...form, tipo_servico_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                <SelectContent>{(tipos ?? []).filter(t => t.ativo).map((t) => <SelectItem key={t.id} value={t.id}>{t.nome} ({fmtEUR(t.preco_unitario)}/{t.unidade})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data início *</Label><Input type="date" value={form.data_inicio ?? ""} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
            <div><Label>Data fim (opcional)</Label><Input type="date" value={form.data_fim ?? ""} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
            <div className="col-span-2"><Label>Descrição</Label><Textarea value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhes do serviço prestado" /></div>
            <div><Label>Quantidade</Label><Input type="number" step="0.01" value={form.quantidade ?? 1} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} /></div>
            <div>
              <Label>Preço unitário (override)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={form.tipo_servico_id ? String(tipoMap.get(form.tipo_servico_id)?.preco_unitario ?? "") : "—"}
                value={form.preco_unitario_override ?? ""}
                onChange={(e) => setForm({ ...form, preco_unitario_override: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
            <div><Label>KM</Label><Input type="number" step="0.01" value={form.km ?? ""} onChange={(e) => setForm({ ...form, km: e.target.value === "" ? null : Number(e.target.value) })} /></div>
            <div><Label>Outros custos (€)</Label><Input type="number" step="0.01" value={form.outros_custos ?? 0} onChange={(e) => setForm({ ...form, outros_custos: Number(e.target.value) })} /></div>
            <div className="col-span-2"><Label>Descrição outros custos</Label><Input value={form.outros_custos_descricao ?? ""} onChange={(e) => setForm({ ...form, outros_custos_descricao: e.target.value })} placeholder="ex.: transporte, materiais" /></div>
            <div>
              <Label>Estado</Label>
              <Select value={form.estado ?? "pendente"} onValueChange={(v) => setForm({ ...form, estado: v as Registo["estado"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Notas admin</Label><Textarea value={form.notas_admin ?? ""} onChange={(e) => setForm({ ...form, notas_admin: e.target.value })} /></div>
            <div className="col-span-2 rounded-md border bg-muted/40 p-3 text-sm flex justify-between">
              <span className="text-muted-foreground">Total estimado</span>
              <span className="font-semibold tabular-nums">{fmtEUR(calcTotal(form).total)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkImportDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        colaboradores={colabs ?? []}
        tipos={tipos ?? []}
        onImported={() => qc.invalidateQueries({ queryKey: ["registos_servico"] })}
      />
    </div>
  );
}

function SummaryCard({ label, value, variant }: { label: string; value: string; variant?: "warning" | "info" | "success" }) {
  const tone =
    variant === "warning" ? "text-amber-600 dark:text-amber-400" :
    variant === "info" ? "text-blue-600 dark:text-blue-400" :
    variant === "success" ? "text-emerald-600 dark:text-emerald-400" :
    "text-foreground";
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

// =========================================================
// PAGAMENTOS
// =========================================================
function PagamentosTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pagamento | null>(null);
  const [form, setForm] = useState<Partial<Pagamento> & { liquidar_registos?: string[] }>({});

  const { data: colabs } = useQuery({
    queryKey: ["colaboradores_lookup_pag"],
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores").select("id, nome_completo, ativo").order("nome_completo");
      if (error) throw error;
      return data as { id: string; nome_completo: string; ativo: boolean }[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["pagamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("id, colaborador_id, data_pagamento, total, referencia, metodo, notas")
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data as Pagamento[];
    },
  });

  const { data: pendentesParaLiquidar } = useQuery({
    queryKey: ["registos_aprovados", form.colaborador_id],
    enabled: !!form.colaborador_id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registos_servico")
        .select("id, data_inicio, quantidade, preco_unitario_override, outros_custos, tipo_servico_id, estado, pagamento_id")
        .eq("colaborador_id", form.colaborador_id!)
        .eq("estado", "aprovado")
        .is("pagamento_id", null);
      if (error) throw error;
      return data as Array<{ id: string; data_inicio: string; quantidade: number; preco_unitario_override: number | null; outros_custos: number; tipo_servico_id: string }>;
    },
  });

  const { data: tipos } = useQuery({
    queryKey: ["tipos_servico_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tipos_servico").select("id, nome, preco_unitario");
      if (error) throw error;
      return data as { id: string; nome: string; preco_unitario: number }[];
    },
  });
  const tipoMap = useMemo(() => new Map((tipos ?? []).map((t) => [t.id, t])), [tipos]);
  const colabMap = useMemo(() => new Map((colabs ?? []).map((c) => [c.id, c.nome_completo])), [colabs]);

  const totalSelecionado = useMemo(() => {
    if (!pendentesParaLiquidar || !form.liquidar_registos) return 0;
    return pendentesParaLiquidar
      .filter((r) => form.liquidar_registos!.includes(r.id))
      .reduce((sum, r) => {
        const preco = r.preco_unitario_override ?? (tipoMap.get(r.tipo_servico_id)?.preco_unitario ?? 0);
        return sum + Number(preco) * Number(r.quantidade) + Number(r.outros_custos ?? 0);
      }, 0);
  }, [pendentesParaLiquidar, form.liquidar_registos, tipoMap]);

  const reset = () => {
    setEditing(null);
    setForm({
      data_pagamento: new Date().toISOString().slice(0, 10),
      total: 0,
      metodo: "Transferência Bancária",
      liquidar_registos: [],
    });
  };
  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (p: Pagamento) => { setEditing(p); setForm({ ...p, liquidar_registos: [] }); setOpen(true); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.colaborador_id) throw new Error("Colaborador obrigatório");
      const totalNum = totalSelecionado > 0 ? totalSelecionado : Number(form.total) || 0;
      const payload = {
        colaborador_id: form.colaborador_id,
        data_pagamento: form.data_pagamento || new Date().toISOString().slice(0, 10),
        total: totalNum,
        referencia: form.referencia?.trim() || null,
        metodo: form.metodo?.trim() || null,
        notas: form.notas?.trim() || null,
      };
      let pagamentoId: string;
      if (editing) {
        const { error } = await supabase.from("pagamentos").update(payload).eq("id", editing.id);
        if (error) throw error;
        pagamentoId = editing.id;
      } else {
        const { data: ins, error } = await supabase.from("pagamentos").insert(payload).select("id").single();
        if (error) throw error;
        pagamentoId = ins.id;
      }
      // Liquidar registos selecionados
      const ids = form.liquidar_registos ?? [];
      if (ids.length > 0) {
        const { error: e2 } = await supabase
          .from("registos_servico")
          .update({ pagamento_id: pagamentoId, estado: "pago" })
          .in("id", ids);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Pagamento atualizado" : "Pagamento registado");
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Soltar registos associados
      await supabase.from("registos_servico").update({ pagamento_id: null, estado: "aprovado" }).eq("pagamento_id", id);
      const { error } = await supabase.from("pagamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento removido");
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePend = (id: string) => {
    const cur = form.liquidar_registos ?? [];
    setForm({ ...form, liquidar_registos: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };

  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: unknown }) => {
      const { error } = await supabase.from("pagamentos").update({ [field]: value } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pagamentos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  type PagRow = Pagamento & { _colab: string };
  const rows = useMemo<PagRow[]>(
    () => (data ?? []).map((p) => ({ ...p, _colab: colabMap.get(p.colaborador_id) ?? "—" })),
    [data, colabMap],
  );

  const columns = useMemo<SmartColumnDef<PagRow>[]>(() => [
    { id: "data_pagamento", accessorKey: "data_pagamento", header: "Data", size: 130,
      meta: { label: "Data", filterVariant: "date", editType: "date" },
      cell: ({ getValue }) => <span className="text-sm whitespace-nowrap">{new Date(String(getValue())).toLocaleDateString("pt-PT")}</span> },
    { id: "_colab", accessorKey: "_colab", header: "Colaborador", size: 220,
      meta: { label: "Colaborador", filterVariant: "text" },
      cell: ({ row }) => (
        <Link to="/colaboradoras/$colaboradoraId" params={{ colaboradoraId: row.original.colaborador_id }} className="font-medium hover:underline truncate block">
          {row.original._colab}
        </Link>
      ) },
    { id: "referencia", accessorKey: "referencia", header: "Referência", size: 200,
      meta: { label: "Referência", filterVariant: "text", editType: "text" },
      cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span> },
    { id: "metodo", accessorKey: "metodo", header: "Método", size: 180,
      meta: { label: "Método", filterVariant: "text", editType: "text", hideOnMobile: true },
      cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span> },
    { id: "total", accessorKey: "total", header: "Total", size: 120,
      meta: { label: "Total", filterVariant: "number", editType: "number" },
      cell: ({ getValue }) => <span className="block text-right tabular-nums font-medium">{fmtEUR(Number(getValue() ?? 0))}</span> },
    { id: "_actions", header: "", size: 96, enableSorting: false, enableHiding: false, enableResizing: false,
      meta: { noTruncate: true },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row.original); }}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm("Remover pagamento? Os registos associados voltam a 'aprovado'.")) remove.mutate(row.original.id); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) },
  ], [remove]);

  return (
    <div className="space-y-4">
      <SmartTable
        tableId="pagamentos"
        columns={columns}
        data={rows}
        isLoading={isLoading}
        editableColumns={["referencia", "metodo", "total", "data_pagamento"]}
        onCellEdit={(rowId, columnId, value) => {
          let v: unknown = value;
          if (columnId === "total") v = Number(value) || 0;
          return updateField.mutateAsync({ id: rowId, field: columnId, value: v });
        }}
        toolbarActions={
          <Button size="sm" onClick={openNew} className="h-9">
            <Plus className="mr-2 h-4 w-4" />Novo pagamento
          </Button>
        }
        emptyMessage="Sem pagamentos"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar pagamento" : "Novo pagamento"}</DialogTitle>
            <DialogDescription>Liquida registos aprovados de um colaborador.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Colaborador *</Label>
              <Select value={form.colaborador_id ?? ""} onValueChange={(v) => setForm({ ...form, colaborador_id: v, liquidar_registos: [] })}>
                <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                <SelectContent>{(colabs ?? []).filter((c) => c.ativo).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data *</Label><Input type="date" value={form.data_pagamento ?? ""} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })} /></div>
            <div><Label>Referência</Label><Input value={form.referencia ?? ""} onChange={(e) => setForm({ ...form, referencia: e.target.value })} placeholder="8/04 - Safaa" /></div>
            <div><Label>Método</Label><Input value={form.metodo ?? ""} onChange={(e) => setForm({ ...form, metodo: e.target.value })} placeholder="Transferência Bancária" /></div>
            <div className="col-span-2"><Label>Notas</Label><Textarea value={form.notas ?? ""} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>

            {!editing && form.colaborador_id && (
              <div className="col-span-2 space-y-2">
                <Label>Registos aprovados disponíveis</Label>
                <div className="rounded-md border max-h-56 overflow-y-auto">
                  {(pendentesParaLiquidar ?? []).length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">Sem registos aprovados pendentes de pagamento.</p>
                  ) : (
                    <ul className="divide-y">
                      {(pendentesParaLiquidar ?? []).map((r) => {
                        const preco = r.preco_unitario_override ?? (tipoMap.get(r.tipo_servico_id)?.preco_unitario ?? 0);
                        const total = Number(preco) * Number(r.quantidade) + Number(r.outros_custos ?? 0);
                        const checked = (form.liquidar_registos ?? []).includes(r.id);
                        return (
                          <li key={r.id} className="flex items-center gap-3 p-2 text-sm">
                            <Checkbox checked={checked} onCheckedChange={() => togglePend(r.id)} />
                            <span className="flex-1">
                              <span className="text-muted-foreground">{new Date(r.data_inicio).toLocaleDateString("pt-PT")}</span>{" · "}
                              {tipoMap.get(r.tipo_servico_id)?.nome ?? "—"}{" · "}
                              {Number(r.quantidade)} un
                            </span>
                            <span className="tabular-nums font-medium">{fmtEUR(total)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}

            <div className="col-span-2 rounded-md border bg-muted/40 p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {totalSelecionado > 0 ? "Total dos registos selecionados" : "Total (manual)"}
              </span>
              {totalSelecionado > 0 ? (
                <span className="font-semibold tabular-nums">{fmtEUR(totalSelecionado)}</span>
              ) : (
                <Input
                  type="number"
                  step="0.01"
                  className="w-32 text-right"
                  value={form.total ?? 0}
                  onChange={(e) => setForm({ ...form, total: Number(e.target.value) })}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Check className="mr-2 h-4 w-4" />Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}