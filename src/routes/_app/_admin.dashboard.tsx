import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Users, Users2, CalendarDays, HeartHandshake, Briefcase, Activity } from "lucide-react";
import { Euro, Clock, CalendarClock, Pencil } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FamilyDetailDialog, type Familia } from "@/components/family-detail";

export const Route = createFileRoute("/_app/_admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Meeru" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DashboardPage,
});

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_estatisticas_publicas" as any);
      if (error) throw error;
      return data as any;
    },
  });

  const { data: ops, isLoading: opsLoading } = useQuery({
    queryKey: ["dashboard-operacional"],
    queryFn: async () => {
      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      const [pend, tipos, sess] = await Promise.all([
        supabase
          .from("registos_servico")
          .select("id, quantidade, preco_unitario_override, outros_custos, tipo_servico_id, estado")
          .in("estado", ["pendente", "aprovado"]),
        supabase.from("tipos_servico").select("id, preco_unitario"),
        supabase
          .from("sessoes_servico")
          .select("id")
          .gte("data_inicio", now.toISOString())
          .lte("data_inicio", in7.toISOString()),
      ]);
      const precos = new Map<string, number>((tipos.data ?? []).map((t: any) => [t.id, Number(t.preco_unitario) || 0]));
      let pendenteTotal = 0;
      let aprovadoTotal = 0;
      let countPendente = 0;
      for (const r of pend.data ?? []) {
        const p = r.preco_unitario_override != null ? Number(r.preco_unitario_override) : (precos.get(r.tipo_servico_id) ?? 0);
        const total = p * Number(r.quantidade) + Number(r.outros_custos || 0);
        if (r.estado === "pendente") { pendenteTotal += total; countPendente++; }
        else aprovadoTotal += total;
      }
      return {
        pendenteTotal,
        aprovadoTotal,
        countPendente,
        proximasSessoes: sess.data?.length ?? 0,
      };
    },
  });

  const { data: acoesPorMes } = useQuery({
    queryKey: ["dashboard-acoes-mes"],
    queryFn: async () => {
      const desde = new Date();
      desde.setMonth(desde.getMonth() - 11);
      desde.setDate(1);
      const { data, error } = await supabase
        .from("acoes")
        .select("data_inicio, tipo")
        .gte("data_inicio", desde.toISOString())
        .not("data_inicio", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: inscricoesPorMes } = useQuery({
    queryKey: ["dashboard-inscricoes-mes"],
    queryFn: async () => {
      const desde = new Date();
      desde.setMonth(desde.getMonth() - 11);
      desde.setDate(1);
      const { data, error } = await supabase
        .from("inscricoes")
        .select("created_at, status")
        .gte("created_at", desde.toISOString())
        .neq("status", "cancelada");
      if (error) throw error;
      return data ?? [];
    },
  });

  const meses = useMemo(() => buildMeses(12), []);

  const acoesMesData = useMemo(() => {
    const map = new Map(meses.map((m) => [m.key, { mes: m.label, eventos: 0, projetos: 0 }]));
    for (const a of acoesPorMes ?? []) {
      const k = monthKey(new Date(a.data_inicio));
      const row = map.get(k);
      if (!row) continue;
      if (a.tipo === "projeto") row.projetos++;
      else row.eventos++;
    }
    return Array.from(map.values());
  }, [acoesPorMes, meses]);

  const inscricoesMesData = useMemo(() => {
    const map = new Map(meses.map((m) => [m.key, { mes: m.label, inscricoes: 0 }]));
    for (const i of inscricoesPorMes ?? []) {
      const k = monthKey(new Date(i.created_at));
      const row = map.get(k);
      if (row) row.inscricoes++;
    }
    return Array.from(map.values());
  }, [inscricoesPorMes, meses]);

  const generosData = useMemo(
    () => (stats?.generos_detalhe ?? []).map((g: any) => ({ name: g.nome, value: g.count })),
    [stats],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da comunidade.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Por aprovar (€)" value={ops?.pendenteTotal} icon={Clock} loading={opsLoading} format="eur" to="/servicos" />
        <KpiCard label="Aprovado por pagar (€)" value={ops?.aprovadoTotal} icon={Euro} loading={opsLoading} format="eur" to="/servicos" />
        <KpiCard label="Registos pendentes" value={ops?.countPendente} icon={Clock} loading={opsLoading} to="/servicos" />
        <KpiCard label="Próximas sessões (7d)" value={ops?.proximasSessoes} icon={CalendarClock} loading={opsLoading} to="/servicos/calendario" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Participantes" value={stats?.membros_familias_total} icon={Users} loading={isLoading} />
        <KpiCard label="Famílias" value={stats?.familias_total} icon={Users2} loading={isLoading} />
        <KpiCard label="Eventos" value={stats?.eventos_total} icon={CalendarDays} loading={isLoading} />
        <KpiCard label="Projetos" value={stats?.projetos_total} icon={Briefcase} loading={isLoading} />
        <KpiCard label="Voluntários" value={stats?.voluntarios_total} icon={HeartHandshake} loading={isLoading} />
        <KpiCard label="Inscrições em eventos" value={stats?.participantes_eventos_total} icon={CalendarDays} loading={isLoading} />
        <KpiCard label="Inscrições em projetos" value={stats?.participantes_projetos_total} icon={Briefcase} loading={isLoading} />
        <KpiCard label="Atividades registadas" value={stats?.atividades_total} icon={Activity} loading={isLoading} />
      </div>

      <NovasFamiliasSection />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ações por mês</CardTitle>
            <CardDescription>Últimos 12 meses</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={acoesMesData}>
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="eventos" fill="hsl(var(--primary))" radius={4} />
                <Bar dataKey="projetos" fill="#10b981" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inscrições por mês</CardTitle>
            <CardDescription>Últimos 12 meses</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inscricoesMesData}>
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="inscricoes" fill="#8b5cf6" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por género</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {generosData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={generosData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {generosData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top atividades</CardTitle>
            <CardDescription>Mais registadas pelas famílias</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {(stats?.atividades_top ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats!.atividades_top} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" fontSize={11} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#06b6d4" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, loading, format, to }: { label: string; value: number | undefined; icon: any; loading?: boolean; format?: "eur"; to?: string }) {
  const display = loading
    ? null
    : format === "eur"
      ? new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value ?? 0)
      : String(value ?? 0);
  const inner = (
    <Card className={to ? "transition hover:border-primary/50 hover:shadow-sm" : undefined}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="mt-1 h-6 w-16" /> : <p className="truncate text-xl font-semibold">{display}</p>}
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function buildMeses(n: number) {
  const out: { key: string; label: string }[] = [];
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - (n - 1));
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  for (let i = 0; i < n; i++) {
    out.push({ key: monthKey(d), label: names[d.getMonth()] });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}