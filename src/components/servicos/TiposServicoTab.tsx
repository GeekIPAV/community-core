import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";
import { UNIDADES, fmtEUR, type TipoServico } from "./types";

export function TiposServicoTab() {
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
        savedViewsKey="views:tipos-servico"
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
