import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Filter, PanelRightClose, PanelRightOpen, X, Check, Pencil, Trash2, Wallet, AlertTriangle, CheckCircle2, Users, UserPlus, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { RegistoPagamentoCell } from "@/components/servicos/PaymentLinkCells";

export const Route = createFileRoute("/_app/_admin/servicos/calendario")({
  component: ServicosCalendarioPage,
});

// ============ types ============
type Estado = "pendente" | "aprovado" | "pago";
type Colab = { id: string; nome_completo: string; ativo: boolean };
type Tipo = { id: string; nome: string; unidade: string; preco_unitario: number; ativo: boolean };
type Registo = {
  id: string;
  colaborador_id: string;
  tipo_servico_id: string;
  data_inicio: string;
  data_fim: string | null;
  descricao: string | null;
  quantidade: number;
  preco_unitario_override: number | null;
  outros_custos: number;
  outros_custos_descricao: string | null;
  estado: Estado;
  pagamento_id: string | null;
  sessao_id: string | null;
};
type Pagamento = { id: string; referencia: string | null; data_pagamento: string };
export type Sessao = {
  id: string;
  nome: string;
  tipo_servico_id: string;
  data_inicio: string;
  data_fim: string | null;
  descricao: string | null;
  local: string | null;
  quantidade_por_colaborador: number;
  preco_unitario_override: number | null;
};

// ============ utils ============
const MESES_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const ESTADOS: Estado[] = ["pendente", "aprovado", "pago"];
const COLAB_PALETTE = [
  "hsl(210 70% 55%)", "hsl(170 65% 42%)", "hsl(35 85% 55%)", "hsl(265 60% 60%)",
  "hsl(195 75% 48%)", "hsl(150 55% 45%)", "hsl(290 50% 55%)", "hsl(25 75% 55%)",
  "hsl(220 50% 50%)", "hsl(180 60% 40%)", "hsl(45 80% 50%)", "hsl(245 55% 60%)",
];
const fmtEUR = (n: number) => (Number(n) || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
const colabColor = (id: string) => {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLAB_PALETTE[h % COLAB_PALETTE.length];
};
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
const startOfWeek = (d: Date) => { const x = startOfDay(d); const dow = (x.getDay() + 6) % 7; return addDays(x, -dow); };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtLongDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });

const estadoDot = (e: Estado) =>
  e === "pendente" ? "bg-amber-500" : e === "aprovado" ? "bg-blue-500" : "bg-emerald-500";
const estadoBorder = (e: Estado) =>
  e === "pendente" ? "border-l-amber-400" : e === "aprovado" ? "border-l-blue-400" : "border-l-emerald-400";
const estadoChip = (e: Estado) => {
  if (e === "pendente") return "bg-amber-100 text-amber-700 border-amber-200";
  if (e === "aprovado") return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
};

function calcTotal(r: Registo, tipoMap: Map<string, Tipo>) {
  const tipo = tipoMap.get(r.tipo_servico_id);
  const preco = r.preco_unitario_override != null ? Number(r.preco_unitario_override) : (tipo?.preco_unitario ?? 0);
  const calc = preco * (Number(r.quantidade) || 0);
  return { calc, total: calc + (Number(r.outros_custos) || 0) };
}

// Group day's records into blocks: shared-session records into one block, individual records as themselves.
type DayBlock =
  | { type: "single"; record: Registo }
  | { type: "session"; sessao: Sessao; records: Registo[] };
function groupDayItems(items: Registo[], sessoesMap?: Map<string, Sessao>): DayBlock[] {
  const sessionGroups = new Map<string, Registo[]>();
  const singles: Registo[] = [];
  for (const r of items) {
    if (r.sessao_id) {
      const arr = sessionGroups.get(r.sessao_id) ?? [];
      arr.push(r);
      sessionGroups.set(r.sessao_id, arr);
    } else singles.push(r);
  }
  const blocks: DayBlock[] = [];
  for (const [sid, recs] of sessionGroups.entries()) {
    // The sessoesMap may not be passed (it's optional); we synthesize from records when needed.
    const sessao = sessoesMap?.get(sid) ?? {
      id: sid,
      nome: recs[0].descricao || "Sessão de grupo",
      tipo_servico_id: recs[0].tipo_servico_id,
      data_inicio: recs[0].data_inicio,
      data_fim: recs[0].data_fim,
      descricao: null,
      local: null,
      quantidade_por_colaborador: recs[0].quantidade,
      preco_unitario_override: recs[0].preco_unitario_override,
    } satisfies Sessao;
    blocks.push({ type: "session", sessao, records: recs });
  }
  for (const r of singles) blocks.push({ type: "single", record: r });
  return blocks;
}

// ============ page ============
type Vista = "mes" | "semana" | "gantt";

export function ServicosCalendarioPage({ embedded = false }: { embedded?: boolean } = {}) {
  const isMobile = useIsMobile();
  const today = new Date();
  const [vista, setVista] = useState<Vista>("mes");
  const [cursor, setCursor] = useState<Date>(startOfDay(today));
  const [showSidebar, setShowSidebar] = useState(!isMobile);
  const [filterColabs, setFilterColabs] = useState<string[]>([]);
  const [filterEstados, setFilterEstados] = useState<Estado[]>([]);
  const [filterTipos, setFilterTipos] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [createDateLocked, setCreateDateLocked] = useState(false);

  // Period range based on vista
  const range = useMemo(() => {
    if (vista === "mes") {
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      return { start, end };
    }
    if (vista === "semana") {
      const start = startOfWeek(cursor);
      return { start, end: addDays(start, 7) };
    }
    // gantt: year
    return { start: new Date(cursor.getFullYear(), 0, 1), end: new Date(cursor.getFullYear() + 1, 0, 1) };
  }, [vista, cursor]);

  const periodLabel = useMemo(() => {
    if (vista === "mes") return `${MESES_LONG[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (vista === "semana") {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      return `${s.getDate()} ${MESES_LONG[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MESES_LONG[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`;
    }
    return String(cursor.getFullYear());
  }, [vista, cursor]);

  const navStep = (dir: -1 | 1) => {
    const d = new Date(cursor);
    if (vista === "mes") d.setMonth(d.getMonth() + dir);
    else if (vista === "semana") d.setDate(d.getDate() + dir * 7);
    else d.setFullYear(d.getFullYear() + dir);
    setCursor(d);
  };

  // Data
  const { data: colabs } = useQuery({
    queryKey: ["colabs_cal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores").select("id, nome_completo, ativo").order("nome_completo");
      if (error) throw error;
      return data as Colab[];
    },
  });
  const { data: tipos } = useQuery({
    queryKey: ["tipos_cal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tipos_servico").select("id, nome, unidade, preco_unitario, ativo").order("nome");
      if (error) throw error;
      return data as Tipo[];
    },
  });
  const { data: registos, isLoading } = useQuery({
    queryKey: ["registos_cal", ymd(range.start), ymd(range.end)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registos_servico")
        .select("id, colaborador_id, tipo_servico_id, data_inicio, data_fim, descricao, quantidade, preco_unitario_override, outros_custos, outros_custos_descricao, estado, pagamento_id, sessao_id")
        .gte("data_inicio", ymd(range.start))
        .lt("data_inicio", ymd(range.end))
        .order("data_inicio");
      if (error) throw error;
      return data as Registo[];
    },
  });
  const { data: sessoes } = useQuery({
    queryKey: ["sessoes_cal", ymd(range.start), ymd(range.end)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessoes_servico")
        .select("id, nome, tipo_servico_id, data_inicio, data_fim, descricao, local, quantidade_por_colaborador, preco_unitario_override")
        .gte("data_inicio", ymd(range.start))
        .lt("data_inicio", ymd(range.end));
      if (error) throw error;
      return data as Sessao[];
    },
  });

  const colabMap = useMemo(() => new Map((colabs ?? []).map((c) => [c.id, c])), [colabs]);
  const tipoMap = useMemo(() => new Map((tipos ?? []).map((t) => [t.id, t])), [tipos]);
  const sessaoMap = useMemo(() => new Map((sessoes ?? []).map((s) => [s.id, s])), [sessoes]);

  const filtered = useMemo(() => {
    let rows = registos ?? [];
    if (filterColabs.length) rows = rows.filter((r) => filterColabs.includes(r.colaborador_id));
    if (filterEstados.length) rows = rows.filter((r) => filterEstados.includes(r.estado));
    if (filterTipos.length) rows = rows.filter((r) => filterTipos.includes(r.tipo_servico_id));
    return rows;
  }, [registos, filterColabs, filterEstados, filterTipos]);

  const openCreate = (date?: string) => {
    setCreateDate(date ?? ymd(today));
    setCreateDateLocked(!!date);
    setCreateOpen(true);
  };

  const ganttBlocked = (vista === "gantt" || vista === "semana") && isMobile;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {!embedded && (
          <div>
            <nav className="text-xs text-muted-foreground mb-1">
              <Link to="/servicos" className="hover:underline">Serviços & Pagamentos</Link>
              <span className="mx-1.5">→</span>
              <span>Calendário</span>
            </nav>
            <h1 className="text-2xl font-semibold">Calendário de Serviços</h1>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navStep(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="min-w-44 text-center text-sm font-semibold">{periodLabel}</div>
            <Button variant="outline" size="icon" onClick={() => navStep(1)}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setCursor(startOfDay(new Date()))}>Hoje</Button>
            <div className="ml-2 inline-flex rounded-md border p-0.5">
              <Button size="sm" variant={vista === "mes" ? "default" : "ghost"} onClick={() => setVista("mes")}>Mês</Button>
              <Button size="sm" variant={vista === "semana" ? "default" : "ghost"} onClick={() => setVista("semana")}>Semana</Button>
              <Button size="sm" variant={vista === "gantt" ? "default" : "ghost"} onClick={() => setVista("gantt")}>Gantt</Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelectFilter
              label="Colaboradora"
              icon={<Filter className="h-3.5 w-3.5" />}
              options={(colabs ?? []).filter((c) => c.ativo).map((c) => ({ value: c.id, label: c.nome_completo }))}
              selected={filterColabs}
              onChange={setFilterColabs}
              emptyLabel="Todas"
            />
            <MultiSelectFilter
              label="Estado"
              options={ESTADOS.map((e) => ({ value: e, label: e[0].toUpperCase() + e.slice(1) }))}
              selected={filterEstados as string[]}
              onChange={(v) => setFilterEstados(v as Estado[])}
              emptyLabel="Todos"
              renderOption={(o) => (
                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]", estadoChip(o.value as Estado))}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", estadoDot(o.value as Estado))} />
                  {o.label}
                </span>
              )}
            />
            <MultiSelectFilter
              label="Tipo"
              options={(tipos ?? []).filter((t) => t.ativo).map((t) => ({ value: t.id, label: t.nome }))}
              selected={filterTipos}
              onChange={setFilterTipos}
              emptyLabel="Todos"
            />
            <Button size="sm" onClick={() => openCreate()}><Plus className="mr-1.5 h-4 w-4" />Novo serviço</Button>
            <Button variant="ghost" size="icon" onClick={() => setShowSidebar((s) => !s)} title={showSidebar ? "Ocultar resumo" : "Mostrar resumo"} className="hidden md:inline-flex">
              {showSidebar ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Main */}
        <div className={cn("grid gap-4", showSidebar ? "lg:grid-cols-[1fr_18rem]" : "grid-cols-1")}>
          <div className="min-w-0">
            {isLoading ? (
              <Skeleton className="h-[500px] w-full" />
            ) : ganttBlocked ? (
              <div className="rounded-md border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
                <p>Disponível apenas em desktop.</p>
                <Button variant="link" onClick={() => setVista("mes")}>Mudar para vista de Mês</Button>
              </div>
            ) : vista === "mes" ? (
              <MesView
                cursor={cursor}
                rows={filtered}
                colabMap={colabMap}
                tipoMap={tipoMap}
                sessaoMap={sessaoMap}
                onCreate={openCreate}
              />
            ) : vista === "semana" ? (
              <SemanaView
                cursor={cursor}
                rows={filtered}
                colabMap={colabMap}
                tipoMap={tipoMap}
                sessaoMap={sessaoMap}
                onCreate={openCreate}
              />
            ) : (
              <GanttView
                year={cursor.getFullYear()}
                rows={filtered}
                colabMap={colabMap}
                tipoMap={tipoMap}
              />
            )}
          </div>
          {showSidebar && (
            <SummarySidebar rows={filtered} colabMap={colabMap} tipoMap={tipoMap} />
          )}
        </div>

        <CreateServicoDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          initialDate={createDate}
          dateLocked={createDateLocked}
          onUnlockDate={() => setCreateDateLocked(false)}
          colabs={(colabs ?? []).filter((c) => c.ativo)}
          tipos={(tipos ?? []).filter((t) => t.ativo)}
        />
      </div>
    </TooltipProvider>
  );
}

// ============ Multi-select filter ============
function MultiSelectFilter({ label, icon, options, selected, onChange, emptyLabel, renderOption }: {
  label: string;
  icon?: React.ReactNode;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  emptyLabel: string;
  renderOption?: (o: { value: string; label: string }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  };
  const summary = selected.length === 0 ? emptyLabel : selected.length === 1
    ? options.find((o) => o.value === selected[0])?.label ?? `1 sel.`
    : `${selected.length} sel.`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          {icon}
          <span className="text-muted-foreground">{label}:</span>
          <span className="font-medium truncate max-w-[140px]">{summary}</span>
          {selected.length > 0 && (
            <span onClick={(e) => { e.stopPropagation(); onChange([]); }} className="ml-1 rounded p-0.5 hover:bg-accent">
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <Command>
          <CommandInput placeholder={`Procurar ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>Sem opções.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const isSel = selected.includes(o.value);
                return (
                  <CommandItem key={o.value} onSelect={() => toggle(o.value)} className="cursor-pointer">
                    <div className={cn("mr-2 h-4 w-4 rounded border flex items-center justify-center", isSel && "bg-primary border-primary text-primary-foreground")}>
                      {isSel && <Check className="h-3 w-3" />}
                    </div>
                    {renderOption ? renderOption(o) : <span>{o.label}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ============ Service Pill + Detail Popover ============
function ServicoPill({ r, colabMap, tipoMap, compact }: { r: Registo; colabMap: Map<string, Colab>; tipoMap: Map<string, Tipo>; compact?: boolean }) {
  const colab = colabMap.get(r.colaborador_id);
  const tipo = tipoMap.get(r.tipo_servico_id);
  const total = calcTotal(r, tipoMap).total;
  const color = colabColor(r.colaborador_id);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "w-full text-left rounded-md border-l-2 px-1.5 py-0.5 text-[10px] flex items-center gap-1 hover:opacity-90 transition-opacity",
            estadoBorder(r.estado),
          )}
          style={{ background: color, color: "white" }}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", estadoDot(r.estado))} />
          <span className="truncate flex-1">{tipo?.nome ?? "—"}</span>
          {!compact && <span className="tabular-nums opacity-90">{fmtEUR(total)}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <ServicoDetail r={r} colab={colab} tipo={tipo} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function ServicoDetail({ r, colab, tipo, onClose }: { r: Registo; colab?: Colab; tipo?: Tipo; onClose: () => void }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("registos_servico").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registo eliminado");
      qc.invalidateQueries({ queryKey: ["registos_cal"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const { data: pag } = useQuery({
    queryKey: ["pag_lookup", r.pagamento_id],
    enabled: !!r.pagamento_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos").select("id, referencia, data_pagamento").eq("id", r.pagamento_id!).single();
      if (error) throw error;
      return data as Pagamento;
    },
  });
  const calc = tipo ? (Number(tipo.preco_unitario) * Number(r.quantidade)) : 0;
  const total = calc + (Number(r.outros_custos) || 0);
  const color = colab ? colabColor(colab.id) : "hsl(220 10% 60%)";

  return (
    <div className="text-sm">
      <div className="flex items-start gap-3 border-b p-3">
        <div className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: color }}>
          {colab ? initials(colab.nome_completo) : "?"}
        </div>
        <div className="flex-1 min-w-0">
          {colab ? (
            <Link
              to="/colaboradoras/$colaboradoraId"
              params={{ colaboradoraId: colab.id }}
              className="font-semibold hover:underline block truncate"
            >
              {colab.nome_completo}
            </Link>
          ) : <div className="font-semibold">—</div>}
          <div className="text-xs text-muted-foreground">{fmtLongDate(r.data_inicio)}</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-2 p-3">
        <div><Badge variant="outline" className={cn("text-[10px]", estadoChip(r.estado))}>{tipo?.nome ?? "—"}</Badge></div>
        {r.descricao && <p className="text-xs text-muted-foreground">{r.descricao}</p>}
        <div className="text-xs text-muted-foreground">
          {r.quantidade} {tipo?.unidade ?? ""} × {fmtEUR(tipo?.preco_unitario ?? 0)} = <span className="text-foreground tabular-nums">{fmtEUR(calc)}</span>
        </div>
        {r.outros_custos > 0 && (
          <div className="text-xs text-muted-foreground">
            {r.outros_custos_descricao || "Outros custos"}: <span className="text-foreground tabular-nums">{fmtEUR(r.outros_custos)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1 border-t">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-base font-semibold tabular-nums">{fmtEUR(total)}</span>
        </div>
      </div>
      <div className="border-t p-3 space-y-2">
        {r.estado === "pago" && pag ? (
          <div className="flex items-center gap-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Pago</span>
            <Badge variant="outline" className="ml-auto">{pag.referencia ?? "—"}</Badge>
            <span className="text-muted-foreground">{new Date(pag.data_pagamento).toLocaleDateString("pt-PT")}</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4" />Sem pagamento associado
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <RegistoPagamentoCell
                registoId={r.id}
                colaboradorId={r.colaborador_id}
                colaboradorNome={colab?.nome_completo ?? "—"}
                pagamentoId={r.pagamento_id}
                total={total}
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t bg-muted/30 p-2">
        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Eliminar este registo?")) remove.mutate(); }}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />Eliminar
        </Button>
        {colab && (
          <Link to="/colaboradoras/$colaboradoraId" params={{ colaboradoraId: colab.id }}>
            <Button size="sm" variant="outline"><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

// ============ Month view ============
function MesView({ cursor, rows, colabMap, tipoMap, sessaoMap, onCreate }: {
  cursor: Date; rows: Registo[]; colabMap: Map<string, Colab>; tipoMap: Map<string, Tipo>; sessaoMap: Map<string, Sessao>; onCreate: (date?: string) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = useMemo(() => {
    const map = new Map<number, Registo[]>();
    for (const r of rows) {
      const d0 = new Date(r.data_inicio + "T00:00:00");
      const d1 = r.data_fim ? new Date(r.data_fim + "T00:00:00") : d0;
      for (let d = new Date(d0); d <= d1; d = addDays(d, 1)) {
        if (d.getFullYear() === year && d.getMonth() === month) {
          const k = d.getDate();
          const arr = map.get(k) ?? []; arr.push(r); map.set(k, arr);
        }
      }
    }
    return map;
  }, [rows, year, month]);

  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  return (
    <div className="rounded-lg border">
      <div className="grid grid-cols-7 border-b bg-muted/30 text-[11px] font-medium text-muted-foreground">
        {DIAS_SHORT.map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border">
        {cells.map((d, i) => {
          const items = d ? byDay.get(d) ?? [] : [];
          return (
            <div
              key={i}
              onClick={() => d && onCreate(ymd(new Date(year, month, d)))}
              className={cn(
                "group min-h-[110px] bg-background p-1.5 relative",
                d ? "cursor-pointer hover:bg-muted/20" : "bg-muted/10",
              )}
            >
              {d && (
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-[11px] font-medium", isToday(d) ? "inline-flex h-5 w-5 items-center justify-center rounded-full ring-1 ring-primary text-primary" : "text-muted-foreground")}>{d}</span>
                  <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>
              )}
              <div className="space-y-0.5">
                {(() => {
                  const blocks = groupDayItems(items, sessaoMap);
                  return <>
                    {blocks.slice(0, 2).map((b, bi) =>
                      b.type === "session"
                        ? <SessionPill key={"s-" + b.sessao.id + "-" + d} sessao={b.sessao} records={b.records} colabMap={colabMap} tipoMap={tipoMap} sessaoMap={sessaoMap} />
                        : <ServicoPill key={b.record.id + "-" + d} r={b.record} colabMap={colabMap} tipoMap={tipoMap} compact />
                    )}
                    {blocks.length > 2 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button onClick={(e) => e.stopPropagation()} className="w-full rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent">
                        +{blocks.length - 2} mais
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2 space-y-1" align="start">
                      <div className="text-xs font-semibold mb-1 px-1">{d} {MESES_LONG[month]}</div>
                      {blocks.map((b, bi) =>
                        b.type === "session"
                          ? <SessionPill key={"sl-" + b.sessao.id} sessao={b.sessao} records={b.records} colabMap={colabMap} tipoMap={tipoMap} sessaoMap={sessaoMap} />
                          : <ServicoPill key={b.record.id + "-list"} r={b.record} colabMap={colabMap} tipoMap={tipoMap} />
                      )}
                    </PopoverContent>
                  </Popover>
                    )}
                  </>;
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ Week view ============
function SemanaView({ cursor, rows, colabMap, tipoMap, sessaoMap, onCreate }: {
  cursor: Date; rows: Registo[]; colabMap: Map<string, Colab>; tipoMap: Map<string, Tipo>; sessaoMap: Map<string, Sessao>; onCreate: (date?: string) => void;
}) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = startOfDay(new Date()).getTime();

  const byDay = useMemo(() => {
    const map = new Map<string, Registo[]>();
    for (const r of rows) {
      const k = r.data_inicio;
      const arr = map.get(k) ?? []; arr.push(r); map.set(k, arr);
    }
    return map;
  }, [rows]);

  const weekTotal = rows.reduce((s, r) => s + calcTotal(r, tipoMap).total, 0);
  const porPagar = rows.filter((r) => r.estado !== "pago").reduce((s, r) => s + calcTotal(r, tipoMap).total, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const isToday = d.getTime() === today;
          const items = byDay.get(ymd(d)) ?? [];
          const total = items.reduce((s, r) => s + calcTotal(r, tipoMap).total, 0);
          return (
            <div
              key={d.toISOString()}
              onClick={() => onCreate(ymd(d))}
              className={cn(
                "rounded-lg border p-2 min-h-[280px] flex flex-col cursor-pointer hover:bg-muted/10 transition-colors",
                isToday && "bg-primary/5 border-primary/30",
              )}
            >
              <div className="text-center mb-2">
                <div className="text-[10px] uppercase text-muted-foreground">{DIAS_SHORT[(d.getDay() + 6) % 7]}</div>
                <div className={cn("text-lg font-semibold", isToday && "text-primary")}>{d.getDate()}</div>
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                {groupDayItems(items).map((b) =>
                  b.type === "session"
                    ? <SessionPill key={"sw-" + b.sessao.id} sessao={b.sessao} records={b.records} colabMap={colabMap} tipoMap={tipoMap} sessaoMap={sessaoMap} />
                    : <ServicoPill key={b.record.id} r={b.record} colabMap={colabMap} tipoMap={tipoMap} compact />
                )}
              </div>
              {total > 0 && <div className="text-[10px] text-muted-foreground text-right mt-2 pt-2 border-t tabular-nums">{fmtEUR(total)}</div>}
            </div>
          );
        })}
      </div>
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground flex justify-between">
        <span>Semana: <b className="text-foreground">{rows.length}</b> serviços · <b className="text-foreground tabular-nums">{fmtEUR(weekTotal)}</b> total</span>
        {porPagar > 0 && <span className="text-amber-600"><b className="tabular-nums">{fmtEUR(porPagar)}</b> por pagar</span>}
      </div>
    </div>
  );
}

// ============ Gantt view ============
function GanttView({ year, rows, colabMap, tipoMap }: {
  year: number; rows: Registo[]; colabMap: Map<string, Colab>; tipoMap: Map<string, Tipo>;
}) {
  const qc = useQueryClient();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const totalDays = daysBetween(yearStart, yearEnd);
  const MESES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  // Group by collaborator
  const groups = useMemo(() => {
    const m = new Map<string, Registo[]>();
    for (const r of rows) {
      const arr = m.get(r.colaborador_id) ?? []; arr.push(r); m.set(r.colaborador_id, arr);
    }
    return Array.from(m.entries()).map(([id, items]) => ({
      id,
      colab: colabMap.get(id),
      items,
      total: items.reduce((s, r) => s + calcTotal(r, tipoMap).total, 0),
    })).sort((a, b) => (a.colab?.nome_completo ?? "").localeCompare(b.colab?.nome_completo ?? ""));
  }, [rows, colabMap, tipoMap]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<null | { id: string; startX: number; iniDay: number; fimDay: number; mode: "move" | "resize-r" }>(null);
  const [preview, setPreview] = useState<Record<string, { iniDay: number; fimDay: number }>>({});
  const movedRef = useRef(false);

  const update = useMutation({
    mutationFn: async ({ id, data_inicio, data_fim }: { id: string; data_inicio: string; data_fim: string | null }) => {
      const { error } = await supabase.from("registos_servico").update({ data_inicio, data_fim } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registos_cal"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const onPointerDown = (e: React.PointerEvent, r: Registo, mode: "move" | "resize-r") => {
    e.stopPropagation(); e.preventDefault();
    movedRef.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const ini = new Date(r.data_inicio + "T00:00:00");
    const fim = r.data_fim ? new Date(r.data_fim + "T00:00:00") : addDays(ini, 1);
    setDrag({ id: r.id, mode, startX: e.clientX, iniDay: daysBetween(yearStart, ini), fimDay: daysBetween(yearStart, fim) });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !trackRef.current) return;
    if (Math.abs(e.clientX - drag.startX) > 2) movedRef.current = true;
    const w = trackRef.current.clientWidth;
    const pxPerDay = w / totalDays;
    const delta = Math.round((e.clientX - drag.startX) / pxPerDay);
    let ini = drag.iniDay, fim = drag.fimDay;
    if (drag.mode === "move") { ini += delta; fim += delta; }
    else fim = Math.max(ini + 1, fim + delta);
    setPreview((p) => ({ ...p, [drag.id]: { iniDay: ini, fimDay: fim } }));
  };
  const onPointerUp = () => {
    if (!drag) return;
    const p = preview[drag.id];
    if (p && movedRef.current) {
      const r = rows.find((x) => x.id === drag.id)!;
      const newIni = addDays(yearStart, p.iniDay);
      const newFim = addDays(yearStart, p.fimDay);
      update.mutate({
        id: drag.id,
        data_inicio: ymd(newIni),
        data_fim: r.data_fim || drag.mode === "resize-r" ? ymd(newFim) : null,
      });
    }
    setDrag(null); setPreview({});
  };

  const today = new Date();
  const todayDay = today.getFullYear() === year ? daysBetween(yearStart, today) : -1;

  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="min-w-[900px]">
        <div className="flex border-b bg-muted/30 text-xs font-medium">
          <div className="w-64 shrink-0 border-r px-3 py-2">Colaboradora</div>
          <div className="flex flex-1">
            {MESES_SHORT.map((m, i) => {
              const days = daysBetween(new Date(year, i, 1), new Date(year, i + 1, 1));
              return <div key={m} className="border-r px-2 py-2 text-center last:border-r-0" style={{ flex: days }}>{m}</div>;
            })}
          </div>
        </div>
        {groups.length === 0 && <div className="px-3 py-8 text-center text-sm text-muted-foreground">Sem serviços neste período.</div>}
        <div onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.id);
            const color = colabColor(g.id);
            return (
              <div key={g.id}>
                <div
                  onClick={() => {
                    const s = new Set(collapsed);
                    if (isCollapsed) s.delete(g.id); else s.add(g.id);
                    setCollapsed(s);
                  }}
                  className="flex items-center border-b bg-muted/40 cursor-pointer hover:bg-muted/60"
                >
                  <div className="w-64 shrink-0 border-r px-3 py-1.5 flex items-center gap-2">
                    <ChevronRight className={cn("h-3 w-3 transition-transform", !isCollapsed && "rotate-90")} />
                    <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white" style={{ background: color }}>
                      {initials(g.colab?.nome_completo ?? "?")}
                    </div>
                    <span className="text-xs font-medium truncate flex-1">{g.colab?.nome_completo ?? "—"}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{fmtEUR(g.total)}</span>
                  </div>
                  <div className="flex-1 px-2 text-[11px] text-muted-foreground">{g.items.length} serviços</div>
                </div>
                {!isCollapsed && g.items.map((r, ri) => {
                  const ini = new Date(r.data_inicio + "T00:00:00");
                  const fim = r.data_fim ? new Date(r.data_fim + "T00:00:00") : addDays(ini, 1);
                  const pv = preview[r.id];
                  const iniDay = pv?.iniDay ?? Math.max(0, daysBetween(yearStart, ini));
                  const fimDay = pv?.fimDay ?? Math.min(totalDays, Math.max(iniDay + 1, daysBetween(yearStart, fim)));
                  const leftPct = (iniDay / totalDays) * 100;
                  const widthPct = Math.max(0.5, ((fimDay - iniDay) / totalDays) * 100);
                  const tipo = tipoMap.get(r.tipo_servico_id);
                  const total = calcTotal(r, tipoMap).total;
                  return (
                    <div key={r.id} className="flex border-b last:border-b-0 hover:bg-muted/10">
                      <div className="w-64 shrink-0 border-r px-3 py-2 pl-12 text-xs">
                        <Badge variant="outline" className={cn("text-[10px]", estadoChip(r.estado))}>{tipo?.nome ?? "—"}</Badge>
                      </div>
                      <div ref={ri === 0 && g === groups[0] ? trackRef : undefined} className="relative flex-1" style={{ height: 36 }}>
                        {MESES_SHORT.map((_, i) => i === 0 ? null : (
                          <div key={i} className="absolute top-0 bottom-0 w-px bg-border/60" style={{ left: `${(daysBetween(yearStart, new Date(year, i, 1)) / totalDays) * 100}%` }} />
                        ))}
                        {todayDay >= 0 && <div className="absolute top-0 bottom-0 w-px bg-primary/70" style={{ left: `${(todayDay / totalDays) * 100}%` }} />}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              onPointerDown={(e) => onPointerDown(e, r, "move")}
                              className={cn("absolute top-1.5 flex h-7 cursor-grab items-center rounded-md text-[10px] text-white shadow-sm active:cursor-grabbing select-none border-l-2", estadoBorder(r.estado))}
                              style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: color }}
                            >
                              <span className="flex-1 truncate px-2">{r.descricao || tipo?.nome}</span>
                              <span className="px-2 tabular-nums opacity-90">{fmtEUR(total)}</span>
                              <div onPointerDown={(e) => onPointerDown(e, r, "resize-r")} className="h-full w-1.5 cursor-ew-resize rounded-r-md bg-black/20" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs space-y-0.5">
                            <div className="font-semibold">{g.colab?.nome_completo}</div>
                            <div>{tipo?.nome} · {r.quantidade} {tipo?.unidade}</div>
                            <div>{fmtLongDate(r.data_inicio)}{r.data_fim ? ` → ${fmtLongDate(r.data_fim)}` : ""}</div>
                            <div className="font-medium">{fmtEUR(total)}</div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ Summary sidebar ============
function SummarySidebar({ rows, colabMap, tipoMap }: { rows: Registo[]; colabMap: Map<string, Colab>; tipoMap: Map<string, Tipo> }) {
  const total = rows.reduce((s, r) => s + calcTotal(r, tipoMap).total, 0);
  const pago = rows.filter((r) => r.estado === "pago").reduce((s, r) => s + calcTotal(r, tipoMap).total, 0);
  const porPagar = total - pago;

  const byColab = useMemo(() => {
    const m = new Map<string, { count: number; total: number; pago: number }>();
    for (const r of rows) {
      const cur = m.get(r.colaborador_id) ?? { count: 0, total: 0, pago: 0 };
      const t = calcTotal(r, tipoMap).total;
      cur.count++; cur.total += t; if (r.estado === "pago") cur.pago += t;
      m.set(r.colaborador_id, cur);
    }
    return Array.from(m.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total);
  }, [rows, tipoMap]);

  const byTipo = useMemo(() => {
    const m = new Map<string, { qtd: number; total: number }>();
    for (const r of rows) {
      const cur = m.get(r.tipo_servico_id) ?? { qtd: 0, total: 0 };
      cur.qtd += Number(r.quantidade) || 0; cur.total += calcTotal(r, tipoMap).total;
      m.set(r.tipo_servico_id, cur);
    }
    return Array.from(m.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total);
  }, [rows, tipoMap]);
  const maxTipo = Math.max(1, ...byTipo.map((t) => t.total));

  return (
    <aside className="w-full lg:w-72 shrink-0 space-y-4">
      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">{rows.length} serviços no período</p>
        <p className="text-2xl font-semibold tabular-nums mt-1">{fmtEUR(total)}</p>
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-emerald-700">Pago</span><span className="tabular-nums">{fmtEUR(pago)}</span></div>
          {porPagar > 0 && <div className="flex justify-between"><span className="text-amber-700">Por pagar</span><span className="tabular-nums">{fmtEUR(porPagar)}</span></div>}
        </div>
      </div>

      {byColab.length > 0 && (
        <div className="rounded-lg border p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Por colaboradora</p>
          <div className="space-y-2">
            {byColab.map((c) => {
              const colab = colabMap.get(c.id);
              const pct = c.total > 0 ? (c.pago / c.total) * 100 : 0;
              return (
                <Link
                  key={c.id}
                  to="/colaboradoras/$colaboradoraId"
                  params={{ colaboradoraId: c.id }}
                  className="block rounded-md p-2 hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0" style={{ background: colabColor(c.id) }}>
                      {initials(colab?.nome_completo ?? "?")}
                    </div>
                    <span className="text-xs font-medium truncate flex-1">{colab?.nome_completo ?? "—"}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{c.count}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground tabular-nums">{fmtEUR(c.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-amber-200 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {byTipo.length > 0 && (
        <div className="rounded-lg border p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Por tipo de serviço</p>
          <div className="space-y-1.5">
            {byTipo.map((t) => {
              const tipo = tipoMap.get(t.id);
              return (
                <div key={t.id}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="truncate">{tipo?.nome ?? "—"}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0 ml-2">{fmtEUR(t.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary/70" style={{ width: `${(t.total / maxTipo) * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{t.qtd} {tipo?.unidade}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

// ============ Create dialog ============
function CreateServicoDialog({ open, onOpenChange, initialDate, dateLocked, onUnlockDate, colabs, tipos }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialDate: string | null;
  dateLocked: boolean;
  onUnlockDate: () => void;
  colabs: Colab[];
  tipos: Tipo[];
}) {
  const qc = useQueryClient();
  const [colabId, setColabId] = useState<string>("");
  const [tipoId, setTipoId] = useState<string>("");
  const [data_inicio, setDataInicio] = useState<string>(initialDate ?? ymd(new Date()));
  const [data_fim, setDataFim] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState<number>(1);
  const [outros, setOutros] = useState<number>(0);
  const [outrosDesc, setOutrosDesc] = useState<string>("");

  // Sync initialDate when dialog opens with a new pre-filled date
  useEffect(() => { if (initialDate) setDataInicio(initialDate); }, [initialDate]);

  const tipo = tipos.find((t) => t.id === tipoId);
  const calc = (tipo?.preco_unitario ?? 0) * (Number(quantidade) || 0);
  const total = calc + (Number(outros) || 0);

  const reset = () => {
    setColabId(""); setTipoId(""); setDataFim(""); setDescricao(""); setQuantidade(1); setOutros(0); setOutrosDesc("");
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!colabId) throw new Error("Colaboradora obrigatória");
      if (!tipoId) throw new Error("Tipo de serviço obrigatório");
      if (!data_inicio) throw new Error("Data obrigatória");
      const payload = {
        colaborador_id: colabId,
        tipo_servico_id: tipoId,
        data_inicio,
        data_fim: data_fim || null,
        descricao: descricao.trim() || null,
        quantidade: Number(quantidade) || 1,
        outros_custos: Number(outros) || 0,
        outros_custos_descricao: outrosDesc.trim() || null,
        estado: "pendente" as Estado,
        submetido_pelo_colaborador: false,
      };
      const { error } = await supabase.from("registos_servico").insert(payload);
      if (error) throw error;
      await supabase.rpc("notificar_nova_entrada_pendente" as never, { p_colaborador_id: colabId } as never);
      return colabs.find((c) => c.id === colabId)?.nome_completo ?? "";
    },
    onSuccess: (name) => {
      toast.success(`Serviço registado para ${name}`);
      qc.invalidateQueries({ queryKey: ["registos_cal"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo serviço</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Colaboradora *</Label>
            <Select value={colabId} onValueChange={setColabId}>
              <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
              <SelectContent>{colabs.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de serviço *</Label>
            <Select value={tipoId} onValueChange={setTipoId}>
              <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
              <SelectContent>{tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome} ({fmtEUR(t.preco_unitario)}/{t.unidade})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data *</Label>
              {dateLocked ? (
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/30">
                  <span className="text-sm flex-1">{fmtLongDate(data_inicio)}</span>
                  <button type="button" onClick={onUnlockDate} className="text-xs text-primary hover:underline">alterar</button>
                </div>
              ) : (
                <Input type="date" value={data_inicio} onChange={(e) => setDataInicio(e.target.value)} />
              )}
            </div>
            <div>
              <Label>Data fim (opcional)</Label>
              <Input type="date" value={data_fim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Quantidade</Label>
            <div className="flex items-center gap-2">
              <Input type="number" step="0.01" value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} />
              {tipo && <span className="text-sm text-muted-foreground">{tipo.unidade}</span>}
            </div>
            {tipo && (
              <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                {quantidade} × {fmtEUR(tipo.preco_unitario)} = <span className="text-foreground font-medium">{fmtEUR(calc)}</span>
              </p>
            )}
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes do serviço" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Outros custos (€)</Label>
              <Input type="number" step="0.01" value={outros} onChange={(e) => setOutros(Number(e.target.value))} />
            </div>
            <div>
              <Label>Descrição outros</Label>
              <Input value={outrosDesc} onChange={(e) => setOutrosDesc(e.target.value)} placeholder="ex.: transportes" />
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="text-lg font-semibold tabular-nums">{fmtEUR(total)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Wallet className="mr-2 h-4 w-4" />Registar serviço
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}