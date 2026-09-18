import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import { Plus, Trash2, Check, Users as UsersIcon, UserPlus, X } from "lucide-react";
import { fmtEUR, type SessaoRow } from "./types";

export function SessoesTab() {
  const qc = useQueryClient();
  const [filterEstado, setFilterEstado] = useState<string>("__all");

  const { data: sessoes, isLoading } = useQuery({
    queryKey: ["sessoes_servico_full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessoes_servico")
        .select("id, nome, tipo_servico_id, data_inicio, data_fim, local, descricao, quantidade_por_colaborador, preco_unitario_override")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as SessaoRow[];
    },
  });
  const { data: tipos } = useQuery({
    queryKey: ["tipos_servico_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tipos_servico").select("id, nome, unidade, preco_unitario").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; unidade: string; preco_unitario: number }[];
    },
  });
  const { data: registos } = useQuery({
    queryKey: ["registos_for_sessoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registos_servico")
        .select("id, sessao_id, colaborador_id, tipo_servico_id, quantidade, preco_unitario_override, outros_custos, estado")
        .not("sessao_id", "is", null);
      if (error) throw error;
      return data as { id: string; sessao_id: string; colaborador_id: string; tipo_servico_id: string; quantidade: number; preco_unitario_override: number | null; outros_custos: number; estado: "pendente" | "aprovado" | "pago" }[];
    },
  });

  const tipoMap = useMemo(() => new Map((tipos ?? []).map((t) => [t.id, t])), [tipos]);
  const bySessao = useMemo(() => {
    const m = new Map<string, { count: number; total: number; pagas: number; pendentes: number }>();
    for (const r of registos ?? []) {
      const tipo = tipoMap.get(r.tipo_servico_id);
      const preco = r.preco_unitario_override != null ? Number(r.preco_unitario_override) : (tipo?.preco_unitario ?? 0);
      const total = preco * Number(r.quantidade) + Number(r.outros_custos || 0);
      const cur = m.get(r.sessao_id) ?? { count: 0, total: 0, pagas: 0, pendentes: 0 };
      cur.count++; cur.total += total;
      if (r.estado === "pago") cur.pagas++; else cur.pendentes++;
      m.set(r.sessao_id, cur);
    }
    return m;
  }, [registos, tipoMap]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sessoes_servico").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sessão eliminada");
      qc.invalidateQueries({ queryKey: ["sessoes_servico_full"] });
      qc.invalidateQueries({ queryKey: ["registos_for_sessoes"] });
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => (sessoes ?? []).map((s) => {
    const agg = bySessao.get(s.id) ?? { count: 0, total: 0, pagas: 0, pendentes: 0 };
    return { ...s, ...agg };
  }), [sessoes, bySessao]);

  const filtered = useMemo(() => {
    if (filterEstado === "__all") return rows;
    if (filterEstado === "pagas") return rows.filter((r) => r.pendentes === 0 && r.count > 0);
    if (filterEstado === "pendentes") return rows.filter((r) => r.pendentes > 0);
    return rows;
  }, [rows, filterEstado]);

  const [editing, setEditing] = useState<SessaoRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Sessões de Grupo</h2>
          <p className="text-sm text-muted-foreground">Eventos partilhados entre várias colaboradoras (workshops, formações, etc.)</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas</SelectItem>
              <SelectItem value="pagas">Todas pagas</SelectItem>
              <SelectItem value="pendentes">Com pendentes</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreating(true)} className="h-9">
            <Plus className="mr-2 h-4 w-4" />Nova sessão
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
          Sem sessões. Cria a primeira a partir do <Link to="/servicos" className="text-primary hover:underline">Calendário</Link>, usando o separador "Sessão de Grupo".
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {filtered.map((s) => {
            const tipo = tipoMap.get(s.tipo_servico_id);
            const allPaid = s.count > 0 && s.pendentes === 0;
            return (
              <div
                key={s.id}
                onClick={() => setEditing(s)}
                className="p-4 flex flex-wrap items-center gap-4 hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{s.nome}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(s.data_inicio + "T00:00:00").toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })}
                    {s.local && <span> · {s.local}</span>}
                  </div>
                </div>
                {tipo && <Badge variant="outline">{tipo.nome}</Badge>}
                <Badge variant="secondary">{s.count} colaboradora{s.count === 1 ? "" : "s"}</Badge>
                <span className="tabular-nums font-semibold min-w-[80px] text-right">{fmtEUR(s.total)}</span>
                {allPaid
                  ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Todas pagas</Badge>
                  : <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">{s.pendentes} pendente{s.pendentes === 1 ? "" : "s"}</Badge>}
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm("Eliminar sessão? Os registos individuais mantêm-se sem ligação.")) remove.mutate(s.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <SessaoEditDialog sessao={editing} onClose={() => setEditing(null)} />
      <NewSessaoDialog
        open={creating}
        onClose={() => setCreating(false)}
        tipos={tipos ?? []}
        onCreated={(s) => { setCreating(false); setEditing(s); }}
      />
    </div>
  );
}

// =========================================================
// SESSAO EDIT DIALOG
// =========================================================
function NewSessaoDialog({
  open, onClose, tipos, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  tipos: { id: string; nome: string; unidade: string; preco_unitario: number }[];
  onCreated: (s: SessaoRow) => void;
}) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [quantidade, setQuantidade] = useState<number>(1);
  const [precoOverride, setPrecoOverride] = useState<string>("");

  useEffect(() => {
    if (open) {
      setNome(""); setDataInicio(""); setDataFim(""); setLocal("");
      setDescricao(""); setTipoId(""); setQuantidade(1); setPrecoOverride("");
    }
  }, [open]);

  const tipo = tipos.find((t) => t.id === tipoId);
  const precoUnit = precoOverride !== "" ? Number(precoOverride) : (tipo?.preco_unitario ?? 0);
  const perColab = precoUnit * (Number(quantidade) || 0);

  const create = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Nome obrigatório");
      if (!dataInicio) throw new Error("Data obrigatória");
      if (!tipoId) throw new Error("Tipo de serviço obrigatório");
      const { data, error } = await supabase
        .from("sessoes_servico")
        .insert({
          nome: nome.trim(),
          data_inicio: dataInicio,
          data_fim: dataFim || null,
          local: local.trim() || null,
          descricao: descricao.trim() || null,
          tipo_servico_id: tipoId,
          quantidade_por_colaborador: Number(quantidade) || 1,
          preco_unitario_override: precoOverride !== "" ? Number(precoOverride) : null,
        })
        .select("id, nome, tipo_servico_id, data_inicio, data_fim, local, descricao, quantidade_por_colaborador, preco_unitario_override")
        .single();
      if (error) throw error;
      return data as SessaoRow;
    },
    onSuccess: (s) => {
      toast.success("Sessão criada. Adiciona colaboradoras.");
      qc.invalidateQueries({ queryKey: ["sessoes_servico_full"] });
      qc.invalidateQueries({ queryKey: ["sessoes_cal"] });
      onCreated(s);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova sessão de grupo</DialogTitle>
          <DialogDescription>Cria a sessão com todos os detalhes. Depois adicionas as colaboradoras.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Workshop de cidadania" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Data início *</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Data fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Local</Label>
            <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex: Sede, Sala 2" />
          </div>
          <div className="grid gap-2">
            <Label>Tipo de serviço *</Label>
            <Select value={tipoId} onValueChange={setTipoId}>
              <SelectTrigger><SelectValue placeholder="Escolher tipo…" /></SelectTrigger>
              <SelectContent>
                {tipos.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome} ({fmtEUR(t.preco_unitario)}/{t.unidade})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Quantidade por colaboradora</Label>
              <Input type="number" min={0} step={0.01} value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} />
            </div>
            <div className="grid gap-2">
              <Label>Preço unitário (override)</Label>
              <Input type="number" min={0} step={0.01} value={precoOverride} onChange={(e) => setPrecoOverride(e.target.value)} placeholder={tipo ? String(tipo.preco_unitario) : ""} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>
          {tipoId && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              Cada colaboradora: <span className="font-semibold tabular-nums">{fmtEUR(perColab)}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "A criar…" : "Criar sessão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessaoEditDialog({ sessao, onClose }: { sessao: SessaoRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [quantidade, setQuantidade] = useState<number>(1);
  const [precoOverride, setPrecoOverride] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (sessao) {
      setNome(sessao.nome ?? "");
      setDataInicio(sessao.data_inicio ?? "");
      setDataFim(sessao.data_fim ?? "");
      setLocal(sessao.local ?? "");
      setDescricao(sessao.descricao ?? "");
      setTipoId(sessao.tipo_servico_id ?? "");
      setQuantidade(Number(sessao.quantidade_por_colaborador) || 1);
      setPrecoOverride(sessao.preco_unitario_override != null ? String(sessao.preco_unitario_override) : "");
    }
  }, [sessao]);

  const { data: tiposEdit } = useQuery({
    queryKey: ["tipos_servico_edit"],
    enabled: !!sessao,
    queryFn: async () => {
      const { data, error } = await supabase.from("tipos_servico").select("id, nome, unidade, preco_unitario, ativo").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; unidade: string; preco_unitario: number; ativo: boolean }[];
    },
  });
  const { data: colabsEdit } = useQuery({
    queryKey: ["colabs_edit"],
    enabled: !!sessao,
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores").select("id, nome_completo, ativo").order("nome_completo");
      if (error) throw error;
      return data as { id: string; nome_completo: string; ativo: boolean }[];
    },
  });
  const { data: sessaoRegistos } = useQuery({
    queryKey: ["sessao_registos_edit", sessao?.id],
    enabled: !!sessao,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registos_servico")
        .select("id, colaborador_id, estado, outros_custos")
        .eq("sessao_id", sessao!.id);
      if (error) throw error;
      return data as { id: string; colaborador_id: string; estado: "pendente" | "aprovado" | "pago"; outros_custos: number }[];
    },
  });

  const tipo = (tiposEdit ?? []).find((t) => t.id === tipoId);
  const precoUnit = precoOverride !== "" ? Number(precoOverride) : (tipo?.preco_unitario ?? 0);
  const perColab = precoUnit * (Number(quantidade) || 0);
  const presentIds = new Set((sessaoRegistos ?? []).map((r) => r.colaborador_id));
  const available = (colabsEdit ?? []).filter((c) => c.ativo && !presentIds.has(c.id));
  const colabMap = useMemo(() => new Map((colabsEdit ?? []).map((c) => [c.id, c])), [colabsEdit]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["sessoes_servico_full"] });
    qc.invalidateQueries({ queryKey: ["registos_for_sessoes"] });
    qc.invalidateQueries({ queryKey: ["registos_servico"] });
    qc.invalidateQueries({ queryKey: ["registos_cal"] });
    qc.invalidateQueries({ queryKey: ["sessoes_cal"] });
    qc.invalidateQueries({ queryKey: ["sessao_registos_edit", sessao?.id] });
  };

  const addColab = useMutation({
    mutationFn: async (colabId: string) => {
      if (!sessao) return;
      const { error } = await supabase.from("registos_servico").insert({
        colaborador_id: colabId,
        tipo_servico_id: tipoId,
        sessao_id: sessao.id,
        data_inicio: dataInicio,
        data_fim: dataFim || null,
        descricao: nome.trim() || sessao.nome,
        quantidade: Number(quantidade) || 1,
        preco_unitario_override: precoOverride !== "" ? Number(precoOverride) : null,
        outros_custos: 0,
        outros_custos_descricao: null,
        estado: "pendente" as const,
        submetido_pelo_colaborador: false,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Colaboradora adicionada"); invalidateAll(); setAddOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRecord = useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await supabase.from("registos_servico").delete().eq("id", recordId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removida da sessão"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!sessao) return;
      if (!nome.trim()) throw new Error("Nome obrigatório");
      if (!dataInicio) throw new Error("Data obrigatória");
      if (!tipoId) throw new Error("Tipo de serviço obrigatório");
      const { error } = await supabase
        .from("sessoes_servico")
        .update({
          nome: nome.trim(),
          data_inicio: dataInicio,
          data_fim: dataFim || null,
          local: local.trim() || null,
          descricao: descricao.trim() || null,
          tipo_servico_id: tipoId,
          quantidade_por_colaborador: Number(quantidade) || 1,
          preco_unitario_override: precoOverride !== "" ? Number(precoOverride) : null,
        })
        .eq("id", sessao.id);
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("registos_servico")
        .update({
          data_inicio: dataInicio,
          data_fim: dataFim || null,
          tipo_servico_id: tipoId,
          quantidade: Number(quantidade) || 1,
          preco_unitario_override: precoOverride !== "" ? Number(precoOverride) : null,
          descricao: nome.trim(),
        })
        .eq("sessao_id", sessao.id);
      if (e2) throw e2;
    },
    onSuccess: () => { toast.success("Sessão atualizada"); invalidateAll(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const estadoChip = (e: "pendente" | "aprovado" | "pago") =>
    e === "pago" ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : e === "aprovado" ? "bg-blue-100 text-blue-700 border-blue-200"
    : "bg-amber-100 text-amber-700 border-amber-200";

  return (
    <Dialog open={!!sessao} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar sessão</DialogTitle>
          <DialogDescription>As alterações de data, tipo, quantidade e preço aplicam-se a todos os registos ligados.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome da sessão *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de serviço *</Label>
              <Select value={tipoId} onValueChange={setTipoId}>
                <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                <SelectContent>
                  {(tiposEdit ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome} ({fmtEUR(t.preco_unitario)}/{t.unidade})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Local</Label>
              <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="(opcional)" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data *</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label>Data de fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{tipo?.unidade ? `${tipo.unidade[0].toUpperCase() + tipo.unidade.slice(1)}s por colaboradora` : "Quantidade por colaboradora"}</Label>
              <Input type="number" step="0.01" value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} />
              {tipo && <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">Cada colaboradora recebe {fmtEUR(perColab)}</p>}
            </div>
            <div>
              <Label>Preço por unidade (€)</Label>
              <Input type="number" step="0.01" value={precoOverride} onChange={(e) => setPrecoOverride(e.target.value)} placeholder={tipo ? String(tipo.preco_unitario) : ""} />
              {tipo && <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">{fmtEUR(precoUnit)} × {quantidade}</p>}
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>

          <div className="rounded-md border">
            <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Colaboradoras ({(sessaoRegistos ?? []).length})
              </span>
              <Popover open={addOpen} onOpenChange={setAddOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={available.length === 0}>
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    {available.length === 0 ? "Todas adicionadas" : "Adicionar colaboradora"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Procurar…" />
                    <CommandList>
                      <CommandEmpty>Sem resultados.</CommandEmpty>
                      <CommandGroup>
                        {available.map((c) => (
                          <CommandItem key={c.id} onSelect={() => addColab.mutate(c.id)} className="cursor-pointer">
                            {c.nome_completo}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="divide-y max-h-56 overflow-y-auto">
              {(sessaoRegistos ?? []).length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">Sem colaboradoras</div>
              ) : (
                (sessaoRegistos ?? []).map((r) => {
                  const c = colabMap.get(r.colaborador_id);
                  return (
                    <div key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="flex-1 min-w-0 truncate">{c?.nome_completo ?? "—"}</span>
                      <Badge variant="outline" className={`text-[10px] ${estadoChip(r.estado)}`}>{r.estado}</Badge>
                      <button
                        type="button"
                        onClick={() => { if (confirm(`Remover ${c?.nome_completo ?? "registo"} da sessão?`)) removeRecord.mutate(r.id); }}
                        className="text-muted-foreground hover:text-destructive"
                        title="Remover"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Check className="mr-2 h-4 w-4" />Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
