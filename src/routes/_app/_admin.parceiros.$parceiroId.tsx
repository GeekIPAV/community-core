import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Calendar, Inbox, Mail, Pencil, Plus, Trash2, User, UserPlus, X, Search, Star } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  ParceiroDialog,
  estadoBadgeClass,
  tipoBadgeClass,
  ESTADOS_PARCEIRO,
  type Parceiro,
} from "./_admin.parceiros.index";
import { InlineMultiSelect } from "@/components/inline-edit";

export const Route = createFileRoute("/_app/_admin/parceiros/$parceiroId")({
  component: ParceiroDetailPage,
});

type Interacao = {
  id: string;
  parceiro_id: string;
  data: string;
  tipo: string | null;
  notas: string | null;
  created_at: string;
};

const TIPOS_INTERACAO = ["Reunião", "Email", "Chamada", "Evento", "Outro"];

function ParceiroDetailPage() {
  const { parceiroId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: parceiro, isLoading } = useQuery({
    queryKey: ["parceiro", parceiroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parceiros")
        .select("*")
        .eq("id", parceiroId)
        .maybeSingle();
      if (error) throw error;
      return data as Parceiro | null;
    },
  });

  const { data: projetos } = useQuery({
    queryKey: ["parceiro-projetos", parceiroId, "expand"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parceiro_projetos")
        .select("projeto:projetos(id, nome, descricao)")
        .eq("parceiro_id", parceiroId);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => r.projeto).filter(Boolean) as { id: string; nome: string; descricao: string | null }[];
    },
  });

  const { data: contactos } = useQuery({
    queryKey: ["parceiro-contactos", parceiroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, telefone")
        .eq("parceiro_id", parceiroId)
        .is("deleted_at", null)
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []) as { id: string; nome_completo: string; email: string | null; telefone: string | null }[];
    },
  });

  const setContactoPrincipal = useMutation({
    mutationFn: async (c: { nome: string; email: string | null }) => {
      const { error } = await supabase
        .from("parceiros")
        .update({ pessoa_contacto: c.nome, email_contacto: c.email })
        .eq("id", parceiroId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contacto principal definido");
      qc.invalidateQueries({ queryKey: ["parceiro", parceiroId] });
      qc.invalidateQueries({ queryKey: ["parceiros"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEstado = useMutation({
    mutationFn: async (estado: string) => {
      const { error } = await supabase.from("parceiros").update({ estado }).eq("id", parceiroId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Estado atualizado"); qc.invalidateQueries({ queryKey: ["parceiro", parceiroId] }); qc.invalidateQueries({ queryKey: ["parceiros"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!parceiro) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/parceiros" })}>
          <ArrowLeft className="me-1 h-4 w-4" /> Voltar
        </Button>
        <p className="text-muted-foreground">Parceiro não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/parceiros" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="me-1 h-3 w-3" /> Parceiros
      </Link>
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <h1 className="text-xl font-semibold leading-tight">{parceiro.nome}</h1>
          <div className="flex flex-wrap gap-2">
            {parceiro.tipo && <Badge variant="outline" className={tipoBadgeClass(parceiro.tipo)}>{parceiro.tipo}</Badge>}
            <Select value={parceiro.estado} onValueChange={(v) => updateEstado.mutate(v)}>
              <SelectTrigger className={`h-7 border ${estadoBadgeClass(parceiro.estado)}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_PARCEIRO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <span>{parceiro.pessoa_contacto ?? <span className="text-muted-foreground">Sem contacto</span>}</span>
            </div>
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
              {parceiro.email_contacto ? (
                <a href={`mailto:${parceiro.email_contacto}`} className="text-primary hover:underline break-all">{parceiro.email_contacto}</a>
              ) : <span className="text-muted-foreground">Sem email</span>}
            </div>
            <div className="text-muted-foreground">{projetos?.length ?? 0} projetos associados</div>
          </div>
          {parceiro.notas && (
            <div className="border-t pt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Notas</p>
              <p className="text-sm whitespace-pre-wrap">{parceiro.notas}</p>
            </div>
          )}
          <div className="border-t pt-4">
            <Button variant="outline" className="w-full" onClick={() => setEditOpen(true)}>
              <Pencil className="me-2 h-4 w-4" /> Editar parceiro
            </Button>
          </div>
        </aside>

        <main>
          <Tabs defaultValue="projetos">
            <TabsList>
              <TabsTrigger value="projetos">Projetos</TabsTrigger>
              <TabsTrigger value="interacoes">Interações</TabsTrigger>
              <TabsTrigger value="contactos">Contactos</TabsTrigger>
            </TabsList>
            <TabsContent value="projetos" className="mt-6 space-y-3">
              <ProjetosTab parceiroId={parceiroId} projetos={projetos ?? []} />
            </TabsContent>
            <TabsContent value="interacoes" className="mt-6">
              <InteracoesTab parceiroId={parceiroId} />
            </TabsContent>
            <TabsContent value="contactos" className="mt-6 space-y-3">
              <ContactosTab
                parceiroId={parceiroId}
                contactos={contactos ?? []}
                principalNome={parceiro.pessoa_contacto}
                onDefinirPrincipal={(c) => setContactoPrincipal.mutate(c)}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <ParceiroDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={parceiro}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["parceiro", parceiroId] }); qc.invalidateQueries({ queryKey: ["parceiro-projetos", parceiroId, "expand"] }); qc.invalidateQueries({ queryKey: ["parceiros"] }); }}
      />
    </div>
  );
}

function ProjetosTab({ parceiroId, projetos }: { parceiroId: string; projetos: { id: string; nome: string; descricao: string | null }[] }) {
  const qc = useQueryClient();
  const { data: todos } = useQuery({
    queryKey: ["projetos", "lista-parceiro"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const associar = useMutation({
    mutationFn: async (ids: string[]) => {
      await supabase.from("parceiro_projetos").delete().eq("parceiro_id", parceiroId);
      if (ids.length > 0) {
        const { error } = await supabase
          .from("parceiro_projetos")
          .insert(ids.map((projeto_id) => ({ parceiro_id: parceiroId, projeto_id })));
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Projetos atualizados"); qc.invalidateQueries({ queryKey: ["parceiro-projetos", parceiroId, "expand"] }); qc.invalidateQueries({ queryKey: ["parceiros", "projeto-counts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const ids = projetos.map((p) => p.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{projetos.length} projetos associados</p>
        <InlineMultiSelect
          values={ids}
          options={(todos ?? []).map((p) => ({ value: p.id, label: p.nome }))}
          onSave={(v) => associar.mutate(v)}
          placeholder="Associar projetos"
        />
      </div>
      {projetos.length === 0 ? (
        <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
          <Inbox className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sem projetos associados
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {projetos.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <Link to="/projetos/$projetoId" params={{ projetoId: p.id }} className="font-medium hover:underline">
                  {p.nome}
                </Link>
                {p.descricao && <p className="text-xs text-muted-foreground truncate">{p.descricao}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Contacto = { id: string; nome_completo: string; email: string | null; telefone: string | null };

function ContactosTab({
  parceiroId,
  contactos,
  principalNome,
  onDefinirPrincipal,
}: {
  parceiroId: string;
  contactos: Contacto[];
  principalNome: string | null;
  onDefinirPrincipal: (c: { nome: string; email: string | null }) => void;
}) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");

  const { data: tipoParceiroId } = useQuery({
    queryKey: ["tipo-user-parceiro-id"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_user")
        .select("id, nome")
        .ilike("nome", "parceiro")
        .maybeSingle();
      if (error) throw error;
      return (data?.id ?? null) as string | null;
    },
  });

  const { data: disponiveis } = useQuery({
    queryKey: ["parceiros-contactos-disponiveis", tipoParceiroId, parceiroId],
    enabled: !!tipoParceiroId && addOpen,
    queryFn: async () => {
      // Pessoas com tipo parceiro (tipo_user_id ou junção pessoa_tipos), sem parceiro_id atribuído
      const [{ data: mainTipo, error: e1 }, { data: viaJuncao, error: e2 }] = await Promise.all([
        supabase
          .from("pessoas")
          .select("id, nome_completo, email, telefone, parceiro_id, tipo_user_id")
          .is("deleted_at", null)
          .is("parceiro_id", null)
          .eq("tipo_user_id", tipoParceiroId!)
          .order("nome_completo"),
        supabase
          .from("pessoa_tipos")
          .select("pessoa:pessoas(id, nome_completo, email, telefone, parceiro_id)")
          .eq("tipo_user_id", tipoParceiroId!),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const map = new Map<string, Contacto>();
      ((mainTipo ?? []) as any[]).forEach((p) => map.set(p.id, p));
      ((viaJuncao ?? []) as any[]).forEach((r) => {
        const p = r.pessoa;
        if (p && !p.parceiro_id) map.set(p.id, p);
      });
      return Array.from(map.values()).sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["parceiro-contactos", parceiroId] });
    qc.invalidateQueries({ queryKey: ["parceiros-contactos-disponiveis"] });
  };

  const associar = useMutation({
    mutationFn: async (pessoaId: string) => {
      const { error } = await supabase
        .from("pessoas")
        .update({ parceiro_id: parceiroId })
        .eq("id", pessoaId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Contacto adicionado"); invalidateAll(); setAddOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const desassociar = useMutation({
    mutationFn: async (pessoaId: string) => {
      const { error } = await supabase
        .from("pessoas")
        .update({ parceiro_id: null })
        .eq("id", pessoaId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Contacto removido"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const criar = useMutation({
    mutationFn: async () => {
      const nome = novoNome.trim();
      if (!nome) throw new Error("Nome obrigatório");
      const payload: any = {
        nome_completo: nome,
        email: novoEmail.trim() || null,
        telefone: novoTelefone.trim() || null,
        status: "ativo",
        parceiro_id: parceiroId,
      };
      if (tipoParceiroId) payload.tipo_user_id = tipoParceiroId;
      const { error } = await supabase.from("pessoas").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contacto criado");
      invalidateAll();
      setNovoOpen(false);
      setNovoNome(""); setNovoEmail(""); setNovoTelefone("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtrados = (disponiveis ?? []).filter((p) =>
    !search.trim() || p.nome_completo.toLowerCase().includes(search.toLowerCase()) || (p.email ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Pessoas do tipo <strong>Parceiro</strong> associadas a esta entidade.
        </p>
        <div className="flex gap-2">
          <Popover open={addOpen} onOpenChange={setAddOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm"><UserPlus className="me-1 h-4 w-4" /> Adicionar existente</Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Procurar parceiro…" value={search} onValueChange={setSearch} />
                <CommandList>
                  <CommandEmpty>
                    Sem parceiros disponíveis.
                  </CommandEmpty>
                  <CommandGroup>
                    {filtrados.map((p) => (
                      <CommandItem key={p.id} value={p.id} onSelect={() => associar.mutate(p.id)}>
                        <div className="flex flex-col">
                          <span className="font-medium">{p.nome_completo}</span>
                          {p.email && <span className="text-xs text-muted-foreground">{p.email}</span>}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button size="sm" onClick={() => setNovoOpen(true)}><Plus className="me-1 h-4 w-4" /> Novo parceiro</Button>
        </div>
      </div>

      {(contactos.length === 0) ? (
        <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
          <Inbox className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sem pessoas de contacto
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {contactos.map((c) => {
            const isPrincipal = principalNome && principalNome === c.nome_completo;
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to="/participantes"
                      className="truncate font-medium hover:underline"
                    >
                      {c.nome_completo}
                    </Link>
                    {isPrincipal && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="h-3 w-3" /> Principal
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {c.email && <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>}
                    {c.telefone && <span>{c.telefone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!isPrincipal && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Definir como contacto principal"
                      onClick={() => onDefinirPrincipal({ nome: c.nome_completo, email: c.email })}
                    >
                      <Star className="me-1 h-3.5 w-3.5" /> Principal
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Remover desta entidade"
                    onClick={() => { if (confirm("Remover este contacto da entidade?")) desassociar.mutate(c.id); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo parceiro para esta entidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={novoTelefone} onChange={(e) => setNovoTelefone(e.target.value)} />
            </div>
            {!tipoParceiroId && (
              <p className="text-xs text-amber-600">
                Tipo &quot;Parceiro&quot; não encontrado — a pessoa será criada sem tipo atribuído.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending || !novoNome.trim()}>
              {criar.isPending ? "A criar…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InteracoesTab({ parceiroId }: { parceiroId: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Interacao | null>(null);
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState("Reunião");
  const [notas, setNotas] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["parceiro-interacoes", parceiroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parceiro_interacoes")
        .select("*")
        .eq("parceiro_id", parceiroId)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Interacao[];
    },
  });

  const openNew = () => {
    setEditing(null);
    setData(new Date().toISOString().slice(0, 10));
    setTipo("Reunião");
    setNotas("");
    setAddOpen(true);
  };

  const openEdit = (r: Interacao) => {
    setEditing(r);
    setData(r.data);
    setTipo(r.tipo ?? "Reunião");
    setNotas(r.notas ?? "");
    setAddOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { parceiro_id: parceiroId, data, tipo, notas: notas.trim() || null };
      if (editing) {
        const { error } = await supabase.from("parceiro_interacoes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("parceiro_interacoes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "Interação atualizada" : "Interação registada"); qc.invalidateQueries({ queryKey: ["parceiro-interacoes", parceiroId] }); setAddOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parceiro_interacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Interação removida"); qc.invalidateQueries({ queryKey: ["parceiro-interacoes", parceiroId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rows?.length ?? 0} interações</p>
        <Button onClick={openNew}><Plus className="me-2 h-4 w-4" /> Registar interação</Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (rows?.length ?? 0) === 0 ? (
        <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
          <Inbox className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sem interações registadas
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex flex-col items-center gap-1 pt-0.5 text-xs text-muted-foreground w-24">
                <Calendar className="h-3.5 w-3.5" />
                <span className="tabular-nums">{new Date(r.data).toLocaleDateString("pt-PT")}</span>
              </div>
              <div className="flex-1 min-w-0">
                {r.tipo && <Badge variant="secondary" className="mb-1">{r.tipo}</Badge>}
                {r.notas && <p className="text-sm whitespace-pre-wrap">{r.notas}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover esta interação?")) remove.mutate(r.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar interação" : "Registar interação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_INTERACAO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea rows={4} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
