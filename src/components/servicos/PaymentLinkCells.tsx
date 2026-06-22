import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, X, Link2, Loader2 } from "lucide-react";

const fmtEUR = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
const fmtDateShort = (s: string) => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : s;
};

type PagamentoLite = {
  id: string;
  data_pagamento: string;
  total: number;
  referencia: string | null;
  metodo: string | null;
};

/**
 * Cell used inside registos table.
 * - If registo is linked to a payment: green badge with popover (ver/desassociar).
 * - Otherwise: small "+ Associar pagamento" button with popover offering
 *     A) Associar a pagamento existente
 *     B) Criar novo pagamento (mini-form)
 */
export function RegistoPagamentoCell({
  registoId,
  colaboradorId,
  colaboradorNome,
  pagamentoId,
  total,
}: {
  registoId: string;
  colaboradorId: string;
  colaboradorNome: string;
  pagamentoId: string | null;
  total: number;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Linked payment info
  const { data: paymentInfo } = useQuery({
    queryKey: ["pagamento_info", pagamentoId],
    enabled: !!pagamentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("id, data_pagamento, referencia, total, metodo")
        .eq("id", pagamentoId!)
        .maybeSingle();
      if (error) throw error;
      return data as PagamentoLite | null;
    },
  });

  // Available payments to link to
  const { data: paymentsList } = useQuery({
    queryKey: ["pagamentos_para_associar", colaboradorId],
    enabled: open && !pagamentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("id, data_pagamento, referencia, total, metodo")
        .eq("colaborador_id", colaboradorId)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data as PagamentoLite[];
    },
  });

  const associar = useMutation({
    mutationFn: async (pid: string) => {
      const { error } = await supabase
        .from("registos_servico")
        .update({ pagamento_id: pid, estado: "pago" })
        .eq("id", registoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço associado e marcado como pago");
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
      qc.invalidateQueries({ queryKey: ["pagamento_servicos"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const desassociar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("registos_servico")
        .update({ pagamento_id: null, estado: "aprovado" })
        .eq("id", registoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço desassociado");
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
      qc.invalidateQueries({ queryKey: ["pagamento_servicos"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Mode B: create new payment ---
  const [mode, setMode] = useState<"choose" | "new">("choose");
  const today = new Date().toISOString().slice(0, 10);
  const firstName = colaboradorNome.split(" ")[0] || colaboradorNome;
  const defaultRef = `${fmtDateShort(today)} - ${firstName}`;
  const [novoForm, setNovoForm] = useState({
    data_pagamento: today,
    referencia: defaultRef,
    metodo: "Transferência Bancária",
    notas: "",
    total: total,
  });

  const criarPagamento = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .insert({
          colaborador_id: colaboradorId,
          data_pagamento: novoForm.data_pagamento,
          total: Number(novoForm.total) || total,
          referencia: novoForm.referencia.trim() || null,
          metodo: novoForm.metodo.trim() || null,
          notas: novoForm.notas.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const pid = data.id as string;
      const { error: e2 } = await supabase
        .from("registos_servico")
        .update({ pagamento_id: pid, estado: "pago" })
        .eq("id", registoId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Pagamento criado e serviço marcado como pago ✓");
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
      qc.invalidateQueries({ queryKey: ["pagamento_servicos"] });
      setOpen(false);
      setMode("choose");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Render linked badge
  if (pagamentoId) {
    const label = paymentInfo?.referencia
      ?? (paymentInfo ? `${fmtDateShort(paymentInfo.data_pagamento)} - ${firstName}` : "Pago");
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300"
          >
            <Link2 className="h-3 w-3" />
            {label}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72" onClick={(e) => e.stopPropagation()}>
          {paymentInfo ? (
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <div className="font-semibold">{paymentInfo.referencia ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(paymentInfo.data_pagamento).toLocaleDateString("pt-PT")}
                  {paymentInfo.metodo && ` · ${paymentInfo.metodo}`}
                </div>
                <div className="tabular-nums font-medium">{fmtEUR(paymentInfo.total)}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  if (confirm("Desassociar este serviço do pagamento? Volta a 'aprovado'.")) {
                    desassociar.mutate();
                  }
                }}
                disabled={desassociar.isPending}
              >
                <X className="mr-2 h-3 w-3" />Desassociar
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">A carregar…</p>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  // Not paid: associate
  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setMode("choose"); }}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <Plus className="mr-1 h-3 w-3" />Associar pagamento
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" onClick={(e) => e.stopPropagation()}>
        {mode === "choose" ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Associar a pagamento existente</Label>
              <Select onValueChange={(v) => associar.mutate(v)}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder={(paymentsList?.length ?? 0) === 0 ? "Sem pagamentos" : "Escolher…"} />
                </SelectTrigger>
                <SelectContent>
                  {(paymentsList ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.referencia ?? "(sem ref.)"} · {new Date(p.data_pagamento).toLocaleDateString("pt-PT")} · {fmtEUR(p.total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-center text-xs text-muted-foreground">ou</div>
            <Button variant="default" size="sm" className="w-full" onClick={() => setMode("new")}>
              <Plus className="mr-2 h-3 w-3" />Criar novo pagamento
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" className="h-8" value={novoForm.data_pagamento}
                  onChange={(e) => setNovoForm({ ...novoForm, data_pagamento: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Total (€)</Label>
                <Input type="number" step="0.01" className="h-8 text-right tabular-nums" value={novoForm.total}
                  onChange={(e) => setNovoForm({ ...novoForm, total: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Referência</Label>
              <Input className="h-8" value={novoForm.referencia}
                onChange={(e) => setNovoForm({ ...novoForm, referencia: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Método</Label>
              <Select value={novoForm.metodo} onValueChange={(v) => setNovoForm({ ...novoForm, metodo: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Transferência Bancária">Transferência Bancária</SelectItem>
                  <SelectItem value="Numerário">Numerário</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Notas</Label>
              <Textarea className="text-sm min-h-[60px]" value={novoForm.notas}
                onChange={(e) => setNovoForm({ ...novoForm, notas: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setMode("choose")}>Voltar</Button>
              <Button size="sm" className="flex-1" onClick={() => criarPagamento.mutate()} disabled={criarPagamento.isPending}>
                {criarPagamento.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Criar e marcar pago
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Cell used in pagamentos table — shows "X serviços" with popover listing
 * linked service records and allowing unlink + associate more.
 */
export function PagamentoServicosCell({
  pagamentoId,
  colaboradorId,
}: {
  pagamentoId: string;
  colaboradorId: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: linked } = useQuery({
    queryKey: ["pagamento_servicos", pagamentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registos_servico")
        .select("id, data_inicio, descricao, quantidade, preco_unitario_override, outros_custos, tipo_servico_id, tipos_servico(nome, preco_unitario)")
        .eq("pagamento_id", pagamentoId)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as Array<{
        id: string; data_inicio: string; descricao: string | null;
        quantidade: number; preco_unitario_override: number | null;
        outros_custos: number; tipo_servico_id: string;
        tipos_servico: { nome: string; preco_unitario: number } | null;
      }>;
    },
  });

  const { data: disponiveis } = useQuery({
    queryKey: ["registos_disponiveis_para_pagamento", colaboradorId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registos_servico")
        .select("id, data_inicio, descricao, quantidade, preco_unitario_override, outros_custos, tipo_servico_id, tipos_servico(nome, preco_unitario)")
        .eq("colaborador_id", colaboradorId)
        .is("pagamento_id", null)
        .in("estado", ["pendente", "aprovado"])
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as Array<{
        id: string; data_inicio: string; descricao: string | null;
        quantidade: number; preco_unitario_override: number | null;
        outros_custos: number; tipo_servico_id: string;
        tipos_servico: { nome: string; preco_unitario: number } | null;
      }>;
    },
  });

  const unlink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("registos_servico")
        .update({ pagamento_id: null, estado: "aprovado" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pagamento_servicos", pagamentoId] });
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [selecionados, setSelecionados] = useState<string[]>([]);
  const link = useMutation({
    mutationFn: async () => {
      if (selecionados.length === 0) return;
      const { error } = await supabase
        .from("registos_servico")
        .update({ pagamento_id: pagamentoId, estado: "pago" })
        .in("id", selecionados);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selecionados.length} serviços associados`);
      setSelecionados([]);
      qc.invalidateQueries({ queryKey: ["pagamento_servicos", pagamentoId] });
      qc.invalidateQueries({ queryKey: ["registos_disponiveis_para_pagamento", colaboradorId] });
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const calc = (r: { quantidade: number; preco_unitario_override: number | null; outros_custos: number; tipos_servico: { preco_unitario: number } | null }) => {
    const preco = r.preco_unitario_override ?? (r.tipos_servico?.preco_unitario ?? 0);
    return Number(preco) * Number(r.quantidade) + Number(r.outros_custos ?? 0);
  };

  const count = linked?.length ?? 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-accent"
        >
          <Badge variant="secondary" className="h-5">{count}</Badge>
          serviço{count === 1 ? "" : "s"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold mb-1.5">Serviços associados</p>
            {count === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum serviço associado.</p>
            ) : (
              <ul className="divide-y rounded-md border max-h-48 overflow-y-auto">
                {(linked ?? []).map((r) => (
                  <li key={r.id} className="flex items-start gap-2 p-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.tipos_servico?.nome ?? "—"}</div>
                      <div className="text-muted-foreground truncate">
                        {new Date(r.data_inicio).toLocaleDateString("pt-PT")}
                        {r.descricao && ` · ${r.descricao}`}
                      </div>
                    </div>
                    <span className="tabular-nums font-medium">{fmtEUR(calc(r))}</span>
                    <button
                      type="button"
                      onClick={() => { if (confirm("Desassociar serviço?")) unlink.mutate(r.id); }}
                      className="text-muted-foreground hover:text-destructive"
                      title="Desassociar"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold mb-1.5">+ Associar mais serviços</p>
            {(disponiveis ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem serviços pendentes/aprovados para associar.</p>
            ) : (
              <>
                <ul className="divide-y rounded-md border max-h-40 overflow-y-auto">
                  {(disponiveis ?? []).map((r) => {
                    const checked = selecionados.includes(r.id);
                    return (
                      <li key={r.id} className="flex items-center gap-2 p-2 text-xs">
                        <Checkbox checked={checked} onCheckedChange={() =>
                          setSelecionados((s) => s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id])
                        } />
                        <span className="flex-1 truncate">
                          {new Date(r.data_inicio).toLocaleDateString("pt-PT")} · {r.tipos_servico?.nome ?? "—"}
                        </span>
                        <span className="tabular-nums">{fmtEUR(calc(r))}</span>
                      </li>
                    );
                  })}
                </ul>
                <Button size="sm" className="w-full mt-2" onClick={() => link.mutate()} disabled={selecionados.length === 0 || link.isPending}>
                  Associar {selecionados.length > 0 ? `(${selecionados.length})` : ""}
                </Button>
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
