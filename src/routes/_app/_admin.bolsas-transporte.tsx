import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Car, ChevronDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { matchCidade, parseViatura, formatEuro, KM_RATE, TRIP_FACTOR, normalizeGrupo, type CidadeBolsa } from "@/lib/bolsa-transporte";

export const Route = createFileRoute("/_app/_admin/bolsas-transporte")({
  component: BolsasTransportePage,
});

type Cidade = CidadeBolsa;

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
};

type InscricaoComBolsa = {
  inscricao_id: string;
  pessoa_id: string;
  pessoa_nome: string;
  familia_id: string | null;
  familia_nome: string | null;
  cidade_residencia: string | null;
  acao_id: string;
  acao_nome: string;
  acao_data: string | null;
  acao_local: string | null;
  viatura_propria: boolean;
  viatura_km: number | null;
  viatura_grupo: string | null;
  isDuplicateGrupo: boolean;
  valor_calculado: number;
  pagamento: BolsaPagamento | null;
};

type AcaoGrupo = {
  id: string;
  nome: string;
  data_inicio: string | null;
  local: string | null;
  inscricoes: InscricaoComBolsa[];
  totalValor: number;
  nPago: number;
  nPorPagar: number;
};

type FamiliaResumo = {
  familia_id: string;
  familia_nome: string;
  totalRecebido: number;
  totalPorReceber: number;
  nPagamentos: number;
  inscricoes: InscricaoComBolsa[];
};

type MapaKmRow = {
  id: string;
  familia_id: string;
  familia_nome?: string;
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

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" });
}

function EstadoBadge({ estado }: { estado: BolsaPagamento["estado"] }) {
  if (estado === "pago") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Pago</Badge>;
  if (estado === "cancelado") return <Badge variant="outline" className="text-muted-foreground">Cancelado</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Por pagar</Badge>;
}

function InlineEditCell({ value, onSave, placeholder = "—" }: { value: string | null; onSave: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (editing) {
    return (
      <Input
        autoFocus
        className="h-7 w-32 text-xs px-2"
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
    <button onClick={() => { setDraft(value ?? ""); setEditing(true); }} className="text-left text-sm hover:underline decoration-dotted text-muted-foreground">
      {value || <span className="italic opacity-50">{placeholder}</span>}
    </button>
  );
}

function InscricaoRow({
  i,
  onChangeEstado,
  onUpdate,
  onMarcarPago,
}: {
  i: InscricaoComBolsa;
  onChangeEstado: (i: InscricaoComBolsa, estado: BolsaPagamento["estado"]) => void;
  onUpdate: (i: InscricaoComBolsa, campo: "metodo_pagamento" | "notas", valor: string) => void;
  onMarcarPago: (i: InscricaoComBolsa) => void;
}) {
  const estado = i.pagamento?.estado ?? "por_pagar";
  const valor = i.pagamento?.valor ?? i.valor_calculado;
  return (
    <TableRow>
      <TableCell className="font-medium">{i.pessoa_nome}</TableCell>
      <TableCell className="text-muted-foreground text-xs">{i.familia_nome ?? "—"}</TableCell>
      <TableCell>
        {i.viatura_propria ? (
          <div className="flex items-center gap-1">
            <Badge className="bg-orange-100 text-orange-800 border-orange-200">
              🚗 {i.viatura_grupo ?? "?"} · {i.viatura_km ?? 0}km
            </Badge>
            {i.isDuplicateGrupo && (
              <AlertTriangle
                className="h-4 w-4 text-amber-600"
                aria-label="Mesmo grupo — pagar apenas ao condutor"
              />
            )}
          </div>
        ) : (
          <span className="text-sm">{i.cidade_residencia ?? "—"}</span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatEuro(valor)}</TableCell>
      <TableCell>
        <Select value={estado} onValueChange={(v) => onChangeEstado(i, v as BolsaPagamento["estado"])}>
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="por_pagar">Por pagar</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <InlineEditCell value={i.pagamento?.metodo_pagamento ?? null} onSave={(v) => onUpdate(i, "metodo_pagamento", v)} placeholder="Método" />
      </TableCell>
      <TableCell>
        <InlineEditCell value={i.pagamento?.notas ?? null} onSave={(v) => onUpdate(i, "notas", v)} placeholder="Notas" />
      </TableCell>
      <TableCell className="text-right">
        {estado === "por_pagar" && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onMarcarPago(i)}>✓ Pago</Button>
        )}
        {estado === "pago" && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onChangeEstado(i, "por_pagar")}>Reverter</Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function BolsasTransportePage() {
  const qc = useQueryClient();

  // ================= TAB 1+2 DATA =================
  const { data: rawData, isLoading: loadingPagamentos } = useQuery({
    queryKey: ["bolsas-pagamentos-full"],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data: acoes, error: acoesErr } = await supabase
        .from("acoes")
        .select("id, nome, data_inicio, local")
        .eq("bolsa_transporte", true)
        .order("data_inicio", { ascending: false, nullsFirst: false });
      if (acoesErr) throw acoesErr;
      if (!acoes?.length) return { acoes: [], inscricoes: [], pessoas: [], familias: [], cidades: [] as CidadeBolsa[], pagamentos: [] as BolsaPagamento[] };

      const acaoIds = acoes.map((a) => a.id);
      const { data: inscricoes, error: iErr } = await supabase
        .from("inscricoes")
        .select("id, acao_id, pessoa_id, status, valores_dinamicos")
        .in("acao_id", acaoIds)
        .neq("status", "cancelada");
      if (iErr) throw iErr;

      const pessoaIds = [...new Set((inscricoes ?? []).map((i) => i.pessoa_id))];
      const pessoasRes = pessoaIds.length
        ? await supabase.from("pessoas").select("id, nome_completo, familia_id, cidade_residencia").in("id", pessoaIds)
        : { data: [], error: null };
      if (pessoasRes.error) throw pessoasRes.error;
      const pessoas = pessoasRes.data ?? [];

      const familiaIds = [...new Set(pessoas.map((p) => p.familia_id).filter(Boolean) as string[])];
      const familiasRes = familiaIds.length
        ? await supabase.from("familias").select("id, nome").in("id", familiaIds)
        : { data: [], error: null };
      if (familiasRes.error) throw familiasRes.error;
      const familias = familiasRes.data ?? [];

      const { data: cidades, error: cErr } = await supabase
        .from("bolsas_cidades")
        .select("id, nome, valor_sentido, ativo")
        .eq("ativo", true);
      if (cErr) throw cErr;

      const inscricaoIds = (inscricoes ?? []).map((i) => i.id);
      const pagRes = inscricaoIds.length
        ? await supabase.from("bolsas_pagamentos").select("*").in("inscricao_id", inscricaoIds)
        : { data: [], error: null };
      if (pagRes.error) throw pagRes.error;

      return {
        acoes: acoes ?? [],
        inscricoes: inscricoes ?? [],
        pessoas,
        familias,
        cidades: (cidades ?? []) as CidadeBolsa[],
        pagamentos: (pagRes.data ?? []) as BolsaPagamento[],
      };
    },
  });

  const { acoesGrupos, familiasResumo } = useMemo(() => {
    if (!rawData) return { acoesGrupos: [] as AcaoGrupo[], familiasResumo: [] as FamiliaResumo[] };
    const pessoaMap = new Map(rawData.pessoas.map((p) => [p.id, p]));
    const familiaMap = new Map(rawData.familias.map((f) => [f.id, f]));
    const pagamentoMap = new Map(rawData.pagamentos.map((p) => [p.inscricao_id, p]));
    const acaoMap = new Map(rawData.acoes.map((a) => [a.id, a]));

    // Group grupos per ação to detect duplicates
    const grupoPorAcao = new Map<string, Map<string, number>>();
    for (const i of rawData.inscricoes) {
      const v = parseViatura(i.valores_dinamicos);
      if (!v.viatura_propria || !v.viatura_grupo) continue;
      const g = normalizeGrupo(v.viatura_grupo);
      if (!g) continue;
      if (!grupoPorAcao.has(i.acao_id)) grupoPorAcao.set(i.acao_id, new Map());
      const m = grupoPorAcao.get(i.acao_id)!;
      m.set(g, (m.get(g) ?? 0) + 1);
    }

    const inscricoesFull: InscricaoComBolsa[] = [];
    for (const i of rawData.inscricoes) {
      const pessoa = pessoaMap.get(i.pessoa_id);
      if (!pessoa) continue;
      const acao = acaoMap.get(i.acao_id);
      if (!acao) continue;
      const familia = pessoa.familia_id ? familiaMap.get(pessoa.familia_id) ?? null : null;
      const v = parseViatura(i.valores_dinamicos);
      const grupoNorm = v.viatura_grupo ? normalizeGrupo(v.viatura_grupo) : "";
      const isDup = !!(v.viatura_propria && grupoNorm && (grupoPorAcao.get(i.acao_id)?.get(grupoNorm) ?? 0) > 1);

      let valorCalc = 0;
      if (v.viatura_propria) {
        const km = typeof v.viatura_km === "number" ? v.viatura_km : 0;
        valorCalc = Math.round(km * KM_RATE * TRIP_FACTOR * 100) / 100;
      } else {
        const cidade = matchCidade(pessoa.cidade_residencia, rawData.cidades);
        if (cidade) valorCalc = Math.round(cidade.valor_sentido * TRIP_FACTOR * 100) / 100;
      }

      inscricoesFull.push({
        inscricao_id: i.id,
        pessoa_id: pessoa.id,
        pessoa_nome: pessoa.nome_completo,
        familia_id: familia?.id ?? null,
        familia_nome: familia?.nome ?? null,
        cidade_residencia: pessoa.cidade_residencia,
        acao_id: acao.id,
        acao_nome: acao.nome,
        acao_data: acao.data_inicio,
        acao_local: acao.local,
        viatura_propria: !!v.viatura_propria,
        viatura_km: typeof v.viatura_km === "number" ? v.viatura_km : null,
        viatura_grupo: v.viatura_grupo ?? null,
        isDuplicateGrupo: isDup,
        valor_calculado: valorCalc,
        pagamento: pagamentoMap.get(i.id) ?? null,
      });
    }

    // Group by ação
    const gruposMap = new Map<string, AcaoGrupo>();
    for (const a of rawData.acoes) {
      gruposMap.set(a.id, {
        id: a.id,
        nome: a.nome,
        data_inicio: a.data_inicio,
        local: a.local,
        inscricoes: [],
        totalValor: 0,
        nPago: 0,
        nPorPagar: 0,
      });
    }
    for (const insc of inscricoesFull) {
      const g = gruposMap.get(insc.acao_id);
      if (!g) continue;
      g.inscricoes.push(insc);
      const estado = insc.pagamento?.estado ?? "por_pagar";
      const valor = insc.pagamento?.valor ?? insc.valor_calculado;
      if (estado === "pago") { g.nPago++; g.totalValor += valor; }
      else if (estado === "por_pagar") { g.nPorPagar++; g.totalValor += valor; }
    }
    const acoesGrupos = Array.from(gruposMap.values()).filter((g) => g.inscricoes.length > 0);

    // Group by família
    const famMap = new Map<string, FamiliaResumo>();
    for (const insc of inscricoesFull) {
      if (!insc.familia_id) continue;
      if (!famMap.has(insc.familia_id)) {
        famMap.set(insc.familia_id, {
          familia_id: insc.familia_id,
          familia_nome: insc.familia_nome ?? "—",
          totalRecebido: 0,
          totalPorReceber: 0,
          nPagamentos: 0,
          inscricoes: [],
        });
      }
      const f = famMap.get(insc.familia_id)!;
      f.inscricoes.push(insc);
      const estado = insc.pagamento?.estado ?? "por_pagar";
      const valor = insc.pagamento?.valor ?? insc.valor_calculado;
      if (estado === "pago") { f.totalRecebido += valor; f.nPagamentos++; }
      else if (estado === "por_pagar") { f.totalPorReceber += valor; }
    }
    const familiasResumo = Array.from(famMap.values()).sort((a, b) => {
      const aPend = a.totalPorReceber > 0 ? 0 : 1;
      const bPend = b.totalPorReceber > 0 ? 0 : 1;
      if (aPend !== bPend) return aPend - bPend;
      return a.familia_nome.localeCompare(b.familia_nome);
    });

    return { acoesGrupos, familiasResumo };
  }, [rawData]);

  const upsertPagamento = useMutation({
    mutationFn: async (p: {
      inscricao_id: string;
      pessoa_id: string;
      acao_id: string;
      valor: number;
      estado: BolsaPagamento["estado"];
      metodo_pagamento?: string | null;
      notas?: string | null;
      data_pagamento?: string | null;
    }) => {
      const { error } = await supabase.from("bolsas_pagamentos").upsert(
        {
          ...p,
          updated_at: new Date().toISOString(),
          data_pagamento:
            p.estado === "pago" && !p.data_pagamento
              ? new Date().toISOString().slice(0, 10)
              : p.data_pagamento ?? null,
        },
        { onConflict: "inscricao_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bolsas-pagamentos-full"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const marcarPago = (i: InscricaoComBolsa) =>
    upsertPagamento.mutate({
      inscricao_id: i.inscricao_id,
      pessoa_id: i.pessoa_id,
      acao_id: i.acao_id,
      valor: i.pagamento?.valor ?? i.valor_calculado,
      estado: "pago",
      metodo_pagamento: i.pagamento?.metodo_pagamento ?? null,
      notas: i.pagamento?.notas ?? null,
    });

  const changeEstado = (i: InscricaoComBolsa, estado: BolsaPagamento["estado"]) =>
    upsertPagamento.mutate({
      inscricao_id: i.inscricao_id,
      pessoa_id: i.pessoa_id,
      acao_id: i.acao_id,
      valor: i.pagamento?.valor ?? i.valor_calculado,
      estado,
      metodo_pagamento: i.pagamento?.metodo_pagamento ?? null,
      notas: i.pagamento?.notas ?? null,
      data_pagamento: i.pagamento?.data_pagamento ?? null,
    });

  const updateCampo = (i: InscricaoComBolsa, campo: "metodo_pagamento" | "notas", valor: string) =>
    upsertPagamento.mutate({
      inscricao_id: i.inscricao_id,
      pessoa_id: i.pessoa_id,
      acao_id: i.acao_id,
      valor: i.pagamento?.valor ?? i.valor_calculado,
      estado: i.pagamento?.estado ?? "por_pagar",
      metodo_pagamento: campo === "metodo_pagamento" ? (valor || null) : i.pagamento?.metodo_pagamento ?? null,
      notas: campo === "notas" ? (valor || null) : i.pagamento?.notas ?? null,
      data_pagamento: i.pagamento?.data_pagamento ?? null,
    });

  // Filters tab 1
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"todos" | BolsaPagamento["estado"]>("todos");
  const acoesFiltradas = useMemo(() => {
    const s = search.trim().toLowerCase();
    return acoesGrupos
      .map((g) => {
        const inscricoes = g.inscricoes.filter((i) => {
          if (estadoFilter !== "todos") {
            const est = i.pagamento?.estado ?? "por_pagar";
            if (est !== estadoFilter) return false;
          }
          if (!s) return true;
          return (
            i.pessoa_nome.toLowerCase().includes(s) ||
            (i.familia_nome ?? "").toLowerCase().includes(s) ||
            g.nome.toLowerCase().includes(s)
          );
        });
        return { ...g, inscricoes };
      })
      .filter((g) => g.inscricoes.length > 0);
  }, [acoesGrupos, search, estadoFilter]);

  const kpis = useMemo(() => {
    let porPagarN = 0, porPagarV = 0, pagoN = 0, pagoV = 0;
    for (const g of acoesGrupos) {
      for (const i of g.inscricoes) {
        const est = i.pagamento?.estado ?? "por_pagar";
        const v = i.pagamento?.valor ?? i.valor_calculado;
        if (est === "por_pagar") { porPagarN++; porPagarV += v; }
        else if (est === "pago") { pagoN++; pagoV += v; }
      }
    }
    return { porPagarN, porPagarV, pagoN, pagoV, nAcoes: acoesGrupos.length, total: porPagarV + pagoV };
  }, [acoesGrupos]);

  // Tab 2 filter
  const [familiaSearch, setFamiliaSearch] = useState("");
  const familiasFiltradas = useMemo(() => {
    const s = familiaSearch.trim().toLowerCase();
    if (!s) return familiasResumo;
    return familiasResumo.filter((f) => f.familia_nome.toLowerCase().includes(s));
  }, [familiasResumo, familiaSearch]);

  // ============ CITIES TAB ============
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<{ nome: string; valor: string; ativo: boolean }>({ nome: "", valor: "", ativo: true });
  const [editing, setEditing] = useState<Cidade | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: cidadesData, isLoading: loadingCidades } = useQuery({
    queryKey: ["bolsas-cidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bolsas_cidades")
        .select("id, nome, valor_sentido, ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Cidade[];
    },
  });

  const invalidateCidades = () => {
    qc.invalidateQueries({ queryKey: ["bolsas-cidades"] });
    qc.invalidateQueries({ queryKey: ["bolsas-pagamentos-full"] });
  };

  const parseValor = (v: string) => {
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) throw new Error("Valor inválido");
    return Math.round(n * 100) / 100;
  };

  const create = useMutation({
    mutationFn: async () => {
      const valor = parseValor(form.valor);
      const nome = form.nome.trim();
      if (!nome) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("bolsas_cidades").insert({ nome, valor_sentido: valor, ativo: form.ativo });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cidade adicionada"); invalidateCidades(); setAddOpen(false); setForm({ nome: "", valor: "", ativo: true }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const nome = editing.nome.trim();
      if (!nome) throw new Error("Nome obrigatório");
      const { error } = await supabase
        .from("bolsas_cidades")
        .update({ nome, valor_sentido: editing.valor_sentido, ativo: editing.ativo })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cidade atualizada"); invalidateCidades(); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!deleteId) return;
      const { error } = await supabase.from("bolsas_cidades").delete().eq("id", deleteId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cidade removida"); invalidateCidades(); setDeleteId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("bolsas_cidades").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateCidades(),
    onError: (e: Error) => toast.error(e.message),
  });

  // ============ TAB 4: MAPA DE KM ============
  const { data: mapaKmData, isLoading: loadingMapaKm } = useQuery({
    queryKey: ["mapa-km"],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapa_km")
        .select("*, familias(nome)")
        .order("data", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Array<MapaKmRow & { familias: { nome: string } | null }>).map((r) => ({
        ...r,
        familia_nome: r.familias?.nome ?? "—",
      })) as MapaKmRow[];
    },
  });

  const { data: familiasList } = useQuery({
    queryKey: ["familias-lista-bolsa"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familias")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const createMapaKm = useMutation({
    mutationFn: async (row: {
      familia_id: string;
      data: string;
      motivo: string;
      km: number;
      matricula: string | null;
      n_carros: number;
      estado: MapaKmRow["estado"];
      metodo_pagamento: string | null;
      notas: string | null;
    }) => {
      const { error } = await supabase.from("mapa_km").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mapa-km"] });
      toast.success("Registo adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMapaKm = useMutation({
    mutationFn: async ({ id, ...row }: Partial<Omit<MapaKmRow, "valor" | "familia_nome">> & { id: string }) => {
      const safe = { ...row } as Partial<Omit<MapaKmRow, "valor" | "familia_nome">>;
      delete (safe as { valor?: unknown }).valor;
      delete (safe as { familia_nome?: unknown }).familia_nome;
      const { error } = await supabase
        .from("mapa_km")
        .update({ ...safe, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mapa-km"] });
      toast.success("Atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMapaKm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mapa_km").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mapa-km"] });
      toast.success("Registo eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const emptyKmForm = {
    familia_id: "",
    data: new Date().toISOString().slice(0, 10),
    motivo: "",
    km: "",
    matricula: "",
    n_carros: "1",
    estado: "por_pagar" as MapaKmRow["estado"],
    metodo_pagamento: "",
    notas: "",
  };
  const [kmSearch, setKmSearch] = useState("");
  const [kmEstadoFilter, setKmEstadoFilter] = useState<"todos" | MapaKmRow["estado"]>("todos");
  const [kmFamiliaFilter, setKmFamiliaFilter] = useState<string>("todas");
  const [addKmOpen, setAddKmOpen] = useState(false);
  const [editKmRow, setEditKmRow] = useState<MapaKmRow | null>(null);
  const [deleteKmId, setDeleteKmId] = useState<string | null>(null);
  const [kmForm, setKmForm] = useState(emptyKmForm);

  const kmKpis = useMemo(() => {
    const rows = mapaKmData ?? [];
    const porPagar = rows.filter((r) => r.estado === "por_pagar");
    const pago = rows.filter((r) => r.estado === "pago");
    return {
      porPagarN: porPagar.length,
      porPagarV: porPagar.reduce((s, r) => s + Number(r.valor), 0),
      pagoN: pago.length,
      pagoV: pago.reduce((s, r) => s + Number(r.valor), 0),
      totalKm: rows.reduce((s, r) => s + Number(r.km), 0),
      totalV: rows.reduce((s, r) => s + Number(r.valor), 0),
    };
  }, [mapaKmData]);

  const kmFiltered = useMemo(() => {
    const rows = mapaKmData ?? [];
    const s = kmSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (kmEstadoFilter !== "todos" && r.estado !== kmEstadoFilter) return false;
      if (kmFamiliaFilter !== "todas" && r.familia_id !== kmFamiliaFilter) return false;
      if (s && !(r.familia_nome ?? "").toLowerCase().includes(s) && !r.motivo.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [mapaKmData, kmSearch, kmEstadoFilter, kmFamiliaFilter]);

  return (
    <Tabs defaultValue="pagamentos" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bolsa de Transporte</h1>
          <p className="text-sm text-muted-foreground">Gestão de pagamentos de bolsa por ação e família.</p>
        </div>
        <TabsList>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          <TabsTrigger value="familias">Por família</TabsTrigger>
          <TabsTrigger value="mapa-km">Mapa de KM</TabsTrigger>
          <TabsTrigger value="cidades">Cidades</TabsTrigger>
        </TabsList>
      </div>

      {/* ============= TAB 1: PAGAMENTOS ============= */}
      <TabsContent value="pagamentos" className="space-y-4">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardDescription>Por pagar</CardDescription></CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-amber-700">{kpis.porPagarN}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{formatEuro(kpis.porPagarV)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Pago</CardDescription></CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-emerald-700">{kpis.pagoN}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{formatEuro(kpis.pagoV)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Ações com bolsa</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{kpis.nAcoes}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Total geral</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-semibold tabular-nums">{formatEuro(kpis.total)}</p></CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-2">
          <Input placeholder="Pesquisar pessoa, família ou ação…" value={search} onChange={(e) => setSearch(e.target.value)} className="md:max-w-md" />
          <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v as typeof estadoFilter)}>
            <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os estados</SelectItem>
              <SelectItem value="por_pagar">Por pagar</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loadingPagamentos ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : acoesFiltradas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem ações com bolsa de transporte.</p>
        ) : (
          <div className="space-y-2">
            {acoesFiltradas.map((acao) => (
              <Collapsible key={acao.id}>
                <CollapsibleTrigger className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-muted/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform [[data-state=open]_&]:rotate-180" />
                    <div className="text-left min-w-0">
                      <p className="font-medium truncate">{acao.nome}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(acao.data_inicio)}{acao.local ? ` · ${acao.local}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {acao.nPorPagar > 0 && <Badge className="bg-amber-100 text-amber-800 border-amber-200">{acao.nPorPagar} por pagar</Badge>}
                    {acao.nPago > 0 && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">{acao.nPago} pagos</Badge>}
                    <span className="text-sm font-medium tabular-nums">{formatEuro(acao.totalValor)}</span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border border-t-0 rounded-b-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pessoa</TableHead>
                          <TableHead>Família</TableHead>
                          <TableHead>Transporte</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Notas</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {acao.inscricoes.map((i) => (
                          <InscricaoRow
                            key={i.inscricao_id}
                            i={i}
                            onChangeEstado={changeEstado}
                            onUpdate={updateCampo}
                            onMarcarPago={marcarPago}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </TabsContent>

      {/* ============= TAB 2: POR FAMÍLIA ============= */}
      <TabsContent value="familias" className="space-y-4">
        <Input placeholder="Pesquisar família…" value={familiaSearch} onChange={(e) => setFamiliaSearch(e.target.value)} className="md:max-w-md" />
        {loadingPagamentos ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : familiasFiltradas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem famílias com bolsa.</p>
        ) : (
          <div className="space-y-2">
            {familiasFiltradas.map((familia) => (
              <Collapsible key={familia.familia_id}>
                <CollapsibleTrigger className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-muted/40">
                  <span className="font-medium">{familia.familia_nome}</span>
                  <div className="flex items-center gap-3">
                    {familia.totalPorReceber > 0 && <span className="text-amber-700 text-sm tabular-nums">{formatEuro(familia.totalPorReceber)} por receber</span>}
                    {familia.totalRecebido > 0 && <span className="text-emerald-700 text-sm tabular-nums">{formatEuro(familia.totalRecebido)} recebido</span>}
                    <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-180" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border border-t-0 rounded-b-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ação</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Pessoa</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Data pagamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {familia.inscricoes.map((i) => (
                          <TableRow key={i.inscricao_id}>
                            <TableCell className="font-medium">{i.acao_nome}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{formatDate(i.acao_data)}</TableCell>
                            <TableCell>{i.pessoa_nome}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEuro(i.pagamento?.valor ?? i.valor_calculado)}</TableCell>
                            <TableCell><EstadoBadge estado={i.pagamento?.estado ?? "por_pagar"} /></TableCell>
                            <TableCell className="text-muted-foreground text-xs">{i.pagamento?.data_pagamento ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <tfoot>
                        <tr className="border-t bg-muted/30">
                          <td colSpan={3} className="px-4 py-2 text-xs font-medium">Total</td>
                          <td className="px-4 py-2 text-right text-xs font-semibold tabular-nums">{formatEuro(familia.totalRecebido + familia.totalPorReceber)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </TabsContent>

      {/* ============= TAB 3: CIDADES (unchanged) ============= */}
      <TabsContent value="cidades" className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Valor por sentido (€) pago a cada participante de uma ação elegível — total = <span className="font-medium">valor × 2 × nº de pessoas</span>.
          </p>
          <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setForm({ nome: "", valor: "", ativo: true }); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova cidade</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova cidade</DialogTitle>
                <DialogDescription>Adiciona uma cidade elegível para bolsa de transporte.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Braga" /></div>
                <div className="space-y-1"><Label>Valor por sentido (€)</Label><Input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="Ex: 3.5" inputMode="decimal" /></div>
                <label className="flex items-center justify-between rounded-md border p-2">
                  <span className="text-sm">Ativa</span>
                  <Switch checked={form.ativo} onCheckedChange={(c) => setForm({ ...form, ativo: c })} />
                </label>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-4 text-sm">
          <Car className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">Viatura própria</p>
            <p className="text-muted-foreground">
              Quem vier na sua viatura própria recebe <span className="font-medium text-foreground">{KM_RATE.toString().replace(".", ",")}€/km × {TRIP_FACTOR}</span> (ida e volta), pago <span className="font-medium text-foreground">uma vez por carro</span> — pessoas com a mesma matrícula contam como um único carro.
            </p>
          </div>
        </div>

        {loadingCidades ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(cidadesData ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem cidades configuradas.</p>}
            {cidadesData?.map((c) => (
              <Card key={c.id} className={c.ativo ? "" : "opacity-60"}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{c.nome}</CardTitle>
                      <CardDescription>
                        {c.valor_sentido.toFixed(2).replace(".", ",")}€ × 2 = <span className="font-semibold">{(c.valor_sentido * 2).toFixed(2).replace(".", ",")}€</span> por pessoa
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <label className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Ativa</span>
                    <Switch checked={c.ativo} onCheckedChange={(v) => toggleAtivo.mutate({ id: c.id, ativo: v })} />
                  </label>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar cidade</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div className="space-y-1"><Label>Nome</Label><Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>Valor por sentido (€)</Label>
                  <Input
                    value={String(editing.valor_sentido).replace(".", ",")}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(",", "."));
                      setEditing({ ...editing, valor_sentido: Number.isFinite(n) ? n : 0 });
                    }}
                    inputMode="decimal"
                  />
                </div>
                <label className="flex items-center justify-between rounded-md border p-2">
                  <span className="text-sm">Ativa</span>
                  <Switch checked={editing.ativo} onCheckedChange={(c) => setEditing({ ...editing, ativo: c })} />
                </label>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => update.mutate()} disabled={update.isPending}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover cidade?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => remove.mutate()}>Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TabsContent>
    </Tabs>
  );
}