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
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "react-i18next";
import { useDir } from "@/lib/i18n";

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
  const { t } = useTranslation();
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
                    {pessoa?.nome_completo?.split(" ")[0] ?? t("header.personalArea")}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => navigate({ to: "/login" })}>
                    <LogIn className="me-2 h-4 w-4" /> {t("header.signIn")}
                  </Button>
                )}
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 md:py-10">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{t("results.title")}</h1>
              <p className="text-sm text-muted-foreground">
                {t("results.subtitle")}
              </p>
            </div>

            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">{t("results.loadError")}</p>
            ) : data ? (
              <Conteudo data={data} isAdmin={isAdmin} />
            ) : null}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Conteudo({ data, isAdmin }: { data: Estatisticas; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data: config } = useQuery({
    queryKey: ["dashboard-config", "resultados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_config")
        .select("charts, kpis")
        .eq("key", "resultados")
        .maybeSingle();
      if (error) throw error;
      const rawCharts = Array.isArray(data?.charts) ? (data!.charts as unknown[]) : [];
      const migrated = rawCharts.map(migrarChart).filter((c): c is ChartConfig => c !== null);
      const rawKpis = Array.isArray(data?.kpis) ? (data!.kpis as unknown as KPIConfig[]) : [];
      return {
        charts: migrated.length ? migrated : DEFAULT_CHARTS,
        kpis: rawKpis.length ? rawKpis : DEFAULT_KPIS,
      };
    },
    staleTime: 1000 * 60,
  });

  const kpis = config?.kpis ?? DEFAULT_KPIS;
  const charts = config?.charts ?? DEFAULT_CHARTS;

  const saveMutation = useMutation({
    mutationFn: async (next: { charts: ChartConfig[]; kpis: KPIConfig[] }) => {
      const { error } = await supabase
        .from("dashboard_config")
        .upsert(
          { key: "resultados", charts: next.charts, kpis: next.kpis },
          { onConflict: "key" },
        );
      if (error) throw error;
    },
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: ["dashboard-config", "resultados"] });
      const prev = queryClient.getQueryData(["dashboard-config", "resultados"]);
      queryClient.setQueryData(["dashboard-config", "resultados"], next);
      return { prev };
    },
    onError: (err: Error, _next, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["dashboard-config", "resultados"], ctx.prev);
      toast.error(err.message || "Não foi possível guardar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-config", "resultados"] });
    },
  });

  const persist = (next: { charts: ChartConfig[]; kpis: KPIConfig[] }) => {
    saveMutation.mutate(next);
  };

  const [editingKpi, setEditingKpi] = useState<KPIConfig | null>(null);
  const [editing, setEditing] = useState<ChartConfig | null>(null);

  const addKpi = () => {
    const novo: KPIConfig = {
      id: `k${Date.now()}`,
      label: t("results.newMetric"),
      metric: "voluntarios_total",
      icon: "bar",
    };
    persist({ charts, kpis: [...kpis, novo] });
    setEditingKpi(novo);
  };

  const updateKpi = (next: KPIConfig) => {
    persist({ charts, kpis: kpis.map((k) => (k.id === next.id ? next : k)) });
  };

  const removeKpi = (id: string) => {
    persist({ charts, kpis: kpis.filter((k) => k.id !== id) });
  };

  const addChart = () => {
    const novo: ChartConfig = {
      id: `c${Date.now()}`,
      title: t("results.newChart"),
      tabela: "pessoas",
      coluna: "genero",
      type: "bar",
    };
    persist({ charts: [...charts, novo], kpis });
    setEditing(novo);
  };

  const updateChart = (next: ChartConfig) => {
    persist({ charts: charts.map((c) => (c.id === next.id ? next : c)), kpis });
  };

  const removeChart = (id: string) => {
    persist({ charts: charts.filter((c) => c.id !== id), kpis });
  };

  const moveChart = (id: string, dir: -1 | 1) => {
    const idx = charts.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= charts.length) return;
    const next = [...charts];
    [next[idx], next[target]] = [next[target], next[idx]];
    persist({ charts: next, kpis });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">{t("results.summary")}</h2>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={addKpi} className="self-start sm:self-auto">
            <Plus className="me-2 h-4 w-4" /> {t("results.newMetric")}
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <KPI
            key={k.id}
            icon={ICON_MAP[k.icon]}
            label={k.label}
            value={data[k.metric] as number}
            sub={k.subMetric ? `${data[k.subMetric] as number}${k.subSuffix ? ` ${k.subSuffix}` : ""}` : undefined}
            onEdit={isAdmin ? () => setEditingKpi(k) : undefined}
            onRemove={isAdmin ? () => removeKpi(k.id) : undefined}
          />
        ))}
        {kpis.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-4 border-dashed">
            <CardContent className="flex h-32 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              {isAdmin ? t("results.emptyMetricsAdmin") : t("results.emptyMetrics")}
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={addKpi}>
                  <Plus className="me-2 h-4 w-4" /> {t("results.newMetric")}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">{t("results.charts")}</h2>
        {isAdmin && (
          <Button size="sm" onClick={addChart} className="self-start sm:self-auto">
            <Plus className="me-2 h-4 w-4" /> {t("results.newChart")}
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {charts.map((cfg, i) => (
          <ChartBlock
            key={cfg.id}
            config={cfg}
            onEdit={isAdmin ? () => setEditing(cfg) : undefined}
            onRemove={isAdmin ? () => removeChart(cfg.id) : undefined}
            onMoveUp={isAdmin && i > 0 ? () => moveChart(cfg.id, -1) : undefined}
            onMoveDown={isAdmin && i < charts.length - 1 ? () => moveChart(cfg.id, 1) : undefined}
          />
        ))}
        {charts.length === 0 && (
          <Card className="lg:col-span-2 border-dashed">
            <CardContent className="flex h-40 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              {isAdmin ? t("results.emptyChartsAdmin") : t("results.emptyCharts")}
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={addChart}>
                  <Plus className="me-2 h-4 w-4" /> {t("results.newChart")}
                </Button>
              )}
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
  onMoveUp,
  onMoveDown,
}: {
  config: ChartConfig;
  onEdit?: () => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
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
        {(onEdit || onRemove || onMoveUp || onMoveDown) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onMoveUp && (
                <DropdownMenuItem onClick={onMoveUp}>
                  <ArrowUp className="mr-2 h-4 w-4" /> Mover para cima
                </DropdownMenuItem>
              )}
              {onMoveDown && (
                <DropdownMenuItem onClick={onMoveDown}>
                  <ArrowDown className="mr-2 h-4 w-4" /> Mover para baixo
                </DropdownMenuItem>
              )}
              {(onMoveUp || onMoveDown) && (onEdit || onRemove) && <DropdownMenuSeparator />}
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
