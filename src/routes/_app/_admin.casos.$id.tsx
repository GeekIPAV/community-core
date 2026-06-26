import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Calendar, CalendarCheck, Clock,
  User, UserPlus, ArrowRightLeft, CheckCircle2, Archive, Plus, MessageCircle, FileText,
  Phone, Users as UsersIcon, RefreshCw, MessagesSquare, Eye, EyeOff, Mail, Trash2, StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

export const Route = createFileRoute("/_app/_admin/casos/$id")({
  component: CasoDetailPage,
});

const ESTADOS = ["Novo", "Em análise", "Em curso", "Em pausa", "Concluído", "Arquivado"];
const PRIORIDADES = ["Alta", "Normal", "Baixa"];
const TIPOS_REGISTO = [
  "Nota interna", "Contacto", "Reunião", "Documento",
  "Encaminhamento", "Atualização de estado", "Resposta da pessoa",
] as const;

const TIPO_ICONE: Record<string, any> = {
  "Nota interna": StickyNote,
  "Contacto": Phone,
  "Reunião": UsersIcon,
  "Documento": FileText,
  "Encaminhamento": ArrowRightLeft,
  "Atualização de estado": RefreshCw,
  "Resposta da pessoa": MessagesSquare,
};

function CasoDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { pessoa: ctxPessoa } = useAuth();
  const [verComoPessoa, setVerComoPessoa] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [concludeOpen, setConcludeOpen] = useState(false);

  // Caso
  const { data: caso, isLoading } = useQuery({
    queryKey: ["caso", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("casos_apoio" as any)
        .select(`
          *,
          pessoa:pessoas!casos_apoio_pessoa_id_fkey(id, nome_completo, telefone, email, familia:familias(id, nome)),
          familia:familias!casos_apoio_familia_id_fkey(id, nome, pessoas(id, nome_completo, telefone, email)),
          mediadora:pessoas!casos_apoio_mediadora_id_fkey(id, nome_completo)
        `)
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // Registos
  const { data: registos = [] } = useQuery({
    queryKey: ["caso-registos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caso_registos" as any)
        .select("*, autor:pessoas(nome_completo)")
        .eq("caso_id", id).order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Objetivos
  const { data: objetivos = [] } = useQuery({
    queryKey: ["caso-objetivos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caso_objetivos" as any)
        .select("*").eq("caso_id", id).order("position");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Transferências
  const { data: transferencias = [] } = useQuery({
    queryKey: ["caso-transferencias", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caso_transferencias" as any)
        .select("*, saida:pessoas!caso_transferencias_mediadora_saida_id_fkey(nome_completo), entrada:pessoas!caso_transferencias_mediadora_entrada_id_fkey(nome_completo)")
        .eq("caso_id", id).order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: equipa = [] } = useQuery({
    queryKey: ["equipa-mediadoras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, is_admin, tipos_user!inner(nome)")
        .eq("status", "ativo").not("auth_user_id", "is", null);
      if (error) throw error;
      return ((data ?? []) as any[])
        .filter((p) => p.is_admin || p.tipos_user?.nome?.toLowerCase() === "equipa")
        .map((p) => ({ id: p.id as string, nome_completo: p.nome_completo as string }));
    },
  });

  const updateCaso = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("casos_apoio" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caso", id] });
      qc.invalidateQueries({ queryKey: ["caso-registos", id] });
      qc.invalidateQueries({ queryKey: ["casos"] });
      qc.invalidateQueries({ queryKey: ["sidebar-badge", "count_casos_novos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const visibleRegistos = useMemo(
    () => verComoPessoa ? registos.filter((r) => r.visivel_para_pessoa) : registos,
    [registos, verComoPessoa]
  );

  const objetivosDone = objetivos.filter((o) => o.estado === "Concluído").length;
  const objetivosPct = objetivos.length > 0 ? Math.round((objetivosDone / objetivos.length) * 100) : 0;
  const diasAberto = caso?.data_abertura
    ? Math.max(0, Math.floor((Date.now() - new Date(caso.data_abertura).getTime()) / 86400000))
    : 0;

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">A carregar…</div>;
  if (!caso) return <div className="p-6 text-sm text-muted-foreground">Caso não encontrado.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/casos" })}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Acompanhamento
          </Button>
          <span>·</span>
          <span className="font-mono">{caso.numero}</span>
          <span>·</span>
          <span className="truncate">{caso.titulo}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* SIDEBAR */}
        <div className="space-y-4 lg:sticky lg:top-4 self-start">
          <Card className="p-4 space-y-3">
            <div className="font-mono text-xs text-muted-foreground">{caso.numero}</div>
            <InlineText
              value={caso.titulo}
              onSave={(v) => updateCaso.mutate({ titulo: v })}
              className="text-lg font-semibold"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{caso.area}</Badge>
              <Select value={caso.estado} onValueChange={(v) => updateCaso.mutate({ estado: v })}>
                <SelectTrigger className="h-7 w-auto px-2 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={caso.prioridade} onValueChange={(v) => updateCaso.mutate({ prioridade: v })}>
                <SelectTrigger className="h-7 w-auto px-2 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Badge variant={caso.origem === "Auto-pedido" ? "default" : "secondary"} className="font-normal">
              {caso.origem}
            </Badge>
          </Card>

          <Card className="p-4 space-y-3 text-sm">
            {caso.pessoa ? (
              <>
                <div className="font-medium">{caso.pessoa?.nome_completo}</div>
                {caso.pessoa?.familia?.nome && (
                  <div className="text-xs text-muted-foreground">{caso.pessoa.familia.nome}</div>
                )}
                {caso.pessoa?.telefone && (
                  <a href={`tel:${caso.pessoa.telefone}`} className="flex items-center gap-2 text-xs hover:underline">
                    <Phone className="h-3.5 w-3.5" /> {caso.pessoa.telefone}
                  </a>
                )}
                {caso.pessoa?.email && (
                  <a href={`mailto:${caso.pessoa.email}`} className="flex items-center gap-2 text-xs hover:underline">
                    <Mail className="h-3.5 w-3.5" /> {caso.pessoa.email}
                  </a>
                )}
              </>
            ) : caso.familia ? (
              <>
                <div className="flex items-center gap-2 font-medium">
                  <UsersIcon className="h-4 w-4 text-muted-foreground" />
                  Família {caso.familia.nome}
                </div>
                <div className="text-xs text-muted-foreground">
                  Apoio a {caso.familia.pessoas?.length ?? 0} pessoa(s)
                </div>
                {(caso.familia.pessoas ?? []).length > 0 && (
                  <ul className="space-y-1 pt-1 border-t">
                    {(caso.familia.pessoas as any[]).map((m) => (
                      <li key={m.id} className="flex items-center justify-between text-xs">
                        <span className="truncate">{m.nome_completo}</span>
                        {m.telefone && (
                          <a href={`tel:${m.telefone}`} className="text-muted-foreground hover:underline ml-2 shrink-0">
                            {m.telefone}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Sem alvo associado</div>
            )}
          </Card>

          <Card className="p-4 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Mediadora</div>
                <Select
                  value={caso.mediadora_id ?? "_none"}
                  onValueChange={(v) => updateCaso.mutate({ mediadora_id: v === "_none" ? null : v })}
                >
                  <SelectTrigger className={cn("h-8 mt-1", !caso.mediadora_id && "text-amber-600 dark:text-amber-300")}>
                    <SelectValue placeholder="Por atribuir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Por atribuir —</SelectItem>
                    {equipa.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome_completo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Abertura: {new Date(caso.data_abertura).toLocaleDateString("pt-PT")}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="date"
                className="h-7 text-xs"
                value={caso.data_prevista_conclusao ?? ""}
                onChange={(e) => updateCaso.mutate({ data_prevista_conclusao: e.target.value || null })}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Aberto há {diasAberto} {diasAberto === 1 ? "dia" : "dias"}</span>
            </div>
          </Card>

          <Card className="p-4 space-y-2">
            <Label className="text-xs">Objetivo do caso</Label>
            <InlineText
              value={caso.objetivo ?? ""}
              onSave={(v) => updateCaso.mutate({ objetivo: v || null })}
              multiline
              placeholder="Sem objetivo definido"
              className="text-sm"
            />
          </Card>

          {objetivos.length > 0 && (
            <Card className="p-4 space-y-2">
              <div className="text-xs text-muted-foreground">
                Objetivos: <span className="font-medium text-foreground">{objetivosDone}/{objetivos.length} concluídos</span>
              </div>
              <Progress value={objetivosPct} className="h-1.5" />
            </Card>
          )}

          <div className="space-y-2">
            <Button className="w-full" onClick={() => setTransferOpen(true)} variant="outline">
              <ArrowRightLeft className="mr-2 h-4 w-4" /> Transferir caso
            </Button>
            {!["Concluído", "Arquivado"].includes(caso.estado) && (
              <Button className="w-full" onClick={() => setConcludeOpen(true)} variant="ghost">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Concluir caso
              </Button>
            )}
            <Button
              className="w-full text-destructive hover:text-destructive"
              variant="ghost" size="sm"
              onClick={() => {
                if (confirm("Arquivar este caso?")) updateCaso.mutate({ estado: "Arquivado" });
              }}
            >
              <Archive className="mr-2 h-3.5 w-3.5" /> Arquivar
            </Button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="min-w-0">
          <Tabs defaultValue="registos" className="space-y-4">
            <TabsList>
              <TabsTrigger value="registos">Registos</TabsTrigger>
              <TabsTrigger value="objetivos">Objetivos</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="transferencias">Transferências</TabsTrigger>
            </TabsList>

            <TabsContent value="registos" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <Switch id="ver-pessoa" checked={verComoPessoa} onCheckedChange={setVerComoPessoa} />
                  <Label htmlFor="ver-pessoa" className="cursor-pointer">Ver como a pessoa vê</Label>
                </div>
              </div>
              {verComoPessoa && (
                <div className="rounded-md border border-blue-300 bg-blue-50 dark:bg-blue-950/20 p-2 text-xs text-blue-900 dark:text-blue-200">
                  Estás a ver o que {caso.pessoa?.nome_completo ?? `a família ${caso.familia?.nome ?? ""}`} vê.
                </div>
              )}
              <div className="space-y-3">
                {visibleRegistos.length === 0 && (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Sem registos ainda.
                  </div>
                )}
                {visibleRegistos.map((r) => <RegistoCard key={r.id} registo={r} casoId={id} />)}
              </div>
              <RegistoCompose casoId={id} autorId={ctxPessoa?.id ?? null} />
            </TabsContent>

            <TabsContent value="objetivos">
              <ObjetivosTab casoId={id} objetivos={objetivos} />
            </TabsContent>

            <TabsContent value="timeline">
              <TimelineTab registos={registos} transferencias={transferencias} />
            </TabsContent>

            <TabsContent value="transferencias">
              <TransferenciasTab transferencias={transferencias} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <TransferSheet
        open={transferOpen}
        onOpenChange={setTransferOpen}
        casoId={id}
        caso={caso}
        equipa={equipa}
        autorId={ctxPessoa?.id ?? null}
      />
      <ConcludeDialog
        open={concludeOpen}
        onOpenChange={setConcludeOpen}
        casoId={id}
        objetivos={objetivos}
      />
    </div>
  );
}

// ---- subcomponents ----

function InlineText({
  value, onSave, multiline, placeholder, className,
}: { value: string; onSave: (v: string) => void; multiline?: boolean; placeholder?: string; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setV(value); setEditing(true); }}
        className={cn(
          "block w-full text-left hover:bg-accent/40 rounded px-1 -mx-1",
          !value && "text-muted-foreground italic",
          className
        )}
      >
        {value || placeholder || "—"}
      </button>
    );
  }
  const commit = () => { setEditing(false); if (v !== value) onSave(v.trim()); };
  return multiline ? (
    <Textarea
      autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={commit}
      rows={3} className={className}
    />
  ) : (
    <Input
      autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }}
      className={cn("h-8", className)}
    />
  );
}

function RegistoCard({ registo, casoId }: { registo: any; casoId: string }) {
  const qc = useQueryClient();
  const Icon = TIPO_ICONE[registo.tipo] ?? StickyNote;
  const isNotaInterna = registo.tipo === "Nota interna";
  const isResposta = registo.tipo === "Resposta da pessoa";

  const toggleVis = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("caso_registos" as any)
        .update({ visivel_para_pessoa: !registo.visivel_para_pessoa }).eq("id", registo.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["caso-registos", casoId] }),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("caso_registos" as any).delete().eq("id", registo.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["caso-registos", casoId] }),
  });

  return (
    <div className={cn(
      "rounded-lg border border-border/60 p-4 space-y-2",
      isNotaInterna && "border-l-2 border-l-amber-300",
      isResposta && "border-l-2 border-l-blue-300",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 font-normal">
            <Icon className="h-3 w-3" /> {registo.tipo}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(registo.data), { addSuffix: true, locale: pt })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {registo.autor?.nome_completo && (
            <span className="text-xs text-muted-foreground">{registo.autor.nome_completo}</span>
          )}
          {!registo.visivel_para_pessoa && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Não visível para a pessoa</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6"
            onClick={() => toggleVis.mutate()}
            title={registo.visivel_para_pessoa ? "Ocultar da pessoa" : "Tornar visível para a pessoa"}>
            {registo.visivel_para_pessoa ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
            onClick={() => { if (confirm("Apagar este registo?")) del.mutate(); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {registo.titulo && <div className="font-medium text-sm">{registo.titulo}</div>}
      <p className="text-sm whitespace-pre-wrap">{registo.conteudo}</p>
      {registo.tipo === "Atualização de estado" && registo.estado_anterior && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{registo.estado_anterior}</Badge>
          <ArrowRight className="h-3 w-3" />
          <Badge>{registo.estado_novo}</Badge>
        </div>
      )}
    </div>
  );
}

function RegistoCompose({ casoId, autorId }: { casoId: string; autorId: string | null }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<string>("Nota interna");
  const [conteudo, setConteudo] = useState("");
  const [visivel, setVisivel] = useState(false);

  const add = useMutation({
    mutationFn: async () => {
      if (!conteudo.trim()) throw new Error("Escreve algo primeiro");
      const { error } = await supabase.from("caso_registos" as any).insert({
        caso_id: casoId, autor_id: autorId, tipo,
        conteudo: conteudo.trim(),
        visivel_para_pessoa: tipo === "Nota interna" ? visivel : (tipo === "Resposta da pessoa" ? true : visivel),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setConteudo(""); setVisivel(false);
      qc.invalidateQueries({ queryKey: ["caso-registos", casoId] });
      qc.invalidateQueries({ queryKey: ["caso", casoId] });
      toast.success("Registo adicionado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex gap-2">
        <Select value={tipo} onValueChange={(v) => {
          setTipo(v);
          setVisivel(v !== "Nota interna");
        }}>
          <SelectTrigger className="w-44 h-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_REGISTO.filter((t) => t !== "Atualização de estado" && t !== "Resposta da pessoa").map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          placeholder="Adicionar registo ao caso…"
          rows={3} className="flex-1"
          value={conteudo} onChange={(e) => setConteudo(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Switch checked={visivel} onCheckedChange={setVisivel} /> Visível para a pessoa
        </label>
        <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar registo
        </Button>
      </div>
    </div>
  );
}

function ObjetivosTab({ casoId, objetivos }: { casoId: string; objetivos: any[] }) {
  const qc = useQueryClient();
  const [novo, setNovo] = useState("");
  const ESTADOS_OBJ = ["Por iniciar", "Em progresso", "Concluído", "Bloqueado", "Cancelado"];

  const add = useMutation({
    mutationFn: async () => {
      if (!novo.trim()) return;
      const { error } = await supabase.from("caso_objetivos" as any).insert({
        caso_id: casoId, descricao: novo.trim(), position: objetivos.length,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNovo(""); qc.invalidateQueries({ queryKey: ["caso-objetivos", casoId] }); },
  });

  const upd = useMutation({
    mutationFn: async ({ id, patch }: any) => {
      const { error } = await supabase.from("caso_objetivos" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["caso-objetivos", casoId] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("caso_objetivos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["caso-objetivos", casoId] }),
  });

  return (
    <div className="space-y-3">
      {objetivos.length === 0 && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sem objetivos definidos.
        </div>
      )}
      {objetivos.map((o) => (
        <Card key={o.id} className="p-3 flex items-start gap-3">
          <div className="flex-1">
            <InlineText value={o.descricao} onSave={(v) => upd.mutate({ id: o.id, patch: { descricao: v } })} />
            <div className="mt-2 flex items-center gap-2">
              <Select value={o.estado} onValueChange={(v) => upd.mutate({ id: o.id, patch: { estado: v } })}>
                <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS_OBJ.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" className="h-7 w-40 text-xs"
                value={o.prazo ?? ""}
                onChange={(e) => upd.mutate({ id: o.id, patch: { prazo: e.target.value || null } })} />
            </div>
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
            onClick={() => { if (confirm("Apagar este objetivo?")) del.mutate(o.id); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </Card>
      ))}
      <div className="flex gap-2 pt-2">
        <Input value={novo} onChange={(e) => setNovo(e.target.value)}
          placeholder="Adicionar objetivo…"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add.mutate(); } }} />
        <Button onClick={() => add.mutate()} variant="outline">
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>
    </div>
  );
}

function TimelineTab({ registos, transferencias }: { registos: any[]; transferencias: any[] }) {
  const items = useMemo(() => {
    const all = [
      ...registos.map((r) => ({ when: r.data, kind: "registo", data: r })),
      ...transferencias.map((t) => ({ when: t.created_at, kind: "transferencia", data: t })),
    ];
    all.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
    return all;
  }, [registos, transferencias]);

  return (
    <div className="relative space-y-3 border-l ps-6 ms-2">
      {items.length === 0 && (
        <div className="text-sm text-muted-foreground">Sem atividade ainda.</div>
      )}
      {items.map((it, i) => {
        if (it.kind === "registo") {
          const Icon = TIPO_ICONE[it.data.tipo] ?? StickyNote;
          return (
            <div key={i} className="relative">
              <div className="absolute -left-[33px] top-1.5 h-3 w-3 rounded-full bg-primary" />
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Icon className="h-3 w-3" /> {it.data.tipo} ·{" "}
                {formatDistanceToNow(new Date(it.when), { addSuffix: true, locale: pt })}
              </div>
              <div className="text-sm">{it.data.conteudo}</div>
            </div>
          );
        }
        return (
          <div key={i} className="relative">
            <div className="absolute -left-[33px] top-1.5 h-3 w-3 rounded-full bg-blue-500" />
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ArrowRightLeft className="h-3 w-3" /> Transferência ·{" "}
              {formatDistanceToNow(new Date(it.when), { addSuffix: true, locale: pt })}
            </div>
            <div className="text-sm">
              {it.data.saida?.nome_completo ?? "—"} → {it.data.entrada?.nome_completo ?? "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TransferenciasTab({ transferencias }: { transferencias: any[] }) {
  if (transferencias.length === 0) {
    return <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      Sem transferências.
    </div>;
  }
  return (
    <div className="space-y-3">
      {transferencias.map((t) => (
        <Card key={t.id} className="p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{new Date(t.data).toLocaleDateString("pt-PT")}</span>
          </div>
          <div className="flex items-center gap-2 font-medium">
            <span>{t.saida?.nome_completo ?? "—"}</span>
            <ArrowRight className="h-3 w-3" />
            <span>{t.entrada?.nome_completo ?? "—"}</span>
          </div>
          {t.motivo && <div className="text-xs text-muted-foreground">{t.motivo}</div>}
          <p className="text-sm whitespace-pre-wrap">{t.notas_transicao}</p>
        </Card>
      ))}
    </div>
  );
}

function TransferSheet({
  open, onOpenChange, casoId, caso, equipa, autorId,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; casoId: string; caso: any;
  equipa: { id: string; nome_completo: string }[]; autorId: string | null;
}) {
  const qc = useQueryClient();
  const [novaMediadora, setNovaMediadora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [notas, setNotas] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (!novaMediadora) throw new Error("Escolhe a nova mediadora");
      if (!notas.trim()) throw new Error("As notas de transição são obrigatórias");
      const entrada = equipa.find((e) => e.id === novaMediadora);
      const saidaNome = caso.mediadora?.nome_completo ?? "Sem mediadora";

      await supabase.from("caso_transferencias" as any).insert({
        caso_id: casoId,
        mediadora_saida_id: caso.mediadora_id,
        mediadora_entrada_id: novaMediadora,
        motivo: motivo.trim() || null,
        notas_transicao: notas.trim(),
      });
      await supabase.from("casos_apoio" as any).update({ mediadora_id: novaMediadora }).eq("id", casoId);
      await supabase.from("caso_registos" as any).insert({
        caso_id: casoId, autor_id: autorId, tipo: "Atualização de estado",
        conteudo: `Caso transferido de ${saidaNome} para ${entrada?.nome_completo}. ${notas.trim()}`,
        visivel_para_pessoa: false,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caso", casoId] });
      qc.invalidateQueries({ queryKey: ["caso-registos", casoId] });
      qc.invalidateQueries({ queryKey: ["caso-transferencias", casoId] });
      toast.success("Caso transferido");
      onOpenChange(false);
      setNovaMediadora(""); setMotivo(""); setNotas("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Transferir caso</SheetTitle>
          <SheetDescription>Atribui o caso a outra mediadora com contexto essencial.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Nova mediadora <span className="text-destructive">*</span></Label>
            <Select value={novaMediadora} onValueChange={setNovaMediadora}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>
                {equipa.filter((e) => e.id !== caso.mediadora_id).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome_completo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: rotação de equipa, ausência…" />
          </div>
          <div className="space-y-2">
            <Label>Notas de transição <span className="text-destructive">*</span></Label>
            <Textarea rows={6} value={notas} onChange={(e) => setNotas(e.target.value)}
              placeholder="Contexto essencial para a nova mediadora: estado atual, acordos feitos, próximos passos urgentes, sensibilidades…" />
          </div>
        </div>
        <SheetFooter className="mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>Transferir</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ConcludeDialog({
  open, onOpenChange, casoId, objetivos,
}: { open: boolean; onOpenChange: (v: boolean) => void; casoId: string; objetivos: any[] }) {
  const qc = useQueryClient();
  const [resultado, setResultado] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [estadoFinal, setEstadoFinal] = useState("Concluído");
  const [fecharObjs, setFecharObjs] = useState<Record<string, boolean>>({});
  const pendentes = objetivos.filter((o) => o.estado !== "Concluído" && o.estado !== "Cancelado");

  const submit = useMutation({
    mutationFn: async () => {
      if (!resultado.trim()) throw new Error("Indica o resultado final");
      await supabase.from("casos_apoio" as any).update({
        estado: estadoFinal, resultado_final: resultado.trim(), data_conclusao: data,
      }).eq("id", casoId);
      const ids = Object.entries(fecharObjs).filter(([, v]) => v).map(([k]) => k);
      if (ids.length > 0) {
        await supabase.from("caso_objetivos" as any).update({ estado: "Concluído" }).in("id", ids);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caso", casoId] });
      qc.invalidateQueries({ queryKey: ["caso-objetivos", casoId] });
      qc.invalidateQueries({ queryKey: ["casos"] });
      toast.success("Caso concluído");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Concluir caso</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Resultado final <span className="text-destructive">*</span></Label>
            <Textarea rows={4} value={resultado} onChange={(e) => setResultado(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Estado final</Label>
              <Select value={estadoFinal} onValueChange={setEstadoFinal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Concluído">Concluído</SelectItem>
                  <SelectItem value="Arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {pendentes.length > 0 && (
            <div className="space-y-2">
              <Label>Marcar objetivos restantes como concluídos</Label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {pendentes.map((o) => (
                  <label key={o.id} className="flex items-start gap-2 text-sm">
                    <input type="checkbox"
                      checked={!!fecharObjs[o.id]}
                      onChange={(e) => setFecharObjs((s) => ({ ...s, [o.id]: e.target.checked }))} />
                    <span>{o.descricao}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>Concluir caso</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}