import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/_admin/participantes")({
  component: ParticipantesPage,
});

type Pessoa = {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  nif: string | null;
  data_nascimento: string | null;
  familia_id: string | null;
  status: string;
  notas: string | null;
  tipo_user_id: string | null;
  genero: string | null;
  nacionalidade: string | null;
  cidade_residencia: string | null;
  religiao: string | null;
};

const STATUS_OPTS = ["ativo", "suspeito_duplicado", "fundido", "arquivado"];
const GENERO_OPTS = ["Masculino", "Feminino"];

const BULK_COLUMNS = [
  "nome",
  "email",
  "telefone",
  "nif",
  "data_nascimento",
  "genero",
  "nacionalidade",
  "cidade_residencia",
  "religiao",
  "familia",
] as const;

const emptyForm: Omit<Pessoa, "id" | "status"> & { status?: string } = {
  nome_completo: "",
  email: "",
  telefone: "",
  nif: "",
  data_nascimento: "",
  familia_id: null,
  notas: "",
  tipo_user_id: null,
  genero: null,
  nacionalidade: "",
  cidade_residencia: "",
  religiao: "",
};

function ParticipantesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Pessoa | null>(null);

  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkFamilia, setBulkFamilia] = useState<string>("__noop");
  const [bulkStatus, setBulkStatus] = useState<string>("__noop");
  const [bulkTipo, setBulkTipo] = useState<string>("__noop");

  const [deleteOne, setDeleteOne] = useState<Pessoa | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pessoas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, telefone, nif, data_nascimento, familia_id, status, notas, tipo_user_id, genero, nacionalidade, cidade_residencia, religiao")
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return data as Pessoa[];
    },
  });

  const { data: familias } = useQuery({
    queryKey: ["familias_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("familias").select("id, nome").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  const { data: tipos } = useQuery({
    queryKey: ["tipos_user_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tipos_user").select("id, nome").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  const tipoName = (id: string | null) =>
    id ? tipos?.find((t) => t.id === id)?.nome ?? "—" : "—";

  const familiaName = (id: string | null) =>
    id ? familias?.find((f) => f.id === id)?.nome ?? "—" : "—";

  const filtered = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    if (!s) return data;
    return data.filter((p) =>
      [p.nome_completo, p.email, p.telefone, p.nif]
        .filter(Boolean)
        .some((v: any) => String(v).toLowerCase().includes(s)),
    );
  }, [data, q]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pessoas"] });

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        nome_completo: form.nome_completo.trim(),
        email: form.email?.trim() || null,
        telefone: form.telefone?.trim() || null,
        nif: form.nif?.trim() || null,
        data_nascimento: form.data_nascimento || null,
        familia_id: form.familia_id || null,
        notas: form.notas?.trim() || null,
        tipo_user_id: form.tipo_user_id || null,
        genero: form.genero || null,
        nacionalidade: form.nacionalidade?.trim() || null,
        cidade_residencia: form.cidade_residencia?.trim() || null,
        religiao: form.religiao?.trim() || null,
      };
      const { error } = await supabase.from("pessoas").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pessoa criada");
      invalidate();
      setAddOpen(false);
      setForm({ ...emptyForm });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("pessoas")
        .update({
          nome_completo: editing.nome_completo,
          email: editing.email || null,
          telefone: editing.telefone || null,
          nif: editing.nif || null,
          data_nascimento: editing.data_nascimento || null,
          familia_id: editing.familia_id || null,
          status: editing.status as any,
          notas: editing.notas || null,
          tipo_user_id: editing.tipo_user_id || null,
          genero: editing.genero || null,
          nacionalidade: editing.nacionalidade || null,
          cidade_residencia: editing.cidade_residencia || null,
          religiao: editing.religiao || null,
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pessoa atualizada");
      invalidate();
      setEditOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkCreate = useMutation({
    mutationFn: async () => {
      const rows = parseBulkCsv(bulkText, familias ?? []);
      if (rows.length === 0) throw new Error("Nada para importar");
      const { error } = await supabase.from("pessoas").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} pessoas importadas`);
      invalidate();
      setBulkAddOpen(false);
      setBulkText("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkUpdate = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      if (ids.length === 0) throw new Error("Seleciona pelo menos uma pessoa");
      const patch: {
        familia_id?: string | null;
        status?: any;
        tipo_user_id?: string | null;
        genero?: string | null;
        nacionalidade?: string | null;
        cidade_residencia?: string | null;
        religiao?: string | null;
      } = {};
      if (bulkFamilia !== "__noop") patch.familia_id = bulkFamilia === "__null" ? null : bulkFamilia;
      if (bulkStatus !== "__noop") patch.status = bulkStatus;
      if (bulkTipo !== "__noop") patch.tipo_user_id = bulkTipo === "__null" ? null : bulkTipo;
      if (bulkGenero !== "__noop") patch.genero = bulkGenero === "__null" ? null : bulkGenero;
      if (bulkNacionalidade.trim()) patch.nacionalidade = bulkNacionalidade.trim();
      if (bulkCidade.trim()) patch.cidade_residencia = bulkCidade.trim();
      if (bulkReligiao.trim()) patch.religiao = bulkReligiao.trim();
      if (Object.keys(patch).length === 0) throw new Error("Nada para alterar");
      const { error } = await supabase.from("pessoas").update(patch).in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} pessoas atualizadas`);
      invalidate();
      setBulkEditOpen(false);
      setSelected(new Set());
      setBulkFamilia("__noop");
      setBulkStatus("__noop");
      setBulkTipo("__noop");
      setBulkGenero("__noop");
      setBulkNacionalidade("");
      setBulkCidade("");
      setBulkReligiao("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) throw new Error("Nada para apagar");
      const { error } = await supabase.from("pessoas").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} ${n === 1 ? "pessoa apagada" : "pessoas apagadas"}`);
      invalidate();
      setDeleteOne(null);
      setBulkDeleteOpen(false);
      setSelected(new Set());
      setEditOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allChecked = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) filtered.forEach((p) => next.delete(p.id));
    else filtered.forEach((p) => next.add(p.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Participantes</h1>
          <p className="text-sm text-muted-foreground">{data?.length ?? 0} pessoas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Pesquisar…" className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button variant="outline" onClick={() => setBulkAddOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importar
          </Button>
          <Button
            variant="outline"
            disabled={selected.size === 0}
            onClick={() => setBulkEditOpen(true)}
          >
            <Pencil className="mr-2 h-4 w-4" /> Editar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
          <Button
            variant="destructive"
            disabled={selected.size === 0}
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Apagar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {!isLoading && !error && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Família</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">Sem resultados</TableCell>
                </TableRow>
              )}
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{p.nome_completo}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.telefone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{familiaName(p.familia_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{tipoName(p.tipo_user_id)}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "ativo" ? "default" : p.status === "suspeito_duplicado" ? "destructive" : "outline"}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing({ ...p }); setEditOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteOne(p)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova pessoa</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome *" className="col-span-2">
              <Input value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} />
            </Field>
            <Field label="Email"><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Telefone"><Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field>
            <Field label="NIF"><Input value={form.nif ?? ""} onChange={(e) => setForm({ ...form, nif: e.target.value })} /></Field>
            <Field label="Data nascimento"><Input type="date" value={form.data_nascimento ?? ""} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} /></Field>
            <Field label="Família" className="col-span-2">
              <Select value={form.familia_id ?? "__null"} onValueChange={(v) => setForm({ ...form, familia_id: v === "__null" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__null">— sem família —</SelectItem>
                  {familias?.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo de utilizador" className="col-span-2">
              <Select value={form.tipo_user_id ?? "__null"} onValueChange={(v) => setForm({ ...form, tipo_user_id: v === "__null" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__null">— sem tipo —</SelectItem>
                  {tipos?.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Notas" className="col-span-2"><Textarea value={form.notas ?? ""} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!form.nome_completo.trim() || create.isPending}>
              {create.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar pessoa</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome *" className="col-span-2"><Input value={editing.nome_completo} onChange={(e) => setEditing({ ...editing, nome_completo: e.target.value })} /></Field>
              <Field label="Email"><Input value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
              <Field label="Telefone"><Input value={editing.telefone ?? ""} onChange={(e) => setEditing({ ...editing, telefone: e.target.value })} /></Field>
              <Field label="NIF"><Input value={editing.nif ?? ""} onChange={(e) => setEditing({ ...editing, nif: e.target.value })} /></Field>
              <Field label="Data nascimento"><Input type="date" value={editing.data_nascimento ?? ""} onChange={(e) => setEditing({ ...editing, data_nascimento: e.target.value })} /></Field>
              <Field label="Família" className="col-span-2">
                <Select value={editing.familia_id ?? "__null"} onValueChange={(v) => setEditing({ ...editing, familia_id: v === "__null" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__null">— sem família —</SelectItem>
                    {familias?.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de utilizador" className="col-span-2">
                <Select value={editing.tipo_user_id ?? "__null"} onValueChange={(v) => setEditing({ ...editing, tipo_user_id: v === "__null" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__null">— sem tipo —</SelectItem>
                    {tipos?.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Estado" className="col-span-2">
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Notas" className="col-span-2"><Textarea value={editing.notas ?? ""} onChange={(e) => setEditing({ ...editing, notas: e.target.value })} /></Field>
            </div>
          )}
          <DialogFooter className="sm:justify-between">
            <Button
              variant="destructive"
              onClick={() => editing && setDeleteOne(editing)}
              disabled={!editing || remove.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Apagar
            </Button>
            <Button onClick={() => update.mutate()} disabled={!editing?.nome_completo.trim() || update.isPending}>
              {update.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk add */}
      <Dialog open={bulkAddOpen} onOpenChange={setBulkAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Importar pessoas em massa</DialogTitle>
            <DialogDescription>
              Uma pessoa por linha, valores separados por vírgula na ordem:{" "}
              <code>nome, email, telefone, nif, data_nascimento (AAAA-MM-DD)</code>. Só o nome é obrigatório.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={10}
            placeholder={"Ana Silva, ana@mail.com, 912345678, 123456789, 1990-04-12\nJoão Costa, , , , "}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={() => bulkCreate.mutate()} disabled={!bulkText.trim() || bulkCreate.isPending}>
              {bulkCreate.isPending ? "A importar…" : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk edit */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {selected.size} pessoas</DialogTitle>
            <DialogDescription>Só os campos alterados serão aplicados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Família">
              <Select value={bulkFamilia} onValueChange={setBulkFamilia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__noop">— não alterar —</SelectItem>
                  <SelectItem value="__null">— remover família —</SelectItem>
                  {familias?.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Estado">
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__noop">— não alterar —</SelectItem>
                  {STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo de utilizador">
              <Select value={bulkTipo} onValueChange={setBulkTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__noop">— não alterar —</SelectItem>
                  <SelectItem value="__null">— remover tipo —</SelectItem>
                  {tipos?.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => bulkUpdate.mutate()} disabled={bulkUpdate.isPending}>
              {bulkUpdate.isPending ? "A guardar…" : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete single */}
      <AlertDialog open={!!deleteOne} onOpenChange={(o) => !o && setDeleteOne(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar pessoa</AlertDialogTitle>
            <AlertDialogDescription>
              Tens a certeza que queres apagar <strong>{deleteOne?.nome_completo}</strong>? Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteOne && remove.mutate([deleteOne.id])}
              disabled={remove.isPending}
            >
              {remove.isPending ? "A apagar…" : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar {selected.size} pessoas</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => remove.mutate(Array.from(selected))}
              disabled={remove.isPending}
            >
              {remove.isPending ? "A apagar…" : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function parseBulkCsv(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [nome, email, telefone, nif, data_nascimento] = line.split(",").map((x) => x?.trim() ?? "");
      if (!nome) throw new Error(`Linha sem nome: "${line}"`);
      return {
        nome_completo: nome,
        email: email || null,
        telefone: telefone || null,
        nif: nif || null,
        data_nascimento: data_nascimento || null,
      };
    });
}