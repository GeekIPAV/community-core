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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Search, Users, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { RegistarAtividadeDialog } from "@/components/registar-atividade-dialog";

export const Route = createFileRoute("/_app/_admin/atividades")({
  component: AtividadesPage,
});

type Atividade = { id: string; nome: string; categoria: string | null; ativo: boolean };
type Registo = {
  id: string;
  atividade_id: string;
  data: string | null;
  descricao: string | null;
  participantes: string[];
  voluntarios: string[];
};

function AtividadesPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", categoria: "" });
  const [editing, setEditing] = useState<Atividade | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [registarEm, setRegistarEm] = useState<Atividade | null>(null);
  const [atribuirOpen, setAtribuirOpen] = useState(false);

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
    queryKey: ["atividade-registos-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atividade_registos")
        .select(
          "id, atividade_id, data, descricao, atividade_registo_participantes(pessoas(nome_completo)), atividade_registo_voluntarios(pessoas(nome_completo))",
        )
        .order("data", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        atividade_id: r.atividade_id,
        data: r.data,
        descricao: r.descricao,
        participantes: (r.atividade_registo_participantes ?? [])
          .map((p: any) => p.pessoas?.nome_completo)
          .filter(Boolean),
        voluntarios: (r.atividade_registo_voluntarios ?? [])
          .map((p: any) => p.pessoas?.nome_completo)
          .filter(Boolean),
      })) as Registo[];
    },
  });

  const removerRegisto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("atividade_registos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registo removido");
      qc.invalidateQueries({ queryKey: ["atividade-registos-admin"] });
      qc.invalidateQueries({ queryKey: ["pessoa-atividades"] });
      qc.invalidateQueries({ queryKey: ["atividade-registos-familia"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
    registos: Registo[];
    nParticipantes: number;
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
      const nomes = new Set<string>();
      for (const r of rs) for (const p of r.participantes) nomes.add(p);
      return { atividade: a, total: rs.length, registos: rs, nParticipantes: nomes.size };
    });
  }, [atividades, registos]);

  const q = query.trim().toLowerCase();
  const linhasFiltradas = q
    ? linhas.filter((l) =>
        l.atividade.nome.toLowerCase().includes(q) ||
        (l.atividade.categoria ?? "").toLowerCase().includes(q) ||
        l.registos.some((r) => r.participantes.some((p) => p.toLowerCase().includes(q))),
      )
    : linhas;

  const grupos = useMemo(() => {
    const map = new Map<string, Linha[]>();
    for (const l of linhasFiltradas) {
      const cat = l.atividade.categoria?.trim() || "Sem categoria";
      const arr = map.get(cat) ?? [];
      arr.push(l);
      map.set(cat, arr);
    }
    const entries = Array.from(map.entries());
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries;
  }, [linhasFiltradas]);

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
            Catálogo de atividades, com os registos de cada uma e quem participou.
          </p>
        </div>
        <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => setAtribuirOpen(true)}>
          <Users className="mr-2 h-4 w-4" /> Atribuir atividade a participantes
        </Button>
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setForm({ nome: "", categoria: "" }); }}>
          <DialogTrigger asChild>
            <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Nova atividade</Button>
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
        <div className="space-y-4">
          {grupos.map(([categoria, items]) => {
            const catOpen = expanded[categoria] !== false;
            return (
              <Collapsible key={categoria} open={catOpen} onOpenChange={(o) => setExpanded((s) => ({ ...s, [categoria]: o }))}>
                <div className="rounded-lg border bg-card">
                  <CollapsibleTrigger asChild>
                    <button className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 rounded-t-lg">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-sm">{categoria}</Badge>
                        <span className="text-sm text-muted-foreground">{items.length} atividade{items.length !== 1 ? "s" : ""}</span>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${catOpen ? "" : "-rotate-90"}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-2">
                      {items.map((l) => {
                        const open = !!expanded[l.atividade.id];
                        return (
                          <div key={l.atividade.id} className="rounded-md border bg-background">
                            <div className={`flex items-center justify-between gap-2 px-3 py-2 ${l.total > 0 ? "cursor-pointer" : ""}`} onClick={() => l.total > 0 && setExpanded((s) => ({ ...s, [l.atividade.id]: !s[l.atividade.id] }))}>
                              <div className="flex items-center gap-2 min-w-0">
                                {l.total > 0 ? (open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />) : <span className="w-4 shrink-0" />}
                                <span className="font-medium truncate">{l.atividade.nome}</span>
                                {!l.atividade.ativo && <Badge variant="outline" className="shrink-0">Inativa</Badge>}
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <span className="text-sm text-muted-foreground tabular-nums">{l.total} registo{l.total !== 1 ? "s" : ""}</span>
                                <span className="text-sm text-muted-foreground tabular-nums">{l.nParticipantes} participante{l.nParticipantes !== 1 ? "s" : ""}</span>
                                <div className="flex items-center gap-1">
                                  <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setRegistarEm(l.atividade); }}>
                                    <Users className="mr-2 h-4 w-4" /> Adicionar participantes
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                      <DropdownMenuItem onClick={() => setEditing(l.atividade)}>
                                        <Pencil className="mr-2 h-4 w-4" /> Editar atividade
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(l.atividade.id)}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar atividade
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                            {open && (
                              <div className="border-t bg-muted/30 px-3 py-2 space-y-2">
                                {l.registos.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">Sem registos.</p>
                                ) : (
                                  l.registos.map((r) => (
                                    <div key={r.id} className="rounded-md border bg-background px-3 py-2 text-sm">
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="text-xs text-muted-foreground">
                                          {r.data ? new Date(r.data).toLocaleDateString("pt-PT") : "sem data"}
                                        </span>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7"
                                          title="Eliminar registo"
                                          onClick={() => removerRegisto.mutate(r.id)}
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {r.participantes.length === 0 ? (
                                          <span className="text-xs text-muted-foreground">Sem participantes</span>
                                        ) : (
                                          r.participantes.map((p) => (
                                            <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                                          ))
                                        )}
                                      </div>
                                      {r.voluntarios.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          {r.voluntarios.map((v) => (
                                            <Badge key={v} variant="outline" className="text-xs">{v}</Badge>
                                          ))}
                                        </div>
                                      )}
                                      {r.descricao && (
                                        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{r.descricao}</p>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
          {grupos.length === 0 && (
            <div className="text-center text-muted-foreground py-6">Sem resultados.</div>
          )}
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

      <RegistarAtividadeDialog
        open={atribuirOpen}
        onOpenChange={setAtribuirOpen}
        escolherParticipantes
        titulo="Atribuir atividade a participantes"
        descricaoDialogo="Escolha a atividade e os participantes (por nome da pessoa ou da família)."
        onRegistado={() => qc.invalidateQueries({ queryKey: ["atividade-registos-admin"] })}
      />

      <RegistarAtividadeDialog
        open={!!registarEm}
        onOpenChange={(o) => { if (!o) setRegistarEm(null); }}
        atividadeIdFixa={registarEm?.id}
        escolherParticipantes
        titulo={registarEm ? `Adicionar participantes — ${registarEm.nome}` : "Adicionar participantes"}
        descricaoDialogo="Escolha os participantes (por nome da pessoa ou da família) e registe a atividade de uma vez."
        onRegistado={() => qc.invalidateQueries({ queryKey: ["atividade-registos-admin"] })}
      />

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