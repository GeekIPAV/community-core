import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/lib/auth-context";
import { CalendarDays, LayoutGrid, LogIn, MapPin } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meeru — Comunidade" },
      { name: "description", content: "Inscreve-te nas próximas ações da comunidade Meeru." },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const { session, pessoa, isAdmin } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["acoes_publicas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes")
        .select("id, nome, descricao, local, data_inicio, data_fim, inscricoes_abertas")
        .order("data_inicio", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const acoesAbertas = useMemo(() => {
    const now = Date.now();
    return (data ?? []).filter((a) => {
      if (!a.data_inicio) return true;
      const ini = new Date(a.data_inicio).getTime();
      return ini >= now - 24 * 60 * 60 * 1000;
    });
  }, [data]);

  const diasComAcao = useMemo(
    () => acoesAbertas.filter((a) => a.data_inicio).map((a) => new Date(a.data_inicio!)),
    [acoesAbertas],
  );

  const acoesDoDia = useMemo(() => {
    if (!selectedDate) return acoesAbertas;
    const k = selectedDate.toDateString();
    return acoesAbertas.filter((a) => a.data_inicio && new Date(a.data_inicio).toDateString() === k);
  }, [acoesAbertas, selectedDate]);

  const acoesPorDia = useMemo(() => {
    const map = new Map<string, typeof acoesAbertas>();
    for (const a of acoesAbertas) {
      if (!a.data_inicio) continue;
      const k = new Date(a.data_inicio).toDateString();
      const arr = map.get(k) ?? [];
      arr.push(a);
      map.set(k, arr);
    }
    return map;
  }, [acoesAbertas]);

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

      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-3xl font-semibold">Próximas ações</h1>
          <p className="text-sm text-muted-foreground">Escolhe uma ação e inscreve-te.</p>
        </div>

        <Tabs defaultValue="galeria">
          <TabsList>
            <TabsTrigger value="galeria"><LayoutGrid className="mr-2 h-4 w-4" /> Galeria</TabsTrigger>
            <TabsTrigger value="calendario"><CalendarDays className="mr-2 h-4 w-4" /> Calendário</TabsTrigger>
          </TabsList>

          <TabsContent value="galeria" className="mt-4">
            {isLoading ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
              </div>
            ) : acoesAbertas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem ações abertas no momento.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {acoesAbertas.map((a) => <AcaoCard key={a.id} acao={a} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendario" className="mt-4">
            <div className="grid gap-6 md:grid-cols-[auto,1fr]">
              <div className="rounded-md border p-3">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  modifiers={{ acao: diasComAcao }}
                  modifiersClassNames={{ acao: "bg-primary/15 font-semibold text-primary" }}
                />
                {selectedDate && (
                  <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setSelectedDate(undefined)}>
                    Limpar filtro
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {acoesDoDia.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem ações neste dia.</p>
                ) : (
                  acoesDoDia.map((a) => <AcaoCard key={a.id} acao={a} />)
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AcaoCard({ acao }: { acao: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{acao.nome}</CardTitle>
        <CardDescription>
          {acao.data_inicio ? new Date(acao.data_inicio).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" }) : "Sem data"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {acao.local && (
          <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /> {acao.local}</p>
        )}
        {acao.descricao && <p className="line-clamp-3 text-muted-foreground">{acao.descricao}</p>}
        {acao.inscricoes_abertas ? (
          <Link to="/acao/$id" params={{ id: acao.id }}>
            <Button size="sm" className="w-full">Ver e inscrever</Button>
          </Link>
        ) : (
          <Button size="sm" className="w-full" variant="outline" disabled>
            Inscrições fechadas
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
