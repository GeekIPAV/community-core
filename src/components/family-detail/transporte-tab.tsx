import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { formatDateBR } from "@/lib/utils";
import { KM_RATE, TRIP_FACTOR } from "@/lib/bolsa-transporte";

type BolsaPagamento = {
  id: string;
  inscricao_id: string;
  pessoa_id: string;
  acao_id: string;
  valor: number;
  estado: "por_pagar" | "pago" | "cancelado";
  metodo_pagamento: string | null;
  notas: string | null;
  data_pagamento: string | null;
  acao_nome?: string;
  acao_data?: string | null;
  pessoa_nome?: string;
};

type MapaKmRow = {
  id: string;
  familia_id: string;
  data: string;
  motivo: string;
  km: number;
  matricula: string | null;
  n_carros: number;
  valor: number;
  estado: "por_pagar" | "pago" | "cancelado";
  metodo_pagamento: string | null;
  notas: string | null;
  data_pagamento: string | null;
};

export function TransporteFamiliaTab({ familiaId }: { familiaId: string }) {
  const qc = useQueryClient();

  const { data: bolsas = [], isLoading: loadingBolsas } = useQuery({
    queryKey: ["familia-bolsas", familiaId],
    queryFn: async () => {
      const { data: pessoas } = await supabase
        .from("pessoas")
        .select("id, nome_completo")
        .eq("familia_id", familiaId);

      if (!pessoas?.length) return [] as BolsaPagamento[];
      const pessoaIds = pessoas.map((p: any) => p.id);
      const pessoaMap = new Map(pessoas.map((p: any) => [p.id, p.nome_completo]));

      const { data, error } = await (supabase as any)
        .from("bolsas_pagamentos")
        .select("*, acoes(nome, data_inicio)")
        .in("pessoa_id", pessoaIds)
        .order("created_at", { ascending: false });
      if (error) throw error;

      return ((data ?? []) as any[]).map((b) => ({
        id: b.id,
        inscricao_id: b.inscricao_id,
        pessoa_id: b.pessoa_id,
        acao_id: b.acao_id,
        valor: b.valor,
        estado: b.estado,
        metodo_pagamento: b.metodo_pagamento,
        notas: b.notas,
        data_pagamento: b.data_pagamento,
        acao_nome: b.acoes?.nome ?? "—",
        acao_data: b.acoes?.data_inicio ?? null,
        pessoa_nome: pessoaMap.get(b.pessoa_id) ?? "—",
      })) as BolsaPagamento[];
    },
  });

  const { data: mapaKm = [], isLoading: loadingKm } = useQuery({
    queryKey: ["familia-mapa-km", familiaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mapa_km")
        .select("*")
        .eq("familia_id", familiaId)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MapaKmRow[];
    },
  });

  const updateBolsa = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<BolsaPagamento> }) => {
      const { valor: _v, acao_nome: _an, acao_data: _ad, pessoa_nome: _pn, ...safe } = patch as any;
      const { error } = await (supabase as any)
        .from("bolsas_pagamentos")
        .update({ ...safe, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["familia-bolsas", familiaId] });
      qc.invalidateQueries({ queryKey: ["bolsas-pagamentos-full"] });
      toast.success("Actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateKm = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Omit<MapaKmRow, "valor">> }) => {
      const { valor: _v, familia_id: _f, ...safe } = patch as any;
      const { error } = await (supabase as any)
        .from("mapa_km")
        .update({ ...safe, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["familia-mapa-km", familiaId] });
      qc.invalidateQueries({ queryKey: ["mapa-km"] });
      qc.invalidateQueries({ queryKey: ["mapa-km-acao"] });
      qc.invalidateQueries({ queryKey: ["transporte-acao"] });
      toast.success("Actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBolsa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("bolsas_pagamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bolsa removida");
      qc.invalidateQueries({ queryKey: ["familia-bolsas", familiaId] });
      qc.invalidateQueries({ queryKey: ["bolsas-pagamentos-full"] });
      qc.invalidateQueries({ queryKey: ["bolsas-acao"] });
      qc.invalidateQueries({ queryKey: ["bolsa-ativas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteKm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("mapa_km").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registo de KM removido");
      qc.invalidateQueries({ queryKey: ["familia-mapa-km", familiaId] });
      qc.invalidateQueries({ queryKey: ["mapa-km"] });
      qc.invalidateQueries({ queryKey: ["mapa-km-acao"] });
      qc.invalidateQueries({ queryKey: ["bolsa-km-ativos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const bolsasPorPagar = bolsas.filter((b) => b.estado === "por_pagar");
    const bolsasPago = bolsas.filter((b) => b.estado === "pago");
    const kmPorPagar = mapaKm.filter((k) => k.estado === "por_pagar");
    const kmPago = mapaKm.filter((k) => k.estado === "pago");
    return {
      bolsasPorPagarN: bolsasPorPagar.length,
      bolsasPorPagarV: bolsasPorPagar.reduce((s, b) => s + b.valor, 0),
      bolsasPagoV: bolsasPago.reduce((s, b) => s + b.valor, 0),
      kmPorPagarN: kmPorPagar.length,
      kmPorPagarV: kmPorPagar.reduce((s, k) => s + k.valor, 0),
      kmPagoV: kmPago.reduce((s, k) => s + k.valor, 0),
      totalPorReceber: bolsasPorPagar.reduce((s, b) => s + b.valor, 0) + kmPorPagar.reduce((s, k) => s + k.valor, 0),
      totalRecebido: bolsasPago.reduce((s, b) => s + b.valor, 0) + kmPago.reduce((s, k) => s + k.valor, 0),
    };
  }, [bolsas, mapaKm]);

  const eur = (v: number) => v.toFixed(2).replace(".", ",") + " €";

  const isLoading = loadingBolsas || loadingKm;

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Por receber (total)</p>
          <p className="text-xl font-semibold text-amber-700 tabular-nums">{eur(kpis.totalPorReceber)}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Já recebido (total)</p>
          <p className="text-xl font-semibold text-emerald-700 tabular-nums">{eur(kpis.totalRecebido)}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Bolsas por pagar</p>
          <p className="text-xl font-semibold tabular-nums">{kpis.bolsasPorPagarN} · {eur(kpis.bolsasPorPagarV)}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">KM por pagar</p>
          <p className="text-xl font-semibold tabular-nums">{kpis.kmPorPagarN} · {eur(kpis.kmPorPagarV)}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-3">Bolsas de transporte</p>
        {bolsas.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sem bolsas de transporte registadas.
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ação</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Pessoa</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Data pagamento</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bolsas.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium whitespace-nowrap">{b.acao_nome}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {b.acao_data ? formatDateBR(b.acao_data) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{b.pessoa_nome}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium whitespace-nowrap">{eur(b.valor)}</TableCell>
                    <TableCell>
                      <Select
                        value={b.estado}
                        onValueChange={(v) => updateBolsa.mutate({ id: b.id, patch: {
                          estado: v as BolsaPagamento["estado"],
                          data_pagamento: v === "pago" && !b.data_pagamento
                            ? new Date().toISOString().slice(0, 10)
                            : b.data_pagamento,
                        }})}
                      >
                        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="por_pagar">Por pagar</SelectItem>
                          <SelectItem value="pago">Pago</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <InlineEditCellTransporte
                        value={b.metodo_pagamento}
                        placeholder="Método"
                        onSave={(v) => updateBolsa.mutate({ id: b.id, patch: { metodo_pagamento: v || null } })}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {b.data_pagamento ?? "—"}
                    </TableCell>
                    <TableCell>
                      <InlineEditCellTransporte
                        value={b.notas}
                        placeholder="Notas"
                        onSave={(v) => updateBolsa.mutate({ id: b.id, patch: { notas: v || null } })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        disabled={deleteBolsa.isPending}
                        onClick={() => { if (confirm("Remover esta bolsa?")) deleteBolsa.mutate(b.id); }}
                        title="Remover bolsa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {bolsas.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td colSpan={3} className="px-4 py-2 text-xs font-medium">Total</td>
                    <td className="px-4 py-2 text-right text-xs font-semibold tabular-nums whitespace-nowrap">
                      {eur(bolsas.reduce((s, b) => s + b.valor, 0))}
                    </td>
                    <td colSpan={5}></td>
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-3">Mapa de KM</p>
        {mapaKm.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sem registos de KM.
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">KM</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead className="text-right">Carros</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Data pagamento</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mapaKm.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="whitespace-nowrap">
                      <Input
                        type="date"
                        defaultValue={k.data ?? ""}
                        className="h-7 w-36 text-xs"
                        onBlur={(e) => {
                          const v = e.target.value || null;
                          if (v !== (k.data ?? null)) updateKm.mutate({ id: k.id, patch: { data: v as any } });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={k.motivo ?? ""}
                        placeholder="Motivo / destino"
                        className="h-7 text-xs min-w-[180px]"
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== (k.motivo ?? "")) updateKm.mutate({ id: k.id, patch: { motivo: v } as any });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        defaultValue={k.km ?? ""}
                        className="h-7 w-20 text-xs text-right tabular-nums ml-auto"
                        onBlur={(e) => {
                          const km = Number(e.target.value.replace(",", "."));
                          if (!isFinite(km) || km === Number(k.km)) return;
                          const n = Math.max(1, Number(k.n_carros ?? 1));
                          const valor = Math.round(km * KM_RATE * TRIP_FACTOR * n * 100) / 100;
                          updateKm.mutate({ id: k.id, patch: { km, valor } as any });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={k.matricula ?? ""}
                        placeholder="—"
                        className="h-7 w-24 text-xs"
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== (k.matricula ?? null)) updateKm.mutate({ id: k.id, patch: { matricula: v } as any });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={k.n_carros ?? 1}
                        className="h-7 w-16 text-xs text-right tabular-nums ml-auto"
                        onBlur={(e) => {
                          const n = Math.max(1, Math.floor(Number(e.target.value)));
                          if (!isFinite(n) || n === Number(k.n_carros)) return;
                          const km = Number(k.km ?? 0);
                          const valor = Math.round(km * KM_RATE * TRIP_FACTOR * n * 100) / 100;
                          updateKm.mutate({ id: k.id, patch: { n_carros: n, valor } as any });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium whitespace-nowrap">{eur(k.valor)}</TableCell>
                    <TableCell>
                      <Select
                        value={k.estado}
                        onValueChange={(v) => updateKm.mutate({ id: k.id, patch: {
                          estado: v as MapaKmRow["estado"],
                          data_pagamento: v === "pago" && !k.data_pagamento
                            ? new Date().toISOString().slice(0, 10)
                            : k.data_pagamento,
                        }})}
                      >
                        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="por_pagar">Por pagar</SelectItem>
                          <SelectItem value="pago">Pago</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <InlineEditCellTransporte
                        value={k.metodo_pagamento}
                        placeholder="Método"
                        onSave={(v) => updateKm.mutate({ id: k.id, patch: { metodo_pagamento: v || null } })}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {k.data_pagamento ?? "—"}
                    </TableCell>
                    <TableCell>
                      <InlineEditCellTransporte
                        value={k.notas}
                        placeholder="Notas"
                        onSave={(v) => updateKm.mutate({ id: k.id, patch: { notas: v || null } })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        disabled={deleteKm.isPending}
                        onClick={() => { if (confirm("Remover este registo de KM?")) deleteKm.mutate(k.id); }}
                        title="Remover registo de KM"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {mapaKm.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td colSpan={2} className="px-4 py-2 text-xs font-medium">Total</td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums">
                      {mapaKm.reduce((s, k) => s + k.km, 0).toLocaleString("pt-PT")} km
                    </td>
                    <td colSpan={2}></td>
                    <td className="px-4 py-2 text-right text-xs font-semibold tabular-nums whitespace-nowrap">
                      {eur(mapaKm.reduce((s, k) => s + k.valor, 0))}
                    </td>
                    <td colSpan={5}></td>
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function InlineEditCellTransporte({ value, onSave, placeholder = "—" }: { value: string | null; onSave: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (editing) {
    return (
      <Input
        autoFocus
        className="h-7 w-28 text-xs px-2"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(draft); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(draft); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className="text-left text-sm hover:underline decoration-dotted text-muted-foreground max-w-[120px] truncate"
    >
      {value || <span className="italic opacity-50">{placeholder}</span>}
    </button>
  );
}
