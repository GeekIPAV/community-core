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
import { Plus, Pencil, Trash2, Car, ChevronDown, AlertTriangle, Download, FileText, Users, FilePlus2, Send, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { matchCidade, parseViatura, formatEuro, KM_RATE, TRIP_FACTOR, normalizeGrupo, type CidadeBolsa } from "@/lib/bolsa-transporte";
import { downloadCSV } from "@/lib/download-csv";
import { FolhaKmDialog } from "@/components/folha-km-dialog";
import { gerarPdfFolhaKm } from "@/lib/gerar-pdf-folha-km";
import { enviarFolhaKm } from "@/lib/folha-km.functions";


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
  faltantes: Faltante[];
  totalValor: number;
  nPago: number;
  nPorPagar: number;
};

// Pessoa elegível (presente + tipo Membro) que ainda não tem registo de bolsa
type Faltante = {
  inscricao_id: string;
  pessoa_id: string;
  pessoa_nome: string;
  acao_id: string;
  familia_id: string | null;
  familia_nome: string | null;
  valor_calculado: number;
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
  acao_id?: string | null;
  acao_nome?: string | null;
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

function FolhaEstadoBadge({ estado }: { estado: string | null }) {
  if (estado === "enviada") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Enviada</Badge>;
  if (estado === "erro_envio" || estado === "erro") return <Badge variant="destructive">Erro no envio</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Rascunho</Badge>;
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
  onDelete,
  indented = false,
}: {
  i: InscricaoComBolsa;
  onChangeEstado: (i: InscricaoComBolsa, estado: BolsaPagamento["estado"]) => void;
  onUpdate: (i: InscricaoComBolsa, campo: "metodo_pagamento" | "notas", valor: string) => void;
  onMarcarPago: (i: InscricaoComBolsa) => void;
  onDelete: (i: InscricaoComBolsa) => void;
  indented?: boolean;
}) {
  const estado = i.pagamento?.estado ?? "por_pagar";
  const valor = i.pagamento?.valor ?? i.valor_calculado;
  const semCidade = !i.viatura_propria && i.valor_calculado === 0;
  return (
    <TableRow className={semCidade ? "opacity-60" : ""}>
      <TableCell className={`font-medium ${indented ? "pl-8" : ""}`}>{i.pessoa_nome}</TableCell>
      <TableCell className="text-muted-foreground text-xs">{i.familia_nome ?? "—"}</TableCell>
      <TableCell>
        {i.viatura_propria ? (
          <div className="flex items-center gap-1.5">
            <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">
              🚗 {i.viatura_grupo ?? "?"} · {i.viatura_km ?? 0} km
            </Badge>
            {i.isDuplicateGrupo && (
              <AlertTriangle
                className="h-4 w-4 text-amber-600"
                aria-label="Mesmo grupo — pagar apenas ao condutor"
              />
            )}
          </div>
        ) : semCidade ? (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Cidade não reconhecida
          </span>
        ) : (
          <span className="text-sm">{i.cidade_residencia ?? "—"}</span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">{formatEuro(valor)}</TableCell>
      <TableCell>
        <Select value={estado} onValueChange={(v) => onChangeEstado(i, v as BolsaPagamento["estado"])}>
          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
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
      <TableCell>
        {i.pagamento && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); if (confirm("Remover esta bolsa?")) onDelete(i); }}
            title="Remover bolsa"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

type FamiliaSubgrupo = {
  key: string;
  nome: string;
  isFamilia: boolean;
  inscricoes: InscricaoComBolsa[];
};

function subgruposPorFamilia(inscricoes: InscricaoComBolsa[]): FamiliaSubgrupo[] {
  const map = new Map<string, FamiliaSubgrupo>();
  for (const i of inscricoes) {
    const key = i.familia_id ?? `__solo_${i.pessoa_id}`;
    const nome = i.familia_id ? (i.familia_nome ?? "—") : i.pessoa_nome;
    if (!map.has(key)) {
      map.set(key, { key, nome, isFamilia: !!i.familia_id, inscricoes: [] });
    }
    map.get(key)!.inscricoes.push(i);
  }
  return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

function FamiliaHeaderRow({
  group,
  colSpan,
  onBulkMarcarPagos,
}: {
  group: FamiliaSubgrupo;
  colSpan: number;
  onBulkMarcarPagos: (members: InscricaoComBolsa[]) => void;
}) {
  const membros = group.inscricoes;
  const activos = membros.filter((i) => (i.pagamento?.estado ?? "por_pagar") !== "cancelado");
  const total = activos.reduce((s, i) => s + (i.pagamento?.valor ?? i.valor_calculado), 0);
  const nPorPagar = activos.filter((i) => (i.pagamento?.estado ?? "por_pagar") === "por_pagar").length;

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30 border-t-2">
      <TableCell colSpan={colSpan} className="py-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">👪 {group.nome}</span>
          <span className="text-xs text-muted-foreground">{membros.length} pessoas</span>
          {nPorPagar > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">{nPorPagar} por pagar</Badge>
          )}
          <span className="ml-auto text-sm font-semibold tabular-nums">{formatEuro(total)}</span>
          {nPorPagar > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onBulkMarcarPagos(activos)}>
              ✓ Marcar todos pagos
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function FamiliaSubgrupoBlock({
  group,
  colSpan,
  onBulkMarcarPagos,
  onChangeEstado,
  onUpdate,
  onMarcarPago,
  onDelete,
}: {
  group: FamiliaSubgrupo;
  colSpan: number;
  onBulkMarcarPagos: (members: InscricaoComBolsa[]) => void;
  onChangeEstado: (i: InscricaoComBolsa, estado: BolsaPagamento["estado"]) => void;
  onUpdate: (i: InscricaoComBolsa, campo: "metodo_pagamento" | "notas", valor: string) => void;
  onMarcarPago: (i: InscricaoComBolsa) => void;
  onDelete: (i: InscricaoComBolsa) => void;
}) {
  const showHeader = group.isFamilia && group.inscricoes.length > 1;
  return (
    <>
      {showHeader && (
        <FamiliaHeaderRow
          group={group}
          colSpan={colSpan}
          onBulkMarcarPagos={onBulkMarcarPagos}
        />
      )}
      {group.inscricoes.map((i) => (
        <InscricaoRow
          key={i.inscricao_id}
          i={i}
          onChangeEstado={onChangeEstado}
          onUpdate={onUpdate}
          onMarcarPago={onMarcarPago}
          onDelete={onDelete}
          indented={showHeader}
        />
      ))}
    </>
  );
}


function BolsasTransportePage() {
  const qc = useQueryClient();

  // ================= TAB 1+2 DATA =================
  const { data: rawData, isLoading: loadingPagamentos } = useQuery({
    queryKey: ["bolsas-pagamentos-full"],
    staleTime: 0,
    queryFn: async () => {
      const { data: acoes, error: acoesErr } = await supabase
        .from("acoes")
        .select("id, nome, data_inicio, local")
        .eq("bolsa_transporte", true)
        .order("data_inicio", { ascending: false, nullsFirst: false });
      if (acoesErr) throw acoesErr;
      if (!acoes?.length) return { acoes: [], inscricoes: [], pessoas: [], familias: [], tiposUser: [] as { id: string; nome: string }[], cidades: [] as CidadeBolsa[], pagamentos: [] as BolsaPagamento[] };

      const acaoIds = acoes.map((a) => a.id);
      const { data: inscricoes, error: iErr } = await supabase
        .from("inscricoes")
        .select("id, acao_id, pessoa_id, status, valores_dinamicos")
        .in("acao_id", acaoIds)
        .neq("status", "cancelada");
      if (iErr) throw iErr;

      const pessoaIds = [...new Set((inscricoes ?? []).map((i) => i.pessoa_id))];
      const pessoasRes = pessoaIds.length
        ? await supabase.from("pessoas").select("id, nome_completo, familia_id, cidade_residencia, tipo_user_id").in("id", pessoaIds)
        : { data: [], error: null };
      if (pessoasRes.error) throw pessoasRes.error;
      const pessoas = pessoasRes.data ?? [];

      const { data: tiposUser, error: tuErr } = await supabase.from("tipos_user").select("id, nome");
      if (tuErr) throw tuErr;

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
        tiposUser: tiposUser ?? [],
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
    const tipoNomeById = new Map((rawData.tiposUser ?? []).map((t) => [t.id, (t.nome ?? "").toLowerCase()]));
    const calcValor = (pessoa: { cidade_residencia: string | null }, v: ReturnType<typeof parseViatura>) => {
      if (v.viatura_propria) {
        const km = typeof v.viatura_km === "number" ? v.viatura_km : 0;
        return Math.round(km * KM_RATE * TRIP_FACTOR * 100) / 100;
      }
      const cidade = matchCidade(pessoa.cidade_residencia, rawData.cidades);
      return cidade ? Math.round(cidade.valor_sentido * TRIP_FACTOR * 100) / 100 : 0;
    };

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
    const faltantesPorAcao = new Map<string, Faltante[]>();
    for (const i of rawData.inscricoes) {
      const pessoa = pessoaMap.get(i.pessoa_id);
      if (!pessoa) continue;
      const acao = acaoMap.get(i.acao_id);
      if (!acao) continue;
      const familia = pessoa.familia_id ? familiaMap.get(pessoa.familia_id) ?? null : null;
      const v = parseViatura(i.valores_dinamicos);
      const grupoNorm = v.viatura_grupo ? normalizeGrupo(v.viatura_grupo) : "";
      const isDup = !!(v.viatura_propria && grupoNorm && (grupoPorAcao.get(i.acao_id)?.get(grupoNorm) ?? 0) > 1);
      const pagamento = pagamentoMap.get(i.id) ?? null;
      const valorCalc = calcValor(pessoa, v);

      if (!pagamento) {
        // Elegível mas sem registo de bolsa: presente + tipo Membro
        const tipoNome = pessoa.tipo_user_id ? tipoNomeById.get(pessoa.tipo_user_id) ?? "" : "";
        if (i.status === "presente" && tipoNome === "membro") {
          const lista = faltantesPorAcao.get(i.acao_id) ?? [];
          lista.push({
            inscricao_id: i.id,
            pessoa_id: pessoa.id,
            pessoa_nome: pessoa.nome_completo,
            acao_id: i.acao_id,
            familia_id: familia?.id ?? null,
            familia_nome: familia?.nome ?? null,
            valor_calculado: valorCalc,
          });
          faltantesPorAcao.set(i.acao_id, lista);
        }
        continue;
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
        pagamento,
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
        faltantes: faltantesPorAcao.get(a.id) ?? [],
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
    const acoesGrupos = Array.from(gruposMap.values()).filter((g) => g.inscricoes.length > 0 || g.faltantes.length > 0);

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

  const deleteBolsa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("bolsas_pagamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bolsa removida");
      qc.removeQueries({ queryKey: ["bolsas-pagamentos-full"] });
      qc.refetchQueries({ queryKey: ["bolsas-pagamentos-full"] });
      qc.invalidateQueries({ queryKey: ["bolsas-acao"] });
      qc.invalidateQueries({ queryKey: ["bolsa-ativas"] });
      qc.invalidateQueries({ queryKey: ["familia-bolsas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criarFaltantes = useMutation({
    mutationFn: async (faltantes: Faltante[]) => {
      if (!faltantes.length) return 0;
      const { error } = await supabase.from("bolsas_pagamentos").insert(
        faltantes.map((f) => ({
          inscricao_id: f.inscricao_id,
          pessoa_id: f.pessoa_id,
          acao_id: f.acao_id,
          valor: f.valor_calculado,
          estado: "por_pagar",
        })),
      );
      if (error) throw error;
      return faltantes.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} bolsa(s) adicionada(s)`);
      qc.refetchQueries({ queryKey: ["bolsas-pagamentos-full"] });
      qc.invalidateQueries({ queryKey: ["bolsas-acao"] });
      qc.invalidateQueries({ queryKey: ["bolsa-ativas"] });
      qc.invalidateQueries({ queryKey: ["familia-bolsas"] });
    },
    onError: (e: Error) => toast.error(e.message),
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

  const bulkEstadoFamilia = (members: InscricaoComBolsa[], estado: BolsaPagamento["estado"]) => {
    for (const i of members) {
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
    }
  };

  const bulkCampoFamilia = (
    members: InscricaoComBolsa[],
    campo: "metodo_pagamento" | "notas",
    valor: string,
  ) => {
    for (const i of members) {
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
    }
  };

  const bulkMarcarPagosFamilia = (members: InscricaoComBolsa[]) => {
    for (const i of members) {
      if ((i.pagamento?.estado ?? "por_pagar") !== "por_pagar") continue;
      marcarPago(i);
    }
  };

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
        const faltantes = g.faltantes.filter((f) => {
          if (estadoFilter !== "todos" && estadoFilter !== "por_pagar") return false;
          if (!s) return true;
          return (
            f.pessoa_nome.toLowerCase().includes(s) ||
            (f.familia_nome ?? "").toLowerCase().includes(s) ||
            g.nome.toLowerCase().includes(s)
          );
        });
        return { ...g, inscricoes, faltantes };
      })
      .filter((g) => g.inscricoes.length > 0 || g.faltantes.length > 0);
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


  // ============ TAB 4: MAPA DE KM ============
  const { data: mapaKmData, isLoading: loadingMapaKm } = useQuery({
    queryKey: ["mapa-km"],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapa_km")
        .select("*, familias(nome), acoes(nome)")
        .order("data", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Array<MapaKmRow & { familias: { nome: string } | null; acoes: { nome: string } | null }>).map((r) => ({
        ...r,
        familia_nome: r.familias?.nome ?? "—",
        acao_nome: r.acoes?.nome ?? null,
      })) as MapaKmRow[];
    },
  });

  const { data: folhasKm } = useQuery({
    queryKey: ["folhas-km"],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folhas_km")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
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
      qc.invalidateQueries({ queryKey: ["familia-mapa-km"] });
      qc.invalidateQueries({ queryKey: ["mapa-km-acao"] });
      qc.invalidateQueries({ queryKey: ["transporte-acao"] });
      qc.invalidateQueries({ queryKey: ["bolsa-km-ativos"] });
      toast.success("Registo adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMapaKm = useMutation({
    mutationFn: async ({ id, ...row }: Partial<Omit<MapaKmRow, "valor" | "familia_nome" | "acao_nome">> & { id: string }) => {
      const safe = { ...row } as Record<string, unknown>;
      delete (safe as { valor?: unknown }).valor;
      delete (safe as { familia_nome?: unknown }).familia_nome;
      delete (safe as { acao_nome?: unknown }).acao_nome;
      const { error } = await supabase
        .from("mapa_km")
        .update({ ...safe, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mapa-km"] });
      qc.invalidateQueries({ queryKey: ["familia-mapa-km"] });
      qc.invalidateQueries({ queryKey: ["mapa-km-acao"] });
      qc.invalidateQueries({ queryKey: ["transporte-acao"] });
      qc.invalidateQueries({ queryKey: ["bolsa-km-ativos"] });
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
      qc.removeQueries({ queryKey: ["mapa-km"] });
      qc.refetchQueries({ queryKey: ["mapa-km"] });
      qc.invalidateQueries({ queryKey: ["familia-mapa-km"] });
      qc.invalidateQueries({ queryKey: ["mapa-km-acao"] });
      qc.invalidateQueries({ queryKey: ["transporte-acao"] });
      qc.invalidateQueries({ queryKey: ["bolsa-km-ativos"] });
      toast.success("Registo eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFolhaKm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("folhas_km").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folhas-km"] });
      toast.success("Folha de KM eliminada");
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
  const [folhaSearch, setFolhaSearch] = useState("");
  const [folhaEstadoFilter, setFolhaEstadoFilter] = useState<"todos" | "rascunho" | "enviada" | "erro_envio">("todos");
  const [addKmOpen, setAddKmOpen] = useState(false);
  const [folhaKmOpen, setFolhaKmOpen] = useState(false);
  const [folhaEdit, setFolhaEdit] = useState<{ folhaId: string; familiaId?: string } | null>(null);
  const [folhaBusyId, setFolhaBusyId] = useState<string | null>(null);

  // Vai buscar a folha completa + assinatura da pessoa e gera o PDF
  const construirPdfFolha = async (id: string) => {
    const { data: f, error } = await supabase.from("folhas_km").select("*").eq("id", id).maybeSingle();
    if (error || !f) throw new Error("Não foi possível carregar a folha.");
    let assinatura: string | null = null;
    if (f.pessoa_id) {
      const { data: p } = await supabase.from("pessoas").select("assinatura").eq("id", f.pessoa_id).maybeSingle();
      assinatura = p?.assinatura ?? null;
    }
    const linhas = (Array.isArray(f.linhas) ? (f.linhas as unknown as Array<Record<string, unknown>>) : []).map((l) => ({
      data: String(l.data ?? ""),
      descricao: String(l.descricao ?? ""),
      percurso: String(l.percurso ?? ""),
      km: Number(l.km ?? 0),
      valor: Number(l.valor ?? 0),
    }));
    const pdf = await gerarPdfFolhaKm({
      dados: {
        nome: f.nome ?? "",
        morada: f.morada ?? "",
        nif: f.nif ?? "",
        iban: f.iban ?? "",
        matricula: f.matricula ?? "",
        email: f.email ?? "",
      },
      linhas,
      totalKm: Number(f.total_km ?? 0),
      totalValor: Number(f.total_valor ?? 0),
      valorKm: Number(f.valor_km ?? KM_RATE),
      assinatura,
      periodo: f.periodo ?? null,
    });
    return { folha: f, ...pdf };
  };

  const descarregarFolha = async (id: string) => {
    setFolhaBusyId(id);
    try {
      const { doc, filename } = await construirPdfFolha(id);
      doc.save(filename);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar o PDF.");
    } finally {
      setFolhaBusyId(null);
    }
  };

  const reenviarFolha = async (id: string) => {
    setFolhaBusyId(id);
    try {
      const { folha, base64, filename } = await construirPdfFolha(id);
      await enviarFolhaKm({
        data: {
          folhaId: id,
          nome: folha.nome ?? "",
          emailPessoa: folha.email ?? null,
          periodo: folha.periodo ?? null,
          totalKm: Number(folha.total_km ?? 0),
          totalValor: Number(folha.total_valor ?? 0),
          ficheiroNome: filename,
          ficheiroBase64: base64,
        },
      });
      toast.success("Folha reenviada por email.");
      qc.invalidateQueries({ queryKey: ["folhas-km"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reenviar a folha.");
    } finally {
      setFolhaBusyId(null);
    }
  };

  // Cria uma folha rascunho a partir de uma linha de mapa_km e abre o diálogo de edição
  const criarFolhaDeMapaKm = async (r: MapaKmRow) => {
    setFolhaBusyId(r.id);
    try {
      const km = Number(r.km) || 0;
      const valor = Math.round(km * KM_RATE * 100) / 100;
      const { data, error } = await supabase
        .from("folhas_km")
        .insert({
          pessoa_id: null,
          nome: `Família ${r.familia_nome ?? ""}`.trim(),
          matricula: r.matricula,
          valor_km: KM_RATE,
          linhas: [{ data: r.data, descricao: r.motivo, percurso: "", km, valor }],
          total_km: km,
          total_valor: valor,
        })
        .select("id")
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["folhas-km"] });
      setFolhaEdit({ folhaId: data.id, familiaId: r.familia_id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar a folha.");
    } finally {
      setFolhaBusyId(null);
    }
  };

  const [editKmRow, setEditKmRow] = useState<MapaKmRow | null>(null);
  const [deleteKmId, setDeleteKmId] = useState<string | null>(null);
  const [deleteFolhaId, setDeleteFolhaId] = useState<string | null>(null);
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

  const folhaEstadoNormalizado = (estado: string | null | undefined): "rascunho" | "enviada" | "erro_envio" =>
    estado === "enviada" ? "enviada" : estado === "erro_envio" || estado === "erro" ? "erro_envio" : "rascunho";

  const folhasFiltered = useMemo(() => {
    const rows = folhasKm ?? [];
    const s = folhaSearch.trim().toLowerCase();
    return rows.filter((f) => {
      if (folhaEstadoFilter !== "todos" && folhaEstadoNormalizado(f.estado) !== folhaEstadoFilter) return false;
      if (s && !f.nome.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [folhasKm, folhaSearch, folhaEstadoFilter]);

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

  // Resumo das bolsas atribuídas (para a 3.ª tabela do separador Mapa de KM)
  const [bolsaResumoSearch, setBolsaResumoSearch] = useState("");
  const [bolsaResumoEstado, setBolsaResumoEstado] = useState<"todos" | BolsaPagamento["estado"]>("todos");
  const bolsasResumo = useMemo(() => {
    const todas = acoesGrupos.flatMap((g) => g.inscricoes).filter((i) => !!i.pagamento);
    const s = bolsaResumoSearch.trim().toLowerCase();
    return todas.filter((i) => {
      if (bolsaResumoEstado !== "todos" && (i.pagamento?.estado ?? "por_pagar") !== bolsaResumoEstado) return false;
      if (
        s &&
        !i.pessoa_nome.toLowerCase().includes(s) &&
        !(i.familia_nome ?? "").toLowerCase().includes(s) &&
        !i.acao_nome.toLowerCase().includes(s)
      )
        return false;
      return true;
    });
  }, [acoesGrupos, bolsaResumoSearch, bolsaResumoEstado]);

  // Abre o diálogo de novo registo de KM já pré-preenchido a partir de uma bolsa
  const criarMapaKmDeBolsa = (i: InscricaoComBolsa) => {
    if (!i.familia_id) {
      toast.error("Esta pessoa não tem família associada.");
      return;
    }
    setEditKmRow(null);
    setKmForm({
      ...emptyKmForm,
      familia_id: i.familia_id,
      data: i.acao_data ? i.acao_data.slice(0, 10) : emptyKmForm.data,
      motivo: i.acao_nome,
      km: i.viatura_km ? String(i.viatura_km) : "",
    });
    setAddKmOpen(true);
  };

  const kmPorFamilia = useMemo(() => {
    const map = new Map<string, MapaKmRow[]>();
    for (const r of mapaKmData ?? []) {
      const arr = map.get(r.familia_id) ?? [];
      arr.push(r);
      map.set(r.familia_id, arr);
    }
    return map;
  }, [mapaKmData]);

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
        <PagamentosTab
          loading={loadingPagamentos}
          acoesFiltradas={acoesFiltradas}
          kpis={kpis}
          kmKpis={kmKpis}
          kmPorFamilia={kmPorFamilia}
          search={search}
          setSearch={setSearch}
          estadoFilter={estadoFilter}
          setEstadoFilter={setEstadoFilter}
          criarFaltantesPending={criarFaltantes.isPending}
          onCriarFaltantes={(f) => criarFaltantes.mutate(f)}
          onChangeEstado={changeEstado}
          onUpdateCampo={updateCampo}
          onMarcarPago={marcarPago}
          onDeleteBolsa={(i) => deleteBolsa.mutate(i.pagamento!.id)}
          onBulkMarcarPagosFamilia={bulkMarcarPagosFamilia}
        />
      </TabsContent>

      {/* ============= TAB 2: POR FAMÍLIA ============= */}
      <TabsContent value="familias" className="space-y-4">
        <FamiliasTab
          loading={loadingPagamentos}
          familiasFiltradas={familiasFiltradas}
          familiaSearch={familiaSearch}
          setFamiliaSearch={setFamiliaSearch}
          kmPorFamilia={kmPorFamilia}
        />
      </TabsContent>

      {/* ============= TAB 3: CIDADES (unchanged) ============= */}
      {/* ============= TAB MAPA DE KM ============= */}
      <TabsContent value="mapa-km" className="space-y-4">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardDescription>Por pagar</CardDescription></CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-amber-700">{kmKpis.porPagarN}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{formatEuro(kmKpis.porPagarV)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Pago</CardDescription></CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-emerald-700">{kmKpis.pagoN}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{formatEuro(kmKpis.pagoV)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Total KM</CardDescription></CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{kmKpis.totalKm.toLocaleString("pt-PT")} km</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Total geral</CardDescription></CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{formatEuro(kmKpis.totalV)}</p>
            </CardContent>
          </Card>
        </div>


        <TooltipProvider delayDuration={200}>
        <div className="flex flex-col gap-6">
        {(folhasKm ?? []).length > 0 && (
          <Card className="border-sky-200 dark:border-sky-900">
            <CardHeader className="border-b bg-sky-50/60 dark:bg-sky-950/30 py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-sky-600" />
                Registo de Folhas de Quilómetros
                <Badge variant="secondary" className="ml-1">{(folhasKm ?? []).length}</Badge>
              </CardTitle>
              <CardDescription>Folhas individuais submetidas por cada pessoa.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row gap-2 px-4 py-3 border-b">
                <Input
                  placeholder="Pesquisar pessoa…"
                  value={folhaSearch}
                  onChange={(e) => setFolhaSearch(e.target.value)}
                  className="md:max-w-xs"
                />
                <Select value={folhaEstadoFilter} onValueChange={(v) => setFolhaEstadoFilter(v as typeof folhaEstadoFilter)}>
                  <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os estados</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="enviada">Enviada</SelectItem>
                    <SelectItem value="erro_envio">Erro no envio</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  onClick={() => {
                    const headers = ["Pessoa", "Período", "Criada em", "KM", "Valor", "Estado de envio"];
                    const rowsCsv = folhasFiltered.map((f) => ({
                      "Pessoa": f.nome ?? "",
                      "Período": f.periodo ?? "",
                      "Criada em": f.created_at ? new Date(f.created_at).toLocaleDateString("pt-PT") : "",
                      "KM": String(f.total_km ?? 0),
                      "Valor": Number(f.total_valor ?? 0).toFixed(2).replace(".", ","),
                      "Estado de envio": f.estado === "enviada" ? "Enviada" : f.estado === "erro_envio" ? "Erro no envio" : "Rascunho",
                    }));
                    downloadCSV(`folhas-km-${new Date().toISOString().slice(0, 10)}.csv`, rowsCsv, headers);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" /> Exportar
                </Button>
                <Button onClick={() => setFolhaKmOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Novo registo
                </Button>
              </div>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead className="text-right">KM</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Estado de envio</TableHead>
                    <TableHead className="w-28 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folhasFiltered.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium whitespace-nowrap">{f.nome}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.periodo ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(f.created_at)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(f.total_km).toLocaleString("pt-PT")}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatEuro(Number(f.total_valor))}</TableCell>
                    <TableCell><FolhaEstadoBadge estado={f.estado} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setFolhaEdit({ folhaId: f.id })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar folha</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={folhaBusyId === f.id} onClick={() => descarregarFolha(f.id)}>
                              {folhaBusyId === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Descarregar PDF</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={folhaBusyId === f.id} onClick={() => reenviarFolha(f.id)}>
                              {folhaBusyId === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reenviar PDF por email</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={folhaBusyId === f.id} onClick={() => setDeleteFolhaId(f.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Eliminar folha</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {loadingMapaKm ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : kmFiltered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem registos.</p>
        ) : (
          <Card className="border-orange-200 dark:border-orange-900">
            <CardHeader className="border-b bg-orange-50/60 dark:bg-orange-950/30 py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-orange-600" />
                Despesas de Quilómetros das Famílias
                <Badge variant="secondary" className="ml-1">{kmFiltered.length}</Badge>
              </CardTitle>
              <CardDescription>Deslocações das famílias reembolsadas a 0,36€/km (ida e volta).</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row gap-2 px-4 py-3 border-b">
                <Input
                  placeholder="Pesquisar família ou motivo…"
                  value={kmSearch}
                  onChange={(e) => setKmSearch(e.target.value)}
                  className="md:max-w-xs"
                />
                <Select value={kmFamiliaFilter} onValueChange={setKmFamiliaFilter}>
                  <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as famílias</SelectItem>
                    {(familiasList ?? []).map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={kmEstadoFilter} onValueChange={(v) => setKmEstadoFilter(v as typeof kmEstadoFilter)}>
                  <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os estados</SelectItem>
                    <SelectItem value="por_pagar">Por pagar</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  onClick={() => {
                    const headers = ["Família", "Ação", "Data", "Motivo", "KM", "Matrícula", "Carros", "Valor", "Estado", "Método", "Notas"];
                    const rowsCsv = kmFiltered.map((r) => ({
                      "Família": r.familia_nome ?? "",
                      "Ação": r.acao_nome ?? "",
                      "Data": r.data ? new Date(r.data).toLocaleDateString("pt-PT") : "",
                      "Motivo": r.motivo,
                      "KM": String(r.km),
                      "Matrícula": r.matricula ?? "",
                      "Carros": String(r.n_carros),
                      "Valor": r.valor.toFixed(2).replace(".", ","),
                      "Estado": r.estado === "pago" ? "Pago" : r.estado === "cancelado" ? "Cancelado" : "Por pagar",
                      "Método": r.metodo_pagamento ?? "",
                      "Notas": r.notas ?? "",
                    }));
                    downloadCSV(`mapa-km-${new Date().toISOString().slice(0, 10)}.csv`, rowsCsv, headers);
                  }}
                >
                  <Download className="mr-2 h-4 w-4" /> Exportar
                </Button>
                <Button variant="outline" onClick={() => { setEditKmRow(null); setKmForm(emptyKmForm); setAddKmOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" /> Registo por família
                </Button>
              </div>
              <div className="overflow-x-auto">

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Família</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">KM</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead className="text-right">Carros</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Estado de pagamento</TableHead>
                  <TableHead>Método de pagamento</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kmFiltered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium whitespace-nowrap">{r.familia_nome}</TableCell>
                    <TableCell className="max-w-[180px]">
                      {r.acao_nome ? (
                        <span className="inline-flex max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-xs" title={r.acao_nome}>
                          {r.acao_nome}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Avulso</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{formatDate(r.data)}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={r.motivo}>{r.motivo}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.km}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.matricula ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.n_carros}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatEuro(Number(r.valor))}</TableCell>
                    <TableCell>
                      <Select
                        value={r.estado}
                        onValueChange={(v) => updateMapaKm.mutate({ id: r.id, estado: v as MapaKmRow["estado"] })}
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
                      <InlineEditCell
                        value={r.metodo_pagamento}
                        placeholder="Método"
                        onSave={(v) => updateMapaKm.mutate({ id: r.id, metodo_pagamento: v || null })}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={r.notas}
                        placeholder="Notas"
                        onSave={(v) => updateMapaKm.mutate({ id: r.id, notas: v || null })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditKmRow(r);
                                setKmForm({
                                  familia_id: r.familia_id,
                                  data: r.data,
                                  motivo: r.motivo,
                                  km: String(r.km),
                                  matricula: r.matricula ?? "",
                                  n_carros: String(r.n_carros),
                                  estado: r.estado,
                                  metodo_pagamento: r.metodo_pagamento ?? "",
                                  notas: r.notas ?? "",
                                });
                                setAddKmOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar despesa</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={folhaBusyId === r.id}
                              onClick={() => criarFolhaDeMapaKm(r)}
                            >
                              {folhaBusyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Criar folha de KM para esta família</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteKmId(r.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Eliminar despesa</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td colSpan={3} className="px-4 py-2 text-xs font-medium">Total filtrado</td>
                  <td className="px-4 py-2 text-right text-xs tabular-nums">{kmFiltered.reduce((s, r) => s + Number(r.km), 0).toLocaleString("pt-PT")} km</td>
                  <td colSpan={2}></td>
                  <td className="px-4 py-2 text-right text-xs font-semibold tabular-nums">{formatEuro(kmFiltered.reduce((s, r) => s + Number(r.valor), 0))}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-emerald-200 dark:border-emerald-900">
          <CardHeader className="border-b bg-emerald-50/60 dark:bg-emerald-950/30 py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Car className="h-4 w-4 text-emerald-600" />
              Bolsas de Transporte
              <Badge variant="secondary" className="ml-1">{bolsasResumo.length}</Badge>
            </CardTitle>
            <CardDescription>Resumo das bolsas atribuídas e o respetivo estado de pagamento.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row gap-2 px-4 py-3 border-b">
              <Input
                placeholder="Pesquisar pessoa, família ou evento…"
                value={bolsaResumoSearch}
                onChange={(e) => setBolsaResumoSearch(e.target.value)}
                className="md:max-w-xs"
              />
              <Select value={bolsaResumoEstado} onValueChange={(v) => setBolsaResumoEstado(v as typeof bolsaResumoEstado)}>
                <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os estados</SelectItem>
                  <SelectItem value="por_pagar">Por pagar</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button
                variant="outline"
                onClick={() => {
                  const headers = ["Pessoa", "Família", "Evento", "Data", "Valor", "Estado de pagamento", "Método de pagamento"];
                  const rowsCsv = bolsasResumo.map((i) => ({
                    "Pessoa": i.pessoa_nome,
                    "Família": i.familia_nome ?? "",
                    "Evento": i.acao_nome,
                    "Data": formatDate(i.acao_data),
                    "Valor": Number(i.pagamento?.valor ?? i.valor_calculado).toFixed(2).replace(".", ","),
                    "Estado de pagamento": i.pagamento?.estado ?? "por_pagar",
                    "Método de pagamento": i.pagamento?.metodo_pagamento ?? "",
                  }));
                  downloadCSV(`bolsas-${new Date().toISOString().slice(0, 10)}.csv`, rowsCsv, headers);
                }}
              >
                <Download className="mr-2 h-4 w-4" /> Exportar
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Família</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Estado de pagamento</TableHead>
                    <TableHead>Método de pagamento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bolsasResumo.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                        Sem bolsas registadas.
                      </TableCell>
                    </TableRow>
                  )}
                  {bolsasResumo.map((i) => (
                    <TableRow key={i.inscricao_id}>
                      <TableCell className="font-medium whitespace-nowrap">{i.pessoa_nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{i.familia_nome ?? "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={i.acao_nome}>{i.acao_nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(i.acao_data)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatEuro(Number(i.pagamento?.valor ?? i.valor_calculado))}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={i.pagamento?.estado ?? "por_pagar"}
                          onValueChange={(v) => changeEstado(i, v as BolsaPagamento["estado"])}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="por_pagar">Por pagar</SelectItem>
                            <SelectItem value="pago">Pago</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <InlineEditCell
                          value={i.pagamento?.metodo_pagamento ?? null}
                          onSave={(v) => updateCampo(i, "metodo_pagamento", v)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => criarMapaKmDeBolsa(i)}
                              >
                                <FilePlus2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Criar mapa de KM a partir desta bolsa</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => { if (i.pagamento) deleteBolsa.mutate(i.pagamento.id); }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Eliminar bolsa</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td colSpan={4} className="px-4 py-2 text-xs font-medium">Total filtrado</td>
                    <td className="px-4 py-2 text-right text-xs font-semibold tabular-nums">
                      {formatEuro(bolsasResumo.reduce((s, i) => s + Number(i.pagamento?.valor ?? i.valor_calculado), 0))}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          </CardContent>
        </Card>
        </div>
        </TooltipProvider>

        <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <Car className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>Cada carro é reembolsado a <strong className="text-foreground">0,36€/km × 2</strong> (ida e volta). O valor é calculado automaticamente: km × 0,36 × 2 × nº de carros.</span>
        </div>

        <FolhaKmDialog open={folhaKmOpen} onOpenChange={setFolhaKmOpen} />
        <FolhaKmDialog
          key={folhaEdit?.folhaId ?? "none"}
          open={!!folhaEdit}
          onOpenChange={(o) => { if (!o) setFolhaEdit(null); }}
          folhaId={folhaEdit?.folhaId}
          familiaId={folhaEdit?.familiaId}
        />


        <Dialog open={addKmOpen} onOpenChange={(o) => { if (!o) { setAddKmOpen(false); setEditKmRow(null); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editKmRow ? "Editar registo" : "Novo registo de KM"}</DialogTitle>
              <DialogDescription>Valor calculado automaticamente: km × 0,36€ × 2 × nº de carros.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Família</Label>
                <Select
                  value={kmForm.familia_id || "__none"}
                  onValueChange={(v) => setKmForm({ ...kmForm, familia_id: v === "__none" ? "" : v })}
                  disabled={!!editKmRow}
                >
                  <SelectTrigger><SelectValue placeholder="Escolher família…" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="__none">—</SelectItem>
                    {(familiasList ?? []).map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Data</Label>
                  <Input type="date" value={kmForm.data} onChange={(e) => setKmForm({ ...kmForm, data: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Estado</Label>
                  <Select value={kmForm.estado} onValueChange={(v) => setKmForm({ ...kmForm, estado: v as MapaKmRow["estado"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="por_pagar">Por pagar</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Motivo / destino</Label>
                <Input
                  value={kmForm.motivo}
                  onChange={(e) => setKmForm({ ...kmForm, motivo: e.target.value })}
                  placeholder="Ex: Consulta médica no IPO, AIMA Lisboa, SEF…"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>KM (ida)</Label>
                  <Input
                    inputMode="decimal"
                    value={kmForm.km}
                    onChange={(e) => setKmForm({ ...kmForm, km: e.target.value })}
                    placeholder="Ex: 45"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Matrícula</Label>
                  <Input
                    value={kmForm.matricula}
                    onChange={(e) => setKmForm({ ...kmForm, matricula: e.target.value.toUpperCase() })}
                    placeholder="AA-00-AA"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Nº carros</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={kmForm.n_carros}
                    onChange={(e) => setKmForm({ ...kmForm, n_carros: e.target.value })}
                  />
                </div>
              </div>

              {kmForm.km && Number(kmForm.km.replace(",", ".")) > 0 && (
                <div className="rounded-md bg-muted px-3 py-2 text-sm">
                  Valor a pagar:{" "}
                  <strong className="tabular-nums">
                    {formatEuro(
                      Math.round(
                        Number(kmForm.km.replace(",", ".")) * KM_RATE * TRIP_FACTOR * Math.max(1, Number(kmForm.n_carros) || 1) * 100,
                      ) / 100,
                    )}
                  </strong>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({kmForm.km} km × 0,36€ × 2 × {Math.max(1, Number(kmForm.n_carros) || 1)} carro{Math.max(1, Number(kmForm.n_carros) || 1) > 1 ? "s" : ""})
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Método de pagamento</Label>
                  <Input
                    value={kmForm.metodo_pagamento}
                    onChange={(e) => setKmForm({ ...kmForm, metodo_pagamento: e.target.value })}
                    placeholder="MB, MBWay, Transferência…"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Notas</Label>
                  <Input value={kmForm.notas} onChange={(e) => setKmForm({ ...kmForm, notas: e.target.value })} placeholder="Observações…" />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setAddKmOpen(false); setEditKmRow(null); }}>Cancelar</Button>
              <Button
                disabled={
                  !kmForm.familia_id ||
                  !kmForm.motivo.trim() ||
                  !kmForm.km ||
                  Number(kmForm.km.replace(",", ".")) <= 0 ||
                  createMapaKm.isPending ||
                  updateMapaKm.isPending
                }
                onClick={() => {
                  const kmNum = Math.round(Number(kmForm.km.replace(",", ".")) * 100) / 100;
                  const nCarros = Math.max(1, Number(kmForm.n_carros) || 1);
                  const payload = {
                    familia_id: kmForm.familia_id,
                    data: kmForm.data,
                    motivo: kmForm.motivo.trim(),
                    km: kmNum,
                    matricula: kmForm.matricula.trim() || null,
                    n_carros: nCarros,
                    estado: kmForm.estado,
                    metodo_pagamento: kmForm.metodo_pagamento.trim() || null,
                    notas: kmForm.notas.trim() || null,
                  };
                  if (editKmRow) {
                    updateMapaKm.mutate({ id: editKmRow.id, ...payload });
                  } else {
                    createMapaKm.mutate(payload);
                  }
                  setAddKmOpen(false);
                  setEditKmRow(null);
                }}
              >
                {editKmRow ? "Guardar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteKmId} onOpenChange={(o) => { if (!o) setDeleteKmId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar registo?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (deleteKmId) deleteMapaKm.mutate(deleteKmId); }}>
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={!!deleteFolhaId} onOpenChange={(o) => { if (!o) setDeleteFolhaId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar folha de KM?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (deleteFolhaId) deleteFolhaKm.mutate(deleteFolhaId); setDeleteFolhaId(null); }}>
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TabsContent>

      <TabsContent value="cidades" className="space-y-6">
        <CidadesTab />
      </TabsContent>
    </Tabs>
  );
}