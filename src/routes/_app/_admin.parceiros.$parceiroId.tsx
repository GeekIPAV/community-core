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
import { ArrowLeft, Calendar, Inbox, Mail, Pencil, Plus, Trash2, User } from "lucide-react";
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
            </TabsList>
            <TabsContent value="projetos" className="mt-6 space-y-3">
              <ProjetosTab parceiroId={parceiroId} projetos={projetos ?? []} />
            </TabsContent>
            <TabsContent value="interacoes" className="mt-6">
              <InteracoesTab parceiroId={parceiroId} />
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
