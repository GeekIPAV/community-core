import { createFileRoute, Link, useNavigate, type SearchSchemaInput } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/lib/auth-context";
import { CalendarDays, LayoutGrid, LogIn, Search, Sparkles, ArrowDown } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AcaoCard } from "@/components/acao-card";
import { CABIN_FONT_LINK } from "@/components/acao-cover";
import { AcaoFeatured } from "@/components/acao-featured";
import { acaoPresentation } from "@/lib/acao-presentation";
import { INITIAL_MEMORY_COUNT, matchesGalleryFilters, type GalleryFilters } from "@/lib/acao-gallery";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/")({
  validateSearch: (search: SearchSchemaInput & { tipo?: string; pesquisa?: string; abertas?: boolean | string; memoria?: number; vista?: string }) => ({
    tipo: typeof search.tipo === "string" ? search.tipo : "",
    pesquisa: typeof search.pesquisa === "string" ? search.pesquisa : "",
    abertas: search.abertas === true || search.abertas === "true",
    memoria: Math.max(INITIAL_MEMORY_COUNT, Math.floor(Number(search.memoria) || INITIAL_MEMORY_COUNT)),
    vista: search.vista === "calendario" ? "calendario" as const : "galeria" as const,
  }),
  head: () => ({
    meta: [
      { title: "Ações da comunidade — MEERU" },
      { name: "description", content: "Encontros, oficinas e momentos para fazer comunidade no Porto e além. Descobre as ações da MEERU e participa." },
      { property: "og:title", content: "Ações da comunidade — MEERU" },
      { property: "og:description", content: "Encontros, oficinas e momentos para fazer comunidade no Porto e além." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [CABIN_FONT_LINK],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate({ from: "/" });
  const search = Route.useSearch();
  const updateFilters = (values: Partial<GalleryFilters>) => {
    void navigate({ to: "/", search: (prev) => ({ ...prev, ...values, memoria: INITIAL_MEMORY_COUNT }), replace: true, resetScroll: false });
  };
  const clearFilters = () => updateFilters({ tipo: "", pesquisa: "", abertas: false });
  const { session, pessoa, isAdmin } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["acoes_publicas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes")
        .select("id, nome, descricao, local, mapa_url, imagem_url, imagem_position, data_inicio, data_fim, inscricoes_abertas, projeto_ids, restrito_a_projetos, publico, participantes_extra, tipo_acao:tipos_acao(id, nome)")
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
        .eq("id", pessoa?.id ?? "")
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

  const { proximos, passados, semData } = useMemo(() => {
    const now = Date.now();
    const prox: typeof data = [];
    const pas: typeof data = [];
    const sem: typeof data = [];
    for (const a of acoesVisiveis) {
      const fim = a.data_fim ? new Date(a.data_fim).getTime() : a.data_inicio ? new Date(a.data_inicio).getTime() : null;
      if (fim === null) {
        sem.push(a);
      } else if (fim >= now - 24 * 60 * 60 * 1000) {
        prox.push(a);
      } else {
        pas.push(a);
      }
    }
    prox.sort((a, b) => {
      const ta = a.data_inicio ? new Date(a.data_inicio).getTime() : new Date(a.data_fim ?? "").getTime();
      const tb = b.data_inicio ? new Date(b.data_inicio).getTime() : new Date(b.data_fim ?? "").getTime();
      return ta - tb;
    });
    pas.sort((a, b) => {
      const ta = a.data_fim ? new Date(a.data_fim).getTime() : new Date(a.data_inicio ?? "").getTime();
      const tb = b.data_fim ? new Date(b.data_fim).getTime() : new Date(b.data_inicio ?? "").getTime();
      return tb - ta;
    });
    return { proximos: prox, passados: pas, semData: sem };
  }, [acoesVisiveis]);

  const countIds = useMemo(() => passados.map((a) => a.id).sort(), [passados]);
  const { data: participantCounts, isError: countsError, refetch: retryCounts } = useQuery({
    queryKey: ["public_action_participant_counts", countIds, pessoa?.id, isAdmin],
    enabled: countIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_action_participant_counts", { p_action_ids: countIds });
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.acao_id, Number(row.participantes)]));
    },
  });

  const tipos = useMemo(() => {
    const map = new Map<string, NonNullable<(typeof acoesVisiveis)[number]["tipo_acao"]>>();
    for (const acao of acoesVisiveis) if (acao.tipo_acao) map.set(acao.tipo_acao.id, acao.tipo_acao);
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  }, [acoesVisiveis]);
  const destaque = proximos[0];
  const proximosFiltrados = proximos.slice(1).filter((a) => matchesGalleryFilters(a, search));
  const semDataFiltrados = semData.filter((a) => matchesGalleryFilters(a, search));
  const passadosFiltrados = passados.filter((a) => matchesGalleryFilters(a, search));
  const hasFilters = Boolean(search.tipo || search.abertas || search.pesquisa.trim());
  const noResults = hasFilters && proximosFiltrados.length + semDataFiltrados.length + passadosFiltrados.length === 0;

  const todasAcoes = useMemo(() => [...proximos, ...passados, ...semData], [proximos, passados, semData]);

  const diasComAcao = useMemo(
    () => todasAcoes.filter((a) => a.data_inicio).map((a) => new Date(a.data_inicio ?? "")),
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
    <SidebarProvider>
      <div className="public-actions-theme flex min-h-screen w-full bg-background">
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
      <header className="border-b">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="hidden md:inline-flex" />
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
        <div className="relative overflow-hidden border-b border-border pb-8 pt-4 md:pb-10 md:pt-6">
          <svg aria-hidden="true" viewBox="0 0 120 120" className="absolute right-0 top-0 h-20 w-20 text-secondary md:h-32 md:w-32"><path d="M0 0H120V120A120 120 0 0 1 0 0Z" fill="currentColor" /></svg>
          <div className="relative max-w-3xl pr-12 md:pr-20">
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">Ações da comunidade</h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">Encontros, oficinas e momentos para fazer comunidade no Porto e além.</p>
          </div>
        </div>

        {isLoading ? <Skeleton className="h-80 w-full" /> : destaque ? (
          <AcaoFeatured acao={destaque} />
        ) : (
          <section className={`grid items-start gap-6 ${passados[0] ? "lg:grid-cols-[1fr_2fr]" : ""}`} aria-label="Novas ações em breve">
            <div className="flex items-start gap-4 border-l-4 border-secondary py-2 pl-5">
              <Sparkles className="mt-1 h-7 w-7 shrink-0 text-secondary" aria-hidden="true" />
              <div><h2 className="text-2xl font-bold">Novas ações em breve</h2><p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">Estamos a preparar os próximos encontros. Entretanto, revê o que já vivemos juntos.</p></div>
            </div>
            {passados[0] && <AcaoFeatured acao={passados[0]} passado participantes={participantCounts?.[passados[0].id]} />}
          </section>
        )}

        <Tabs value={search.vista} onValueChange={(vista) => { void navigate({ to: "/", search: (prev) => ({ ...prev, vista: vista === "calendario" ? "calendario" : "galeria" }), replace: true, resetScroll: false }); }}>
          <TabsList>
            <TabsTrigger value="galeria"><LayoutGrid className="mr-2 h-4 w-4" /> Galeria</TabsTrigger>
            <TabsTrigger value="calendario"><CalendarDays className="mr-2 h-4 w-4" /> Calendário</TabsTrigger>
          </TabsList>

          <TabsContent value="galeria" className="mt-4 space-y-8">
            <div className="min-w-0 space-y-4 border-b pb-5">
              <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Filtrar por tipo de ação">
                <Button variant="outline" aria-pressed={!search.tipo} onClick={() => updateFilters({ tipo: "" })} className={`shrink-0 gap-2 rounded-none ${!search.tipo ? "acao-chip-ink" : ""}`}><LayoutGrid className="h-4 w-4" />Todas</Button>
                {tipos.map((tipo) => {
                  const { Icon, tone } = acaoPresentation(tipo);
                  return <Button key={tipo.id} variant="outline" aria-pressed={search.tipo === tipo.id} onClick={() => updateFilters({ tipo: tipo.id })} className={`shrink-0 gap-2 rounded-none ${tone} ${search.tipo === tipo.id ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}><Icon className="h-4 w-4" />{tipo.nome}</Button>;
                })}
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Pesquisar por nome ou local" placeholder="Pesquisar por nome ou local" value={search.pesquisa} onChange={(event) => updateFilters({ pesquisa: event.target.value })} className="h-10 rounded-none bg-card pl-9" /></div>
                <label className="flex cursor-pointer items-center gap-3 text-sm font-medium"><Switch checked={search.abertas} onCheckedChange={(abertas) => updateFilters({ abertas })} aria-label="Só com inscrições abertas" />Só com inscrições abertas</label>
              </div>
            </div>
            {isLoading ? (
              <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
              </div>
            ) : (
              <>
                {noResults && <div className="space-y-3 border-y py-8 text-center" role="status"><p className="text-muted-foreground">Não encontrámos ações com estes filtros.</p><Button variant="outline" onClick={clearFilters}>Limpar filtros</Button></div>}
                {proximosFiltrados.length > 0 && <section>
                  <h2 className="mb-3 text-xl font-semibold">Próximas ações</h2>
                    <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      {proximosFiltrados.map((a) => <AcaoCard key={a.id} acao={a} />)}
                    </div>
                </section>}

                {semDataFiltrados.length > 0 && <section>
                  <h2 className="mb-3 text-xl font-semibold">Data a definir</h2>
                    <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      {semDataFiltrados.map((a) => <AcaoCard key={a.id} acao={a} />)}
                    </div>
                </section>}

                {passadosFiltrados.length > 0 && <section aria-label="Memória da comunidade">
                  <h2 className="text-xl font-semibold">Memória da comunidade</h2>
                  <p className="mb-4 mt-1 text-sm text-muted-foreground">Momentos que vivemos juntos.</p>
                  {countsError && <p role="alert" className="mb-4 text-sm text-muted-foreground">Não foi possível carregar a contagem de participantes. <Button variant="link" onClick={() => void retryCounts()}>Tentar novamente</Button></p>}
                    <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      {passadosFiltrados.slice(0, search.memoria).map((a) => <AcaoCard key={a.id} acao={a} passado participantes={participantCounts?.[a.id]} />)}
                    </div>
                    {passadosFiltrados.length > search.memoria && <div className="mt-6 flex justify-center"><Button variant="outline" className="gap-2" onClick={() => { void navigate({ to: "/", search: (prev) => ({ ...prev, memoria: prev.memoria + INITIAL_MEMORY_COUNT }), replace: true, resetScroll: false }); }}>Ver mais<ArrowDown className="h-4 w-4" /></Button></div>}
                </section>}
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
                        <Button
                          variant="ghost"
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
                        </Button>
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
              <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {acoesDoDia.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem ações neste dia.</p>
                ) : (
                  acoesDoDia.map((a) => <AcaoCard key={a.id} acao={a} passado={passados.some((p) => p.id === a.id)} participantes={participantCounts?.[a.id]} />)
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

