import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  HeartHandshake,
  Calendar,
  FolderKanban,
  Home,
  LogIn,
  Plus,
  Settings2,
  Trash2,
  Users,
  Globe2,
  Church,
  UserCheck,
  BarChart3,
} from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth-context";

type Estatisticas = {
  familias_total: number;
  membros_familias_total: number;
  projetos_total: number;
  participantes_projetos_total: number;
  projetos_detalhe: { nome: string; participantes: number }[];
  eventos_total: number;
  participantes_eventos_total: number;
  nacionalidades_total: number;
  nacionalidades_detalhe: { nome: string; count: number }[];
  religioes_total: number;
  religioes_detalhe: { nome: string; count: number }[];
  generos_detalhe: { nome: string; count: number }[];
  voluntarios_total: number;
};

export const Route = createFileRoute("/resultados")({
  head: () => ({
    meta: [
      { title: "Resultados e Impacto — Meeru" },
      { name: "description", content: "Estatísticas e impacto da comunidade Meeru." },
    ],
  }),
  component: ResultadosPage,
});

const PIE_COLORS = [
  "#6366f1",
  "#06b6d4",
  "#f59e0b",
  "#ec4899",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#3b82f6",
];

type ChartType = "pie" | "bar" | "barH";
type TabelaKey = "pessoas" | "familias" | "acoes" | "inscricoes";
type ChartConfig = {
  id: string;
  title: string;
  tabela: TabelaKey;
  coluna: string;
  type: ChartType;
};

const TABELA_LABEL: Record<TabelaKey, string> = {
  pessoas: "Pessoas",
  familias: "Famílias",
  acoes: "Ações (eventos/projetos)",
  inscricoes: "Inscrições",
};

const COLUNAS_POR_TABELA: Record<TabelaKey, { value: string; label: string }[]> = {
  pessoas: [
    { value: "genero", label: "Género" },
    { value: "nacionalidade", label: "Nacionalidade" },
    { value: "religiao", label: "Religião" },
    { value: "cidade_residencia", label: "Cidade de residência" },
    { value: "profissao", label: "Profissão" },
    { value: "is_voluntario", label: "Voluntário" },
    { value: "status", label: "Estado" },
    { value: "familia", label: "Família" },
    { value: "tipo_user", label: "Tipo de utilizador" },
    { value: "projetos", label: "Projetos" },
  ],
  familias: [{ value: "status", label: "Estado" }],
  acoes: [
    { value: "tipo", label: "Tipo" },
    { value: "status", label: "Estado" },
    { value: "inscricoes_abertas", label: "Inscrições abertas" },
    { value: "local", label: "Local" },
  ],
  inscricoes: [
    { value: "status", label: "Estado" },
    { value: "acao", label: "Ação" },
    { value: "tipo_acao", label: "Tipo de ação" },
  ],
};

const CHART_TYPE_LABEL: Record<ChartType, string> = {
  pie: "Circular",
  bar: "Barras (vertical)",
  barH: "Barras (horizontal)",
};

const DEFAULT_CHARTS: ChartConfig[] = [
  { id: "c1", title: "Distribuição por género", tabela: "pessoas", coluna: "genero", type: "pie" },
  { id: "c2", title: "Religiões", tabela: "pessoas", coluna: "religiao", type: "pie" },
  { id: "c3", title: "Nacionalidades", tabela: "pessoas", coluna: "nacionalidade", type: "bar" },
  { id: "c4", title: "Participantes por projeto", tabela: "inscricoes", coluna: "acao", type: "bar" },
];

const STORAGE_KEY = "resultados.charts.v1";
const KPI_STORAGE_KEY = "resultados.kpis.v1";

type MetricKey =
  | "voluntarios_total"
  | "familias_total"
  | "membros_familias_total"
  | "eventos_total"
  | "participantes_eventos_total"
  | "projetos_total"
  | "participantes_projetos_total"
  | "nacionalidades_total"
  | "religioes_total";

type IconKey = "heart" | "home" | "calendar" | "folder" | "users" | "globe" | "church" | "userCheck" | "bar";

type KPIConfig = {
  id: string;
  label: string;
  metric: MetricKey;
  subMetric?: MetricKey;
  subSuffix?: string;
  icon: IconKey;
};

const METRIC_LABEL: Record<MetricKey, string> = {
  voluntarios_total: "Voluntários",
  familias_total: "Famílias",
  membros_familias_total: "Membros de famílias",
  eventos_total: "Eventos",
  participantes_eventos_total: "Participações em eventos",
  projetos_total: "Projetos",
  participantes_projetos_total: "Participações em projetos",
  nacionalidades_total: "Nacionalidades",
  religioes_total: "Religiões",
};

const ICON_MAP: Record<IconKey, React.ReactNode> = {
  heart: <HeartHandshake className="h-5 w-5" />,
  home: <Home className="h-5 w-5" />,
  calendar: <Calendar className="h-5 w-5" />,
  folder: <FolderKanban className="h-5 w-5" />,
  users: <Users className="h-5 w-5" />,
  globe: <Globe2 className="h-5 w-5" />,
  church: <Church className="h-5 w-5" />,
  userCheck: <UserCheck className="h-5 w-5" />,
  bar: <BarChart3 className="h-5 w-5" />,
};

const ICON_LABEL: Record<IconKey, string> = {
  heart: "Coração",
  home: "Casa",
  calendar: "Calendário",
  folder: "Pasta",
  users: "Pessoas",
  globe: "Globo",
  church: "Igreja",
  userCheck: "Verificado",
  bar: "Barras",
};

const DEFAULT_KPIS: KPIConfig[] = [
  { id: "k1", label: "Voluntários", metric: "voluntarios_total", icon: "heart" },
  { id: "k2", label: "Famílias", metric: "familias_total", subMetric: "membros_familias_total", subSuffix: "membros", icon: "home" },
  { id: "k3", label: "Eventos", metric: "eventos_total", subMetric: "participantes_eventos_total", subSuffix: "participações", icon: "calendar" },
  { id: "k4", label: "Projetos", metric: "projetos_total", subMetric: "participantes_projetos_total", subSuffix: "participações", icon: "folder" },
];

// Migra ChartConfigs antigos (dataset → tabela/coluna)
function migrarChart(raw: unknown): ChartConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== "string" || typeof c.title !== "string") return null;
  const type = (c.type as ChartType) ?? "bar";
  if (typeof c.tabela === "string" && typeof c.coluna === "string") {
    return { id: c.id, title: c.title, tabela: c.tabela as TabelaKey, coluna: c.coluna, type };
  }
  // Formato antigo
  const map: Record<string, { tabela: TabelaKey; coluna: string }> = {
    generos: { tabela: "pessoas", coluna: "genero" },
    religioes: { tabela: "pessoas", coluna: "religiao" },
    nacionalidades: { tabela: "pessoas", coluna: "nacionalidade" },
    projetos: { tabela: "inscricoes", coluna: "acao" },
  };
  const m = map[c.dataset as string];
  if (!m) return null;
  return { id: c.id, title: c.title, tabela: m.tabela, coluna: m.coluna, type };
}

function ResultadosPage() {
  const navigate = useNavigate();
  const { session, pessoa, isAdmin } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["estatisticas_publicas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_estatisticas_publicas");
      if (error) throw error;
      return data as unknown as Estatisticas;
    },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="border-b">
            <div className="flex h-14 items-center justify-between px-4">
              <span className="text-sm font-semibold">Meeru</span>
              <div className="flex items-center gap-2">
                {session ? (
                  <Button size="sm" variant="outline" onClick={() => navigate({ to: isAdmin ? "/participantes" : "/perfil" })}>
                    {pessoa?.nome_completo?.split(" ")[0] ?? "Área pessoal"}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => navigate({ to: "/login" })}>
                    <LogIn className="mr-2 h-4 w-4" /> Entrar
                  </Button>
                )}
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Resultados e Impacto</h1>
              <p className="text-sm text-muted-foreground">
                Uma visão agregada e anónima do alcance da nossa comunidade.
              </p>
            </div>

            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">Não foi possível carregar as estatísticas.</p>
            ) : data ? (
              <Conteudo data={data} isAdmin={isAdmin} />
            ) : null}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Conteudo({ data }: { data: Estatisticas }) {
  const [kpis, setKpis] = useState<KPIConfig[]>(() => {
    if (typeof window === "undefined") return DEFAULT_KPIS;
    try {
      const raw = window.localStorage.getItem(KPI_STORAGE_KEY);
      if (!raw) return DEFAULT_KPIS;
      const parsed = JSON.parse(raw) as KPIConfig[];
      return Array.isArray(parsed) ? parsed : DEFAULT_KPIS;
    } catch {
      return DEFAULT_KPIS;
    }
  });
  const [editingKpi, setEditingKpi] = useState<KPIConfig | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify(kpis));
    } catch {
      // ignore
    }
  }, [kpis]);

  const addKpi = () => {
    const novo: KPIConfig = {
      id: `k${Date.now()}`,
      label: "Nova métrica",
      metric: "voluntarios_total",
      icon: "bar",
    };
    setKpis((prev) => [...prev, novo]);
    setEditingKpi(novo);
  };

  const updateKpi = (next: KPIConfig) => {
    setKpis((prev) => prev.map((k) => (k.id === next.id ? next : k)));
  };

  const removeKpi = (id: string) => {
    setKpis((prev) => prev.filter((k) => k.id !== id));
  };

  const [charts, setCharts] = useState<ChartConfig[]>(() => {
    if (typeof window === "undefined") return DEFAULT_CHARTS;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_CHARTS;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CHARTS;
      const migrated = parsed.map(migrarChart).filter((c): c is ChartConfig => c !== null);
      return migrated.length ? migrated : DEFAULT_CHARTS;
    } catch {
      return DEFAULT_CHARTS;
    }
  });
  const [editing, setEditing] = useState<ChartConfig | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
    } catch {
      // ignore
    }
  }, [charts]);

  const addChart = () => {
    const novo: ChartConfig = {
      id: `c${Date.now()}`,
      title: "Novo gráfico",
      tabela: "pessoas",
      coluna: "genero",
      type: "bar",
    };
    setCharts((prev) => [...prev, novo]);
    setEditing(novo);
  };

  const updateChart = (next: ChartConfig) => {
    setCharts((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  };

  const removeChart = (id: string) => {
    setCharts((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Resumo</h2>
        <Button size="sm" variant="outline" onClick={addKpi}>
          <Plus className="mr-2 h-4 w-4" /> Nova métrica
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <KPI
            key={k.id}
            icon={ICON_MAP[k.icon]}
            label={k.label}
            value={data[k.metric] as number}
            sub={k.subMetric ? `${data[k.subMetric] as number}${k.subSuffix ? ` ${k.subSuffix}` : ""}` : undefined}
            onEdit={() => setEditingKpi(k)}
            onRemove={() => removeKpi(k.id)}
          />
        ))}
        {kpis.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-4 border-dashed">
            <CardContent className="flex h-32 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              Sem métricas. Adiciona a primeira.
              <Button size="sm" variant="outline" onClick={addKpi}>
                <Plus className="mr-2 h-4 w-4" /> Nova métrica
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Gráficos</h2>
        <Button size="sm" onClick={addChart}>
          <Plus className="mr-2 h-4 w-4" /> Novo gráfico
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {charts.map((cfg) => (
          <ChartBlock
            key={cfg.id}
            config={cfg}
            onEdit={() => setEditing(cfg)}
            onRemove={() => removeChart(cfg.id)}
          />
        ))}
        {charts.length === 0 && (
          <Card className="lg:col-span-2 border-dashed">
            <CardContent className="flex h-40 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              Sem gráficos. Adiciona o primeiro.
              <Button size="sm" variant="outline" onClick={addChart}>
                <Plus className="mr-2 h-4 w-4" /> Novo gráfico
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <ChartConfigDialog
        chart={editing}
        onClose={() => setEditing(null)}
        onSave={(next) => {
          updateChart(next);
          setEditing(null);
        }}
      />

      <KPIConfigDialog
        kpi={editingKpi}
        onClose={() => setEditingKpi(null)}
        onSave={(next) => {
          updateKpi(next);
          setEditingKpi(null);
        }}
      />
    </div>
  );
}

function KPI({
  icon,
  label,
  value,
  sub,
  onEdit,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  return (
    <Card className="group relative">
      <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
        <CardDescription className="flex items-center gap-2 text-xs">{icon} {label}</CardDescription>
        {(onEdit || onRemove) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Settings2 className="mr-2 h-4 w-4" /> Configurar
                </DropdownMenuItem>
              )}
              {onEdit && onRemove && <DropdownMenuSeparator />}
              {onRemove && (
                <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Remover
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function KPIConfigDialog({
  kpi,
  onClose,
  onSave,
}: {
  kpi: KPIConfig | null;
  onClose: () => void;
  onSave: (next: KPIConfig) => void;
}) {
  const [draft, setDraft] = useState<KPIConfig | null>(kpi);
  useEffect(() => setDraft(kpi), [kpi]);
  if (!draft) return null;
  return (
    <Dialog open={!!kpi} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar métrica</DialogTitle>
          <DialogDescription>Escolhe o título, o ícone e os valores a apresentar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="kpi-label">Título</Label>
            <Input
              id="kpi-label"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Ícone</Label>
            <Select value={draft.icon} onValueChange={(v: IconKey) => setDraft({ ...draft, icon: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ICON_LABEL) as IconKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {ICON_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Valor principal</Label>
            <Select value={draft.metric} onValueChange={(v: MetricKey) => setDraft({ ...draft, metric: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(METRIC_LABEL) as MetricKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {METRIC_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Valor secundário (opcional)</Label>
            <Select
              value={draft.subMetric ?? "none"}
              onValueChange={(v) =>
                setDraft({ ...draft, subMetric: v === "none" ? undefined : (v as MetricKey) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {(Object.keys(METRIC_LABEL) as MetricKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {METRIC_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {draft.subMetric && (
            <div className="grid gap-2">
              <Label htmlFor="kpi-sub-suffix">Sufixo do valor secundário</Label>
              <Input
                id="kpi-sub-suffix"
                placeholder="ex: participações"
                value={draft.subSuffix ?? ""}
                onChange={(e) => setDraft({ ...draft, subSuffix: e.target.value })}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(draft)}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChartBlock({
  config,
  onEdit,
  onRemove,
}: {
  config: ChartConfig;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { data: series, isLoading, error } = useQuery({
    queryKey: ["agrupamento", config.tabela, config.coluna],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_agrupamento", {
        p_tabela: config.tabela,
        p_coluna: config.coluna,
      });
      if (error) throw error;
      const arr = (data as unknown as { nome: string; count: number }[]) ?? [];
      return arr.map((r) => ({ name: r.nome, value: r.count }));
    },
  });
  const colunaLabel =
    COLUNAS_POR_TABELA[config.tabela]?.find((c) => c.value === config.coluna)?.label ?? config.coluna;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{config.title}</CardTitle>
          <CardDescription>
            {TABELA_LABEL[config.tabela]} · {colunaLabel} · {CHART_TYPE_LABEL[config.type]}
          </CardDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <Settings2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Settings2 className="mr-2 h-4 w-4" /> Configurar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="h-80">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : error ? (
          <p className="flex h-full items-center justify-center text-sm text-destructive">
            Não foi possível carregar os dados.
          </p>
        ) : (
          <ChartRenderer type={config.type} data={series ?? []} />
        )}
      </CardContent>
    </Card>
  );
}

function ChartRenderer({ type, data }: { type: ChartType; data: { name: string; value: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados</p>
    );
  }
  const total = data.reduce((acc, d) => acc + (d.value ?? 0), 0);
  const pct = (v: number) => (total > 0 ? ((v / total) * 100).toFixed(1) : "0");
  const fmtLegend = (value: string) => {
    const item = data.find((d) => d.name === value);
    if (!item) return value;
    return `${value}: ${item.value} (${pct(item.value)}%)`;
  };
  const fmtTooltip = (value: number, name: string) => [
    `${value} (${pct(value)}%)`,
    name,
  ] as [string, string];
  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            label={(e: { name: string; value: number }) => `${e.name}: ${e.value} (${pct(e.value)}%)`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={fmtTooltip}
            contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} formatter={fmtLegend} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (type === "barH") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
          <YAxis
            dataKey="name"
            type="category"
            width={140}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(name: string) => fmtLegend(name)}
          />
          <Tooltip
            formatter={fmtTooltip}
            contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          interval={0}
          angle={-25}
          textAnchor="end"
          height={60}
          tickFormatter={(name: string) => fmtLegend(name)}
        />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
        <Tooltip
          formatter={fmtTooltip}
          contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartConfigDialog({
  chart,
  onClose,
  onSave,
}: {
  chart: ChartConfig | null;
  onClose: () => void;
  onSave: (next: ChartConfig) => void;
}) {
  const [draft, setDraft] = useState<ChartConfig | null>(chart);
  useEffect(() => setDraft(chart), [chart]);
  if (!draft) return null;
  return (
    <Dialog open={!!chart} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar gráfico</DialogTitle>
          <DialogDescription>Escolhe o título, os dados e o tipo de visualização.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="chart-title">Título</Label>
            <Input
              id="chart-title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Tabela</Label>
            <Select
              value={draft.tabela}
              onValueChange={(v: TabelaKey) => {
                const primeira = COLUNAS_POR_TABELA[v][0]?.value ?? "";
                setDraft({ ...draft, tabela: v, coluna: primeira });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TABELA_LABEL) as TabelaKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {TABELA_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Agrupar / segmentar por</Label>
            <Select
              value={draft.coluna}
              onValueChange={(v: string) => setDraft({ ...draft, coluna: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUNAS_POR_TABELA[draft.tabela].map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Tipo de gráfico</Label>
            <Select
              value={draft.type}
              onValueChange={(v: ChartType) => setDraft({ ...draft, type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CHART_TYPE_LABEL) as ChartType[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {CHART_TYPE_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(draft)}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
