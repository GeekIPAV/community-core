import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
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
import { EmailPedidosAjudaSection } from "@/components/email-pedidos-ajuda-section";

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
      const { data, error } = await supabase.rpc("get_estatisticas_publicas");
      if (error) throw error;
      return data as unknown as {
        membros_familias_total?: number;
        familias_total?: number;
        eventos_total?: number;
        projetos_total?: number;
        voluntarios_total?: number;
        participantes_eventos_total?: number;
        participantes_projetos_total?: number;
        atividades_total?: number;
        generos_detalhe?: { nome: string; count: number }[];
        atividades_top?: { nome: string; count: number }[];
      };
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

  const hoje = new Date();
  const meses = useMemo(
    () => buildMeses(12),
    // Re-compute when the month changes (day-of-month is enough as proxy)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hoje.getFullYear(), hoje.getMonth()],
  );

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

      <NovasPessoasSemFamiliaSection />

      <EmailPedidosAjudaSection />

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

function KpiCard({ label, value, icon: Icon, loading, format, to }: { label: string; value: number | undefined; icon: React.ComponentType<{ className?: string }>; loading?: boolean; format?: "eur"; to?: string }) {
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

function NovasFamiliasSection() {
  const [selected, setSelected] = useState<Familia | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard", "novas-familias"],
    queryFn: async () => {
      const desde = new Date();
      desde.setMonth(desde.getMonth() - 1);
      const { data: fams, error } = await supabase
        .from("familias")
        .select("id, nome, notas, status, contacto_meeru_id, updated_at, created_at")
        .is("deleted_at", null)
        .gte("created_at", desde.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (fams ?? []).map((f: any) => f.id);
      let membrosByFam = new Map<string, { id: string; nome_completo: string }[]>();
      if (ids.length) {
        const { data: ps } = await supabase
          .from("pessoas")
          .select("id, nome_completo, familia_id")
          .in("familia_id", ids)
          .eq("status", "ativo");
        for (const p of ps ?? []) {
          const arr = membrosByFam.get((p as any).familia_id) ?? [];
          arr.push({ id: (p as any).id, nome_completo: (p as any).nome_completo });
          membrosByFam.set((p as any).familia_id, arr);
        }
      }
      return (fams ?? []).map((f: any) => ({ ...f, membros: membrosByFam.get(f.id) ?? [] }));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novas famílias inscritas</CardTitle>
        <CardDescription>Famílias registadas no último mês — clica para editar dados e membros</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Sem novas famílias no último mês.</p>
        ) : (
          <ul className="divide-y">
            {data!.map((f: any) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{f.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(f.created_at).toLocaleDateString("pt-PT")} ·{" "}
                    {f.membros.length === 0
                      ? "Sem membros"
                      : f.membros.map((m: any) => m.nome_completo).join(", ")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelected({
                      id: f.id,
                      nome: f.nome,
                      notas: f.notas,
                      status: f.status,
                      contacto_meeru_id: f.contacto_meeru_id,
                      updated_at: f.updated_at,
                    });
                    setOpen(true);
                  }}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <FamilyDetailDialog
        family={selected}
        open={open}
        onClose={() => setOpen(false)}
        onUpdate={() => refetch()}
        defaultTab="membros"
      />
    </Card>
  );
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

function NovasPessoasSemFamiliaSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "novas-pessoas-sem-familia"],
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - 14);
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, telefone, created_at")
        .is("familia_id", null)
        .eq("status", "ativo")
        .gte("created_at", desde.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novas pessoas sem família</CardTitle>
        <CardDescription>Inscritas nas últimas 2 semanas e ainda sem família associada</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Sem novas pessoas sem família.</p>
        ) : (
          <ul className="divide-y">
            {data!.map((p: any) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.nome_completo}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("pt-PT")}
                    {p.email ? ` · ${p.email}` : ""}
                    {p.telefone ? ` · ${p.telefone}` : ""}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/participantes" search={{ q: p.nome_completo } as any}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Abrir
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}