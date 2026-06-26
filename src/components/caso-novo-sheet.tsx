import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase, Home, BookOpen, HeartPulse, FileText, Users, GraduationCap, Plus, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const AREAS = [
  { value: "Emprego", icon: Briefcase },
  { value: "Habitação", icon: Home },
  { value: "Educação", icon: BookOpen },
  { value: "Saúde", icon: HeartPulse },
  { value: "Documentação", icon: FileText },
  { value: "Integração social", icon: Users },
  { value: "Formação", icon: GraduationCap },
  { value: "Outro", icon: Plus },
] as const;

type Pessoa = { id: string; nome_completo: string; familia_id: string | null };
type Familia = { id: string; nome: string; membros: number };

export function CasoNovoSheet({
  open, onOpenChange, mode = "staff", lockedPessoaId, familiaId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode?: "staff" | "auto";
  lockedPessoaId?: string;
  familiaId?: string | null;
  onCreated?: (id: string) => void;
}) {
  const { session, pessoa: ctxPessoa } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [alvo, setAlvo] = useState<"pessoa" | "familia">("pessoa");
  const [pessoaId, setPessoaId] = useState<string | "">("");
  const [familiaIdSel, setFamiliaIdSel] = useState<string | "">("");
  const [area, setArea] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [prioridade, setPrioridade] = useState("Normal");
  const [mediadoraId, setMediadoraId] = useState<string>("");
  const [objetivos, setObjetivos] = useState<string[]>([]);
  const [novoObjetivo, setNovoObjetivo] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [familiaPickerOpen, setFamiliaPickerOpen] = useState(false);
  const [pesquisa, setPesquisa] = useState("");
  const [pesquisaFam, setPesquisaFam] = useState("");

  useEffect(() => {
    if (open) {
      setAlvo("pessoa");
      setPessoaId(lockedPessoaId ?? "");
      setFamiliaIdSel(lockedPessoaId ? "" : (familiaId ?? ""));
      setArea(""); setTitulo(""); setDescricao(""); setObjetivo("");
      setPrioridade("Normal"); setMediadoraId(""); setObjetivos([]); setNovoObjetivo("");
    }
  }, [open, lockedPessoaId, familiaId]);

  const { data: pessoas } = useQuery({
    enabled: open && mode === "staff" && pesquisa.length >= 1,
    queryKey: ["caso-novo-pessoas", pesquisa, familiaId],
    queryFn: async () => {
      let q = supabase
        .from("pessoas")
        .select("id, nome_completo, familia_id")
        .eq("status", "ativo")
        .ilike("nome_completo", `%${pesquisa}%`)
        .order("nome_completo")
        .limit(20);
      if (familiaId) q = q.eq("familia_id", familiaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Pessoa[];
    },
  });

  const { data: equipa } = useQuery({
    enabled: open && mode === "staff",
    queryKey: ["caso-novo-equipa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, tipo_user_id, is_admin, auth_user_id, tipos_user!inner(nome)")
        .eq("status", "ativo")
        .not("auth_user_id", "is", null);
      if (error) throw error;
      return ((data ?? []) as any[])
        .filter((p) => p.is_admin || p.tipos_user?.nome?.toLowerCase() === "equipa")
        .map((p) => ({ id: p.id as string, nome_completo: p.nome_completo as string }));
    },
  });

  const { data: pessoaLocked } = useQuery({
    enabled: open && !!pessoaId && mode === "staff" && !!lockedPessoaId,
    queryKey: ["caso-novo-pessoa-locked", pessoaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pessoas")
        .select("id, nome_completo, familia_id")
        .eq("id", pessoaId).maybeSingle();
      return (data ?? null) as Pessoa | null;
    },
  });

  const pessoaSelecionada = pessoas?.find((p) => p.id === pessoaId) ?? pessoaLocked ?? null;

  const { data: familias } = useQuery({
    enabled: open && mode === "staff" && alvo === "familia" && pesquisaFam.length >= 1,
    queryKey: ["caso-novo-familias", pesquisaFam],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familias")
        .select("id, nome, pessoas(count)")
        .ilike("nome", `%${pesquisaFam}%`)
        .order("nome").limit(20);
      if (error) throw error;
      return ((data ?? []) as any[]).map((f) => ({
        id: f.id as string, nome: f.nome as string, membros: f.pessoas?.[0]?.count ?? 0,
      })) as Familia[];
    },
  });

  const { data: familiaSelecionada } = useQuery({
    enabled: open && mode === "staff" && alvo === "familia" && !!familiaIdSel,
    queryKey: ["caso-novo-familia-sel", familiaIdSel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familias")
        .select("id, nome, pessoas(count)")
        .eq("id", familiaIdSel).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { id: (data as any).id, nome: (data as any).nome, membros: (data as any).pessoas?.[0]?.count ?? 0 } as Familia;
    },
  });

  // Auto-suggest titulo
  useEffect(() => {
    if (!titulo && area) {
      if (alvo === "pessoa" && pessoaSelecionada?.nome_completo) {
        setTitulo(`${area} — ${pessoaSelecionada.nome_completo}`);
      } else if (alvo === "familia" && familiaSelecionada?.nome) {
        setTitulo(`${area} — Família ${familiaSelecionada.nome}`);
      }
    }
  }, [area, alvo, pessoaSelecionada?.nome_completo, familiaSelecionada?.nome]); // eslint-disable-line

  const createMut = useMutation({
    mutationFn: async () => {
      const isAuto = mode === "auto";
      const isFamilia = !isAuto && alvo === "familia";
      const finalPessoaId = isAuto ? ctxPessoa?.id : (isFamilia ? null : pessoaId);
      const finalFamiliaId = isFamilia ? (familiaIdSel || null) : null;
      if (!isFamilia && !finalPessoaId) throw new Error("Selecione uma pessoa");
      if (isFamilia && !finalFamiliaId) throw new Error("Selecione uma família");
      if (!area) throw new Error("Selecione uma área");
      if (!titulo.trim()) throw new Error("Indique um título");

      const payload: any = {
        pessoa_id: finalPessoaId,
        familia_id: finalFamiliaId,
        area,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        objetivo: objetivo.trim() || null,
        origem: isAuto ? "Auto-pedido" : "Mediadora",
        prioridade: isAuto ? "Normal" : prioridade,
        estado: isAuto ? "Novo" : (mediadoraId ? "Em análise" : "Novo"),
        mediadora_id: isAuto ? null : (mediadoraId || null),
        created_by_auth_id: session?.user?.id ?? null,
      };
      const { data: caso, error } = await supabase
        .from("casos_apoio" as any)
        .insert(payload).select("id, numero").single();
      if (error) throw error;
      const casoRow = caso as any;

      if (isAuto) {
        if (descricao.trim()) {
          await supabase.from("caso_registos" as any).insert({
            caso_id: casoRow.id,
            autor_id: ctxPessoa?.id ?? null,
            tipo: "Resposta da pessoa",
            conteudo: descricao.trim(),
            visivel_para_pessoa: true,
          });
        }
        // Notify staff
        await supabase.rpc("notificar_staff" as any, {
          p_tipo: "novo_auto_pedido",
          p_titulo: "Novo pedido de apoio",
          p_descricao: `${ctxPessoa?.nome_completo ?? "Alguém"}: ${titulo.trim()}`,
          p_link: `/casos/${casoRow.id}`,
          p_group_key: "novo_auto_pedido",
        });
      } else {
        await supabase.from("caso_registos" as any).insert({
          caso_id: casoRow.id,
          autor_id: ctxPessoa?.id ?? null,
          tipo: "Nota interna",
          conteudo: `Caso aberto por ${ctxPessoa?.nome_completo ?? "Equipa"}.`,
          visivel_para_pessoa: false,
        });
        if (objetivos.length > 0) {
          await supabase.from("caso_objetivos" as any).insert(
            objetivos.map((d, i) => ({ caso_id: casoRow.id, descricao: d, position: i }))
          );
        }
      }
      return casoRow;
    },
    onSuccess: (caso) => {
      qc.invalidateQueries({ queryKey: ["casos"] });
      qc.invalidateQueries({ queryKey: ["meus-casos"] });
      qc.invalidateQueries({ queryKey: ["meus-acompanhamentos"] });
      qc.invalidateQueries({ queryKey: ["familia-casos"] });
      qc.invalidateQueries({ queryKey: ["sidebar-badge", "count_casos_novos"] });
      onOpenChange(false);
      if (mode === "auto") {
        toast.success("O teu pedido foi enviado. A equipa MEERU vai responder em breve.");
      } else {
        toast.success(`Caso ${(caso as any).numero} aberto`);
        onCreated?.(caso.id);
        navigate({ to: "/casos/$id", params: { id: caso.id } });
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao abrir caso"),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{mode === "auto" ? "Pedir apoio à equipa MEERU" : "Novo caso de apoio"}</SheetTitle>
          <SheetDescription>
            {mode === "auto"
              ? "Descreve o que precisas. A equipa MEERU vai responder em breve."
              : "Cria um novo caso de acompanhamento para uma pessoa."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {mode === "staff" && (
            <div className="space-y-3">
              {!lockedPessoaId && (
                <div className="space-y-2">
                  <Label>Alvo do caso <span className="text-destructive">*</span></Label>
                  <RadioGroup value={alvo} onValueChange={(v) => setAlvo(v as "pessoa" | "familia")} className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="pessoa" id="alvo-pessoa" />
                      <Label htmlFor="alvo-pessoa" className="font-normal">Pessoa</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="familia" id="alvo-familia" />
                      <Label htmlFor="alvo-familia" className="font-normal">Família (apoio a vários)</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {(lockedPessoaId || alvo === "pessoa") && (
                <div className="space-y-2">
                  <Label>Pessoa <span className="text-destructive">*</span></Label>
                  {lockedPessoaId ? (
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      {pessoaSelecionada?.nome_completo ?? "—"}
                    </div>
                  ) : (
                    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
                      {pessoaSelecionada?.nome_completo ?? "Pesquisar pessoa…"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Pesquisar por nome…" value={pesquisa} onValueChange={setPesquisa} />
                      <CommandList>
                        <CommandEmpty>
                          {pesquisa.length < 1 ? "Escreve para pesquisar" : "Sem resultados"}
                        </CommandEmpty>
                        <CommandGroup>
                          {(pessoas ?? []).map((p) => (
                            <CommandItem key={p.id} value={p.id}
                              onSelect={() => { setPessoaId(p.id); setPickerOpen(false); }}>
                              {p.nome_completo}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                  )}
                </div>
              )}

              {!lockedPessoaId && alvo === "familia" && (
                <div className="space-y-2">
                  <Label>Família <span className="text-destructive">*</span></Label>
                  <Popover open={familiaPickerOpen} onOpenChange={setFamiliaPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start font-normal">
                        {familiaSelecionada?.nome
                          ? `${familiaSelecionada.nome} · ${familiaSelecionada.membros} pessoa(s)`
                          : "Pesquisar família…"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Pesquisar família…" value={pesquisaFam} onValueChange={setPesquisaFam} />
                        <CommandList>
                          <CommandEmpty>
                            {pesquisaFam.length < 1 ? "Escreve para pesquisar" : "Sem resultados"}
                          </CommandEmpty>
                          <CommandGroup>
                            {(familias ?? []).map((f) => (
                              <CommandItem key={f.id} value={f.id}
                                onSelect={() => { setFamiliaIdSel(f.id); setFamiliaPickerOpen(false); }}>
                                <div className="flex w-full items-center justify-between">
                                  <span>{f.nome}</span>
                                  <span className="text-xs text-muted-foreground">{f.membros} pessoa(s)</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {familiaSelecionada && (
                    <p className="text-xs text-muted-foreground">
                      Este caso conta como apoio a {familiaSelecionada.membros} pessoa(s) da família.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Área de apoio <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 gap-2">
              {AREAS.map(({ value, icon: Icon }) => (
                <button key={value} type="button" onClick={() => setArea(value)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition",
                    area === value ? "border-primary bg-primary/5" : "hover:bg-accent"
                  )}>
                  <Icon className="h-4 w-4" /> {value}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Título <span className="text-destructive">*</span></Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder="Resumo breve da necessidade" />
          </div>

          <div className="space-y-2">
            <Label>{mode === "auto" ? "Descreve a tua situação" : "Descrição detalhada"}</Label>
            <Textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)}
              placeholder={mode === "auto"
                ? "Descreve o que precisas de ajuda. Quanto mais detalhes deres, mais rápido te podemos ajudar."
                : "Contexto do caso, situação atual, urgência…"} />
          </div>

          {mode === "staff" && (
            <>
              <div className="space-y-2">
                <Label>Objetivo do caso</Label>
                <Input value={objetivo} onChange={(e) => setObjetivo(e.target.value)}
                  placeholder="O que seria uma boa solução?" />
              </div>

              <div className="space-y-2">
                <Label>Prioridade</Label>
                <RadioGroup value={prioridade} onValueChange={setPrioridade} className="flex gap-4">
                  {["Alta", "Normal", "Baixa"].map((p) => (
                    <div key={p} className="flex items-center gap-2">
                      <RadioGroupItem value={p} id={`prio-${p}`} />
                      <Label htmlFor={`prio-${p}`} className="font-normal">{p}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Mediadora responsável</Label>
                <Select value={mediadoraId} onValueChange={(v) => setMediadoraId(v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Por atribuir (fica em fila)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Por atribuir —</SelectItem>
                    {(equipa ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nome_completo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Objetivos específicos (opcional)</Label>
                <div className="flex gap-2">
                  <Input value={novoObjetivo} onChange={(e) => setNovoObjetivo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && novoObjetivo.trim()) {
                        e.preventDefault();
                        setObjetivos((o) => [...o, novoObjetivo.trim()]);
                        setNovoObjetivo("");
                      }
                    }}
                    placeholder="Adicionar objetivo e pressionar Enter" />
                  <Button type="button" variant="outline" onClick={() => {
                    if (novoObjetivo.trim()) {
                      setObjetivos((o) => [...o, novoObjetivo.trim()]);
                      setNovoObjetivo("");
                    }
                  }}>Adicionar</Button>
                </div>
                {objetivos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {objetivos.map((o, i) => (
                      <Badge key={i} variant="secondary" className="gap-1.5">
                        {o}
                        <button type="button" onClick={() => setObjetivos((arr) => arr.filter((_, idx) => idx !== i))}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            {mode === "auto" ? "Enviar pedido" : "Abrir caso"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}