import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Mail, Phone, CreditCard, Calendar,
  Pencil, Plus, Trash2, Copy, Inbox, ChevronDown, Receipt, Wallet, BarChart3,
} from "lucide-react";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/_admin/colaboradoras/$colaboradoraId")({
  component: ColaboradoraDetailPage,
});

// ============ types ============
type Colab = {
  id: string; nome_completo: string; email: string | null; telefone: string | null;
  iban: string | null; notas: string | null; ativo: boolean; created_at: string;
};
type Tipo = { id: string; nome: string; unidade: string; preco_unitario: number; ativo: boolean };
type Registo = {
  id: string; colaborador_id: string; tipo_servico_id: string;
  data_inicio: string; data_fim: string | null; descricao: string | null;
  quantidade: number; preco_unitario_override: number | null;
  outros_custos: number; outros_custos_descricao: string | null;
  km: number | null; estado: "pendente" | "aprovado" | "pago";
  submetido_pelo_colaborador: boolean; pagamento_id: string | null; notas_admin: string | null;
};
type Pagamento = {
  id: string; colaborador_id: string; data_pagamento: string;
  total: number; referencia: string | null; metodo: string | null; notas: string | null;
};

// ============ utils ============
const ESTADOS: Registo["estado"][] = ["pendente", "aprovado", "pago"];
const METODOS = ["Transferência Bancária", "MB Way", "Numerário", "Cheque", "Outro"];
const fmtEUR = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

const AVATAR_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];
const nameHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
};

const estadoBadge = (e: Registo["estado"]) => {
  if (e === "pendente") return <Badge className="bg-amber-500 hover:bg-amber-500">Pendente</Badge>;
  if (e === "aprovado") return <Badge className="bg-blue-600 hover:bg-blue-600">Aprovado</Badge>;
  return <Badge className="bg-emerald-600 hover:bg-emerald-600">Pago</Badge>;
};

const monthKey = (d: string) => d.slice(0, 7);

// ============ page ============
function ColaboradoraDetailPage() {
  const { colaboradoraId: id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("servicos");

  const { data: colab, isLoading } = useQuery({
    queryKey: ["colaboradora", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id, nome_completo, email, telefone, iban, notas, ativo, created_at")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Colab | null;
    },
  });

  const { data: allColabs } = useQuery({
    queryKey: ["colaboradoras_nav"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores").select("id, nome_completo, ativo").order("nome_completo");
      if (error) throw error;
      return data as { id: string; nome_completo: string; ativo: boolean }[];
    },
  });

  const { data: tipos } = useQuery({
    queryKey: ["tipos_servico_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_servico").select("id, nome, unidade, preco_unitario, ativo").order("nome");
      if (error) throw error;
      return data as Tipo[];
    },
  });
  const tipoMap = useMemo(() => new Map((tipos ?? []).map((t) => [t.id, t])), [tipos]);

  const { data: registos } = useQuery({
    queryKey: ["colaboradora-servicos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registos_servico")
        .select("id, colaborador_id, tipo_servico_id, data_inicio, data_fim, descricao, quantidade, preco_unitario_override, outros_custos, outros_custos_descricao, km, estado, submetido_pelo_colaborador, pagamento_id, notas_admin")
        .eq("colaborador_id", id)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as Registo[];
    },
  });

  const { data: pagamentos } = useQuery({
    queryKey: ["colaboradora-pagamentos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("id, colaborador_id, data_pagamento, total, referencia, metodo, notas")
        .eq("colaborador_id", id)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data as Pagamento[];
    },
  });

  const calcTotal = (r: Registo): number => {
    const tipo = tipoMap.get(r.tipo_servico_id);
    const preco = r.preco_unitario_override != null ? Number(r.preco_unitario_override) : (tipo?.preco_unitario ?? 0);
    return preco * Number(r.quantidade ?? 1) + Number(r.outros_custos ?? 0);
  };

  const totals = useMemo(() => {
    const t = (registos ?? []).reduce((acc, r) => {
      const v = calcTotal(r);
      acc.ganho += v;
      if (r.estado === "pago") acc.pago += v;
      return acc;
    }, { ganho: 0, pago: 0 });
    return { ...t, pendente: Math.max(0, t.ganho - t.pago) };
  }, [registos, tipoMap]);

  // prev / next
  const navList = useMemo(() => (allColabs ?? []).filter((c) => c.ativo || c.id === id), [allColabs, id]);
  const idx = navList.findIndex((c) => c.id === id);
  const prev = idx > 0 ? navList[idx - 1] : null;
  const next = idx >= 0 && idx < navList.length - 1 ? navList[idx + 1] : null;

  if (isLoading) {
    return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  }
  if (!colab) {
    return (
      <div className="p-6 space-y-3">
        <Link to="/servicos" className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />Voltar
        </Link>
        <p>Colaboradora não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Top bar — breadcrumb + back + nav arrows */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/servicos" })}>
            <ArrowLeft className="h-4 w-4 mr-1" />Voltar
          </Button>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link to="/servicos">Colaboradoras</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>{colab.nome_completo}</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" disabled={!prev}
            onClick={() => prev && navigate({ to: "/colaboradoras/$colaboradoraId", params: { colaboradoraId: prev.id } })}
            title={prev?.nome_completo ?? ""}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground px-1">{idx + 1} / {navList.length}</span>
          <Button variant="outline" size="icon" disabled={!next}
            onClick={() => next && navigate({ to: "/colaboradoras/$colaboradoraId", params: { colaboradoraId: next.id } })}
            title={next?.nome_completo ?? ""}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT SIDEBAR */}
        <aside className="lg:w-72 lg:shrink-0">
          <div className="lg:sticky lg:top-4">
            <ProfileCard
              colab={colab}
              totals={totals}
              onEdit={() => setEditOpen(true)}
            />
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="servicos"><Receipt className="mr-2 h-4 w-4" />Serviços</TabsTrigger>
              <TabsTrigger value="pagamentos"><Wallet className="mr-2 h-4 w-4" />Pagamentos</TabsTrigger>
              <TabsTrigger value="resumo"><BarChart3 className="mr-2 h-4 w-4" />Resumo</TabsTrigger>
            </TabsList>

            <TabsContent value="servicos" className="mt-4">
              <ServicosTab
                colaboradorId={id}
                colaboradorName={colab.nome_completo}
                registos={registos ?? []}
                pagamentos={pagamentos ?? []}
                tipos={tipos ?? []}
                tipoMap={tipoMap}
                onJumpToPagamento={(payId) => {
                  setActiveTab("pagamentos");
                  setTimeout(() => {
                    document.getElementById(`pag-${payId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }, 100);
                }}
              />
            </TabsContent>

            <TabsContent value="pagamentos" className="mt-4">
              <PagamentosTab
                colaboradorId={id}
                colaboradorName={colab.nome_completo}
                pagamentos={pagamentos ?? []}
                registos={registos ?? []}
                tipos={tipos ?? []}
                tipoMap={tipoMap}
              />
            </TabsContent>

            <TabsContent value="resumo" className="mt-4">
              <ResumoTab
                registos={registos ?? []}
                pagamentos={pagamentos ?? []}
                tipoMap={tipoMap}
                totals={totals}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <EditProfileSheet
        open={editOpen} onOpenChange={setEditOpen}
        colab={colab}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["colaboradora", id] });
          qc.invalidateQueries({ queryKey: ["colaboradoras_nav"] });
          qc.invalidateQueries({ queryKey: ["colaboradores"] });
        }}
        onDeleted={() => navigate({ to: "/servicos" })}
      />
    </div>
  );
}

// ============ Profile Card ============
function ProfileCard({ colab, totals, onEdit }: {
  colab: Colab;
  totals: { ganho: number; pago: number; pendente: number };
  onEdit: () => void;
}) {
  const color = AVATAR_COLORS[nameHash(colab.nome_completo) % AVATAR_COLORS.length];
  const ini = initials(colab.nome_completo);
  const memberDate = new Date(colab.created_at).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  const ibanLast4 = colab.iban ? colab.iban.replace(/\s/g, "").slice(-4) : null;

  const copyIban = () => {
    if (!colab.iban) return;
    navigator.clipboard.writeText(colab.iban);
    toast.success("IBAN copiado");
  };

  return (
    <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col items-center text-center space-y-2">
        <div className={cn("h-20 w-20 rounded-full flex items-center justify-center text-xl font-semibold", color)}>
          {ini}
        </div>
        <h2 className="text-lg font-semibold leading-tight">{colab.nome_completo}</h2>
        <div className="inline-flex items-center gap-1.5 text-xs">
          <span className={cn("h-2 w-2 rounded-full", colab.ativo ? "bg-emerald-500" : "bg-muted-foreground")} />
          <span className="text-muted-foreground">{colab.ativo ? "Ativa" : "Inativa"}</span>
        </div>
      </div>

      <div className="border-t border-border/60" />

      <div className="space-y-2.5 text-sm">
        <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email">
          {colab.email ? (
            <a href={`mailto:${colab.email}`} className="hover:underline truncate block">{colab.email}</a>
          ) : <span className="text-muted-foreground">—</span>}
        </InfoRow>
        <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Telefone">
          {colab.telefone ?? <span className="text-muted-foreground">—</span>}
        </InfoRow>
        <InfoRow icon={<CreditCard className="h-3.5 w-3.5" />} label="IBAN">
          {ibanLast4 ? (
            <div className="flex items-center gap-2">
              <code className="font-mono text-sm">···· {ibanLast4}</code>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={copyIban} title="Copiar IBAN">
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          ) : <span className="text-muted-foreground">—</span>}
        </InfoRow>
        <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Membro desde">
          <span className="capitalize">{memberDate}</span>
        </InfoRow>
      </div>

      <div className="border-t border-border/60" />

      <div className="grid grid-cols-3 gap-2">
        <StatBlock label="Ganho" value={fmtEUR(totals.ganho)} />
        <StatBlock label="Pago" value={fmtEUR(totals.pago)} tone="text-emerald-600" />
        <StatBlock label="Pendente" value={fmtEUR(totals.pendente)} tone={totals.pendente > 0 ? "text-amber-600" : ""} />
      </div>

      <div className="border-t border-border/60" />

      <Button variant="outline" className="w-full" onClick={onEdit}>
        <Pencil className="mr-2 h-4 w-4" />Editar perfil
      </Button>

      {colab.notas && (
        <div className="text-xs text-muted-foreground whitespace-pre-wrap border-l-2 border-border pl-3">
          {colab.notas}
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="text-sm truncate">{children}</div>
      </div>
    </div>
  );
}

function StatBlock({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2 text-center">
      <p className={cn("font-semibold text-sm tabular-nums leading-tight", tone)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ============ Serviços tab ============
function ServicosTab({
  colaboradorId, colaboradorName, registos, pagamentos, tipos, tipoMap, onJumpToPagamento,
}: {
  colaboradorId: string;
  colaboradorName: string;
  registos: Registo[];
  pagamentos: Pagamento[];
  tipos: Tipo[];
  tipoMap: Map<string, Tipo>;
  onJumpToPagamento: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [filterEstado, setFilterEstado] = useState("__all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const pagMap = useMemo(() => new Map(pagamentos.map((p) => [p.id, p])), [pagamentos]);

  const filtered = useMemo(() => {
    let rows = registos;
    if (filterEstado !== "__all") rows = rows.filter((r) => r.estado === filterEstado);
    if (filterFrom) rows = rows.filter((r) => r.data_inicio >= filterFrom);
    if (filterTo) rows = rows.filter((r) => r.data_inicio <= filterTo);
    return rows;
  }, [registos, filterEstado, filterFrom, filterTo]);

  const calc = (r: Registo) => {
    const t = tipoMap.get(r.tipo_servico_id);
    const preco = r.preco_unitario_override ?? (t?.preco_unitario ?? 0);
    return Number(preco) * Number(r.quantidade);
  };

  type Row = Registo & { _tipo: string; _unidade: string; _calc: number; _total: number };
  const rows = useMemo<Row[]>(() => filtered.map((r) => {
    const t = tipoMap.get(r.tipo_servico_id);
    const c = calc(r);
    return {
      ...r,
      _tipo: t?.nome ?? "—",
      _unidade: t?.unidade ?? "",
      _calc: c,
      _total: c + Number(r.outros_custos || 0),
    };
  }), [filtered, tipoMap]);

  const summary = useMemo(() => {
    const t = filtered.reduce((acc, r) => {
      const v = calc(r) + Number(r.outros_custos || 0);
      acc.total += v;
      if (r.estado === "pago") acc.pago += v;
      if (r.estado !== "pago") acc.pendente += v;
      return acc;
    }, { total: 0, pago: 0, pendente: 0 });
    return { count: filtered.length, ...t };
  }, [filtered, tipoMap]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("registos_servico").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registo removido");
      qc.invalidateQueries({ queryKey: ["colaboradora-servicos", colaboradorId] });
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns = useMemo<SmartColumnDef<Row>[]>(() => [
    { id: "data_inicio", accessorKey: "data_inicio", header: "Data", size: 110,
      meta: { label: "Data", filterVariant: "date" },
      cell: ({ getValue }) => <span className="text-sm whitespace-nowrap">{new Date(String(getValue())).toLocaleDateString("pt-PT")}</span> },
    { id: "descricao", accessorKey: "descricao", header: "Descrição", size: 220,
      meta: { label: "Descrição", filterVariant: "text" },
      cell: ({ getValue }) => <span className="truncate block">{(getValue() as string) || "—"}</span> },
    { id: "_tipo", accessorKey: "_tipo", header: "Tipo de Serviço", size: 180,
      meta: { label: "Tipo de Serviço", filterVariant: "text" },
      cell: ({ getValue }) => <Badge variant="outline" className="truncate max-w-full">{getValue() as string}</Badge> },
    { id: "quantidade", accessorKey: "quantidade", header: "Qtd", size: 100,
      meta: { label: "Qtd", filterVariant: "number" },
      cell: ({ row }) => <span className="block text-right tabular-nums">{Number(row.original.quantidade)} {row.original._unidade}</span> },
    { id: "_calc", accessorKey: "_calc", header: "Calculado", size: 110,
      meta: { label: "Calculado", filterVariant: "number", hideOnMobile: true },
      cell: ({ getValue }) => <span className="block text-right tabular-nums text-muted-foreground">{fmtEUR(Number(getValue() ?? 0))}</span> },
    { id: "outros_custos", accessorKey: "outros_custos", header: "Outros", size: 100,
      meta: { label: "Outros", filterVariant: "number", hideOnMobile: true },
      cell: ({ getValue }) => {
        const v = Number(getValue() ?? 0);
        if (!v) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="block text-right tabular-nums text-muted-foreground text-xs">{fmtEUR(v)}</span>;
      } },
    { id: "_total", accessorKey: "_total", header: "Total", size: 110,
      meta: { label: "Total", filterVariant: "number" },
      cell: ({ getValue }) => <span className="block text-right tabular-nums font-semibold">{fmtEUR(Number(getValue() ?? 0))}</span> },
    { id: "estado", accessorKey: "estado", header: "Estado", size: 110,
      meta: { label: "Estado", filterVariant: "select", filterOptions: ESTADOS as unknown as string[] },
      cell: ({ getValue }) => estadoBadge(getValue() as Registo["estado"]) },
    { id: "pagamento_id", accessorKey: "pagamento_id", header: "Pagamento", size: 130,
      meta: { label: "Pagamento", hideOnMobile: true },
      cell: ({ row }) => {
        const pid = row.original.pagamento_id;
        if (!pid) return <span className="text-muted-foreground text-xs">—</span>;
        const p = pagMap.get(pid);
        return (
          <button onClick={() => onJumpToPagamento(pid)} className="text-xs hover:underline text-primary inline-flex items-center gap-1 truncate">
            {p?.referencia || new Date(p?.data_pagamento ?? "").toLocaleDateString("pt-PT")}
          </button>
        );
      } },
    { id: "_actions", header: "", size: 80, enableSorting: false, enableHiding: false, enableResizing: false,
      meta: { noTruncate: true },
      cell: ({ row }) => (
        <Button size="icon" variant="ghost" className="h-8 w-8"
          onClick={() => { if (confirm("Remover registo?")) remove.mutate(row.original.id); }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ) },
  ], [pagMap, remove, onJumpToPagamento]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-xs">Estado</Label>
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">De</Label><Input type="date" className="h-9 w-40" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" className="h-9 w-40" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} /></div>
      </div>

      <SmartTable
        tableId={`colab_servicos_${colaboradorId}`}
        columns={columns}
        data={rows}
        toolbarActions={<RegistarServicoButton colaboradorId={colaboradorId} colaboradorName={colaboradorName} tipos={tipos} />}
        emptyMessage="Sem serviços registados"
      />

      {rows.length > 0 && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm flex flex-wrap gap-x-6 gap-y-1 justify-between">
          <span><b>{summary.count}</b> serviços</span>
          <span>Total: <b className="tabular-nums">{fmtEUR(summary.total)}</b></span>
          <span>Pago: <b className="tabular-nums text-emerald-600">{fmtEUR(summary.pago)}</b></span>
          <span>Pendente: <b className="tabular-nums text-amber-600">{fmtEUR(summary.pendente)}</b></span>
        </div>
      )}
    </div>
  );
}

// ============ Pagamentos tab ============
function PagamentosTab({
  colaboradorId, colaboradorName, pagamentos, registos, tipos, tipoMap,
}: {
  colaboradorId: string;
  colaboradorName: string;
  pagamentos: Pagamento[];
  registos: Registo[];
  tipos: Tipo[];
  tipoMap: Map<string, Tipo>;
}) {
  const qc = useQueryClient();
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let rows = pagamentos;
    if (filterFrom) rows = rows.filter((p) => p.data_pagamento >= filterFrom);
    if (filterTo) rows = rows.filter((p) => p.data_pagamento <= filterTo);
    return rows;
  }, [pagamentos, filterFrom, filterTo]);

  const byPagamento = useMemo(() => {
    const m = new Map<string, Registo[]>();
    for (const r of registos) {
      if (!r.pagamento_id) continue;
      const list = m.get(r.pagamento_id) ?? [];
      list.push(r);
      m.set(r.pagamento_id, list);
    }
    return m;
  }, [registos]);

  const total = filtered.reduce((s, p) => s + Number(p.total || 0), 0);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("registos_servico").update({ pagamento_id: null, estado: "aprovado" }).eq("pagamento_id", id);
      const { error } = await supabase.from("pagamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento removido");
      qc.invalidateQueries({ queryKey: ["colaboradora-pagamentos", colaboradorId] });
      qc.invalidateQueries({ queryKey: ["colaboradora-servicos", colaboradorId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 justify-between">
        <div className="flex gap-2 items-end">
          <div><Label className="text-xs">De</Label><Input type="date" className="h-9 w-40" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" className="h-9 w-40" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} /></div>
        </div>
        <RegistarPagamentoButton colaboradorId={colaboradorId} colaboradorName={colaboradorName} tipos={tipos} />
      </div>

      <div className="rounded-lg border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            <Inbox className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Sem pagamentos registados
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <th className="p-2 w-8"></th>
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Referência</th>
                <th className="p-2 text-left">Método</th>
                <th className="p-2 text-left">Serviços</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-left">Notas</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const linked = byPagamento.get(p.id) ?? [];
                const isOpen = expanded.has(p.id);
                return (
                  <>
                    <tr key={p.id} id={`pag-${p.id}`} className="border-t hover:bg-muted/20">
                      <td className="p-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggle(p.id)}>
                          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                        </Button>
                      </td>
                      <td className="p-2 whitespace-nowrap">{new Date(p.data_pagamento).toLocaleDateString("pt-PT")}</td>
                      <td className="p-2 font-medium">{p.referencia || "—"}</td>
                      <td className="p-2 text-muted-foreground">{p.metodo || "—"}</td>
                      <td className="p-2">
                        <button className="inline-flex items-center" onClick={() => toggle(p.id)}>
                          <Badge variant="secondary">{linked.length} serviço{linked.length === 1 ? "" : "s"}</Badge>
                        </button>
                      </td>
                      <td className="p-2 text-right font-semibold text-emerald-600 tabular-nums">{fmtEUR(p.total)}</td>
                      <td className="p-2 text-muted-foreground text-xs truncate max-w-[200px]">{p.notas || ""}</td>
                      <td className="p-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => { if (confirm("Remover pagamento? Os serviços voltarão a estado aprovado.")) remove.mutate(p.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-muted/30">
                        <td colSpan={8} className="p-3">
                          {linked.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sem serviços associados.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="text-left p-1">Data</th>
                                  <th className="text-left p-1">Descrição</th>
                                  <th className="text-left p-1">Tipo</th>
                                  <th className="text-right p-1">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {linked.map((r) => {
                                  const t = tipoMap.get(r.tipo_servico_id);
                                  const preco = r.preco_unitario_override ?? (t?.preco_unitario ?? 0);
                                  const v = Number(preco) * Number(r.quantidade) + Number(r.outros_custos || 0);
                                  return (
                                    <tr key={r.id} className="border-t border-border/40">
                                      <td className="p-1 whitespace-nowrap">{new Date(r.data_inicio).toLocaleDateString("pt-PT")}</td>
                                      <td className="p-1">{r.descricao || "—"}</td>
                                      <td className="p-1">{t?.nome ?? "—"}</td>
                                      <td className="p-1 text-right tabular-nums">{fmtEUR(v)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm flex justify-between">
          <span><b>{filtered.length}</b> pagamentos</span>
          <span>Total pago: <b className="tabular-nums text-emerald-600">{fmtEUR(total)}</b></span>
        </div>
      )}
    </div>
  );
}

// ============ Resumo tab ============
function ResumoTab({
  registos, pagamentos, tipoMap, totals,
}: {
  registos: Registo[];
  pagamentos: Pagamento[];
  tipoMap: Map<string, Tipo>;
  totals: { ganho: number; pago: number; pendente: number };
}) {
  const calc = (r: Registo) => {
    const t = tipoMap.get(r.tipo_servico_id);
    const preco = r.preco_unitario_override ?? (t?.preco_unitario ?? 0);
    return Number(preco) * Number(r.quantidade) + Number(r.outros_custos || 0);
  };

  const months = useMemo(() => {
    const arr: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return arr;
  }, []);

  const chartData = useMemo(() => {
    const serv = new Map<string, number>();
    const pag = new Map<string, number>();
    for (const r of registos) {
      const k = monthKey(r.data_inicio);
      serv.set(k, (serv.get(k) ?? 0) + calc(r));
    }
    for (const p of pagamentos) {
      const k = monthKey(p.data_pagamento);
      pag.set(k, (pag.get(k) ?? 0) + Number(p.total || 0));
    }
    return months.map((m) => ({
      mes: m.slice(5) + "/" + m.slice(2, 4),
      Serviços: Number((serv.get(m) ?? 0).toFixed(2)),
      Pagamentos: Number((pag.get(m) ?? 0).toFixed(2)),
    }));
  }, [months, registos, pagamentos, tipoMap]);

  const byTipo = useMemo(() => {
    const m = new Map<string, number>();
    let total = 0;
    for (const r of registos) {
      const t = tipoMap.get(r.tipo_servico_id);
      const name = t?.nome ?? "—";
      const v = calc(r);
      m.set(name, (m.get(name) ?? 0) + v);
      total += v;
    }
    return Array.from(m.entries())
      .map(([nome, valor]) => ({ nome, valor, pct: total > 0 ? (valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
  }, [registos, tipoMap]);

  const recent = useMemo(() => [...registos]
    .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))
    .slice(0, 5), [registos]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Serviços registados" value={String(registos.length)} />
        <StatCard label="Total ganho" value={fmtEUR(totals.ganho)} />
        <StatCard label="Total pago" value={fmtEUR(totals.pago)} tone="text-emerald-600" />
        <StatCard label="Pendente" value={fmtEUR(totals.pendente)} tone={totals.pendente > 0 ? "text-amber-600" : ""} />
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium mb-3">Últimos 12 meses</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `€${v}`} />
              <RTooltip
                formatter={(v: number) => fmtEUR(v)}
                contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Serviços" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Pagamentos" fill="hsl(142 71% 45%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium mb-3">Por tipo de serviço</p>
        {byTipo.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados.</p>
        ) : (
          <div className="space-y-2">
            {byTipo.map((b) => (
              <div key={b.nome}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="truncate">{b.nome}</span>
                  <span className="tabular-nums text-muted-foreground">{fmtEUR(b.valor)} · {b.pct.toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${b.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium mb-3">Atividade recente</p>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem registos.</p>
        ) : (
          <ul className="space-y-3">
            {recent.map((r) => {
              const t = tipoMap.get(r.tipo_servico_id);
              return (
                <li key={r.id} className="flex gap-3 items-start">
                  <div className="w-20 shrink-0 text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                    {new Date(r.data_inicio).toLocaleDateString("pt-PT")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{r.descricao || t?.nome || "Serviço"}</span>
                      <Badge variant="outline" className="text-[10px]">{t?.nome ?? "—"}</Badge>
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums whitespace-nowrap">{fmtEUR(calc(r))}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

// ============ Edit Profile Sheet ============
function EditProfileSheet({
  open, onOpenChange, colab, onSaved, onDeleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  colab: Colab;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState<Partial<Colab>>(colab);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // sync when opening for new colab
  const lastId = useState<string | null>(null);
  if (open && lastId[0] !== colab.id) {
    lastId[1](colab.id);
    if (form.id !== colab.id) setForm(colab);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form.nome_completo?.trim()) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("colaboradores").update({
        nome_completo: form.nome_completo.trim(),
        email: form.email?.trim() || null,
        telefone: form.telefone?.trim() || null,
        iban: form.iban?.trim() || null,
        notas: form.notas?.trim() || null,
        ativo: form.ativo ?? true,
      }).eq("id", colab.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atualizada"); onSaved(); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("colaboradores").delete().eq("id", colab.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Colaboradora removida"); onDeleted(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar perfil</SheetTitle>
            <SheetDescription>Atualizar dados da colaboradora.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 py-4">
            <div><Label>Nome completo *</Label><Input value={form.nome_completo ?? ""} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            <div><Label>IBAN</Label><Input className="font-mono" value={form.iban ?? ""} onChange={(e) => setForm({ ...form, iban: e.target.value })} /></div>
            <div><Label>Notas</Label><Textarea rows={4} value={form.notas ?? ""} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="font-medium">Ativa</Label>
                <p className="text-xs text-muted-foreground">Colaboradoras inativas não aparecem em opções.</p>
              </div>
              <Switch checked={form.ativo ?? true} onCheckedChange={(c) => setForm({ ...form, ativo: c })} />
            </div>
          </div>
          <SheetFooter className="flex-col sm:flex-row gap-2">
            <Button variant="destructive" onClick={() => setConfirmDelete(true)} className="sm:mr-auto">
              <Trash2 className="mr-2 h-4 w-4" />Eliminar
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eliminar colaboradora?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tens a certeza? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { remove.mutate(); setConfirmDelete(false); }}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============ Registar serviço (prefilled) ============
function RegistarServicoButton({
  colaboradorId, colaboradorName, tipos,
}: {
  colaboradorId: string;
  colaboradorName: string;
  tipos: Tipo[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Registo>>({
    data_inicio: new Date().toISOString().slice(0, 10),
    quantidade: 1, outros_custos: 0, estado: "pendente",
  });
  const tipoMap = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos]);
  const preco = form.preco_unitario_override ?? (form.tipo_servico_id ? tipoMap.get(form.tipo_servico_id)?.preco_unitario ?? 0 : 0);
  const calc = Number(preco) * Number(form.quantidade ?? 1);
  const total = calc + Number(form.outros_custos ?? 0);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.tipo_servico_id) throw new Error("Tipo de serviço obrigatório");
      const { error } = await supabase.from("registos_servico").insert({
        colaborador_id: colaboradorId,
        tipo_servico_id: form.tipo_servico_id,
        data_inicio: form.data_inicio!,
        data_fim: form.data_fim || null,
        descricao: form.descricao?.trim() || null,
        quantidade: Number(form.quantidade) || 1,
        preco_unitario_override: form.preco_unitario_override != null && (form.preco_unitario_override as unknown as string) !== "" ? Number(form.preco_unitario_override) : null,
        outros_custos: Number(form.outros_custos) || 0,
        outros_custos_descricao: form.outros_custos_descricao?.trim() || null,
        estado: form.estado ?? "pendente",
        submetido_pelo_colaborador: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço registado");
      qc.invalidateQueries({ queryKey: ["colaboradora-servicos", colaboradorId] });
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
      setOpen(false);
      setForm({ data_inicio: new Date().toISOString().slice(0, 10), quantidade: 1, outros_custos: 0, estado: "pendente" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="h-9">
        <Plus className="mr-2 h-4 w-4" />Registar serviço
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo serviço</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm flex items-center gap-2">
              <span className="text-muted-foreground">Colaboradora:</span>
              <Badge variant="secondary">{colaboradorName}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Tipo de serviço *</Label>
                <Select value={form.tipo_servico_id ?? ""} onValueChange={(v) => setForm({ ...form, tipo_servico_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                  <SelectContent>
                    {tipos.filter(t => t.ativo).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nome} — {fmtEUR(t.preco_unitario)}/{t.unidade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Data *</Label><Input type="date" value={form.data_inicio ?? ""} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
              <div><Label>Data fim</Label><Input type="date" value={form.data_fim ?? ""} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
              <div className="col-span-2"><Label>Descrição</Label><Textarea value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
              <div><Label>Quantidade</Label><Input type="number" step="0.01" value={form.quantidade ?? 1} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} /></div>
              <div>
                <Label>Preço unitário (override)</Label>
                <Input type="number" step="0.01"
                  placeholder={form.tipo_servico_id ? String(tipoMap.get(form.tipo_servico_id)?.preco_unitario ?? "") : "—"}
                  value={form.preco_unitario_override ?? ""}
                  onChange={(e) => setForm({ ...form, preco_unitario_override: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div><Label>Outros custos (€)</Label><Input type="number" step="0.01" value={form.outros_custos ?? 0} onChange={(e) => setForm({ ...form, outros_custos: Number(e.target.value) })} /></div>
              <div>
                <Label>Estado</Label>
                <Select value={form.estado ?? "pendente"} onValueChange={(v) => setForm({ ...form, estado: v as Registo["estado"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{Number(form.quantidade ?? 1)} × {fmtEUR(Number(preco))}</span><span className="tabular-nums">{fmtEUR(calc)}</span></div>
                {Number(form.outros_custos ?? 0) > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>Outros custos</span><span className="tabular-nums">{fmtEUR(form.outros_custos)}</span></div>}
                <div className="flex justify-between font-semibold mt-1 pt-1 border-t"><span>Total</span><span className="tabular-nums">{fmtEUR(total)}</span></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============ Registar pagamento (prefilled w/ checklist) ============
function RegistarPagamentoButton({
  colaboradorId, colaboradorName, tipos,
}: {
  colaboradorId: string;
  colaboradorName: string;
  tipos: Tipo[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const firstName = colaboradorName.split(/\s+/)[0] ?? "";
  const today = new Date();
  const defaultRef = `${today.getDate()}/${today.getMonth() + 1} - ${firstName}`;
  const [form, setForm] = useState<{
    data_pagamento: string; referencia: string; metodo: string; notas: string; selecionados: string[];
  }>({
    data_pagamento: today.toISOString().slice(0, 10),
    referencia: defaultRef, metodo: "Transferência Bancária", notas: "", selecionados: [],
  });
  const tipoMap = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos]);

  const { data: pendingApproved } = useQuery({
    queryKey: ["pagar_pendentes", colaboradorId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registos_servico")
        .select("id, data_inicio, descricao, quantidade, preco_unitario_override, outros_custos, tipo_servico_id, estado")
        .eq("colaborador_id", colaboradorId)
        .in("estado", ["pendente", "aprovado"])
        .is("pagamento_id", null)
        .order("data_inicio");
      if (error) throw error;
      return data as Array<{ id: string; data_inicio: string; descricao: string | null; quantidade: number; preco_unitario_override: number | null; outros_custos: number; tipo_servico_id: string; estado: string }>;
    },
  });

  const total = useMemo(() => {
    if (!pendingApproved) return 0;
    return pendingApproved.filter((r) => form.selecionados.includes(r.id)).reduce((s, r) => {
      const preco = r.preco_unitario_override ?? (tipoMap.get(r.tipo_servico_id)?.preco_unitario ?? 0);
      return s + Number(preco) * Number(r.quantidade) + Number(r.outros_custos ?? 0);
    }, 0);
  }, [pendingApproved, form.selecionados, tipoMap]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: ins, error } = await supabase.from("pagamentos").insert({
        colaborador_id: colaboradorId,
        data_pagamento: form.data_pagamento,
        total,
        referencia: form.referencia.trim() || null,
        metodo: form.metodo.trim() || null,
        notas: form.notas.trim() || null,
      }).select("id").single();
      if (error) throw error;
      if (form.selecionados.length > 0) {
        const { error: e2 } = await supabase.from("registos_servico")
          .update({ pagamento_id: ins.id, estado: "pago" }).in("id", form.selecionados);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success("Pagamento registado");
      qc.invalidateQueries({ queryKey: ["colaboradora-pagamentos", colaboradorId] });
      qc.invalidateQueries({ queryKey: ["colaboradora-servicos", colaboradorId] });
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
      qc.invalidateQueries({ queryKey: ["registos_servico"] });
      setOpen(false);
      setForm({ data_pagamento: today.toISOString().slice(0, 10), referencia: defaultRef, metodo: "Transferência Bancária", notas: "", selecionados: [] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) => {
    setForm({ ...form, selecionados: form.selecionados.includes(id) ? form.selecionados.filter(x => x !== id) : [...form.selecionados, id] });
  };
  const toggleAll = () => {
    const all = (pendingApproved ?? []).map((r) => r.id);
    const allSelected = all.length > 0 && all.every((id) => form.selecionados.includes(id));
    setForm({ ...form, selecionados: allSelected ? [] : all });
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="h-9">
        <Plus className="mr-2 h-4 w-4" />Registar pagamento
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm flex items-center gap-2">
              <span className="text-muted-foreground">Colaboradora:</span>
              <Badge variant="secondary">{colaboradorName}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Data *</Label><Input type="date" value={form.data_pagamento} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })} /></div>
              <div><Label>Referência</Label><Input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} /></div>
              <div>
                <Label>Método</Label>
                <Select value={form.metodo} onValueChange={(v) => setForm({ ...form, metodo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{METODOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notas</Label><Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Serviços a liquidar (pendentes + aprovados)</Label>
                {(pendingApproved ?? []).length > 0 && (
                  <button type="button" onClick={toggleAll} className="text-xs text-primary hover:underline">
                    {form.selecionados.length === (pendingApproved ?? []).length ? "Desmarcar todos" : "Selecionar todos"}
                  </button>
                )}
              </div>
              <div className="rounded-md border max-h-60 overflow-y-auto">
                {(pendingApproved ?? []).length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Sem serviços por liquidar.</p>
                ) : (pendingApproved ?? []).map((r) => {
                  const t = tipoMap.get(r.tipo_servico_id);
                  const preco = r.preco_unitario_override ?? (t?.preco_unitario ?? 0);
                  const v = Number(preco) * Number(r.quantidade) + Number(r.outros_custos ?? 0);
                  return (
                    <label key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 border-b last:border-0 cursor-pointer hover:bg-muted/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <Checkbox checked={form.selecionados.includes(r.id)} onCheckedChange={() => toggle(r.id)} />
                        <div className="text-sm min-w-0">
                          <div className="truncate">
                            {new Date(r.data_inicio).toLocaleDateString("pt-PT")} — {r.descricao || t?.nome || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{t?.nome ?? ""}</span>
                            <span>·</span>
                            <span>{Number(r.quantidade)} × {fmtEUR(Number(preco))}</span>
                            <Badge variant="outline" className="text-[10px]">{r.estado}</Badge>
                          </div>
                        </div>
                      </div>
                      <span className="tabular-nums text-sm font-medium">{fmtEUR(v)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-between rounded-md border bg-muted/40 p-3 text-sm">
              <span>Total do pagamento</span>
              <span className="font-semibold tabular-nums">{fmtEUR(total)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || form.selecionados.length === 0}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}