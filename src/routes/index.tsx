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
import { CalendarDays, LayoutGrid, LogIn, MapPin, ExternalLink } from "lucide-react";
import { RichTextView } from "@/components/rich-text-view";

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
        .select("id, nome, descricao, local, mapa_url, imagem_url, data_inicio, data_fim, inscricoes_abertas, projeto_ids, restrito_a_projetos, publico")
        .eq("publico", true)
        .order("data_inicio", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: meusProjetos } = useQuery({
    queryKey: ["meus_projetos", pessoa?.id],
    enabled: !!pessoa?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("projeto_ids")
        .eq("id", pessoa!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.projeto_ids as string[] | null) ?? [];
    },
  });

  const acoesVisiveis = useMemo(() => {
    const meus = new Set(meusProjetos ?? []);
    const isAdminUser = isAdmin;
    return (data ?? []).filter((a) => {
      if (!a.restrito_a_projetos) return true;
      if (isAdminUser) return true;
      const restritos = (a.projeto_ids as string[] | null) ?? [];
      if (restritos.length === 0) return true;
      return restritos.some((p) => meus.has(p));
    });
  }, [data, meusProjetos, isAdmin]);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const { proximos, passados } = useMemo(() => {
    const now = Date.now();
    const prox: typeof data = [];
    const pas: typeof data = [];
    for (const a of acoesVisiveis) {
      const fim = a.data_fim ? new Date(a.data_fim).getTime() : a.data_inicio ? new Date(a.data_inicio).getTime() : now;
      if (fim >= now - 24 * 60 * 60 * 1000) {
        prox.push(a);
      } else {
        pas.push(a);
      }
    }
    return { proximos: prox, passados: pas };
  }, [acoesVisiveis]);

  const todasAcoes = useMemo(() => [...proximos, ...passados], [proximos, passados]);

  const diasComAcao = useMemo(
    () => todasAcoes.filter((a) => a.data_inicio).map((a) => new Date(a.data_inicio!)),
    [todasAcoes],
  );

  const acoesDoDia = useMemo(() => {
    if (!selectedDate) return todasAcoes;
    const k = selectedDate.toDateString();
    return todasAcoes.filter((a) => a.data_inicio && new Date(a.data_inicio).toDateString() === k);
  }, [todasAcoes, selectedDate]);

  const acoesPorDia = useMemo(() => {
    const map = new Map<string, typeof todasAcoes>();
    for (const a of todasAcoes) {
      if (!a.data_inicio) continue;
      const k = new Date(a.data_inicio).toDateString();
      const arr = map.get(k) ?? [];
      arr.push(a);
      map.set(k, arr);
    }
    return map;
  }, [todasAcoes]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="border-b">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Meeru</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/resultados" className="hidden text-xs font-medium text-muted-foreground hover:text-foreground sm:inline">
              Resultados
            </Link>
            {session ? (
              <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={() => navigate({ to: isAdmin ? "/participantes" : "/perfil" })}>
                {pessoa?.nome_completo?.split(" ")[0] ?? "Área pessoal"}
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={() => navigate({ to: "/login" })}>
                <LogIn className="mr-2 h-4 w-4" /> Entrar
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 md:py-8">
        <section className="rounded-lg border bg-card/50 p-6 md:p-10">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Bem-vindo à Meeru</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
            A Meeru é uma comunidade que organiza encontros, atividades e projetos para aproximar pessoas e famílias.
            Explora as próximas ações abaixo e inscreve-te naquelas que fizerem sentido para ti.
          </p>
          {!session && (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigate({ to: "/login" })}>
                <LogIn className="mr-2 h-4 w-4" /> Entrar / Registar
              </Button>
            </div>
          )}
        </section>

        <div>
          <h2 className="text-2xl font-semibold md:text-3xl">Ações da comunidade</h2>
          <p className="text-sm text-muted-foreground">Próximas e passadas.</p>
        </div>

        <Tabs defaultValue="galeria">
          <TabsList>
            <TabsTrigger value="galeria"><LayoutGrid className="mr-2 h-4 w-4" /> Galeria</TabsTrigger>
            <TabsTrigger value="calendario"><CalendarDays className="mr-2 h-4 w-4" /> Calendário</TabsTrigger>
          </TabsList>

          <TabsContent value="galeria" className="mt-4 space-y-8">
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
              </div>
            ) : (
              <>
                <section>
                  <h2 className="mb-3 text-xl font-semibold">Próximos eventos</h2>
                  {proximos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem ações abertas no momento.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {proximos.map((a) => <AcaoCard key={a.id} acao={a} />)}
                    </div>
                  )}
                </section>

                <section>
                  <h2 className="mb-3 text-xl font-semibold">Eventos passados</h2>
                  {passados.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem eventos passados.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {passados.map((a) => <AcaoCard key={a.id} acao={a} passado />)}
                    </div>
                  )}
                </section>
              </>
            )}
          </TabsContent>

          <TabsContent value="calendario" className="mt-4">
            <div className="space-y-6">
              <div className="rounded-md border p-3">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  modifiers={{ acao: diasComAcao }}
                  modifiersClassNames={{ acao: "font-semibold text-primary" }}
                  className="w-full [--cell-size:2.75rem] sm:[--cell-size:5.5rem] md:[--cell-size:7rem]"
                  classNames={{
                    months: "relative flex w-full flex-col gap-4",
                    month: "flex w-full flex-col gap-4",
                    table: "w-full border-collapse table-fixed",
                    day: "group/day relative h-(--cell-size) w-full select-none p-0 text-left align-top",
                  }}
                  components={{
                    DayButton: ({ day, modifiers, className: btnClass, ...btnProps }) => {
                      const list = acoesPorDia.get(day.date.toDateString()) ?? [];
                      return (
                        <button
                          {...btnProps}
                          data-selected-single={
                            modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle
                          }
                          className={
                            "flex h-full w-full flex-col items-stretch gap-0.5 rounded-md border border-transparent p-0.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[selected-single=true]:border-primary data-[selected-single=true]:bg-primary/10 sm:gap-1 sm:p-1 " +
                            (modifiers.today ? "bg-accent/40 " : "") +
                            (btnClass ?? "")
                          }
                        >
                          <span className={"text-[11px] font-medium sm:text-xs " + (list.length > 0 ? "text-primary" : "text-muted-foreground")}>
                            {day.date.getDate()}
                          </span>
                          <div className="hidden flex-1 flex-col gap-0.5 overflow-hidden sm:flex">
                            {list.slice(0, 3).map((a) => (
                              <span
                                key={a.id}
                                title={a.nome}
                                className="truncate rounded-sm bg-primary/15 px-1 py-0.5 text-[10px] font-medium leading-tight text-primary"
                              >
                                {a.nome}
                              </span>
                            ))}
                            {list.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">+{list.length - 3}</span>
                            )}
                          </div>
                          {list.length > 0 && (
                            <span className="mx-auto mt-auto h-1 w-1 rounded-full bg-primary sm:hidden" />
                          )}
                        </button>
                      );
                    },
                  }}
                />
                {selectedDate && (
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSelectedDate(undefined)}>
                    Limpar filtro
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {acoesDoDia.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem ações neste dia.</p>
                ) : (
                  acoesDoDia.map((a) => <AcaoCard key={a.id} acao={a} passado={passados.some((p) => p.id === a.id)} />)
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function AcaoCard({ acao, passado }: { acao: any; passado?: boolean }) {
  return (
    <Card className={"overflow-hidden " + (passado ? "opacity-70" : "")}>
      {acao.imagem_url && (
        <img src={acao.imagem_url} alt={acao.nome} className="h-36 w-full object-cover" />
      )}
      <CardHeader>
        <CardTitle className="text-lg">{acao.nome}</CardTitle>
        <CardDescription>
          {acao.data_inicio ? new Date(acao.data_inicio).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" }) : "Sem data"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {(acao.local || acao.mapa_url) && (
          <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {acao.local && <span>{acao.local}</span>}
            {acao.mapa_url && (
              <a
                href={acao.mapa_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Mapa <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </p>
        )}
        {acao.descricao && <RichTextView className="line-clamp-3 text-muted-foreground" html={acao.descricao} />}
        {passado ? (
          <Link to="/acao/$id" params={{ id: acao.id }}>
            <Button size="sm" className="w-full" variant="secondary">Ver resumo</Button>
          </Link>
        ) : acao.inscricoes_abertas ? (
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
