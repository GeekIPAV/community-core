import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";
import { Activity, Flame, Inbox, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/meus-acompanhamentos")({
  component: MeusAcompanhamentosPage,
});

type Row = {
  id: string;
  numero: string;
  alvo_familia: boolean;
  pessoa_nome: string | null;
  familia_nome: string | null;
  familia_membros: number;
  area: string;
  titulo: string;
  prioridade: string;
  estado: string;
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

function MeusAcompanhamentosPage() {
  const navigate = useNavigate();
  const { pessoa } = useAuth();
  const mediadoraId = pessoa?.id ?? null;

  const { data: casos = [], isLoading } = useQuery({
    queryKey: ["meus-acompanhamentos", mediadoraId],
    enabled: !!mediadoraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("casos_apoio" as any)
        .select(`
          id, numero, pessoa_id, familia_id, area, titulo, prioridade, estado, data_abertura,
          pessoa:pessoas!casos_apoio_pessoa_id_fkey(nome_completo, familia:familias(nome)),
          familia:familias!casos_apoio_familia_id_fkey(nome, pessoas(count)),
          caso_registos(count)
        `)
        .eq("mediadora_id", mediadoraId!)
        .order("data_abertura", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((c) => ({
        id: c.id,
        numero: c.numero,
        alvo_familia: !c.pessoa_id && !!c.familia_id,
        pessoa_nome: c.pessoa?.nome_completo ?? null,
        familia_nome: c.pessoa?.familia?.nome ?? c.familia?.nome ?? null,
        familia_membros: c.familia?.pessoas?.[0]?.count ?? 0,
        area: c.area,
        titulo: c.titulo,
        prioridade: c.prioridade,
        estado: c.estado,
        data_abertura: c.data_abertura,
        registos_count: c.caso_registos?.[0]?.count ?? 0,
      })) as Row[];
    },
  });

  const stats = useMemo(() => {
    const ativos = casos.filter((c) => !["Concluído", "Arquivado"].includes(c.estado)).length;
    const novos = casos.filter((c) => c.estado === "Novo").length;
    const emCurso = casos.filter((c) => ["Em análise", "Em curso"].includes(c.estado)).length;
    const alta = casos.filter((c) => c.prioridade === "Alta" && !["Concluído", "Arquivado"].includes(c.estado)).length;
    return { ativos, novos, emCurso, alta };
  }, [casos]);

  const columns = useMemo<SmartColumnDef<Row>[]>(() => [
    {
      id: "numero", accessorKey: "numero", header: "Nº", size: 130,
      meta: { label: "Nº", filterVariant: "text" },
      cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{String(getValue())}</span>,
    },
    {
      id: "pessoa", accessorFn: (r) => r.pessoa_nome ?? r.familia_nome ?? "—",
      header: "Pessoa / Família", size: 220, meta: { label: "Pessoa", filterVariant: "text" },
      cell: ({ row }) => row.original.alvo_familia ? (
        <div className="min-w-0">
          <div className="font-medium truncate">Família {row.original.familia_nome ?? "—"}</div>
          <div className="text-xs text-muted-foreground truncate">Apoia {row.original.familia_membros} pessoa(s)</div>
        </div>
      ) : (
        <div className="min-w-0">
          <div className="font-medium truncate">{row.original.pessoa_nome ?? "—"}</div>
          {row.original.familia_nome && <div className="text-xs text-muted-foreground truncate">{row.original.familia_nome}</div>}
        </div>
      ),
    },
    {
      id: "area", accessorKey: "area", header: "Área", size: 140,
      meta: { label: "Área", filterVariant: "text" },
      cell: ({ getValue }) => <Badge variant="outline" className="font-normal">{String(getValue())}</Badge>,
    },
    {
      id: "titulo", accessorKey: "titulo", header: "Título", size: 260,
      meta: { label: "Título", filterVariant: "text" },
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
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Os Meus Acompanhamentos</h1>
        <p className="text-sm text-muted-foreground">Casos de apoio atribuídos a ti.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ativos" value={stats.ativos} icon={FolderOpen} tone="ok" />
        <StatCard label="Novos" value={stats.novos} icon={Inbox} tone={stats.novos > 0 ? "warn" : "muted"} />
        <StatCard label="Em curso" value={stats.emCurso} icon={Activity} tone="ok" />
        <StatCard label="Alta prioridade" value={stats.alta} icon={Flame} tone={stats.alta > 0 ? "warn" : "muted"} />
      </div>

      <SmartTable
        tableId="meus-acompanhamentos-v1"
        columns={columns}
        data={casos}
        isLoading={isLoading}
        defaultGroupBy="estado"
        defaultCollapsedGroups={["Concluído", "Arquivado"]}
        onRowClick={(r) => navigate({ to: "/casos/$id", params: { id: r.id } })}
        emptyMessage="Ainda não tens casos atribuídos"
      />
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