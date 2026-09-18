import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, ExternalLink } from "lucide-react";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";
import { ParticipantePicker } from "./ParticipantePicker";
import type { Colaborador } from "./types";

export function ColaboradoresTab() {
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
        <Link
          to="/servicos/colaborador/$id"
          params={{ id: row.original.id }}
          className="inline-flex items-center gap-1 truncate font-medium hover:underline text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
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
        savedViewsKey="views:colaboradores"
        columns={columns}
        data={rows}
        isLoading={isLoading}
        defaultGroupBy="_status"
        editableColumns={["email", "telefone", "iban", "ativo"]}
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
