import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";
import { CasoNovoSheet, AREAS } from "@/components/caso-novo-sheet";
import { AlertCircle, Plus, UserCircle, Users as UsersIcon, FolderOpen, Flame, Activity, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/_admin/casos/")({
  component: CasosListPage,
});

type CasoRow = {
  id: string;
  numero: string;
  pessoa_id: string;
  pessoa_nome: string;
  familia_nome: string | null;
  area: string;
  titulo: string;
  mediadora_id: string | null;
  mediadora_nome: string | null;
  prioridade: string;
  estado: string;
  origem: string;
  data_abertura: string;
  registos_count: number;
};

const ESTADO_TONE: Record<string, string> = {
  "Novo": "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100 font-semibold",
  "Em análise": "bg-blue-100 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200",
  "Em curso": "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  "Em pausa": "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  "Concluído": "bg-muted text-muted-foreground",
  "Arquivado": "bg-muted/50 text-muted-foreground",
};

const PRIO_DOT: Record<string, string> = {
  "Alta": "bg-red-500",
  "Normal": "bg-amber-400",
  "Baixa": "bg-slate-300",
};

function CasosListPage() {
  const navigate = useNavigate();
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: casos = [], isLoading } = useQuery({
    queryKey: ["casos", "lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("casos_apoio" as any)
        .select(`
          id, numero, pessoa_id, area, titulo, mediadora_id, prioridade, estado, origem, data_abertura,
          pessoa:pessoas!casos_apoio_pessoa_id_fkey(nome_completo, familia:familias(nome)),
          mediadora:pessoas!casos_apoio_mediadora_id_fkey(nome_completo),
          caso_registos(count)
        `)
        .order("data_abertura", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((c) => ({
        id: c.id,
        numero: c.numero,
        pessoa_id: c.pessoa_id,
        pessoa_nome: c.pessoa?.nome_completo ?? "—",
        familia_nome: c.pessoa?.familia?.nome ?? null,
        area: c.area,
        titulo: c.titulo,
        mediadora_id: c.mediadora_id,
        mediadora_nome: c.mediadora?.nome_completo ?? null,
        prioridade: c.prioridade,
        estado: c.estado,
        origem: c.origem,
        data_abertura: c.data_abertura,
        registos_count: c.caso_registos?.[0]?.count ?? 0,
      })) as CasoRow[];
    },
  });

  const stats = useMemo(() => {
    const novos = casos.filter((c) => c.estado === "Novo").length;
    const emCurso = casos.filter((c) => ["Em análise", "Em curso"].includes(c.estado)).length;
    const alta = casos.filter((c) => c.prioridade === "Alta" && !["Concluído", "Arquivado"].includes(c.estado)).length;
    const auto = casos.filter((c) => c.origem === "Auto-pedido" && c.estado === "Novo").length;
    const semMediadora = casos.filter((c) => c.estado === "Novo" && !c.mediadora_id).length;
    return { novos, emCurso, alta, auto, semMediadora };
  }, [casos]);

  const columns = useMemo<SmartColumnDef<CasoRow>[]>(() => [
    {
      id: "numero", accessorKey: "numero", header: "Nº", size: 140,
      meta: { label: "Nº", filterVariant: "text" },
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-muted-foreground">{String(getValue())}</span>
      ),
    },
    {
      id: "pessoa", accessorFn: (r) => r.pessoa_nome, header: "Pessoa / Família", size: 220,
      meta: { label: "Pessoa", filterVariant: "text" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{row.original.pessoa_nome}</div>
          {row.original.familia_nome && (
            <div className="text-xs text-muted-foreground truncate">{row.original.familia_nome}</div>
          )}
        </div>
      ),
    },
    {
      id: "area", accessorKey: "area", header: "Área", size: 140,
      meta: { label: "Área", filterVariant: "select", filterOptions: AREAS.map((a) => a.value) },
      cell: ({ getValue }) => <Badge variant="outline" className="font-normal">{String(getValue())}</Badge>,
    },
    {
      id: "titulo", accessorKey: "titulo", header: "Título", size: 260,
      meta: { label: "Título", filterVariant: "text" },
    },
    {
      id: "mediadora", accessorFn: (r) => r.mediadora_nome ?? "Por atribuir", header: "Mediadora", size: 180,
      meta: { label: "Mediadora", filterVariant: "text" },
      cell: ({ row }) => row.original.mediadora_nome
        ? <span className="text-sm">{row.original.mediadora_nome}</span>
        : <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 font-normal">Por atribuir</Badge>,
    },
    {
      id: "prioridade", accessorKey: "prioridade", header: "Prioridade", size: 120,
      meta: { label: "Prioridade", filterVariant: "select", filterOptions: ["Alta", "Normal", "Baixa"] },
      cell: ({ getValue }) => {
        const v = String(getValue());
        return (
          <span className="inline-flex items-center gap-2 text-sm">
            <span className={cn("h-2 w-2 rounded-full", PRIO_DOT[v] ?? "bg-muted")} />
            {v}
          </span>
        );
      },
    },
    {
      id: "estado", accessorKey: "estado", header: "Estado", size: 130,
      meta: { label: "Estado", filterVariant: "select",
        filterOptions: ["Novo", "Em análise", "Em curso", "Em pausa", "Concluído", "Arquivado"] },
      cell: ({ getValue }) => {
        const v = String(getValue());
        return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs", ESTADO_TONE[v] ?? "bg-muted")}>{v}</span>;
      },
    },
    {
      id: "origem", accessorKey: "origem", header: "Origem", size: 130,
      meta: { label: "Origem", filterVariant: "select", filterOptions: ["Mediadora", "Auto-pedido"] },
      cell: ({ getValue }) => {
        const v = String(getValue());
        if (v === "Auto-pedido") {
          return (
            <span className="inline-flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300">
              <UserCircle className="h-3.5 w-3.5" /> Auto-pedido
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <UsersIcon className="h-3.5 w-3.5" /> Equipa
          </span>
        );
      },
    },
    {
      id: "registos_count", accessorKey: "registos_count", header: "Registos", size: 90,
      meta: { label: "Registos" },
      cell: ({ getValue }) => <span className="tabular-nums text-sm">{String(getValue())}</span>,
    },
    {
      id: "data_abertura", accessorKey: "data_abertura", header: "Abertura", size: 110,
      meta: { label: "Abertura" },
      cell: ({ getValue }) => {
        const d = getValue() as string;
        return <span className="text-xs text-muted-foreground">{d ? new Date(d).toLocaleDateString("pt-PT") : "—"}</span>;
      },
    },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Acompanhamento</h1>
          <p className="text-sm text-muted-foreground">Casos de apoio individualizado.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Novos" value={stats.novos} icon={Inbox} tone={stats.novos > 0 ? "warn" : "muted"} />
        <StatCard label="Em curso" value={stats.emCurso} icon={Activity} tone="ok" />
        <StatCard label="Alta prioridade" value={stats.alta} icon={Flame} tone={stats.alta > 0 ? "warn" : "muted"} />
        <StatCard label="Auto-pedidos pendentes" value={stats.auto} icon={UserCircle} tone={stats.auto > 0 ? "info" : "muted"} />
      </div>

      {stats.semMediadora > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <AlertCircle className="h-4 w-4" />
            <span>{stats.semMediadora} casos por atribuir a uma mediadora</span>
          </div>
        </div>
      )}

      <SmartTable
        tableId="casos-v1"
        columns={columns}
        data={casos}
        isLoading={isLoading}
        defaultGroupBy="estado"
        defaultCollapsedGroups={["Concluído", "Arquivado"]}
        onRowClick={(r) => navigate({ to: "/casos/$id", params: { id: r.id } })}
        toolbarActions={
          <Button size="sm" onClick={() => setNovoOpen(true)} className="h-9">
            <Plus className="mr-2 h-4 w-4" /> Novo caso
          </Button>
        }
        emptyMessage="Sem casos registados"
      />

      <CasoNovoSheet open={novoOpen} onOpenChange={setNovoOpen} mode="staff" />
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, tone,
}: { label: string; value: number; icon: any; tone: "ok" | "warn" | "info" | "muted" }) {
  const toneClass = {
    ok: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300",
    warn: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300",
    info: "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        </div>
        <div className={cn("rounded-md p-2", toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

export { FolderOpen };