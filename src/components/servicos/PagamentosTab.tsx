import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Check } from "lucide-react";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";
import { PagamentoServicosCell } from "@/components/servicos/PaymentLinkCells";
import { fmtEUR, type Pagamento } from "./types";

export function PagamentosTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pagamento | null>(null);
  const [form, setForm] = useState<Partial<Pagamento> & { liquidar_registos?: string[] }>({});

  const { data: colabs } = useQuery({
    queryKey: ["colaboradores_lookup"],
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
      // O total é sempre calculado por trigger a partir dos registos associados.
      const baseFields = {
        colaborador_id: form.colaborador_id,
        data_pagamento: form.data_pagamento || new Date().toISOString().slice(0, 10),
        referencia: form.referencia?.trim() || null,
        metodo: form.metodo?.trim() || null,
        notas: form.notas?.trim() || null,
      };
      let pagamentoId: string;
      if (editing) {
        const { error } = await supabase.from("pagamentos").update(baseFields).eq("id", editing.id);
        if (error) throw error;
        pagamentoId = editing.id;
      } else {
        const { data: ins, error } = await supabase.from("pagamentos").insert({ ...baseFields, total: 0 }).select("id").single();
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
    onMutate: async ({ id, field, value }) => {
      await qc.cancelQueries({ queryKey: ["pagamentos"] });
      const prev = qc.getQueryData<Pagamento[]>(["pagamentos"]);
      if (prev) {
        qc.setQueryData<Pagamento[]>(["pagamentos"], prev.map((p) =>
          p.id === id ? ({ ...p, [field]: value } as Pagamento) : p
        ));
      }
      return { prev };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["pagamentos"], ctx.prev);
      toast.error(e.message);
    },
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
        <Link to="/servicos/colaborador/$id" params={{ id: row.original.colaborador_id }} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline truncate block">
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
      meta: { label: "Total", filterVariant: "number" },
      cell: ({ getValue }) => <span className="block text-right tabular-nums font-medium">{fmtEUR(Number(getValue() ?? 0))}</span> },
    { id: "_servicos", header: "Serviços", size: 110, enableSorting: false,
      meta: { label: "Serviços", noTruncate: true },
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <PagamentoServicosCell pagamentoId={row.original.id} colaboradorId={row.original.colaborador_id} />
        </div>
      ) },
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
        savedViewsKey="views:pagamentos"
        columns={columns}
        data={rows}
        isLoading={isLoading}
        editableColumns={["referencia", "metodo", "data_pagamento"]}
        onRowClick={(p) => openEdit(p)}
        onCellEdit={(rowId, columnId, value) => {
          return updateField.mutateAsync({ id: rowId, field: columnId, value });
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

            <div className="col-span-2 rounded-md border bg-muted/40 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {editing ? "Total atual (calculado automaticamente)" : "Total dos registos selecionados"}
                </span>
                <span className="font-semibold tabular-nums">
                  {fmtEUR(editing ? Number(editing.total ?? 0) : totalSelecionado)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                O total é sempre a soma dos serviços associados — não é editável manualmente.
              </p>
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
