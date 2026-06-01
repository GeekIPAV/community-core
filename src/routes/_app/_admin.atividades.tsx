import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/_admin/atividades")({
  component: AtividadesPage,
});

type Atividade = { id: string; nome: string; categoria: string | null; ativo: boolean };
type Registo = { id: string; atividade_id: string; familia_id: string; data: string | null; descricao: string | null; familia_nome: string };

function AtividadesPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", categoria: "" });
  const [editing, setEditing] = useState<Atividade | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: atividades, isLoading: loadingA } = useQuery({
    queryKey: ["atividades-catalogo-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atividades_catalogo")
        .select("id, nome, categoria, ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Atividade[];
    },
  });

  const { data: registos, isLoading: loadingR } = useQuery({
    queryKey: ["familia-atividades-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familia_atividades")
        .select("id, atividade_id, familia_id, data, descricao, familias(nome)")
        .order("data", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        atividade_id: r.atividade_id,
        familia_id: r.familia_id,
        data: r.data,
        descricao: r.descricao,
        familia_nome: r.familias?.nome ?? "(sem família)",
      })) as Registo[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["atividades-catalogo-admin"] });
    qc.invalidateQueries({ queryKey: ["atividades-catalogo"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const nome = form.nome.trim();
      if (!nome) throw new Error("Nome obrigatório");
      const { error } = await supabase
        .from("atividades_catalogo")
        .insert({ nome, categoria: form.categoria.trim() || null, ativo: true });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atividade adicionada"); invalidate(); setAddOpen(false); setForm({ nome: "", categoria: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const nome = editing.nome.trim();
      if (!nome) throw new Error("Nome obrigatório");
      const { error } = await supabase
        .from("atividades_catalogo")
        .update({ nome, categoria: editing.categoria?.trim() || null, ativo: editing.ativo })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atividade atualizada"); invalidate(); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!deleteId) return;
      const { error } = await supabase.from("atividades_catalogo").delete().eq("id", deleteId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atividade removida"); invalidate(); setDeleteId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  type Linha = {
    atividade: Atividade;
    total: number;
    porFamilia: { familia_id: string; familia_nome: string; count: number; ultima: string | null }[];
  };

  const linhas: Linha[] = useMemo(() => {
    if (!atividades) return [];
    const byAt = new Map<string, Registo[]>();
    for (const r of registos ?? []) {
      const arr = byAt.get(r.atividade_id) ?? [];
      arr.push(r);
      byAt.set(r.atividade_id, arr);
    }
    return atividades.map((a) => {
      const rs = byAt.get(a.id) ?? [];
      const fam = new Map<string, { familia_id: string; familia_nome: string; count: number; ultima: string | null }>();
      for (const r of rs) {
        const k = r.familia_id;
        const cur = fam.get(k) ?? { familia_id: k, familia_nome: r.familia_nome, count: 0, ultima: null };
        cur.count += 1;
        if (r.data && (!cur.ultima || r.data > cur.ultima)) cur.ultima = r.data;
        fam.set(k, cur);
      }
      return {
        atividade: a,
        total: rs.length,
        porFamilia: Array.from(fam.values()).sort((x, y) => y.count - x.count || x.familia_nome.localeCompare(y.familia_nome)),
      };
    });
  }, [atividades, registos]);

  const q = query.trim().toLowerCase();
  const linhasFiltradas = q
    ? linhas.filter((l) =>
        l.atividade.nome.toLowerCase().includes(q) ||
        (l.atividade.categoria ?? "").toLowerCase().includes(q),
      )
    : linhas;

  const totalRegistos = registos?.length ?? 0;
  const totalAtividades = atividades?.length ?? 0;
  const totalUsadas = linhas.filter((l) => l.total > 0).length;

  const loading = loadingA || loadingR;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Atividades e Acompanhamento</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de atividades, com resumo de quantas vezes foram realizadas e em que famílias.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setForm({ nome: "", categoria: "" }); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nova atividade</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova atividade</DialogTitle>
              <DialogDescription>Adicionar uma atividade ao catálogo.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="space-y-1"><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ex: Cultural, Relacional" /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Guardar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Atividades no catálogo</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{totalAtividades}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Atividades já usadas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{totalUsadas}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total de registos</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{totalRegistos}</CardContent></Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Procurar por nome ou categoria…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Atividade</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Vezes</TableHead>
                <TableHead className="text-right">Famílias</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhasFiltradas.map((l) => {
                const open = !!expanded[l.atividade.id];
                return (
                  <Fragment key={l.atividade.id}>
                    <TableRow className={l.total > 0 ? "cursor-pointer" : ""} onClick={() => l.total > 0 && setExpanded((s) => ({ ...s, [l.atividade.id]: !s[l.atividade.id] }))}>
                      <TableCell>
                        {l.total > 0 ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
                      </TableCell>
                      <TableCell className="font-medium">
                        {l.atividade.nome}
                        {!l.atividade.ativo && <Badge variant="outline" className="ml-2">Inativa</Badge>}
                      </TableCell>
                      <TableCell>{l.atividade.categoria ? <Badge variant="secondary">{l.atividade.categoria}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.total}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.porFamilia.length}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(l.atividade); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setDeleteId(l.atividade.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                    {open && l.porFamilia.length > 0 && (
                      <TableRow className="bg-muted/30">
                        <TableCell />
                        <TableCell colSpan={5}>
                          <div className="flex flex-wrap gap-2 py-1">
                            {l.porFamilia.map((f) => (
                              <div key={f.familia_id} className="rounded-md border bg-background px-2 py-1 text-xs flex items-center gap-2">
                                <span className="font-medium">{f.familia_nome}</span>
                                <Badge variant="secondary" className="h-5">{f.count}×</Badge>
                                {f.ultima && <span className="text-muted-foreground">última: {f.ultima}</span>}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {linhasFiltradas.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem resultados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar atividade</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Nome</Label><Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div className="space-y-1"><Label>Categoria</Label><Input value={editing.categoria ?? ""} onChange={(e) => setEditing({ ...editing, categoria: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={() => update.mutate()} disabled={update.isPending}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover atividade?</AlertDialogTitle>
            <AlertDialogDescription>Se tiver registos associados, a remoção pode falhar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}