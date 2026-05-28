import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  "#6366f1", // indigo
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#ec4899", // pink
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#ef4444", // red
  "#14b8a6", // teal
  "#f97316", // orange
  "#3b82f6", // blue
];

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
          <Conteudo data={data} />
        ) : null}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Conteudo({ data }: { data: Estatisticas }) {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={<HeartHandshake className="h-5 w-5" />} label="Voluntários" value={data.voluntarios_total} />
        <KPI icon={<Home className="h-5 w-5" />} label="Famílias" value={data.familias_total} sub={`${data.membros_familias_total} membros`} />
        <KPI icon={<Calendar className="h-5 w-5" />} label="Eventos" value={data.eventos_total} sub={`${data.participantes_eventos_total} participações`} />
        <KPI icon={<FolderKanban className="h-5 w-5" />} label="Projetos" value={data.projetos_total} sub={`${data.participantes_projetos_total} participações`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por género</CardTitle>
            <CardDescription>Pessoas ativas com género declarado</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <PieGrafico data={data.generos_detalhe} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Religiões</CardTitle>
            <CardDescription>{data.religioes_total} religiões representadas</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <PieGrafico data={data.religioes_detalhe} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Globe2 className="h-4 w-4" /> Nacionalidades</CardTitle>
            <CardDescription>{data.nacionalidades_total} nacionalidades</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <BarGrafico data={data.nacionalidades_detalhe.map((n) => ({ name: n.nome, value: n.count }))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Participantes por projeto</CardTitle>
            <CardDescription>Total de inscrições ativas em projetos</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <BarGrafico data={data.projetos_detalhe.map((p) => ({ name: p.nome, value: p.participantes }))} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPI({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2 text-xs">{icon} {label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function PieGrafico({ data }: { data: { nome: string; count: number }[] }) {
  if (!data || data.length === 0) {
    return <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados</p>;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="nome"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={(entry: { nome: string }) => entry.nome}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function BarGrafico({ data }: { data: { name: string; value: number }[] }) {
  if (!data || data.length === 0) {
    return <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados</p>;
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
        />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
        />
        <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
