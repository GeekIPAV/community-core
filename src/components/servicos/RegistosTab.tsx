import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Check, Users as UsersIcon, Download, ChevronRight, Upload } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";
import { InlineMultiSelect } from "@/components/inline-edit";
import { BulkImportDialog } from "@/components/servicos/BulkImportDialog";
import { RegistoPagamentoCell } from "@/components/servicos/PaymentLinkCells";
import { ESTADOS, fmtEUR, type Registo } from "./types";
import { SummaryCard } from "./SummaryCard";

export function RegistosTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Registo | null>(null);
  const [form, setForm] = useState<Partial<Registo>>({});
  const [filterEstado, setFilterEstado] = useState<string[]>([]);
  const [filterColabs, setFilterColabs] = useState<string[]>([]);
  const [filterSessao, setFilterSessao] = useState<"all" | "session" | "individual">("all");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [resumoOpen, setResumoOpen] = useState(false);
  


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
        .select("id, colaborador_id, tipo_servico_id, data_inicio, data_fim, descricao, quantidade, preco_unitario_override, outros_custos, outros_custos_descricao, km, estado, submetido_pelo_colaborador, pagamento_id, notas_admin, sessao_id")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as Registo[];
    },
  });
  const { data: sessoes } = useQuery({
    queryKey: ["sessoes_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessoes_servico")
        .select("id, nome, data_inicio, tipo_servico_id, local")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as { id: string; nome: string; data_inicio: string; tipo_servico_id: string; local: string | null }[];
    },
  });
  const sessaoMap = useMemo(() => new Map((sessoes ?? []).map((s) => [s.id, s])), [sessoes]);

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
    if (filterEstado.length > 0) {
      const set = new Set(filterEstado);
      rows = rows.filter((r) => set.has(r.estado));
    }
    if (filterColabs.length > 0) {
      const set = new Set(filterColabs);
      rows = rows.filter((r) => set.has(r.colaborador_id));
    }
    if (filterSessao === "session") rows = rows.filter((r) => !!r.sessao_id);
    if (filterSessao === "individual") rows = rows.filter((r) => !r.sessao_id);
    return rows;
  }, [data, filterEstado, filterColabs, filterSessao]);

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

  const resumoPorColab = useMemo(() => {
    const map = new Map<string, { pendente: number; aprovado: number }>();
    for (const r of filtered) {
      if (r.estado === "pago") continue;
      if (r.pagamento_id) continue;
      if (r.estado !== "pendente" && r.estado !== "aprovado") continue;
      const { total } = calcTotal(r);
      const cur = map.get(r.colaborador_id) ?? { pendente: 0, aprovado: 0 };
      if (r.estado === "pendente") cur.pendente += total;
      else cur.aprovado += total;
      map.set(r.colaborador_id, cur);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, nome: colabMap.get(id) ?? "—", pendente: v.pendente, aprovado: v.aprovado, total: v.pendente + v.aprovado }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [filtered, colabMap, tipoMap]);
  const resumoTotal = useMemo(() => resumoPorColab.reduce((s, r) => s + r.total, 0), [resumoPorColab]);

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
        if (payload.estado === "pendente") {
          await supabase.rpc("notificar_nova_entrada_pendente" as never, { p_colaborador_id: payload.colaborador_id } as never);
        }
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
    onMutate: async ({ id, field, value }) => {
      await qc.cancelQueries({ queryKey: ["registos_servico"] });
      const prev = qc.getQueryData<Registo[]>(["registos_servico"]);
      if (prev) {
        qc.setQueryData<Registo[]>(["registos_servico"], prev.map((r) =>
          r.id === id ? ({ ...r, [field]: value } as Registo) : r
        ));
      }
      return { prev };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["registos_servico"], ctx.prev);
      toast.error(e.message);
    },
    // Não invalidamos aqui — a cache já reflete o novo valor.
    // Evita refetch completo a cada edição inline (causava lentidão).
  });

  // Ações em massa sobre os registos atualmente filtrados.
  const bulkSetEstado = useMutation({
    mutationFn: async ({ ids, novoEstado }: { ids: string[]; novoEstado: Registo["estado"] }) => {
      if (ids.length === 0) return 0;
      const { error } = await supabase.from("registos_servico").update({ estado: novoEstado }).in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count, vars) => {
      toast.success(`${count} registo(s) marcados como ${vars.novoEstado}`);
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aprovarPendentes = () => {
    const ids = filtered.filter((r) => r.estado === "pendente").map((r) => r.id);
    if (ids.length === 0) return toast.info("Sem registos pendentes no filtro atual");
    if (!confirm(`Aprovar ${ids.length} registo(s) pendente(s)?`)) return;
    bulkSetEstado.mutate({ ids, novoEstado: "aprovado" });
  };

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
        <Link to="/servicos/colaborador/$id" params={{ id: row.original.colaborador_id }} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline truncate block">
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
    { id: "_pagamento", header: "Pagamento", size: 200, enableSorting: false,
      meta: { label: "Pagamento", noTruncate: true },
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RegistoPagamentoCell
            registoId={row.original.id}
            colaboradorId={row.original.colaborador_id}
            colaboradorNome={row.original._colab}
            pagamentoId={row.original.pagamento_id}
            total={row.original._total}
          />
        </div>
      ) },
    { id: "submetido_pelo_colaborador", accessorKey: "submetido_pelo_colaborador", header: "Origem", size: 120,
      meta: { label: "Origem", filterVariant: "select", filterOptions: ["true", "false"], hideOnMobile: true },
      cell: ({ getValue }) => getValue() ? <Badge variant="outline">Self-service</Badge> : <Badge variant="secondary">Admin</Badge> },
    { id: "_sessao", header: "Sessão", size: 180, enableSorting: false,
      meta: { label: "Sessão", noTruncate: true },
      cell: ({ row }) => {
        const sid = row.original.sessao_id;
        if (!sid) return <span className="text-muted-foreground">—</span>;
        const s = sessaoMap.get(sid);
        return (
          <Badge variant="outline" className="gap-1 max-w-full" title={s?.nome ?? ""}>
            <UsersIcon className="h-3 w-3 shrink-0" />
            <span className="truncate">{s?.nome ?? "Sessão"}</span>
          </Badge>
        );
      } },
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
  ], [setEstado, remove, sessaoMap]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total filtrado" value={fmtEUR(totals.total)} />
        <SummaryCard label="Pendente" value={fmtEUR(totals.pendente)} variant="warning" />
        <SummaryCard label="Aprovado" value={fmtEUR(totals.aprovado)} variant="info" />
        <SummaryCard label="Pago" value={fmtEUR(totals.pago)} variant="success" />
      </div>

      <div className="rounded-lg border bg-card">
        <button
          type="button"
          onClick={() => setResumoOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer select-none text-sm hover:bg-muted/40 rounded-lg text-left"
        >
          <span className="flex items-center gap-2">
            <ChevronRight className={`h-4 w-4 transition-transform ${resumoOpen ? "rotate-90" : ""}`} />
            <span className="font-medium">Resumo a pagar por colaboradora</span>
            <span className="text-muted-foreground">
              ({resumoPorColab.length} {resumoPorColab.length === 1 ? "colaboradora" : "colaboradoras"} · {fmtEUR(resumoTotal)})
            </span>
          </span>
        </button>
        {resumoOpen && (
          <div className="px-4 pb-3 pt-1 text-sm border-t border-border">
            {resumoPorColab.length === 0 ? (
              <p className="text-muted-foreground py-2">Sem valores por pagar no filtro atual.</p>
            ) : (
              <ul className="divide-y">
                <li className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 py-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                  <span>Colaboradora</span>
                  <span className="text-right">Pendente</span>
                  <span className="text-right">Aprovado</span>
                  <span className="text-right">Total</span>
                </li>
                {resumoPorColab.map((r) => (
                  <li key={r.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 items-center py-1.5">
                    <span className="truncate text-foreground">{r.nome}</span>
                    <span className="tabular-nums text-right text-amber-600 dark:text-amber-400">{r.pendente > 0 ? fmtEUR(r.pendente) : "—"}</span>
                    <span className="tabular-nums text-right text-blue-600 dark:text-blue-400">{r.aprovado > 0 ? fmtEUR(r.aprovado) : "—"}</span>
                    <span className="tabular-nums text-right font-medium">{fmtEUR(r.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          <div className="w-56">
            <InlineMultiSelect
              values={filterEstado}
              options={(ESTADOS as unknown as string[]).map((e) => ({ value: e, label: e }))}
              onSave={(v) => setFilterEstado(v)}
              placeholder="Todos os estados"
            />
          </div>
          <div className="w-64">
            <InlineMultiSelect
              values={filterColabs}
              options={(colabs ?? []).filter((c) => c.ativo || filterColabs.includes(c.id)).map((c) => ({ value: c.id, label: c.nome_completo }))}
              onSave={(v) => setFilterColabs(v)}
              placeholder="Todas as colaboradoras"
            />
          </div>
          <Select value={filterSessao} onValueChange={(v) => setFilterSessao(v as typeof filterSessao)}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Sessões: todos</SelectItem>
              <SelectItem value="session">Apenas de sessão</SelectItem>
              <SelectItem value="individual">Apenas individuais</SelectItem>
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
        savedViewsKey="views:registos-servico"
        columns={columns}
        data={rowsData}
        isLoading={isLoading}
        editableColumns={["quantidade", "estado"]}
        onRowClick={(r) => openEdit(r)}
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
            <Button
              variant="outline"
              size="sm"
              onClick={aprovarPendentes}
              disabled={bulkSetEstado.isPending || !filtered.some((r) => r.estado === "pendente")}
              className="h-9"
              title="Aprovar todos os pendentes do filtro atual"
            >
              <Check className="mr-2 h-4 w-4" />Aprovar pendentes
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
