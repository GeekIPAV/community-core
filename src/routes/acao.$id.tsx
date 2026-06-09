import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, MapPin, CalendarDays, ExternalLink } from "lucide-react";
import { RichTextView } from "@/components/rich-text-view";
import { matchCidade, formatEuro, type CidadeBolsa } from "@/lib/bolsa-transporte";

export const Route = createFileRoute("/acao/$id")({
  component: AcaoDetailPage,
});

type FieldDef = { key: string; label?: string; type?: "text" | "number" | "date" | "checkbox" | "select" | "multiselect"; required?: boolean; options?: string[] };

function parseFields(config: any): FieldDef[] {
  if (!config) return [];
  if (Array.isArray(config?.fields)) return config.fields as FieldDef[];
  // Legacy shape: { key: "text" | "boolean" | ... }
  if (typeof config === "object") {
    return Object.entries(config).map(([key, t]) => ({
      key,
      label: key,
      type: t === "boolean" ? "checkbox" : t === "number" ? "number" : t === "date" ? "date" : "text",
    }));
  }
  return [];
}

function AcaoDetailPage() {
  const { id } = Route.useParams();
  const [open, setOpen] = useState(false);

  const { data: acao, isLoading } = useQuery({
    queryKey: ["acao", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("acoes").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <span className="text-sm font-semibold">Meeru</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !acao ? (
          <p className="text-sm text-muted-foreground">Ação não encontrada.</p>
        ) : (
          <Card className="overflow-hidden">
            {acao.imagem_url && (
              <img
                src={acao.imagem_url}
                alt={acao.nome}
                className="h-56 w-full object-cover sm:h-72"
              />
            )}
            <CardHeader>
              <CardTitle className="text-2xl">{acao.nome}</CardTitle>
              <CardDescription className="space-y-1">
                {acao.data_inicio && (
                  <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {new Date(acao.data_inicio).toLocaleString("pt-PT", { dateStyle: "full", timeStyle: "short" })}</span>
                )}
                {(acao.local || acao.mapa_url) && (
                  <span className="flex flex-wrap items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {acao.local && <span>{acao.local}</span>}
                    {acao.mapa_url && (
                      <a
                        href={acao.mapa_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Abrir no Google Maps <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {acao.descricao && <RichTextView html={acao.descricao} />}
              {acao.restrito_a_projetos && (acao.projeto_ids?.length ?? 0) > 0 && (
                <p className="text-xs rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-muted-foreground">
                  Inscrição reservada a participantes dos projetos associados a esta ação.
                </p>
              )}
              <Button size="lg" onClick={() => setOpen(true)}>Inscrever</Button>
            </CardContent>
          </Card>
        )}

        {acao && (
          <InscreverDialog open={open} onOpenChange={setOpen} acao={acao} />
        )}
      </main>
    </div>
  );
}

function InscreverDialog({ open, onOpenChange, acao }: { open: boolean; onOpenChange: (v: boolean) => void; acao: any }) {
  const { session, pessoa } = useAuth();
  const fields = useMemo(() => parseFields(acao?.config_campos), [acao]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inscrição — {acao?.nome}</DialogTitle>
          <DialogDescription>
            {session ? "Seleciona quem inscrever e preenche os dados." : "Preenche os teus dados para te inscreveres."}
          </DialogDescription>
        </DialogHeader>
        {session ? (
          <LoggedInForm acao={acao} pessoa={pessoa} fields={fields} onDone={() => onOpenChange(false)} />
        ) : (
          acao?.restrito_a_projetos && (acao?.projeto_ids?.length ?? 0) > 0 ? (
            <RestritoLoginPrompt />
          ) : (
            <AnonForm acao={acao} fields={fields} onDone={() => onOpenChange(false)} />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

function RestritoLoginPrompt() {
  const navigate = useNavigate();
  return (
    <div className="space-y-3 rounded-md border bg-muted/40 p-4 text-sm">
      <p>Esta ação está reservada a participantes dos projetos associados. Inicia sessão com a tua conta para te inscreveres.</p>
      <Button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") {
            sessionStorage.setItem("postLoginRedirect", window.location.pathname);
          }
          navigate({ to: "/login" });
        }}
      >
        Iniciar sessão
      </Button>
    </div>
  );
}

function DynamicFields({ fields, values, setValues }: {
  fields: FieldDef[];
  values: Record<string, any>;
  setValues: (v: Record<string, any>) => void;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="space-y-3 border-t pt-3">
      {fields.map((f) => {
        const label = f.label ?? f.key;
        if (f.type === "checkbox") {
          return (
            <div key={f.key} className="flex items-center gap-2">
              <Checkbox
                id={`f-${f.key}`}
                checked={!!values[f.key]}
                onCheckedChange={(c) => setValues({ ...values, [f.key]: c === true })}
              />
              <Label htmlFor={`f-${f.key}`}>{label}</Label>
            </div>
          );
        }
        if (f.type === "select") {
          return (
            <div key={f.key} className="space-y-1">
              <Label>{label}{f.required ? " *" : ""}</Label>
              <Select value={values[f.key] ?? ""} onValueChange={(v) => setValues({ ...values, [f.key]: v })}>
                <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                <SelectContent>
                  {(f.options ?? []).filter((o) => o).map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }
        if (f.type === "multiselect") {
          const current: string[] = Array.isArray(values[f.key]) ? values[f.key] : [];
          return (
            <div key={f.key} className="space-y-1">
              <Label>{label}{f.required ? " *" : ""}</Label>
              <div className="space-y-1 rounded-md border p-2">
                {(f.options ?? []).filter((o) => o).map((o) => {
                  const checked = current.includes(o);
                  return (
                    <label key={o} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          const next = c === true ? [...current, o] : current.filter((x) => x !== o);
                          setValues({ ...values, [f.key]: next });
                        }}
                      />
                      {o}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        }
        return (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={`f-${f.key}`}>{label}{f.required ? " *" : ""}</Label>
            <Input
              id={`f-${f.key}`}
              type={f.type ?? "text"}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              required={f.required}
            />
          </div>
        );
      })}
    </div>
  );
}

function AnonForm({ acao, fields, onDone }: { acao: any; fields: FieldDef[]; onDone: () => void }) {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [nif, setNif] = useState("");
  const [dataNasc, setDataNasc] = useState("");
  const [telefone, setTelefone] = useState("");
  const [valores, setValores] = useState<Record<string, any>>({});
  const [confirmUpdate, setConfirmUpdate] = useState(false);

  const submit = useMutation({
    mutationFn: async (atualizar: boolean) => {
      const { data, error } = await supabase.rpc("inscrever_publico" as any, {
        p_acao_id: acao.id,
        p_nome: nome,
        p_email: email || null,
        p_nif: nif || null,
        p_data_nascimento: dataNasc || null,
        p_telefone: telefone || null,
        p_valores: valores,
        p_atualizar: atualizar,
      });
      if (error) throw error;
      return data as { ja_inscrito?: boolean; atualizado?: boolean };
    },
    onSuccess: (res, atualizar) => {
      if (res?.ja_inscrito && !atualizar) {
        setConfirmUpdate(true);
        return;
      }
      toast.success(res?.atualizado ? "Respostas atualizadas!" : "Inscrição registada!");
      onDone();
      navigate({ to: "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
    <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
      <span className="text-muted-foreground">Já tens conta?</span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto px-0"
        onClick={() => {
          if (typeof window !== "undefined") {
            sessionStorage.setItem("postLoginRedirect", window.location.pathname);
          }
          navigate({ to: "/login" });
        }}
      >
        Iniciar sessão
      </Button>
    </div>
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate(false);
      }}
    >
      <div className="space-y-1"><Label htmlFor="nome">Nome completo *</Label><Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="telefone">Telefone</Label><Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="nif">NIF</Label><Input id="nif" value={nif} onChange={(e) => setNif(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="dn">Data nasc.</Label><Input id="dn" type="date" value={dataNasc} onChange={(e) => setDataNasc(e.target.value)} /></div>
      </div>
      <DynamicFields fields={fields} values={valores} setValues={setValores} />
      <DialogFooter>
        <Button type="submit" disabled={!nome || submit.isPending}>
          {submit.isPending ? "A enviar…" : "Confirmar inscrição"}
        </Button>
      </DialogFooter>
    </form>
    <Dialog open={confirmUpdate} onOpenChange={setConfirmUpdate}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Já estavas inscrito</DialogTitle>
          <DialogDescription>
            Encontrámos uma inscrição existente nesta ação com este email. Queres atualizar as respostas com o que preencheste agora?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { setConfirmUpdate(false); onDone(); navigate({ to: "/" }); }}>
            Manter respostas anteriores
          </Button>
          <Button onClick={() => { setConfirmUpdate(false); submit.mutate(true); }} disabled={submit.isPending}>
            Atualizar respostas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function LoggedInForm({ acao, pessoa, fields, onDone }: { acao: any; pessoa: any; fields: FieldDef[]; onDone: () => void }) {
  const qc = useQueryClient();

  const { data: agregado } = useQuery({
    queryKey: ["agregado", pessoa?.familia_id, pessoa?.id],
    enabled: !!pessoa,
    queryFn: async () => {
      if (!pessoa) return [];
      if (!pessoa.familia_id) {
        return [{ id: pessoa.id, nome_completo: pessoa.nome_completo, cidade_residencia: pessoa.cidade_residencia, projeto_ids: (pessoa as any).projeto_ids ?? [] }];
      }
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, cidade_residencia, projeto_ids")
        .eq("familia_id", pessoa.familia_id);
      if (error) throw error;
      return (data ?? []).map((p: any) => ({ ...p, projeto_ids: p.projeto_ids ?? [] }));
    },
  });

  const { data: cidadesBolsa } = useQuery({
    queryKey: ["bolsas-cidades"],
    enabled: !!acao?.bolsa_transporte,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bolsas_cidades" as any)
        .select("id, nome, valor_sentido, ativo")
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as unknown as CidadeBolsa[];
    },
  });

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [valoresPorPessoa, setValoresPorPessoa] = useState<Record<string, Record<string, any>>>({});
  const [confirmar, setConfirmar] = useState<{ existentes: Array<{ id: string; nome: string }>; novos: string[] } | null>(null);

  const projetosRestritos: string[] = acao?.restrito_a_projetos ? (acao?.projeto_ids ?? []) : [];
  const restrito = projetosRestritos.length > 0;
  const isElegivel = (m: any) => !restrito || (m.projeto_ids ?? []).some((id: string) => projetosRestritos.includes(id));

  useEffect(() => {
    if (pessoa && selected[pessoa.id] === undefined) {
      setSelected((s) => ({ ...s, [pessoa.id]: true }));
    }
  }, [pessoa, selected]);

  const checkSubmit = useMutation({
    mutationFn: async () => {
      const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
      if (ids.length === 0) throw new Error("Seleciona pelo menos uma pessoa");
      if (restrito) {
        const naoElegiveis = (agregado ?? []).filter((m: any) => ids.includes(m.id) && !isElegivel(m));
        if (naoElegiveis.length > 0) {
          throw new Error("Algumas pessoas selecionadas não pertencem aos projetos desta ação.");
        }
      }
      const { data, error } = await supabase
        .from("inscricoes")
        .select("id, pessoa_id")
        .eq("acao_id", acao.id)
        .in("pessoa_id", ids)
        .neq("status", "cancelada");
      if (error) throw error;
      const existentesIds = new Set((data ?? []).map((r: any) => r.pessoa_id));
      const existentes = (agregado ?? [])
        .filter((m: any) => existentesIds.has(m.id))
        .map((m: any) => ({ id: m.id, nome: m.nome_completo }));
      const novos = ids.filter((pid) => !existentesIds.has(pid));
      return { existentes, novos };
    },
    onSuccess: (res) => {
      if (res.existentes.length > 0) {
        setConfirmar(res);
      } else {
        finalSubmit.mutate({ atualizarIds: [], inserirIds: res.novos });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finalSubmit = useMutation({
    mutationFn: async ({ atualizarIds, inserirIds }: { atualizarIds: string[]; inserirIds: string[] }) => {
      if (inserirIds.length > 0) {
        const rows = inserirIds.map((pid) => ({
          pessoa_id: pid,
          acao_id: acao.id,
          valores_dinamicos: valoresPorPessoa[pid] ?? {},
        }));
        const { error } = await supabase.from("inscricoes").insert(rows);
        if (error) throw error;
      }
      for (const pid of atualizarIds) {
        const { error } = await supabase
          .from("inscricoes")
          .update({ valores_dinamicos: valoresPorPessoa[pid] ?? {} })
          .eq("acao_id", acao.id)
          .eq("pessoa_id", pid)
          .neq("status", "cancelada");
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Inscrições guardadas!");
      qc.invalidateQueries();
      setConfirmar(null);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!pessoa) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Tens sessão iniciada mas ainda não estás associado a um perfil da comunidade. Podes inscrever-te como convidado abaixo.
        </p>
        <AnonForm acao={acao} fields={fields} onDone={onDone} />
      </div>
    );
  }

  return (
    <>
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); checkSubmit.mutate(); }}>
      <div className="space-y-2">
        <Label>Quem queres inscrever?</Label>
        {restrito && (
          <p className="text-xs text-muted-foreground">
            Esta ação está reservada a participantes dos projetos associados — apenas membros elegíveis podem ser inscritos.
          </p>
        )}
        <div className="space-y-2 rounded-md border p-3">
          {(agregado ?? []).length > 0 && (agregado ?? []).every((m: any) => !isElegivel(m)) && (
            <p className="text-sm text-muted-foreground">Nenhum membro do agregado pertence aos projetos desta ação.</p>
          )}
          {(agregado ?? []).map((m: any) => {
            const elegivel = isElegivel(m);
            return (
            <div key={m.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`p-${m.id}`}
                  checked={!!selected[m.id]}
                  disabled={!elegivel}
                  onCheckedChange={(c) => setSelected({ ...selected, [m.id]: c === true })}
                />
                <Label htmlFor={`p-${m.id}`} className={elegivel ? "" : "text-muted-foreground"}>
                  {m.nome_completo}{m.id === pessoa.id ? " (eu)" : ""}
                  {!elegivel && <span className="ml-2 text-xs italic">— não pertence aos projetos</span>}
                </Label>
              </div>
              {selected[m.id] && fields.length > 0 && (
                <div className="pl-6">
                  <DynamicFields
                    fields={fields}
                    values={valoresPorPessoa[m.id] ?? {}}
                    setValues={(v) => setValoresPorPessoa({ ...valoresPorPessoa, [m.id]: v })}
                  />
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>
      {acao?.bolsa_transporte && cidadesBolsa && (
        (() => {
          const items = (agregado ?? [])
            .filter((m: any) => selected[m.id])
            .map((m: any) => ({ m, cidade: matchCidade(m.cidade_residencia, cidadesBolsa) }));
          const elegiveis = items.filter((i) => i.cidade);
          const total = elegiveis.reduce((s, i) => s + i.cidade!.valor_sentido * 2, 0);
          return (
            <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-semibold">Bolsa de transporte</p>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Seleciona quem queres inscrever para ver o valor da bolsa.</p>
              ) : elegiveis.length === 0 ? (
                <p className="text-xs text-muted-foreground">Esta ação tem bolsa de transporte, mas a tua cidade de residência não consta na lista de cidades elegíveis. Atualiza no teu perfil se for o caso.</p>
              ) : (
                <>
                  <ul className="space-y-1 text-xs">
                    {items.map(({ m, cidade }) => (
                      <li key={m.id} className="flex justify-between gap-2">
                        <span>{m.nome_completo}</span>
                        {cidade ? (
                          <span className="text-muted-foreground">
                            {cidade.nome} · {formatEuro(cidade.valor_sentido)} × 2 = <span className="font-medium text-foreground">{formatEuro(cidade.valor_sentido * 2)}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">sem cidade elegível</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                    <span>Total a receber</span>
                    <span>{formatEuro(total)}</span>
                  </div>
                </>
              )}
            </div>
          );
        })()
      )}
      <DialogFooter>
        <Button type="submit" disabled={checkSubmit.isPending || finalSubmit.isPending}>
          {checkSubmit.isPending || finalSubmit.isPending ? "A enviar…" : "Confirmar inscrição"}
        </Button>
      </DialogFooter>
    </form>
    <Dialog open={!!confirmar} onOpenChange={(o) => { if (!o) setConfirmar(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Já existem inscrições</DialogTitle>
          <DialogDescription>
            {confirmar && (
              <>
                {confirmar.existentes.length === 1
                  ? `${confirmar.existentes[0].nome} já está inscrito(a) nesta ação.`
                  : `Estas pessoas já estão inscritas: ${confirmar.existentes.map((p) => p.nome).join(", ")}.`}
                {" "}Queres atualizar as respostas com o que preencheste agora?
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!confirmar) return;
              finalSubmit.mutate({ atualizarIds: [], inserirIds: confirmar.novos });
            }}
            disabled={finalSubmit.isPending}
          >
            Manter respostas anteriores
          </Button>
          <Button
            onClick={() => {
              if (!confirmar) return;
              finalSubmit.mutate({
                atualizarIds: confirmar.existentes.map((p) => p.id),
                inserirIds: confirmar.novos,
              });
            }}
            disabled={finalSubmit.isPending}
          >
            Atualizar respostas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}