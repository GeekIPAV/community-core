import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Upload, Users } from "lucide-react";
import { formatDateBR } from "@/lib/utils";

export const Route = createFileRoute("/_app/_admin/familias")({
  component: FamiliasPage,
});

type Familia = { id: string; nome: string; notas: string | null };

function FamiliasPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [notas, setNotas] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Familia | null>(null);

  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkNotas, setBulkNotas] = useState("");

  const [membrosFamilia, setMembrosFamilia] = useState<Familia | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["familias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("familias").select("*").order("nome");
      if (error) throw error;
      return data as Familia[];
    },
  });

  const { data: contagens } = useQuery({
    queryKey: ["familias", "contagens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("familia_id")
        .eq("status", "ativo")
        .not("familia_id", "is", null);
      if (error) throw error;
      const map = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        if (r.familia_id) map.set(r.familia_id, (map.get(r.familia_id) ?? 0) + 1);
      });
      return map;
    },
  });

  const { data: membros, isLoading: loadingMembros } = useQuery({
    queryKey: ["familias", "membros", membrosFamilia?.id],
    enabled: !!membrosFamilia,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, telefone, data_nascimento, status")
        .eq("familia_id", membrosFamilia!.id)
        .order("nome_completo");
      if (error) throw error;
      return data as Array<{ id: string; nome_completo: string; email: string | null; telefone: string | null; data_nascimento: string | null; status: string }>;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["familias"] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("familias").insert({ nome, notas: notas || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Família criada");
      invalidate();
      setAddOpen(false);
      setNome("");
      setNotas("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("familias")
        .update({ nome: editing.nome, notas: editing.notas || null })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Família atualizada");
      invalidate();
      setEditOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkCreate = useMutation({
    mutationFn: async () => {
      const rows = bulkText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const [n, ...rest] = line.split(",");
          const nm = n?.trim();
          if (!nm) throw new Error(`Linha sem nome: "${line}"`);
          return { nome: nm, notas: rest.join(",").trim() || null };
        });
      if (rows.length === 0) throw new Error("Nada para importar");
      const { error } = await supabase.from("familias").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} famílias importadas`);
      invalidate();
      setBulkAddOpen(false);
      setBulkText("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkUpdate = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      if (ids.length === 0) throw new Error("Seleciona pelo menos uma família");
      const { error } = await supabase.from("familias").update({ notas: bulkNotas || null }).in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} famílias atualizadas`);
      invalidate();
      setBulkEditOpen(false);
      setSelected(new Set());
      setBulkNotas("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];
  const allChecked = rows.length > 0 && rows.every((f) => selected.has(f.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) rows.forEach((f) => next.delete(f.id));
    else rows.forEach((f) => next.add(f.id));
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
          <h1 className="text-2xl font-semibold">Famílias</h1>
          <p className="text-sm text-muted-foreground">{rows.length} famílias</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setBulkAddOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importar
          </Button>
          <Button variant="outline" disabled={selected.size === 0} onClick={() => setBulkEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Editar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova família</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova família</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notas">Notas</Label>
                  <Textarea id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!nome || create.isPending}>
                  {create.isPending ? "A guardar…" : "Guardar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={allChecked} onCheckedChange={toggleAll} /></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-24">Membros</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem famílias</TableCell></TableRow>
              )}
              {rows.map((f) => (
                <TableRow key={f.id} className="cursor-pointer" onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest("button, [role=checkbox], input")) return;
                  setMembrosFamilia(f);
                }}>
                  <TableCell><Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggleOne(f.id)} /></TableCell>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{contagens?.get(f.id) ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground">{f.notas ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" title="Ver membros" onClick={() => setMembrosFamilia(f)}>
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Editar" onClick={() => { setEditing({ ...f }); setEditOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar família</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={editing.notas ?? ""} onChange={(e) => setEditing({ ...editing, notas: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => update.mutate()} disabled={!editing?.nome.trim() || update.isPending}>
              {update.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk add */}
      <Dialog open={bulkAddOpen} onOpenChange={setBulkAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Importar famílias em massa</DialogTitle>
            <DialogDescription>
              Uma família por linha: <code>nome, notas</code> (notas opcionais).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={10}
            placeholder={"Família Silva, notas opcionais\nFamília Costa"}
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
            <DialogTitle>Editar {selected.size} famílias</DialogTitle>
            <DialogDescription>As notas serão substituídas em todas as famílias selecionadas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={bulkNotas} onChange={(e) => setBulkNotas(e.target.value)} placeholder="Deixar vazio para limpar" />
          </div>
          <DialogFooter>
            <Button onClick={() => bulkUpdate.mutate()} disabled={bulkUpdate.isPending}>
              {bulkUpdate.isPending ? "A guardar…" : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Membros */}
      <Dialog open={!!membrosFamilia} onOpenChange={(o) => { if (!o) setMembrosFamilia(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Membros de {membrosFamilia?.nome}</DialogTitle>
            <DialogDescription>
              {loadingMembros ? "A carregar…" : `${membros?.length ?? 0} membro(s)`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Data nasc.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!membros || membros.length === 0) && !loadingMembros && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem membros</TableCell></TableRow>
                )}
                {membros?.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nome_completo}</TableCell>
                    <TableCell className="text-muted-foreground">{m.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{m.telefone ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateBR(m.data_nascimento)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}