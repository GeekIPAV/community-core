import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Inbox, Pencil, Plus, Trash2 } from "lucide-react";
import { InlineMultiSelect } from "@/components/inline-edit";

export const Route = createFileRoute("/_app/_admin/parceiros/")({
  component: ParceirosPage,
});

export type Parceiro = {
  id: string;
  nome: string;
  tipo: string | null;
  estado: string;
  pessoa_contacto: string | null;
  email_contacto: string | null;
  notas: string | null;
};

export const TIPOS_PARCEIRO = ["Institucional", "Financiador", "Comunitário", "Outro"];
export const ESTADOS_PARCEIRO = ["Ativa", "Em negociação", "Inativa"];

export function tipoBadgeClass(tipo: string | null) {
  switch (tipo) {
    case "Institucional": return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
    case "Financiador": return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "Comunitário": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function estadoBadgeClass(estado: string) {
  switch (estado) {
    case "Ativa": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "Em negociação": return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function ParceirosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tipos, setTipos] = useState<string[]>([]);
  const [estados, setEstados] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Parceiro | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: parceiros, isLoading } = useQuery({
    queryKey: ["parceiros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parceiros")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Parceiro[];
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["parceiros", "projeto-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parceiro_projetos").select("parceiro_id");
      if (error) throw error;
      const m = new Map<string, number>();
      for (const r of (data ?? []) as { parceiro_id: string }[]) {
        m.set(r.parceiro_id, (m.get(r.parceiro_id) ?? 0) + 1);
      }
      return m;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (parceiros ?? []).filter((p) => {
      if (q && !p.nome.toLowerCase().includes(q) && !(p.pessoa_contacto ?? "").toLowerCase().includes(q) && !(p.email_contacto ?? "").toLowerCase().includes(q)) return false;
      if (tipos.length > 0 && !tipos.includes(p.tipo ?? "")) return false;
      if (estados.length > 0 && !estados.includes(p.estado)) return false;
      return true;
    });
  }, [parceiros, search, tipos, estados]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parceiros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Parceiro removido"); qc.invalidateQueries({ queryKey: ["parceiros"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (p: Parceiro) => { setEditing(p); setOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Parceiros</h1>
          <p className="text-sm text-muted-foreground">{parceiros?.length ?? 0} parceiros</p>
        </div>
        <Button onClick={openNew}><Plus className="me-2 h-4 w-4" /> Novo parceiro</Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}>Importar (colar)</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar parceiros..."
          className="max-w-xs"
        />
        <InlineMultiSelect
          values={tipos}
          options={TIPOS_PARCEIRO.map((t) => ({ value: t, label: t }))}
          onSave={(v) => setTipos(v)}
          placeholder="Tipo"
        />
        <InlineMultiSelect
          values={estados}
          options={ESTADOS_PARCEIRO.map((t) => ({ value: t, label: t }))}
          onSave={(v) => setEstados(v)}
          placeholder="Estado"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
          <Inbox className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sem parceiros
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Projetos</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      to="/parceiros/$parceiroId"
                      params={{ parceiroId: p.id }}
                      className="font-medium hover:underline"
                    >
                      {p.nome}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {p.tipo ? <Badge variant="outline" className={tipoBadgeClass(p.tipo)}>{p.tipo}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={estadoBadgeClass(p.estado)}>{p.estado}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.pessoa_contacto ?? "—"}</TableCell>
                  <TableCell>
                    {p.email_contacto ? (
                      <a href={`mailto:${p.email_contacto}`} className="text-primary hover:underline">{p.email_contacto}</a>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex h-6 min-w-8 items-center justify-center rounded-full bg-muted px-2 text-xs font-medium tabular-nums">
                      {counts?.get(p.id) ?? 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover "${p.nome}"?`)) remove.mutate(p.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ParceiroDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["parceiros"] })}
      />
      <ParceirosImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => qc.invalidateQueries({ queryKey: ["parceiros"] })}
      />
    </div>
  );
}

export function ParceiroDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Parceiro | null;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [estado, setEstado] = useState("Ativa");
  const [contacto, setContacto] = useState("");
  const [email, setEmail] = useState("");
  const [notas, setNotas] = useState("");
  const [projetoIds, setProjetoIds] = useState<string[]>([]);

  const { data: projetos } = useQuery({
    queryKey: ["projetos", "lista-parceiro"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const { data: existentes } = useQuery({
    queryKey: ["parceiro-projetos", editing?.id],
    enabled: !!editing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parceiro_projetos")
        .select("projeto_id")
        .eq("parceiro_id", editing!.id);
      if (error) throw error;
      return ((data ?? []) as { projeto_id: string }[]).map((r) => r.projeto_id);
    },
  });

  useEffect(() => {
    if (!open) return;
    setNome(editing?.nome ?? "");
    setTipo(editing?.tipo ?? "");
    setEstado(editing?.estado ?? "Ativa");
    setContacto(editing?.pessoa_contacto ?? "");
    setEmail(editing?.email_contacto ?? "");
    setNotas(editing?.notas ?? "");
    setProjetoIds(existentes ?? []);
  }, [open, editing, existentes]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: nome.trim(),
        tipo: tipo || null,
        estado,
        pessoa_contacto: contacto.trim() || null,
        email_contacto: email.trim() || null,
        notas: notas.trim() || null,
      };
      let id = editing?.id;
      if (editing) {
        const { error } = await supabase.from("parceiros").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("parceiros").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      if (id) {
        await supabase.from("parceiro_projetos").delete().eq("parceiro_id", id);
        if (projetoIds.length > 0) {
          const { error } = await supabase
            .from("parceiro_projetos")
            .insert(projetoIds.map((pid) => ({ parceiro_id: id!, projeto_id: pid })));
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Parceiro atualizado" : "Parceiro criado");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar parceiro" : "Novo parceiro"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo || "__none"} onValueChange={(v) => setTipo(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {TIPOS_PARCEIRO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS_PARCEIRO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Pessoa de contacto</Label>
            <Input value={contacto} onChange={(e) => setContacto(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email de contacto</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Projetos associados</Label>
            <InlineMultiSelect
              values={projetoIds}
              options={(projetos ?? []).map((p) => ({ value: p.id, label: p.nome }))}
              onSave={(v) => setProjetoIds(v)}
              placeholder="Sem projetos"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea rows={4} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!nome.trim() || save.isPending}>
            {save.isPending ? "A guardar…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}