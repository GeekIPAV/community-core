import { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Trash2, UserMinus, FolderOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDateBR } from "@/lib/utils";
import { InlineText, InlineSelect, InlineMultiSelect } from "@/components/inline-edit";
import { KM_RATE, TRIP_FACTOR } from "@/lib/bolsa-transporte";
import { Switch } from "@/components/ui/switch";
import { personIcon, flagFor } from "@/lib/person-display";

// ── Constants ──────────────────────────────────────────────────────────────
const PESSOA_STATUS_OPTS = ["ativo", "suspeito_duplicado", "fundido", "arquivado"];
const GENERO_OPTS = ["Masculino", "Feminino"];

export const STATUS_OPTS = [
  "Sem estado",
  "Em espera",
  "No programa",
  "Não interessada",
  "Concluído",
  "Fora do País",
] as const;
export type FamiliaStatus = typeof STATUS_OPTS[number];

export const STATUS_GROUPS: { label: string; options: FamiliaStatus[] }[] = [
  { label: "A fazer", options: ["Sem estado", "Em espera"] },
  { label: "Em andamento", options: ["No programa"] },
  { label: "Concluídos", options: ["Não interessada", "Concluído", "Fora do País"] },
];

export type Familia = {
  id: string;
  nome: string;
  notas: string | null;
  status: FamiliaStatus;
  contacto_meeru_id: string | null;
  direito_bolsa?: boolean | null;
  direito_mapa_km?: boolean | null;
  updated_at: string | null;
};

type Membro = {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  status: string;
  genero: string | null;
  cidade_residencia: string | null;
  nacionalidade: string | null;
  religiao: string | null;
  nif: string | null;
  projeto_ids: string[] | null;
  is_voluntario: boolean | null;
};

// ── AtividadesFamiliaTab ────────────────────────────────────────────────────
type AtividadeCatalogo = { id: string; nome: string; categoria: string | null };
type FamiliaAtividadeRow = {
  id: string;
  data: string | null;
  descricao: string | null;
  created_at: string;
  atividade: { id: string; nome: string; categoria: string | null } | null;
};

function AtividadesFamiliaTab({ familiaId }: { familiaId: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [atividadeId, setAtividadeId] = useState<string>("");
  const [dataVal, setDataVal] = useState<string>("");
  const [descricao, setDescricao] = useState<string>("");
  const [novaOpen, setNovaOpen] = useState(false);
  const [novaNome, setNovaNome] = useState("");
  const [novaCategoria, setNovaCategoria] = useState<string>("");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const { data: catalogo } = useQuery({
    queryKey: ["atividades-catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atividades_catalogo")
        .select("id, nome, categoria")
        .eq("ativo", true)
        .order("categoria")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as AtividadeCatalogo[];
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["familia-atividades", familiaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familia_atividades")
        .select("id, data, descricao, created_at, atividade:atividades_catalogo(id, nome, categoria)")
        .eq("familia_id", familiaId)
        .order("data", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FamiliaAtividadeRow[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!atividadeId) throw new Error("Escolha uma atividade");
      const { error } = await supabase.from("familia_atividades").insert({
        familia_id: familiaId,
        atividade_id: atividadeId,
        data: dataVal || null,
        descricao: descricao.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atividade registada");
      qc.invalidateQueries({ queryKey: ["familia-atividades", familiaId] });
      setAddOpen(false);
      setAtividadeId("");
      setDataVal("");
      setDescricao("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("familia_atividades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atividade removida");
      qc.invalidateQueries({ queryKey: ["familia-atividades", familiaId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criarAtividade = useMutation({
    mutationFn: async () => {
      const nome = novaNome.trim();
      if (!nome) throw new Error("Nome obrigatório");
      const { data: inserted, error } = await supabase
        .from("atividades_catalogo")
        .insert({ nome, categoria: novaCategoria.trim() || null })
        .select("id")
        .single();
      if (error) throw error;
      return (inserted as any).id as string;
    },
    onSuccess: (id) => {
      toast.success("Atividade criada");
      qc.invalidateQueries({ queryKey: ["atividades-catalogo"] });
      setNovaOpen(false);
      setNovaNome("");
      setNovaCategoria("");
      setAtividadeId(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const categorias = Array.from(new Set((catalogo ?? []).map((c) => c.categoria || "(Sem categoria)")));

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Registar atividade
        </Button>
      </div>
      <div className="flex-1 min-h-0 max-h-[60vh] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Data</TableHead>
              <TableHead>Atividade</TableHead>
              <TableHead className="w-40">Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-16 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">A carregar…</TableCell></TableRow>
            )}
            {!isLoading && (!rows || rows.length === 0) && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem atividades registadas</TableCell></TableRow>
            )}
            {(() => {
              if (!rows) return null;
              const groups = new Map<string, typeof rows>();
              for (const r of rows) {
                const k = r.atividade?.categoria || "(Sem categoria)";
                const list = groups.get(k) ?? [];
                list.push(r);
                groups.set(k, list);
              }
              const sorted = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
              return sorted.flatMap(([cat, items]) => [
                <TableRow key={`grp-${cat}`} className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={5} className="font-semibold">
                    {cat} <span className="text-muted-foreground font-normal">({items.length})</span>
                  </TableCell>
                </TableRow>,
                ...items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{r.data ? formatDateBR(r.data) : "—"}</TableCell>
                    <TableCell className="font-medium">{r.atividade?.nome ?? "—"}</TableCell>
                    <TableCell>{r.atividade?.categoria ? <Badge variant="secondary">{r.atividade.categoria}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-pre-wrap">{r.descricao || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Remover"
                        onClick={() => setConfirmRemoveId(r.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )),
              ]);
            })()}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Registar atividade</DialogTitle>
            <DialogDescription>Escolha uma atividade do catálogo. Se não encontrar, pode criar uma nova.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Atividade</Label>
              <div className="flex gap-2">
                <Select value={atividadeId} onValueChange={setAtividadeId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Escolher…" /></SelectTrigger>
                  <SelectContent className="max-h-[60vh]">
                    {categorias.map((cat) => (
                      <div key={cat}>
                        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{cat}</div>
                        {(catalogo ?? []).filter((c) => (c.categoria || "(Sem categoria)") === cat).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setNovaOpen(true)} title="Criar nova atividade">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={dataVal} onChange={(e) => setDataVal(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Notas, contexto, observações…" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => add.mutate()} disabled={!atividadeId || add.isPending}>
              {add.isPending ? "A guardar…" : "Registar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova atividade</DialogTitle>
            <DialogDescription>Adiciona uma nova atividade ao catálogo para todas as famílias.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={novaNome} onChange={(e) => setNovaNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={novaCategoria || "__none"} onValueChange={(v) => setNovaCategoria(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">(Sem categoria)</SelectItem>
                  <SelectItem value="Cultural">Cultural</SelectItem>
                  <SelectItem value="Relacional">Relacional</SelectItem>
                  <SelectItem value="Mediação">Mediação</SelectItem>
                  <SelectItem value="Económica Educacional e da Saúde">Económica Educacional e da Saúde</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => criarAtividade.mutate()} disabled={!novaNome.trim() || criarAtividade.isPending}>
              {criarAtividade.isPending ? "A criar…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmRemoveId} onOpenChange={(o) => !o && setConfirmRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover atividade</AlertDialogTitle>
            <AlertDialogDescription>Remover esta atividade do registo da família?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRemoveId) remove.mutate(confirmRemoveId);
                setConfirmRemoveId(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── FamilyDetailDialog ───────────────────────────────────────────────────────

// ── TransporteFamiliaTab ────────────────────────────────────────────────────

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

function TransporteFamiliaTab({ familiaId }: { familiaId: string }) {
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


export interface FamilyDetailDialogProps {
  family: Familia | null;
  open: boolean;
  onClose: () => void;
  /** Full list of siblings to enable prev/next navigation */
  siblings?: Familia[];
  /** Called when user navigates to a different sibling */
  onSelectSibling?: (f: Familia) => void;
  /** Called after any successful mutation so the parent can refresh its queries */
  onUpdate?: () => void;
  /** Which tab to open first (defaults to "membros") */
 defaultTab?: "dados" | "membros" | "projetos" | "acoes" | "atividades" | "casos" | "contexto" | "transporte";
}

export function FamilyDetailDialog({
  family,
  open,
  onClose,
  siblings,
  onSelectSibling,
  onUpdate,
  defaultTab = "membros",
}: FamilyDetailDialogProps) {
  const qc = useQueryClient();

  // ── tab + editing state ───────────────────────────────────────────────────
  const [detailTab, setDetailTab] = useState<"dados" | "membros" | "projetos" | "acoes" | "atividades" | "casos" | "contexto" | "transporte">(defaultTab);
  const [editing, setEditing] = useState<Familia | null>(family);

  // When the selected family changes reset editing state. Only reset the active
  // tab on the first open (not on prev/next sibling navigation).
  const prevFamilyId = useRef<string | null>(null);
  useEffect(() => {
    if (!family) return;
    setEditing({ ...family });
    if (prevFamilyId.current === null) {
      setDetailTab(defaultTab);
    }
    prevFamilyId.current = family.id;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family?.id]);

  useEffect(() => {
    if (!open) {
      prevFamilyId.current = null;
    }
  }, [open]);

  // ── shared confirm dialog state ───────────────────────────────────────────
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  // ── sub-dialog states ─────────────────────────────────────────────────────
  const [addMembroOpen, setAddMembroOpen] = useState(false);
  const [addAcaoOpen, setAddAcaoOpen] = useState(false);
  const [novaAcao, setNovaAcao] = useState<{ pessoa_id: string; acao_id: string }>({ pessoa_id: "", acao_id: "" });
  const [bulkProjetoId, setBulkProjetoId] = useState<string>("");

  const emptyMembro = {
    nome_completo: "",
    email: "",
    telefone: "",
    data_nascimento: "",
    genero: "" as string,
    cidade_residencia: "",
    nacionalidade: "",
    religiao: "",
    nif: "",
    projeto_ids: [] as string[],
    status: "ativo" as string,
  };
  const [novoMembro, setNovoMembro] = useState(emptyMembro);
  const [bulkMembrosText, setBulkMembrosText] = useState("");
  const [bulkMembrosVoluntario, setBulkMembrosVoluntario] = useState(false);

  const BULK_MEMBROS_PLACEHOLDER =
    "nome, email, telefone, data_nascimento (AAAA-MM-DD), genero, cidade, nacionalidade, religiao, nif\n" +
    "Maria Silva, maria@exemplo.pt, 912345678, 1985-03-12, Feminino, Lisboa, Portuguesa, Católica, 123456789\n" +
    "João Costa, , 933221100, 1990-07-25, Masculino, Porto, Portuguesa, , ";

  // ── queries ───────────────────────────────────────────────────────────────
  const { data: membros, isLoading: loadingMembros } = useQuery({
    queryKey: ["familias", "membros", family?.id],
    enabled: !!family,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, telefone, data_nascimento, status, genero, cidade_residencia, nacionalidade, religiao, nif, projeto_ids, is_voluntario")
        .eq("familia_id", family!.id)
        .order("nome_completo");
      if (error) throw error;
      return data as Membro[];
    },
  });

  const { data: equipa } = useQuery({
    queryKey: ["familias", "equipa-meeru"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, auth_user_id, is_admin, tipo_user_id")
        .eq("status", "ativo")
        .not("auth_user_id", "is", null)
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; nome_completo: string; email: string | null; auth_user_id: string | null; is_admin: boolean; tipo_user_id: string | null }>;
    },
  });

  const { data: projetosList } = useQuery({
    queryKey: ["projetos", "lista"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });
  const projetosMap = useMemo(() => new Map((projetosList ?? []).map((p) => [p.id, p.nome])), [projetosList]);

  const { data: acoesFamilia, isLoading: loadingAcoesFamilia } = useQuery({
    queryKey: ["familias", "acoes", family?.id],
    enabled: !!family && membros !== undefined,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const ids = (membros ?? []).map((m) => m.id);
      if (ids.length === 0)
        return [] as Array<{ inscricao_id: string; acao_id: string; nome: string; data_inicio: string | null; local: string | null; status: string; pessoa_id: string; pessoa_nome: string }>;
      const { data, error } = await supabase
        .from("inscricoes")
        .select("id, status, pessoa_id, acao:acoes(id, nome, data_inicio, local)")
        .in("pessoa_id", ids)
        .neq("status", "cancelada");
      if (error) throw error;
      const nomeById = new Map((membros ?? []).map((m) => [m.id, m.nome_completo]));
      return (data ?? []).map((r: any) => ({
        inscricao_id: r.id,
        acao_id: r.acao?.id,
        nome: r.acao?.nome ?? "—",
        data_inicio: r.acao?.data_inicio ?? null,
        local: r.acao?.local ?? null,
        status: r.status,
        pessoa_id: r.pessoa_id,
        pessoa_nome: nomeById.get(r.pessoa_id) ?? "—",
      }));
    },
  });

  const { data: acoesList } = useQuery({
    queryKey: ["acoes", "lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes")
        .select("id, nome, data_inicio")
        .order("data_inicio", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; data_inicio: string | null }[];
    },
  });

  // ── invalidation helpers ──────────────────────────────────────────────────
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["familias"] });
    qc.invalidateQueries({ queryKey: ["pessoas"] });
    onUpdate?.();
  };

  const invalidateMembros = () => {
    qc.invalidateQueries({ queryKey: ["familias", "membros", family?.id] });
    qc.invalidateQueries({ queryKey: ["familias", "contagens"] });
    qc.invalidateQueries({ queryKey: ["familias", "agregados"] });
    qc.invalidateQueries({ queryKey: ["pessoas"] });
    onUpdate?.();
  };

  // ── mutations ─────────────────────────────────────────────────────────────
  const savePessoa = (id: string, field: string) => async (v: any) => {
    const { error } = await supabase.from("pessoas").update({ [field]: v } as any).eq("id", id);
    if (error) { toast.error(error.message); throw error; }
    invalidateMembros();
  };

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("familias")
        .update({
          nome: editing.nome,
          notas: editing.notas || null,
          status: editing.status,
          contacto_meeru_id: editing.contacto_meeru_id,
          direito_bolsa: !!editing.direito_bolsa,
          direito_mapa_km: !!editing.direito_mapa_km,
        } as any)
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Família atualizada");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFamilia = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("familias").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Família eliminada");
      invalidateAll();
      qc.invalidateQueries({ queryKey: ["familias", "contagens"] });
      qc.invalidateQueries({ queryKey: ["familias", "agregados"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMembro = useMutation({
    mutationFn: async () => {
      if (!family) throw new Error("Família não selecionada");
      const nome = novoMembro.nome_completo.trim();
      if (!nome) throw new Error("Nome é obrigatório");
      const { error } = await supabase.from("pessoas").insert({
        nome_completo: nome,
        email: novoMembro.email.trim() || null,
        telefone: novoMembro.telefone.trim() || null,
        data_nascimento: novoMembro.data_nascimento || null,
        genero: novoMembro.genero || null,
        cidade_residencia: novoMembro.cidade_residencia.trim() || null,
        nacionalidade: novoMembro.nacionalidade.trim() || null,
        religiao: novoMembro.religiao.trim() || null,
        nif: novoMembro.nif.trim() || null,
        projeto_ids: novoMembro.projeto_ids,
        status: novoMembro.status,
        familia_id: family.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro adicionado");
      invalidateMembros();
      setAddMembroOpen(false);
      setNovoMembro(emptyMembro);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkAddMembros = useMutation({
    mutationFn: async () => {
      if (!family) throw new Error("Família não selecionada");
      const lines = bulkMembrosText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .filter((l) => !/^nome\s*,/i.test(l));
      if (lines.length === 0) throw new Error("Nada para importar");
      const rows = lines.map((line, idx) => {
        const cols = line.split(",").map((c) => c.trim());
        const [nomeCol, email, telefone, data_nascimento, genero, cidade, nacionalidade, religiao, nif] = cols;
        if (!nomeCol) throw new Error(`Linha ${idx + 1}: nome é obrigatório`);
        if (data_nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(data_nascimento)) {
          throw new Error(`Linha ${idx + 1}: data deve estar em AAAA-MM-DD`);
        }
        return {
          nome_completo: nomeCol,
          email: email || null,
          telefone: telefone || null,
          data_nascimento: data_nascimento || null,
          genero: genero || null,
          cidade_residencia: cidade || null,
          nacionalidade: nacionalidade || null,
          religiao: religiao || null,
          nif: nif || null,
          status: "ativo",
          is_voluntario: bulkMembrosVoluntario,
          familia_id: family.id,
        };
      });
      const { error } = await supabase.from("pessoas").insert(rows as any);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} ${bulkMembrosVoluntario ? "voluntário(s)" : "membro(s)"} adicionado(s)`);
      invalidateMembros();
      setAddMembroOpen(false);
      setBulkMembrosText("");
      setBulkMembrosVoluntario(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeFromFamilia = useMutation({
    mutationFn: async (pessoaId: string) => {
      const { error } = await supabase.from("pessoas").update({ familia_id: null } as any).eq("id", pessoaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro removido da família");
      invalidateMembros();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePessoa = useMutation({
    mutationFn: async (pessoaId: string) => {
      const { error } = await supabase.from("pessoas").update({ deleted_at: new Date().toISOString() } as any).eq("id", pessoaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Utilizador apagado");
      invalidateMembros();
      qc.invalidateQueries({ queryKey: ["familias", "acoes", family?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkAssignProjeto = useMutation({
    mutationFn: async ({ projetoId, action }: { projetoId: string; action: "add" | "remove" }) => {
      const lista = membros ?? [];
      if (lista.length === 0) throw new Error("Sem membros");
      const batchSize = 5;
      for (let i = 0; i < lista.length; i += batchSize) {
        const batch = lista.slice(i, i + batchSize);
        await Promise.all(batch.map(async (m) => {
          const atuais = new Set<string>(m.projeto_ids ?? []);
          if (action === "add") atuais.add(projetoId);
          else atuais.delete(projetoId);
          const { error } = await supabase
            .from("pessoas")
            .update({ projeto_ids: Array.from(atuais) } as any)
            .eq("id", m.id);
          if (error) throw error;
        }));
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.action === "add" ? "Projeto atribuído a todos os membros" : "Projeto removido de todos os membros");
      qc.invalidateQueries({ queryKey: ["familias", "membros", family?.id] });
      qc.invalidateQueries({ queryKey: ["familias", "agregados"] });
      qc.invalidateQueries({ queryKey: ["pessoas"] });
      setBulkProjetoId("");
      onUpdate?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addInscricaoFamilia = useMutation({
    mutationFn: async () => {
      if (!novaAcao.pessoa_id || !novaAcao.acao_id) throw new Error("Escolha membro e ação");
      const { data: existing } = await supabase
        .from("inscricoes")
        .select("id, status")
        .eq("pessoa_id", novaAcao.pessoa_id)
        .eq("acao_id", novaAcao.acao_id)
        .neq("status", "cancelada")
        .maybeSingle();
      if (existing) throw new Error("Este membro já está inscrito nesta ação");
      const { error } = await supabase.from("inscricoes").insert({ pessoa_id: novaAcao.pessoa_id, acao_id: novaAcao.acao_id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inscrição adicionada");
      qc.invalidateQueries({ queryKey: ["familias", "acoes", family?.id] });
      qc.invalidateQueries({ queryKey: ["familias", "agregados"] });
      setAddAcaoOpen(false);
      setNovaAcao({ pessoa_id: "", acao_id: "" });
      onUpdate?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── navigation ────────────────────────────────────────────────────────────
  const siblingIdx = siblings && family ? siblings.findIndex((f) => f.id === family.id) : -1;
  const hasPrev = siblingIdx > 0;
  const hasNext = siblings != null && siblingIdx >= 0 && siblingIdx < siblings.length - 1;

  const goPrev = () => {
    if (hasPrev && siblings && onSelectSibling) onSelectSibling(siblings[siblingIdx - 1]);
  };
  const goNext = () => {
    if (hasNext && siblings && onSelectSibling) onSelectSibling(siblings[siblingIdx + 1]);
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-[min(1200px,95vw)] w-[95vw] sm:w-full p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-6 pb-0">
            <DialogHeader>
              <div className="flex items-center justify-between gap-3">
                <DialogTitle>{family?.nome}</DialogTitle>
                {siblings && onSelectSibling && (
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" title="Família anterior" onClick={goPrev} disabled={!hasPrev}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Família seguinte" onClick={goNext} disabled={!hasNext}>
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                )}
              </div>
              <DialogDescription>
                {loadingMembros ? "A carregar…" : `${membros?.length ?? 0} membro(s)`}
              </DialogDescription>
            </DialogHeader>
          </div>

          <Tabs
            value={detailTab}
            onValueChange={(v) => setDetailTab(v as typeof detailTab)}
            className="flex flex-col flex-1 min-h-0 px-6 pb-6"
          >
            <TabsList className="w-full">
              <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
              <TabsTrigger value="membros" className="flex-1">Membros</TabsTrigger>
              <TabsTrigger value="projetos" className="flex-1">Projetos</TabsTrigger>
              <TabsTrigger value="acoes" className="flex-1">Ações</TabsTrigger>
              <TabsTrigger value="atividades" className="flex-1">Atividades</TabsTrigger>
              <TabsTrigger value="casos" className="flex-1">Casos</TabsTrigger>
              <TabsTrigger value="transporte" className="flex-1">Transporte</TabsTrigger>
              <TabsTrigger value="contexto" className="flex-1">
                {family ? <ContextoTabLabel familiaId={family.id} /> : "Contexto"}
              </TabsTrigger>
            </TabsList>

            {/* ── Dados ── */}
            <TabsContent value="dados" className="space-y-4 pt-4">
              {editing && (
                <>
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v as FamiliaStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_GROUPS.map((g) => (
                          <div key={g.label}>
                            <div className="px-2 py-1 text-xs text-muted-foreground">{g.label}</div>
                            {g.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea value={editing.notas ?? ""} onChange={(e) => setEditing({ ...editing, notas: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Pessoa de Contacto (Equipa MEERU)</Label>
                    <Select
                      value={editing.contacto_meeru_id ?? "__none"}
                      onValueChange={(v) => setEditing({ ...editing, contacto_meeru_id: v === "__none" ? null : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Sem contacto" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Sem contacto</SelectItem>
                        {(equipa ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter className="flex justify-between gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setConfirmState({
                          open: true,
                          title: "Eliminar família",
                          description: `Eliminar "${editing.nome}"? Os membros ficarão sem família e as atividades associadas serão removidas. Esta ação não pode ser desfeita.`,
                          onConfirm: () => deleteFamilia.mutate(editing.id),
                        });
                      }}
                      disabled={deleteFamilia.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deleteFamilia.isPending ? "A eliminar…" : "Eliminar família"}
                    </Button>
                    <Button onClick={() => update.mutate()} disabled={!editing.nome.trim() || update.isPending}>
                      {update.isPending ? "A guardar…" : "Guardar"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </TabsContent>

            {/* ── Membros ── */}
            <TabsContent value="membros" className="pt-4 flex-1 min-h-0 overflow-hidden">
              {(() => {
                const membrosNormais = (membros ?? []).filter((m) => !m.is_voluntario);
                const voluntarios = (membros ?? []).filter((m) => !!m.is_voluntario);
                const renderTable = (lista: typeof membrosNormais, emptyLabel: string) => (
                  <div className="flex-1 min-h-0 max-h-[55vh] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Data nasc.</TableHead>
                          <TableHead>Género</TableHead>
                          <TableHead>Cidade</TableHead>
                          <TableHead>Nacionalidade</TableHead>
                          <TableHead>Religião</TableHead>
                          <TableHead>NIF</TableHead>
                          <TableHead>Projetos</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-20 text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lista.length === 0 && !loadingMembros && (
                          <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">{emptyLabel}</TableCell></TableRow>
                        )}
                        {lista.map((m) => {
                          const PersonIco = personIcon(m.genero, m.data_nascimento);
                          return (
                            <TableRow key={m.id}>
                              <TableCell className="font-medium whitespace-nowrap min-w-[180px]">
                                <span className="inline-flex items-center gap-2">
                                  <PersonIco aria-hidden className="h-5 w-5 shrink-0 text-primary" strokeWidth={2.25} />
                                  <InlineText value={m.nome_completo} onSave={async (v) => { if (v) await savePessoa(m.id, "nome_completo")(v); }} />
                                </span>
                              </TableCell>
                              <TableCell className="min-w-[200px]"><InlineText value={m.email} onSave={savePessoa(m.id, "email")} /></TableCell>
                              <TableCell className="min-w-[140px]"><InlineText value={m.telefone} onSave={savePessoa(m.id, "telefone")} /></TableCell>
                              <TableCell className="min-w-[140px]"><InlineText value={m.data_nascimento} type="date" onSave={savePessoa(m.id, "data_nascimento")} /></TableCell>
                              <TableCell className="min-w-[120px]">
                                <InlineSelect value={m.genero} options={GENERO_OPTS.map((g) => ({ value: g, label: g }))} placeholder="não definido" onSave={savePessoa(m.id, "genero")} />
                              </TableCell>
                              <TableCell className="min-w-[160px]"><InlineText value={m.cidade_residencia} onSave={savePessoa(m.id, "cidade_residencia")} /></TableCell>
                              <TableCell className="min-w-[140px]">
                                {m.nacionalidade ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <span aria-hidden>{flagFor(m.nacionalidade)}</span>
                                    <InlineText value={m.nacionalidade} onSave={savePessoa(m.id, "nacionalidade")} />
                                  </span>
                                ) : (
                                  <InlineText value={m.nacionalidade} onSave={savePessoa(m.id, "nacionalidade")} />
                                )}
                              </TableCell>
                              <TableCell className="min-w-[140px]"><InlineText value={m.religiao} onSave={savePessoa(m.id, "religiao")} /></TableCell>
                              <TableCell className="min-w-[120px]"><InlineText value={m.nif} onSave={savePessoa(m.id, "nif")} /></TableCell>
                              <TableCell>
                                <InlineMultiSelect
                                  values={m.projeto_ids ?? []}
                                  options={(projetosList ?? []).map((p) => ({ value: p.id, label: p.nome }))}
                                  placeholder="sem projetos"
                                  onSave={(v) => savePessoa(m.id, "projeto_ids")(v)}
                                />
                              </TableCell>
                              <TableCell>
                                <InlineSelect
                                  value={m.status}
                                  options={PESSOA_STATUS_OPTS.map((s) => ({ value: s, label: s }))}
                                  allowClear={false}
                                  onSave={savePessoa(m.id, "status")}
                                />
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    title="Remover da família"
                                    onClick={() => {
                                      setConfirmState({
                                        open: true,
                                        title: "Remover da família",
                                        description: `Remover ${m.nome_completo} desta família? O utilizador continua a existir.`,
                                        onConfirm: () => removeFromFamilia.mutate(m.id),
                                      });
                                    }}
                                  >
                                    <UserMinus className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    title="Apagar utilizador"
                                    onClick={() => {
                                      setConfirmState({
                                        open: true,
                                        title: "Apagar utilizador",
                                        description: `Apagar ${m.nome_completo} definitivamente? Esta ação não pode ser desfeita.`,
                                        onConfirm: () => deletePessoa.mutate(m.id),
                                      });
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                );
                return (
                  <div className="flex flex-col h-full min-h-0 gap-3">
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => setAddMembroOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Adicionar membro
                      </Button>
                    </div>
                    <Tabs defaultValue="membros-inner" className="flex flex-col flex-1 min-h-0">
                      <TabsList className="w-full">
                        <TabsTrigger value="membros-inner" className="flex-1">Membros ({membrosNormais.length})</TabsTrigger>
                        <TabsTrigger value="voluntarios-inner" className="flex-1">Voluntários ({voluntarios.length})</TabsTrigger>
                      </TabsList>
                      <TabsContent value="membros-inner" className="pt-3 flex-1 min-h-0">
                        {renderTable(membrosNormais, "Sem membros")}
                      </TabsContent>
                      <TabsContent value="voluntarios-inner" className="pt-3 flex-1 min-h-0">
                        {renderTable(voluntarios, "Sem voluntários")}
                      </TabsContent>
                    </Tabs>
                  </div>
                );
              })()}
            </TabsContent>

            {/* ── Projetos ── */}
            <TabsContent value="projetos" className="pt-4 flex-1 min-h-0 overflow-auto">
              {(() => {
                const lista = membros ?? [];
                const porProjeto = new Map<string, { nome: string; membros: { id: string; nome: string }[] }>();
                for (const m of lista) {
                  for (const pid of (m.projeto_ids ?? [])) {
                    const nome = projetosMap.get(pid) ?? "(projeto removido)";
                    const entry = porProjeto.get(pid) ?? { nome, membros: [] };
                    entry.membros.push({ id: m.id, nome: m.nome_completo });
                    porProjeto.set(pid, entry);
                  }
                }
                const resumo = Array.from(porProjeto.entries()).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
                const todosTemProjeto = (pid: string) => lista.length > 0 && lista.every((m) => (m.projeto_ids ?? []).includes(pid));
                return (
                  <div className="space-y-5">
                    <div className="rounded-md border p-4 space-y-3">
                      <div className="text-sm font-medium">Atribuir projeto a todos os membros</div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Select value={bulkProjetoId} onValueChange={setBulkProjetoId}>
                          <SelectTrigger className="sm:w-72"><SelectValue placeholder="Escolher projeto…" /></SelectTrigger>
                          <SelectContent>
                            {(projetosList ?? []).map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => bulkAssignProjeto.mutate({ projetoId: bulkProjetoId, action: "add" })}
                          disabled={!bulkProjetoId || lista.length === 0 || bulkAssignProjeto.isPending}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Atribuir a todos ({lista.length})
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Adiciona o projeto escolhido a todos os membros desta família. Membros que já estejam no projeto mantêm-se.
                      </p>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Resumo dos projetos</div>
                      {resumo.length === 0 ? (
                        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                          Nenhum membro está atribuído a projetos.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {resumo.map(([pid, info]) => (
                            <div key={pid} className="rounded-md border p-3 flex flex-col gap-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{info.nome}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {info.membros.length} de {lista.length} membro(s)
                                    {todosTemProjeto(pid) && " · todos"}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setConfirmState({
                                      open: true,
                                      title: "Remover projeto",
                                      description: `Remover o projeto "${info.nome}" de todos os membros desta família?`,
                                      onConfirm: () => bulkAssignProjeto.mutate({ projetoId: pid, action: "remove" }),
                                    });
                                  }}
                                  disabled={bulkAssignProjeto.isPending}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" /> Remover de todos
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {info.membros.map((m) => (
                                  <Badge key={m.id} variant="secondary" className="text-[11px]">{m.nome}</Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </TabsContent>

            {/* ── Ações ── */}
            <TabsContent value="acoes" className="pt-4 flex-1 min-h-0 overflow-hidden">
              {loadingMembros ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
              <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Inscrições dos membros desta família</span>
                <Button
                  size="sm"
                  onClick={() => {
                    setNovaAcao({ pessoa_id: (membros?.[0]?.id ?? ""), acao_id: "" });
                    setAddAcaoOpen(true);
                  }}
                  disabled={!membros || membros.length === 0}
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar ação
                </Button>
              </div>
              <div className="h-full max-h-[60vh] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Membro</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingAcoesFamilia && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">A carregar…</TableCell></TableRow>
                    )}
                    {!loadingAcoesFamilia && (!acoesFamilia || acoesFamilia.length === 0) && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem inscrições</TableCell></TableRow>
                    )}
                    {acoesFamilia?.map((a) => (
                      <TableRow key={a.inscricao_id}>
                        <TableCell className="font-medium whitespace-nowrap">{a.nome}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{a.data_inicio ? formatDateBR(a.data_inicio) : "—"}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{a.local ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{a.pessoa_nome}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{a.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              </>
              )}
            </TabsContent>

            {/* ── Atividades ── */}
            <TabsContent value="atividades" className="pt-4 flex-1 min-h-0 overflow-hidden">
              {family && <AtividadesFamiliaTab familiaId={family.id} />}
            </TabsContent>

            {/* ── Casos de Apoio ── */}
            <TabsContent value="casos" className="pt-4 flex-1 min-h-0 overflow-auto">
              {family && <CasosFamiliaTab familiaId={family.id} />}
            </TabsContent>

            {/* ── Transporte ── */}
            <TabsContent value="transporte" className="pt-4 flex-1 min-h-0 overflow-auto">
              {family && <TransporteFamiliaTab familiaId={family.id} />}
            </TabsContent>

            {/* ── Contexto Relacional ── */}
            <TabsContent value="contexto" className="pt-4 flex-1 min-h-0 overflow-auto">
              {family && <ContextoRelacionalTab familiaId={family.id} />}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ── Add ação sub-dialog ── */}
      <Dialog open={addAcaoOpen} onOpenChange={setAddAcaoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar ação</DialogTitle>
            <DialogDescription>{family ? `Família: ${family.nome}` : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Membro</Label>
              <Select value={novaAcao.pessoa_id || undefined} onValueChange={(v) => setNovaAcao((s) => ({ ...s, pessoa_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Escolher membro…" /></SelectTrigger>
                <SelectContent>
                  {(membros ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ação</Label>
              <Select value={novaAcao.acao_id || undefined} onValueChange={(v) => setNovaAcao((s) => ({ ...s, acao_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Escolher ação…" /></SelectTrigger>
                <SelectContent>
                  {(acoesList ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}{a.data_inicio ? ` — ${formatDateBR(a.data_inicio)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addInscricaoFamilia.mutate()}
              disabled={!novaAcao.pessoa_id || !novaAcao.acao_id || addInscricaoFamilia.isPending}
            >
              {addInscricaoFamilia.isPending ? "A guardar…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add membro sub-dialog ── */}
      <Dialog open={addMembroOpen} onOpenChange={setAddMembroOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar membro</DialogTitle>
            <DialogDescription>{family ? `Família: ${family.nome}` : ""}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="individual" className="flex flex-col gap-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="individual">Individual</TabsTrigger>
              <TabsTrigger value="massa">Importar em massa</TabsTrigger>
            </TabsList>
            <TabsContent value="individual">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="membro-nome">Nome completo</Label>
                  <Input id="membro-nome" value={novoMembro.nome_completo} onChange={(e) => setNovoMembro({ ...novoMembro, nome_completo: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="membro-email">Email</Label>
                  <Input id="membro-email" type="email" value={novoMembro.email} onChange={(e) => setNovoMembro({ ...novoMembro, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="membro-telefone">Telefone</Label>
                  <Input id="membro-telefone" value={novoMembro.telefone} onChange={(e) => setNovoMembro({ ...novoMembro, telefone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="membro-data">Data de nascimento</Label>
                  <Input id="membro-data" type="date" value={novoMembro.data_nascimento} onChange={(e) => setNovoMembro({ ...novoMembro, data_nascimento: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Género</Label>
                  <Select value={novoMembro.genero || "__none"} onValueChange={(v) => setNovoMembro({ ...novoMembro, genero: v === "__none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      {GENERO_OPTS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="membro-cidade">Cidade</Label>
                  <Input id="membro-cidade" value={novoMembro.cidade_residencia} onChange={(e) => setNovoMembro({ ...novoMembro, cidade_residencia: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="membro-nacionalidade">Nacionalidade</Label>
                  <Input id="membro-nacionalidade" value={novoMembro.nacionalidade} onChange={(e) => setNovoMembro({ ...novoMembro, nacionalidade: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="membro-religiao">Religião</Label>
                  <Input id="membro-religiao" value={novoMembro.religiao} onChange={(e) => setNovoMembro({ ...novoMembro, religiao: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="membro-nif">NIF</Label>
                  <Input id="membro-nif" value={novoMembro.nif} onChange={(e) => setNovoMembro({ ...novoMembro, nif: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Projetos</Label>
                  <InlineMultiSelect
                    values={novoMembro.projeto_ids}
                    options={(projetosList ?? []).map((p) => ({ value: p.id, label: p.nome }))}
                    placeholder="sem projetos"
                    onSave={(v) => setNovoMembro({ ...novoMembro, projeto_ids: v })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={novoMembro.status} onValueChange={(v) => setNovoMembro({ ...novoMembro, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PESSOA_STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button onClick={() => addMembro.mutate()} disabled={!novoMembro.nome_completo.trim() || addMembro.isPending}>
                  {addMembro.isPending ? "A guardar…" : "Adicionar"}
                </Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="massa">
              <div className="space-y-3">
                <Textarea
                  rows={10}
                  className="font-mono text-xs"
                  placeholder={BULK_MEMBROS_PLACEHOLDER}
                  value={bulkMembrosText}
                  onChange={(e) => setBulkMembrosText(e.target.value)}
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={bulkMembrosVoluntario}
                    onCheckedChange={(v) => setBulkMembrosVoluntario(!!v)}
                  />
                  Adicionar como voluntários
                </label>
                <p className="text-xs text-muted-foreground">
                  Colunas: nome, email, telefone, data_nascimento (AAAA-MM-DD), genero, cidade, nacionalidade, religiao, nif. Só o nome é obrigatório — deixa as restantes em branco entre vírgulas.
                </p>
              </div>
              <DialogFooter className="mt-4">
                <Button
                  onClick={() => bulkAddMembros.mutate()}
                  disabled={!bulkMembrosText.trim() || bulkAddMembros.isPending}
                >
                  {bulkAddMembros.isPending ? "A importar…" : "Importar"}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmState.open}
        onOpenChange={(o) => !o && setConfirmState((s) => ({ ...s, open: false }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmState.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmState.onConfirm();
                setConfirmState((s) => ({ ...s, open: false }));
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Contexto Relacional ────────────────────────────────────────────────────
const LINGUAS_OPTS = [
  "Português", "Árabe", "Inglês", "Francês", "Tigrínia",
  "Wolof", "Sorani", "Russo", "Ucraniano", "Outro",
];
const REDES_OPTS = [
  "Família alargada presente",
  "Amigos da comunidade",
  "Vizinhos de referência",
  "Comunidade religiosa",
  "Sem redes identificadas",
];
const REDES_EXCL = "Sem redes identificadas";
const FREQ_OPTS = [
  "Muito frequente (semanal)",
  "Frequente (mensal)",
  "Ocasional",
  "Inativa",
];

type Contexto = {
  familia_id: string;
  territorio: string | null;
  linguas: string[];
  tradicao_cultural: string | null;
  redes_suporte: string[];
  frequencia_participacao: string | null;
  notas_relacionais: string | null;
};

function useContextoQuery(familiaId: string) {
  return useQuery({
    queryKey: ["familia-contexto", familiaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familia_contexto")
        .select("*")
        .eq("familia_id", familiaId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Contexto | null;
    },
  });
}

export function ContextoTabLabel({ familiaId }: { familiaId: string }) {
  const { data } = useContextoQuery(familiaId);
  const hasData = !!data && (
    !!data.territorio ||
    (data.linguas?.length ?? 0) > 0 ||
    !!data.tradicao_cultural ||
    (data.redes_suporte?.length ?? 0) > 0 ||
    !!data.frequencia_participacao ||
    !!data.notas_relacionais
  );
  return (
    <span className="inline-flex items-center gap-1.5">
      Contexto
      {hasData && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
    </span>
  );
}

function ContextoRelacionalTab({ familiaId }: { familiaId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useContextoQuery(familiaId);

  const empty: Contexto = {
    familia_id: familiaId,
    territorio: "",
    linguas: [],
    tradicao_cultural: "",
    redes_suporte: [],
    frequencia_participacao: null,
    notas_relacionais: "",
  };
  const [local, setLocal] = useState<Contexto>(empty);

  useEffect(() => {
    if (data) setLocal(data);
    else setLocal(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, familiaId]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["familia-contexto", familiaId] });

  const saveField = async (patch: Partial<Contexto>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    const payload = { ...next, familia_id: familiaId };
    const { error } = await supabase
      .from("familia_contexto")
      .upsert(payload, { onConflict: "familia_id" });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Contexto guardado");
      invalidate();
    }
  };

  const saveAll = async () => {
    const { error } = await supabase
      .from("familia_contexto")
      .upsert({ ...local, familia_id: familiaId }, { onConflict: "familia_id" });
    if (error) toast.error(error.message);
    else { toast.success("Contexto relacional guardado"); invalidate(); }
  };

  const toggleLingua = (l: string) => {
    const has = local.linguas.includes(l);
    saveField({ linguas: has ? local.linguas.filter((x) => x !== l) : [...local.linguas, l] });
  };

  const toggleRede = (r: string) => {
    const isExcl = r === REDES_EXCL;
    if (isExcl) {
      const has = local.redes_suporte.includes(REDES_EXCL);
      saveField({ redes_suporte: has ? [] : [REDES_EXCL] });
      return;
    }
    if (local.redes_suporte.includes(REDES_EXCL)) return;
    const has = local.redes_suporte.includes(r);
    saveField({ redes_suporte: has ? local.redes_suporte.filter((x) => x !== r) : [...local.redes_suporte, r] });
  };

  if (isLoading) {
    return <div className="space-y-2 p-1"><div className="h-32 animate-pulse rounded bg-muted" /></div>;
  }

  const hExcl = local.redes_suporte.includes(REDES_EXCL);

  return (
    <div className="space-y-4 p-1">
      {/* Localização e Línguas */}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-0">Localização e Línguas</h3>
      <div className="space-y-2">
        <Label>Território / bairro</Label>
        <Input
          value={local.territorio ?? ""}
          onChange={(e) => setLocal({ ...local, territorio: e.target.value })}
          onBlur={() => saveField({ territorio: local.territorio?.trim() || null })}
          placeholder="Ex: Bonfim, Campanhã..."
        />
      </div>
      <div className="space-y-2">
        <Label>Línguas faladas</Label>
        <div className="flex flex-wrap gap-1.5">
          {LINGUAS_OPTS.map((l) => {
            const on = local.linguas.includes(l);
            return (
              <button
                key={l}
                type="button"
                onClick={() => toggleLingua(l)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cultura e Identidade */}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-6">Cultura e Identidade</h3>
      <div className="space-y-1">
        <Label>Tradição cultural / religiosa</Label>
        <Textarea
          rows={2}
          value={local.tradicao_cultural ?? ""}
          onChange={(e) => setLocal({ ...local, tradicao_cultural: e.target.value })}
          onBlur={() => saveField({ tradicao_cultural: local.tradicao_cultural?.trim() || null })}
        />
        <p className="text-xs text-muted-foreground italic mt-1">
          Campo opcional e confidencial — preencher apenas com o consentimento explícito da família
        </p>
      </div>

      {/* Redes de Suporte */}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-6">Redes de Suporte</h3>
      <div className="space-y-2">
        <Label>Redes de suporte identificadas</Label>
        <div className="space-y-1.5">
          {REDES_OPTS.map((r) => {
            const checked = local.redes_suporte.includes(r);
            const disabled = hExcl && r !== REDES_EXCL;
            return (
              <label key={r} className={`flex items-center gap-2 text-sm ${disabled ? "opacity-50" : ""}`}>
                <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggleRede(r)} />
                <span>{r}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Participação */}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-6">Participação</h3>
      <div className="space-y-2">
        <Label>Frequência de participação</Label>
        <Select
          value={local.frequencia_participacao ?? "__none"}
          onValueChange={(v) => saveField({ frequencia_participacao: v === "__none" ? null : v })}
        >
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">—</SelectItem>
            {FREQ_OPTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Notas relacionais */}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-6">Notas relacionais</h3>
      <div className="space-y-1">
        <Label>Notas relacionais</Label>
        <Textarea
          rows={4}
          value={local.notas_relacionais ?? ""}
          onChange={(e) => setLocal({ ...local, notas_relacionais: e.target.value })}
          onBlur={() => saveField({ notas_relacionais: local.notas_relacionais?.trim() || null })}
          placeholder="Observações sobre dinâmicas relacionais, contexto de integração, notas de acompanhamento..."
        />
        <p className="text-xs text-muted-foreground italic mt-1">
          Contexto qualitativo para uso interno da mediadora — não partilhado externamente
        </p>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={saveAll}>Guardar contexto</Button>
      </div>
    </div>
  );
}

function CasosFamiliaTab({ familiaId }: { familiaId: string }) {
  const { data: casos = [], isLoading } = useQuery({
    queryKey: ["familia-casos", familiaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("casos_apoio")
        .select("id, numero, titulo, area, estado, prioridade, data_abertura, pessoa:pessoas!casos_apoio_pessoa_id_fkey(nome_completo), mediadora:pessoas!casos_apoio_mediadora_id_fkey(nome_completo)")
        .eq("familia_id", familiaId)
        .order("data_abertura", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">A carregar…</div>;
  if (casos.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center space-y-2">
        <FolderOpen className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <p className="text-sm text-muted-foreground">Sem casos de apoio para esta família.</p>
      </div>
    );
  }
  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Área</TableHead>
            <TableHead>Pessoa</TableHead>
            <TableHead>Mediadora</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Abertura</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {casos.map((c) => (
            <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => window.open(`/casos/${c.id}`, "_self")}>
              <TableCell className="font-mono text-xs">
                <Link to="/casos/$id" params={{ id: c.id }} className="text-primary hover:underline">{c.numero}</Link>
              </TableCell>
              <TableCell className="font-medium">{c.titulo}</TableCell>
              <TableCell><Badge variant="outline">{c.area}</Badge></TableCell>
              <TableCell>{c.pessoa?.nome_completo ?? <Badge variant="outline" className="font-normal">Família</Badge>}</TableCell>
              <TableCell>{c.mediadora?.nome_completo ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell><Badge variant="secondary">{c.estado}</Badge></TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatDateBR(c.data_abertura)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
