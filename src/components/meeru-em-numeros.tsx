import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Home,
  Globe2,
  HeartHandshake,
  Activity,
  Calendar,
  FolderKanban,
  Flag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Estatisticas = {
  familias_total: number;
  membros_familias_total: number;
  projetos_total: number;
  participantes_projetos_total: number;
  eventos_total: number;
  participantes_eventos_total: number;
  nacionalidades_total: number;
  nacionalidades_detalhe: { nome: string; count: number }[];
  voluntarios_total: number;
  atividades_total: number;
};

export function MeeruEmNumeros({ data, loading }: { data?: Estatisticas; loading?: boolean }) {
  const top3 = (data?.nacionalidades_detalhe ?? []).slice(0, 3);

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold">A MEERU em números</h2>
        <p className="text-sm text-muted-foreground">
          Panorama do impacto da comunidade.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Pessoas apoiadas" value={data?.membros_familias_total} icon={HeartHandshake} loading={loading} />
        <KpiCard label="Famílias acompanhadas" value={data?.familias_total} icon={Home} loading={loading} />
        <KpiCard label="Nacionalidades" value={data?.nacionalidades_total} icon={Globe2} loading={loading} />
        <KpiCard label="Voluntários" value={data?.voluntarios_total} icon={Users} loading={loading} />
        <KpiCard label="Atividades registadas" value={data?.atividades_total} icon={Activity} loading={loading} />
        <KpiCard
          label="Eventos realizados"
          value={data?.eventos_total}
          sub={data ? `${data.participantes_eventos_total} participações` : undefined}
          icon={Calendar}
          loading={loading}
        />
        <KpiCard
          label="Projetos ativos"
          value={data?.projetos_total}
          sub={data ? `${data.participantes_projetos_total} participações` : undefined}
          icon={FolderKanban}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4" />
            Top 3 nacionalidades
          </CardTitle>
          <CardDescription>Principais nacionalidades representadas na comunidade</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : top3.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <ul className="divide-y">
              {top3.map((n, i) => (
                <li key={n.nome} className="flex items-center justify-between py-2 text-sm">
                  <span className="flex items-center gap-3">
                    <span className="w-5 text-xs text-muted-foreground">{i + 1}.</span>
                    <span className="font-medium">{n.nome}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {n.count} {n.count === 1 ? "pessoa" : "pessoas"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number | undefined;
  sub?: string;
  icon: LucideIcon;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-16" />
          ) : (
            <p className="truncate text-xl font-semibold">{value ?? 0}</p>
          )}
          {sub && !loading && (
            <p className="text-xs text-muted-foreground">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}