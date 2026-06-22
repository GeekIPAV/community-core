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
import { ArrowLeft, MapPin, CalendarDays, ExternalLink, Pencil, UserPlus, Users } from "lucide-react";
import { RichTextView } from "@/components/rich-text-view";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ImageUpload } from "@/components/image-upload";
import { Switch } from "@/components/ui/switch";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { matchCidade, formatEuro, type CidadeBolsa } from "@/lib/bolsa-transporte";

export const Route = createFileRoute("/acao/$id")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("acoes")
      .select("id, nome, descricao, local, imagem_url, data_inicio, data_fim, publico")
      .eq("id", params.id)
      .eq("publico", true)
      .maybeSingle();
    return { acao: data };
  },
  head: ({ params, loaderData }) => {
    const a = loaderData?.acao;
    const url = `https://appmeeru.lovable.app/acao/${params.id}`;
    if (!a) {
      return {
        meta: [
          { title: "Ação — Meeru" },
          { name: "description", content: "Detalhes da ação na comunidade Meeru." },
        ],
      };
    }
    const plainDesc = (a.descricao ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 155);
    const desc = plainDesc || `Inscreve-te em ${a.nome} na comunidade Meeru.`;
    return {
      meta: [
        { title: `${a.nome} — Meeru` },
        { name: "description", content: desc },
        { property: "og:title", content: a.nome },
        { property: "og:description", content: desc },
        { property: "og:type", content: "event" },
        { property: "og:url", content: url },
        ...(a.imagem_url ? [
          { property: "og:image", content: a.imagem_url },
          { name: "twitter:image", content: a.imagem_url },
        ] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Event",
          name: a.nome,
          description: desc,
          startDate: a.data_inicio ?? undefined,
          endDate: a.data_fim ?? undefined,
          location: a.local ? { "@type": "Place", name: a.local } : undefined,
          image: a.imagem_url ?? undefined,
          organizer: { "@type": "Organization", name: "Meeru" },
          url,
        }),
      }],
    };
  },
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
  const { isAdmin, isStaff } = useAuth();
  const canManage = isAdmin || isStaff;
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [adminPessoaOpen, setAdminPessoaOpen] = useState(false);
  const [adminFamiliaOpen, setAdminFamiliaOpen] = useState(false);

  const { data: acao, isLoading } = useQuery({
    queryKey: ["acao", id],
    queryFn: async () => {
      let q = supabase.from("acoes").select("*").eq("id", id);
      if (!canManage) q = q.eq("publico", true);
      const { data, error } = await q.single();
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
          <Card className="relative overflow-hidden">
            {canManage && (
              <div className="absolute right-4 top-16 z-10">
                <Button size="icon" variant="secondary" onClick={() => setEditOpen(true)} title="Editar ação">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
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
              <AcaoParceirosChips acaoId={acao.id} />
              {acao.restrito_a_projetos && (acao.projeto_ids?.length ?? 0) > 0 && (
                <p className="text-xs rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-muted-foreground">
                  Inscrição reservada a participantes dos projetos associados a esta ação.
                </p>
              )}
              <Button size="lg" onClick={() => setOpen(true)}>Inscrever</Button>
              {canManage && (
                <div className="space-y-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gestão</p>
                  {!acao.publico && (
                    <p className="text-xs text-amber-600">Esta ação não está pública — só admins/equipa a vêem.</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setAdminPessoaOpen(true)}>
                      <UserPlus className="h-4 w-4" /> Inscrever pessoa
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setAdminFamiliaOpen(true)}>
                      <Users className="h-4 w-4" /> Inscrever família
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {acao && (
          <InscreverDialog open={open} onOpenChange={setOpen} acao={acao} />
        )}
        {acao && canManage && (
          <>
            <EditarAcaoDialog open={editOpen} onOpenChange={setEditOpen} acao={acao} />
            <AdminInscreverPessoaDialog open={adminPessoaOpen} onOpenChange={setAdminPessoaOpen} acao={acao} />
            <AdminInscreverFamiliaDialog open={adminFamiliaOpen} onOpenChange={setAdminFamiliaOpen} acao={acao} />
          </>
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

// ============================================================
// ADMIN: Editar ação
// ============================================================
function EditarAcaoDialog({ open, onOpenChange, acao }: { open: boolean; onOpenChange: (v: boolean) => void; acao: any }) {
  const qc = useQueryClient();
  const toLocalInput = (v: string | null | undefined) => {
    if (!v) return "";
    const d = new Date(v);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [form, setForm] = useState({
    nome: acao.nome ?? "",
    descricao: acao.descricao ?? "",
    local: acao.local ?? "",
    mapa_url: acao.mapa_url ?? "",
    imagem_url: acao.imagem_url ?? "",
    data_inicio: toLocalInput(acao.data_inicio),
    data_fim: toLocalInput(acao.data_fim),
    publico: !!acao.publico,
    inscricoes_abertas: !!acao.inscricoes_abertas,
    restrito_a_projetos: !!acao.restrito_a_projetos,
    projeto_ids: (acao.projeto_ids ?? []) as string[],
  });

  useEffect(() => {
    if (open) {
      setForm({
        nome: acao.nome ?? "",
        descricao: acao.descricao ?? "",
        local: acao.local ?? "",
        mapa_url: acao.mapa_url ?? "",
        imagem_url: acao.imagem_url ?? "",
        data_inicio: toLocalInput(acao.data_inicio),
        data_fim: toLocalInput(acao.data_fim),
        publico: !!acao.publico,
        inscricoes_abertas: !!acao.inscricoes_abertas,
        restrito_a_projetos: !!acao.restrito_a_projetos,
        projeto_ids: (acao.projeto_ids ?? []) as string[],
      });
    }
  }, [open, acao]);

  const { data: projetos } = useQuery({
    queryKey: ["projetos_lookup"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        nome: form.nome.trim(),
        descricao: form.descricao || null,
        local: form.local || null,
        mapa_url: form.mapa_url || null,
        imagem_url: form.imagem_url || null,
        data_inicio: form.data_inicio ? new Date(form.data_inicio).toISOString() : null,
        data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
        publico: form.publico,
        inscricoes_abertas: form.inscricoes_abertas,
        restrito_a_projetos: form.restrito_a_projetos,
        projeto_ids: form.projeto_ids,
      };
      const { error } = await supabase.from("acoes").update(payload).eq("id", acao.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação atualizada!");
      qc.invalidateQueries({ queryKey: ["acao", acao.id] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleProjeto = (id: string) => {
    setForm((f) => ({
      ...f,
      projeto_ids: f.projeto_ids.includes(id) ? f.projeto_ids.filter((x) => x !== id) : [...f.projeto_ids, id],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar ação</DialogTitle>
          <DialogDescription>Altera a informação principal desta ação.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        >
          <div className="space-y-1">
            <Label htmlFor="ed-nome">Nome *</Label>
            <Input id="ed-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label>Imagem</Label>
            <ImageUpload value={form.imagem_url} onChange={(url) => setForm({ ...form, imagem_url: url ?? "" })} />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <RichTextEditor value={form.descricao} onChange={(v) => setForm({ ...form, descricao: v })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ed-local">Local</Label>
              <Input id="ed-local" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ed-mapa">URL do mapa</Label>
              <Input id="ed-mapa" value={form.mapa_url} onChange={(e) => setForm({ ...form, mapa_url: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ed-di">Data início</Label>
              <Input id="ed-di" type="datetime-local" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ed-df">Data fim</Label>
              <Input id="ed-df" type="datetime-local" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Pública</p>
                <p className="text-xs text-muted-foreground">Visível em /acao/{"{id}"} para qualquer pessoa.</p>
              </div>
              <Switch checked={form.publico} onCheckedChange={(c) => setForm({ ...form, publico: c })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Inscrições abertas</p>
                <p className="text-xs text-muted-foreground">Permite novas inscrições.</p>
              </div>
              <Switch checked={form.inscricoes_abertas} onCheckedChange={(c) => setForm({ ...form, inscricoes_abertas: c })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Restringir a projetos</p>
                <p className="text-xs text-muted-foreground">Só participantes destes projetos podem inscrever-se.</p>
              </div>
              <Switch checked={form.restrito_a_projetos} onCheckedChange={(c) => setForm({ ...form, restrito_a_projetos: c })} />
            </div>
            {form.restrito_a_projetos && (
              <div className="space-y-1 pt-2">
                <Label>Projetos</Label>
                <div className="grid gap-1 rounded-md border p-2 sm:grid-cols-2">
                  {(projetos ?? []).map((p: any) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={form.projeto_ids.includes(p.id)} onCheckedChange={() => toggleProjeto(p.id)} />
                      {p.nome}
                    </label>
                  ))}
                  {(projetos ?? []).length === 0 && <p className="text-xs text-muted-foreground">Sem projetos.</p>}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!form.nome.trim() || save.isPending}>{save.isPending ? "A guardar…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// ADMIN: Inscrever pessoa
// ============================================================
function PessoaSearch({ value, onChange }: { value: { id: string; nome: string } | null; onChange: (v: { id: string; nome: string } | null) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: results } = useQuery({
    queryKey: ["admin-pessoa-search", search],
    enabled: open && search.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email")
        .eq("status", "ativo")
        .or(`nome_completo.ilike.%${search}%,email.ilike.%${search}%`)
        .order("nome_completo")
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" type="button" className="w-full justify-start">
          {value ? value.nome : "Procurar pessoa…"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Nome ou email…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{search.length < 2 ? "Escreve pelo menos 2 letras." : "Sem resultados."}</CommandEmpty>
            <CommandGroup>
              {(results ?? []).map((p: any) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => { onChange({ id: p.id, nome: p.nome_completo }); setOpen(false); }}
                >
                  <div className="flex flex-col">
                    <span>{p.nome_completo}</span>
                    {p.email && <span className="text-xs text-muted-foreground">{p.email}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AdminInscreverPessoaDialog({ open, onOpenChange, acao }: { open: boolean; onOpenChange: (v: boolean) => void; acao: any }) {
  const qc = useQueryClient();
  const fields = useMemo(() => parseFields(acao?.config_campos), [acao]);
  const [pessoa, setPessoa] = useState<{ id: string; nome: string } | null>(null);
  const [valores, setValores] = useState<Record<string, any>>({});

  useEffect(() => { if (open) { setPessoa(null); setValores({}); } }, [open]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!pessoa) throw new Error("Escolhe uma pessoa.");
      const { data: existing } = await supabase
        .from("inscricoes")
        .select("id")
        .eq("acao_id", acao.id)
        .eq("pessoa_id", pessoa.id)
        .neq("status", "cancelada")
        .maybeSingle();
      if (existing) {
        const { error } = await supabase.from("inscricoes").update({ valores_dinamicos: valores }).eq("id", existing.id);
        if (error) throw error;
        return "atualizada";
      }
      const { error } = await supabase.from("inscricoes").insert({ pessoa_id: pessoa.id, acao_id: acao.id, valores_dinamicos: valores });
      if (error) throw error;
      return "criada";
    },
    onSuccess: (r) => {
      toast.success(r === "atualizada" ? "Inscrição atualizada!" : "Pessoa inscrita!");
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inscrever pessoa</DialogTitle>
          <DialogDescription>Pesquisa uma pessoa existente para inscrever em {acao.nome}.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
          <div className="space-y-1">
            <Label>Pessoa</Label>
            <PessoaSearch value={pessoa} onChange={setPessoa} />
          </div>
          <DynamicFields fields={fields} values={valores} setValues={setValores} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!pessoa || submit.isPending}>{submit.isPending ? "A inscrever…" : "Inscrever"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// ADMIN: Inscrever família
// ============================================================
function AdminInscreverFamiliaDialog({ open, onOpenChange, acao }: { open: boolean; onOpenChange: (v: boolean) => void; acao: any }) {
  const qc = useQueryClient();
  const fields = useMemo(() => parseFields(acao?.config_campos), [acao]);
  const [search, setSearch] = useState("");
  const [openCombo, setOpenCombo] = useState(false);
  const [familia, setFamilia] = useState<{ id: string; nome: string } | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [valores, setValores] = useState<Record<string, any>>({});

  useEffect(() => { if (open) { setFamilia(null); setSelected({}); setValores({}); setSearch(""); } }, [open]);

  const { data: familias } = useQuery({
    queryKey: ["admin-familia-search", search],
    enabled: open && openCombo && search.length >= 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familias")
        .select("id, nome")
        .ilike("nome", `%${search}%`)
        .order("nome")
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: membros } = useQuery({
    queryKey: ["admin-familia-membros", familia?.id],
    enabled: !!familia,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo")
        .eq("familia_id", familia!.id)
        .eq("status", "ativo")
        .order("nome_completo");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (membros) {
      const s: Record<string, boolean> = {};
      membros.forEach((m: any) => { s[m.id] = true; });
      setSelected(s);
    }
  }, [membros]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!familia) throw new Error("Escolhe uma família.");
      const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
      if (ids.length === 0) throw new Error("Seleciona pelo menos uma pessoa.");
      const { data: existing } = await supabase
        .from("inscricoes")
        .select("pessoa_id")
        .eq("acao_id", acao.id)
        .in("pessoa_id", ids)
        .neq("status", "cancelada");
      const existingIds = new Set((existing ?? []).map((r: any) => r.pessoa_id));
      const novos = ids.filter((id) => !existingIds.has(id));
      if (novos.length > 0) {
        const rows = novos.map((pid) => ({ pessoa_id: pid, acao_id: acao.id, valores_dinamicos: valores }));
        const { error } = await supabase.from("inscricoes").insert(rows);
        if (error) throw error;
      }
      return { criadas: novos.length, jaInscritas: existingIds.size };
    },
    onSuccess: (r) => {
      toast.success(`${r.criadas} inscrição/ões criada(s)${r.jaInscritas ? `, ${r.jaInscritas} já existia(m)` : ""}.`);
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inscrever família</DialogTitle>
          <DialogDescription>Inscreve toda uma família (ou os membros escolhidos) em {acao.nome}.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
          <div className="space-y-1">
            <Label>Família</Label>
            <Popover open={openCombo} onOpenChange={setOpenCombo}>
              <PopoverTrigger asChild>
                <Button variant="outline" type="button" className="w-full justify-start">
                  {familia ? familia.nome : "Procurar família…"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Nome da família…" value={search} onValueChange={setSearch} />
                  <CommandList>
                    <CommandEmpty>{search.length < 1 ? "Escreve para procurar." : "Sem resultados."}</CommandEmpty>
                    <CommandGroup>
                      {(familias ?? []).map((f: any) => (
                        <CommandItem key={f.id} value={f.id} onSelect={() => { setFamilia({ id: f.id, nome: f.nome }); setOpenCombo(false); }}>
                          {f.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {familia && (
            <div className="space-y-1">
              <Label>Membros</Label>
              <div className="space-y-1 rounded-md border p-2">
                {(membros ?? []).length === 0 && <p className="text-xs text-muted-foreground">Família sem membros ativos.</p>}
                {(membros ?? []).map((m: any) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!selected[m.id]} onCheckedChange={(c) => setSelected({ ...selected, [m.id]: c === true })} />
                    {m.nome_completo}
                  </label>
                ))}
              </div>
            </div>
          )}
          {familia && <DynamicFields fields={fields} values={valores} setValues={setValores} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!familia || submit.isPending}>{submit.isPending ? "A inscrever…" : "Inscrever selecionados"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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