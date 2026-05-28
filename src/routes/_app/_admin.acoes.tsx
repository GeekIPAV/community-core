import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Maximize2, Minimize2, ArrowUpDown, UserPlus, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  flexRender, type ColumnDef, type SortingState, type VisibilityState, type ColumnOrderState,
} from "@tanstack/react-table";
import { AdvancedTableFilters, advancedFilterFn, type ColumnFilterMeta } from "@/components/advanced-table-filters";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { DraggableTableHeaders } from "@/components/draggable-table-headers";

export const Route = createFileRoute("/_app/_admin/acoes")({
  component: AcoesPage,
});

type FieldType = "text" | "number" | "date" | "checkbox" | "select" | "multiselect";
type FieldDef = { key: string; label: string; type: FieldType; required?: boolean; options?: string[] };

const TYPE_LABEL: Record<FieldType, string> = {
  text: "Texto",
  number: "Número",
  date: "Data",
  checkbox: "Sim/Não",
  select: "Escolha única",
  multiselect: "Escolha múltipla",
};

function parseFields(config: any): FieldDef[] {
  if (Array.isArray(config?.fields)) {
    return (config.fields as any[]).map((f) => ({
      key: String(f.key ?? ""),
      label: String(f.label ?? f.key ?? ""),
      type: (["text", "number", "date", "checkbox", "select", "multiselect"].includes(f.type) ? f.type : "text") as FieldType,
      required: !!f.required,
      options: Array.isArray(f.options) ? f.options.map((o: any) => String(o)) : undefined,
    }));
  }
  if (config && typeof config === "object") {
    return Object.entries(config).map(([key, t]) => ({
      key,
      label: key,
      type: (t === "boolean" ? "checkbox" : t === "number" ? "number" : t === "date" ? "date" : "text") as FieldType,
      required: false,
    }));
  }
  return [];
}

function slugifyKey(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function FieldsEditor({ fields, setFields }: { fields: FieldDef[]; setFields: (f: FieldDef[]) => void }) {
  const update = (i: number, patch: Partial<FieldDef>) => {
    const next = fields.map((f, idx) => {
      if (idx !== i) return f;
      const merged = { ...f, ...patch };
      if (patch.label !== undefined) {
        const base = slugifyKey(patch.label) || `campo_${i + 1}`;
        let key = base;
        let n = 2;
        const taken = new Set(fields.filter((_, k) => k !== i).map((x) => x.key));
        while (taken.has(key)) key = `${base}_${n++}`;
        merged.key = key;
      }
      return merged;
    });
    setFields(next);
  };
  const remove = (i: number) => setFields(fields.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    setFields(next);
  };
  const add = () => {
    const n = fields.length + 1;
    setFields([...fields, { key: `campo_${n}`, label: `Campo ${n}`, type: "text", required: false }]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Campos do formulário</Label>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar campo
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          Sem campos. Clica em “Adicionar campo” para criar perguntas do formulário de inscrição.
        </p>
      ) : (
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="space-y-2 rounded-md border p-3">
              <div className="grid gap-2 md:grid-cols-[1fr_160px_auto]">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Pergunta</Label>
                <Input
                  value={f.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={f.type} onValueChange={(v) => update(i, { type: v as FieldType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-between gap-1 md:flex-col md:items-stretch">
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={!!f.required} onCheckedChange={(v) => update(i, { required: !!v })} />
                  Obrigatório
                </label>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === fields.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              </div>
              {(f.type === "select" || f.type === "multiselect") && (
                <OptionsEditor
                  options={f.options ?? []}
                  setOptions={(options) => update(i, { options })}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ options, setOptions }: { options: string[]; setOptions: (o: string[]) => void }) {
  return (
    <div className="space-y-1 rounded-md bg-muted/30 p-2">
      <Label className="text-xs text-muted-foreground">Opções</Label>
      {options.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Sem opções. Adiciona pelo menos uma.</p>
      )}
      <div className="space-y-1">
        {options.map((opt, idx) => (
          <div key={idx} className="flex gap-1">
            <Input
              value={opt}
              onChange={(e) => setOptions(options.map((o, k) => (k === idx ? e.target.value : o)))}
              placeholder={`Opção ${idx + 1}`}
            />
            <Button type="button" size="icon" variant="ghost" onClick={() => setOptions(options.filter((_, k) => k !== idx))}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" size="sm" variant="outline" onClick={() => setOptions([...options, ""])}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar opção
      </Button>
    </div>
  );
}

type AcaoForm = {
  nome: string;
  local: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  inscricoes_abertas: boolean;
  fields: FieldDef[];
};

const EMPTY_FORM: AcaoForm = { nome: "", local: "", descricao: "", data_inicio: "", data_fim: "", status: "ativa", inscricoes_abertas: true, fields: [] };

const DEFAULT_STATUSES = ["ativa", "cancelada", "concluida"];

function StatusInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const all = Array.from(new Set([...DEFAULT_STATUSES, ...options].filter(Boolean)));
  return (
    <>
      <Input
        list="acao-status-list"
        value={value}
        placeholder="Ex: ativa, em-pausa…"
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id="acao-status-list">
        {all.map((s) => <option key={s} value={s} />)}
      </datalist>
    </>
  );
}

function toDtLocal(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDtLocal(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const INSCRICAO_STATUSES = ["confirmada", "pendente", "presente", "ausente", "cancelada"] as const;
type InscricaoStatus = typeof INSCRICAO_STATUSES[number];

const INSCRICAO_STATUS_LABEL: Record<InscricaoStatus, string> = {
  confirmada: "Confirmada",
  pendente: "Pendente",
  presente: "Presente",
  ausente: "Ausente",
  cancelada: "Cancelada",
};

type InscricaoRow = {
  id: string;
  status: InscricaoStatus;
  valores_dinamicos: Record<string, any> | null;
  pessoa: any;
};

function InscricoesTab({ acaoId, fields }: { acaoId: string; fields: FieldDef[] }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<InscricaoStatus>("presente");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const { data, isLoading } = useQuery({
    queryKey: ["inscricoes", acaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inscricoes")
        .select("id, status, valores_dinamicos, created_at, pessoa:pessoas(id, nome_completo, email, telefone, data_nascimento, nif, cidade_residencia, genero, nacionalidade)")
        .eq("acao_id", acaoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: InscricaoStatus }) => {
      const { error } = await supabase.from("inscricoes").update({ status: status as any }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inscricoes", acaoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const baseRows: InscricaoRow[] = useMemo(
    () => (data ?? []).filter((r: any) => r.status !== "cancelada"),
    [data]
  );
  const total = baseRows.length;
  const presentes = baseRows.filter((r) => r.status === "presente").length;

  const columns: ColumnDef<InscricaoRow>[] = useMemo(() => [
    {
      id: "status",
      header: "Estado",
      accessorFn: (r) => INSCRICAO_STATUS_LABEL[r.status] ?? r.status,
      filterFn: advancedFilterFn as any,
      meta: { filterVariant: "select", filterOptions: INSCRICAO_STATUSES.map((s) => INSCRICAO_STATUS_LABEL[s]), label: "Estado" } satisfies ColumnFilterMeta,
      cell: ({ row }) => (
        <Select
          value={row.original.status}
          onValueChange={(v) => updateStatus.mutate({ ids: [row.original.id], status: v as InscricaoStatus })}
        >
          <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {INSCRICAO_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{INSCRICAO_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    { id: "nome", header: "Nome", accessorFn: (r) => r.pessoa?.nome_completo ?? "", filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Nome" } satisfies ColumnFilterMeta },
    { id: "email", header: "Email", accessorFn: (r) => r.pessoa?.email ?? "", filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Email" } satisfies ColumnFilterMeta },
    { id: "telefone", header: "Telefone", accessorFn: (r) => r.pessoa?.telefone ?? "", filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Telefone" } satisfies ColumnFilterMeta },
    { id: "data_nascimento", header: "Data nasc.", accessorFn: (r) => r.pessoa?.data_nascimento ?? "", filterFn: advancedFilterFn as any, meta: { filterVariant: "date", label: "Data nascimento" } satisfies ColumnFilterMeta },
    { id: "nif", header: "NIF", accessorFn: (r) => r.pessoa?.nif ?? "", filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "NIF" } satisfies ColumnFilterMeta },
    { id: "cidade", header: "Cidade", accessorFn: (r) => r.pessoa?.cidade_residencia ?? "", filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Cidade" } satisfies ColumnFilterMeta },
    ...fields.map<ColumnDef<InscricaoRow>>((f) => {
      const variant: ColumnFilterMeta["filterVariant"] =
        f.type === "date" ? "date" : f.type === "number" ? "number" : (f.type === "select" || f.type === "multiselect") ? "select" : "text";
      return {
        id: `field:${f.key}`,
        header: f.label,
        accessorFn: (r) => {
          const v = r.valores_dinamicos?.[f.key];
          if (v === undefined || v === null) return "";
          return Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Sim" : "Não") : v;
        },
        filterFn: advancedFilterFn as any,
        meta: { filterVariant: variant, filterOptions: f.options, label: f.label } satisfies ColumnFilterMeta,
      };
    }),
  ], [fields]);

  const table = useReactTable({
    data: baseRows,
    columns,
    state: { sorting, columnVisibility, columnOrder },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (r) => r.id,
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const filteredRows = table.getRowModel().rows;
  const allSelected = filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.original.id));
  const someSelected = selected.size > 0;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filteredRows.map((r) => r.original.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const applyBulk = () => {
    if (selected.size === 0) return;
    updateStatus.mutate(
      { ids: Array.from(selected), status: bulkStatus },
      { onSuccess: () => { qc.invalidateQueries({ queryKey: ["inscricoes", acaoId] }); setSelected(new Set()); toast.success("Estado atualizado"); } },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-md border px-3 py-2">
          <p className="text-xs text-muted-foreground">Inscritos</p>
          <p className="text-xl font-semibold">{total}</p>
        </div>
        <div className="rounded-md border px-3 py-2">
          <p className="text-xs text-muted-foreground">Presentes</p>
          <p className="text-xl font-semibold">{presentes}</p>
        </div>
        <div className="ml-auto">
          <AdvancedTableFilters table={table} />
        </div>
        <DataTableViewOptions table={table} />
      </div>
      {baseRows.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          Ainda ninguém se inscreveu.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
            <span className="text-xs text-muted-foreground">
              {someSelected ? `${selected.size} selecionada(s)` : "Seleciona inscrições para alterar em massa"}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as InscricaoStatus)}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INSCRICAO_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{INSCRICAO_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!someSelected || updateStatus.isPending} onClick={applyBulk}>
                Aplicar
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Selecionar tudo" />
                  </TableHead>
                  <DraggableTableHeaders table={table} onOrderChange={setColumnOrder} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={table.getVisibleLeafColumns().length + 1} className="text-center text-xs text-muted-foreground">
                      Sem resultados para os filtros aplicados.
                    </TableCell>
                  </TableRow>
                )}
                {filteredRows.map((row) => (
                  <TableRow key={row.id} data-state={selected.has(row.original.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selected.has(row.original.id)} onCheckedChange={() => toggleOne(row.original.id)} />
                    </TableCell>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell ?? ((c: any) => c.getValue() || "—"), cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function AcoesPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<AcaoForm>(EMPTY_FORM);

  const [editing, setEditing] = useState<(AcaoForm & { id: string }) | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editFullscreen, setEditFullscreen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["acoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("acoes").select("*").order("data_inicio", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: inscricaoCounts } = useQuery({
    queryKey: ["acoes", "inscricoes-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inscricoes")
        .select("acao_id, status");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of (data ?? []) as any[]) {
        if (r.status === "cancelada") continue;
        map.set(r.acao_id, (map.get(r.acao_id) ?? 0) + 1);
      }
      return map;
    },
  });

  const toggleInscricoesAbertas = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("acoes").update({ inscricoes_abertas: value } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acoes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["acoes"] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("acoes").insert({
        nome: form.nome,
        local: form.local || null,
        descricao: form.descricao || null,
        data_inicio: fromDtLocal(form.data_inicio),
        data_fim: fromDtLocal(form.data_fim),
        status: form.status,
        inscricoes_abertas: form.inscricoes_abertas,
        config_campos: { fields: form.fields },
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação criada");
      invalidate();
      setAddOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("acoes")
        .update({
          nome: editing.nome,
          local: editing.local || null,
          descricao: editing.descricao || null,
          data_inicio: fromDtLocal(editing.data_inicio),
          data_fim: fromDtLocal(editing.data_fim),
          status: editing.status,
          inscricoes_abertas: editing.inscricoes_abertas,
          config_campos: { fields: editing.fields },
        } as any)
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação atualizada");
      invalidate();
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!deleteId) return;
      const { error } = await supabase.from("acoes").delete().eq("id", deleteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação apagada");
      invalidate();
      setDeleteId(null);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ações</h1>
          <p className="text-sm text-muted-foreground">Eventos da comunidade</p>
        </div>
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setForm(EMPTY_FORM); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nova ação</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova ação</DialogTitle>
              <DialogDescription>Define os dados da ação e que campos os participantes vão preencher.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Local</Label><Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <StatusInput
                    value={form.status}
                    onChange={(v) => setForm({ ...form, status: v })}
                    options={(data ?? []).map((a: any) => a.status).filter(Boolean)}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Data de início</Label><Input type="datetime-local" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
                <div className="space-y-2"><Label>Data de fim</Label><Input type="datetime-local" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
              </div>
              <label className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Inscrições abertas</p>
                  <p className="text-xs text-muted-foreground">Quando desligado, a ação não mostra o botão "Inscrever" no portal público.</p>
                </div>
                <Switch checked={form.inscricoes_abertas} onCheckedChange={(c) => setForm({ ...form, inscricoes_abertas: c })} />
              </label>
              <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
              <FieldsEditor fields={form.fields} setFields={(fields) => setForm({ ...form, fields })} />
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!form.nome || create.isPending}>
                {create.isPending ? "A guardar…" : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem ações.</p>}
          {data?.map((a) => {
            const fields = parseFields(a.config_campos);
            const inscritos = inscricaoCounts?.get(a.id) ?? 0;
            const inscricoesAbertas = (a as any).inscricoes_abertas ?? true;
            return (
              <Card
                key={a.id}
                className="cursor-pointer transition-colors hover:bg-muted/30"
                onClick={() => setEditing({
                  id: a.id,
                  nome: a.nome ?? "",
                  local: a.local ?? "",
                  descricao: a.descricao ?? "",
                  data_inicio: toDtLocal(a.data_inicio),
                  data_fim: toDtLocal(a.data_fim),
                  status: String((a as any).status ?? "ativa"),
                  inscricoes_abertas: inscricoesAbertas,
                  fields,
                })}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle>{a.nome}</CardTitle>
                      {a.data_inicio && (
                        <CardDescription>
                          {new Date(a.data_inicio).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}
                          {a.data_fim ? ` → ${new Date(a.data_fim).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}` : ""}
                        </CardDescription>
                      )}
                    </div>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                  <label
                    className="flex items-center justify-between rounded-md border p-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs font-medium">Inscrições abertas</span>
                    <Switch
                      checked={inscricoesAbertas}
                      disabled={toggleInscricoesAbertas.isPending}
                      onCheckedChange={(c) => toggleInscricoesAbertas.mutate({ id: a.id, value: c })}
                    />
                  </label>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Inscritos</span>
                    <span className="text-sm font-semibold text-foreground">{inscritos}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setEditFullscreen(false); } }}>
        <DialogContent
          className={
            editFullscreen
              ? "max-w-none w-screen h-screen sm:rounded-none p-6 overflow-y-auto overflow-x-hidden"
              : "max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden"
          }
        >
          <DialogHeader className="sticky top-0 z-10 -mx-6 -mt-6 border-b bg-background px-6 py-4">
            <div className="flex items-center justify-between gap-2 pr-8">
              <DialogTitle>{editing?.nome || "Editar ação"}</DialogTitle>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setEditFullscreen((v) => !v)}
                title={editFullscreen ? "Sair do ecrã inteiro" : "Ecrã inteiro"}
              >
                {editFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </DialogHeader>
          {editing && (
            <Tabs defaultValue="detalhes" className="min-w-0">
              <TabsList>
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="inscricoes">Inscrições</TabsTrigger>
              </TabsList>
              <TabsContent value="detalhes" className="space-y-4 min-w-0">
              <div className="space-y-2"><Label>Nome</Label><Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Local</Label><Input value={editing.local} onChange={(e) => setEditing({ ...editing, local: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <StatusInput
                    value={editing.status}
                    onChange={(v) => setEditing({ ...editing, status: v })}
                    options={(data ?? []).map((a: any) => a.status).filter(Boolean)}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Data de início</Label><Input type="datetime-local" value={editing.data_inicio} onChange={(e) => setEditing({ ...editing, data_inicio: e.target.value })} /></div>
                <div className="space-y-2"><Label>Data de fim</Label><Input type="datetime-local" value={editing.data_fim} onChange={(e) => setEditing({ ...editing, data_fim: e.target.value })} /></div>
              </div>
              <label className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Inscrições abertas</p>
                  <p className="text-xs text-muted-foreground">Quando desligado, a ação não mostra o botão "Inscrever" no portal público.</p>
                </div>
                <Switch checked={editing.inscricoes_abertas} onCheckedChange={(c) => setEditing({ ...editing, inscricoes_abertas: c })} />
              </label>
              <div className="space-y-2"><Label>Descrição</Label><Textarea value={editing.descricao} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} /></div>
              <FieldsEditor fields={editing.fields} setFields={(fields) => setEditing({ ...editing, fields })} />
              </TabsContent>
              <TabsContent value="inscricoes" className="min-w-0">
                <InscricoesTab acaoId={editing.id} fields={editing.fields} />
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="destructive" onClick={() => editing && setDeleteId(editing.id)}>
              <Trash2 className="mr-1 h-4 w-4" /> Apagar
            </Button>
            <Button onClick={() => update.mutate()} disabled={!editing?.nome || update.isPending}>
              {update.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar ação?</DialogTitle>
            <DialogDescription>
              Esta ação será removida permanentemente. As inscrições associadas podem deixar de funcionar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending ? "A apagar…" : "Apagar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}