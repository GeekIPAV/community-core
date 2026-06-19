import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X, UserPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnOrderState,
} from "@tanstack/react-table";
import { AdvancedTableFilters, advancedFilterFn, type ColumnFilterMeta } from "@/components/advanced-table-filters";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { DraggableTableHeaders } from "@/components/draggable-table-headers";
import { useMobileColumnVisibility } from "@/hooks/use-mobile-columns";

export const Route = createFileRoute("/_app/_admin/projetos")({
  component: ProjetosPage,
});

type Projeto = { id: string; nome: string; descricao: string | null };
type PessoaLite = { id: string; nome_completo: string; email: string | null; projeto_ids: string[]; familia_id: string | null; is_voluntario: boolean };
type FamiliaLite = { id: string; nome: string };

function ProjetosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Projeto | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["projetos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome, descricao")
        .order("nome");
      if (error) throw error;
      return data as Projeto[];
    },
  });

  const { data: contagens } = useQuery({
    queryKey: ["projetos", "contagens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("projeto_ids")
        .eq("status", "ativo")
        .not("projeto_ids", "is", null);
      if (error) throw error;
      const m = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        for (const pid of (r.projeto_ids ?? []) as string[]) {
          m.set(pid, (m.get(pid) ?? 0) + 1);
        }
      });
      return m;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["projetos"] });
    qc.invalidateQueries({ queryKey: ["projeto-membros"] });
  };

  const openNew = () => { setEditing(null); setNome(""); setDescricao(""); setOpen(true); };
  const openEdit = (p: Projeto) => { setEditing(p); setNome(p.nome); setDescricao(p.descricao ?? ""); setOpen(true); };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { nome: nome.trim(), descricao: descricao.trim() || null };
      if (editing) {
        const { error } = await supabase.from("projetos").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projetos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "Projeto atualizado" : "Projeto criado"); invalidate(); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projetos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Projeto removido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns = useMemo<ColumnDef<Projeto>[]>(() => [
    { id: "nome", header: "Nome", accessorKey: "nome", cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>, filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Nome" } satisfies ColumnFilterMeta },
    { id: "descricao", header: "Descrição", accessorKey: "descricao", cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span>, filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Descrição" } satisfies ColumnFilterMeta },
    { id: "pessoas", header: "Pessoas", accessorFn: (p) => contagens?.get(p.id) ?? 0, cell: ({ getValue }) => {
        const n = getValue() as number;
        return <span className="inline-flex h-6 min-w-8 items-center justify-center rounded-full bg-muted px-2 text-xs font-medium tabular-nums">{n}</span>;
      }, filterFn: advancedFilterFn as any, meta: { filterVariant: "number", label: "Pessoas" } satisfies ColumnFilterMeta },
  ], [contagens]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);

  const table = useReactTable({
    columnResizeMode: "onChange",
    defaultColumn: { minSize: 60, size: 160, maxSize: 800 },
    data: data ?? [],
    columns,
    state: { sorting, columnVisibility, columnOrder },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (r) => r.id,
  });

  useMobileColumnVisibility(table, ["nome", "pessoas"]);
  const tableRows = table.getRowModel().rows;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Projetos</h1>
          <p className="text-sm text-muted-foreground">{data?.length ?? 0} projetos</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdvancedTableFilters table={table} />
          <DataTableViewOptions table={table} />
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo projeto</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <DraggableTableHeaders table={table} onOrderChange={setColumnOrder} />
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.length === 0 && (
                <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length + 1} className="text-center text-muted-foreground">Sem projetos</TableCell></TableRow>
              )}
              {tableRows.map((row) => {
                const p = row.original;
                return (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover o projeto "${p.nome}"?`)) remove.mutate(p.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar projeto" : "Novo projeto"}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            {editing && <ProjetoMembros projetoId={editing.id} />}
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={!nome.trim() || save.isPending}>
              {save.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjetoMembros({ projetoId }: { projetoId: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: pessoas, isLoading } = useQuery({
    queryKey: ["projeto-membros", "all-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, projeto_ids, familia_id, is_voluntario")
        .eq("status", "ativo")
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []) as PessoaLite[];
    },
  });

  const { data: familias } = useQuery({
    queryKey: ["projeto-membros", "familias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("familias").select("id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as FamiliaLite[];
    },
  });

  const familiasDisponiveis = useMemo(() => {
    const byFam = new Map<string, PessoaLite[]>();
    for (const p of pessoas ?? []) {
      if (!p.familia_id) continue;
      if ((p.projeto_ids ?? []).includes(projetoId)) continue;
      const arr = byFam.get(p.familia_id) ?? [];
      arr.push(p);
      byFam.set(p.familia_id, arr);
    }
    return (familias ?? [])
      .map((f) => ({ ...f, pessoas: byFam.get(f.id) ?? [] }))
      .filter((f) => f.pessoas.length > 0);
  }, [pessoas, familias, projetoId]);

  const membros = useMemo(
    () => (pessoas ?? []).filter((p) => (p.projeto_ids ?? []).includes(projetoId)),
    [pessoas, projetoId],
  );
  const disponiveis = useMemo(
    () => (pessoas ?? []).filter((p) => !(p.projeto_ids ?? []).includes(projetoId)),
    [pessoas, projetoId],
  );
  const voluntariosNoProjeto = useMemo(() => membros.filter((p) => p.is_voluntario), [membros]);
  const voluntariosDisponiveis = useMemo(() => disponiveis.filter((p) => p.is_voluntario), [disponiveis]);
  const familiasNoProjeto = useMemo(() => {
    const byFam = new Map<string, PessoaLite[]>();
    for (const p of membros) {
      if (!p.familia_id) continue;
      const arr = byFam.get(p.familia_id) ?? [];
      arr.push(p);
      byFam.set(p.familia_id, arr);
    }
    return (familias ?? [])
      .filter((f) => byFam.has(f.id))
      .map((f) => ({ ...f, pessoas: byFam.get(f.id) ?? [] }));
  }, [membros, familias]);

  const [tab, setTab] = useState<"membros" | "voluntarios" | "familias">("membros");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["projeto-membros"] });
    qc.invalidateQueries({ queryKey: ["projetos", "contagens"] });
  };

  const add = useMutation({
    mutationFn: async (pessoa: PessoaLite) => {
      const next = Array.from(new Set([...(pessoa.projeto_ids ?? []), projetoId]));
      const { error } = await supabase.from("pessoas").update({ projeto_ids: next }).eq("id", pessoa.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pessoa adicionada"); invalidate(); setAddOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addFamilia = useMutation({
    mutationFn: async (fam: { id: string; nome: string; pessoas: PessoaLite[] }) => {
      await Promise.all(
        fam.pessoas.map((p) => {
          const next = Array.from(new Set([...(p.projeto_ids ?? []), projetoId]));
          return supabase.from("pessoas").update({ projeto_ids: next }).eq("id", p.id).then(({ error }) => {
            if (error) throw error;
          });
        }),
      );
      return fam.pessoas.length;
    },
    onSuccess: (n) => { toast.success(`${n} pessoa(s) adicionada(s)`); invalidate(); setAddOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (pessoa: PessoaLite) => {
      const next = (pessoa.projeto_ids ?? []).filter((id) => id !== projetoId);
      const { error } = await supabase.from("pessoas").update({ projeto_ids: next }).eq("id", pessoa.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pessoa removida"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const renderPessoasList = (lista: PessoaLite[], emptyText: string) => {
    if (isLoading) {
      return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>;
    }
    if (lista.length === 0) {
      return <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
    }
    return (
      <ul className="divide-y rounded-md border">
        {lista.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.nome_completo}</p>
              {p.email && <p className="truncate text-xs text-muted-foreground">{p.email}</p>}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => remove.mutate(p)}
              disabled={remove.isPending}
              aria-label={`Remover ${p.nome_completo}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    );
  };

  const addLabel = tab === "familias" ? "Adicionar família" : tab === "voluntarios" ? "Adicionar voluntário" : "Adicionar pessoa";

  return (
    <div className="space-y-3 border-t pt-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="membros">Membros ({membros.length})</TabsTrigger>
            <TabsTrigger value="voluntarios">Voluntários ({voluntariosNoProjeto.length})</TabsTrigger>
            <TabsTrigger value="familias">Famílias ({familiasNoProjeto.length})</TabsTrigger>
          </TabsList>
          <Popover open={addOpen} onOpenChange={setAddOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">
                <UserPlus className="me-2 h-4 w-4" /> {addLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command>
                <CommandInput placeholder={tab === "familias" ? "Procurar família…" : "Procurar pessoa…"} />
                <CommandList>
                  <CommandEmpty>Sem resultados.</CommandEmpty>
                  {tab === "familias" ? (
                    <CommandGroup heading="Famílias disponíveis">
                      {familiasDisponiveis.map((f) => (
                        <CommandItem
                          key={`fam-${f.id}`}
                          value={`familia ${f.nome}`}
                          onSelect={() => addFamilia.mutate(f)}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <span className="truncate">{f.nome}</span>
                            <span className="rounded-full bg-muted px-2 text-xs tabular-nums">{f.pessoas.length}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : tab === "voluntarios" ? (
                    <CommandGroup heading="Voluntários disponíveis">
                      {voluntariosDisponiveis.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.nome_completo} ${p.email ?? ""}`}
                          onSelect={() => add.mutate(p)}
                        >
                          <div className="flex flex-col">
                            <span>{p.nome_completo}</span>
                            {p.email && <span className="text-xs text-muted-foreground">{p.email}</span>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : (
                    <>
                      {familiasDisponiveis.length > 0 && (
                        <>
                          <CommandGroup heading="Famílias">
                            {familiasDisponiveis.map((f) => (
                              <CommandItem
                                key={`fam-${f.id}`}
                                value={`familia ${f.nome}`}
                                onSelect={() => addFamilia.mutate(f)}
                              >
                                <div className="flex w-full items-center justify-between gap-2">
                                  <span className="truncate">{f.nome}</span>
                                  <span className="rounded-full bg-muted px-2 text-xs tabular-nums">{f.pessoas.length}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          <CommandSeparator />
                        </>
                      )}
                      <CommandGroup heading="Pessoas">
                        {disponiveis.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.nome_completo} ${p.email ?? ""}`}
                            onSelect={() => add.mutate(p)}
                          >
                            <div className="flex flex-col">
                              <span>{p.nome_completo}</span>
                              {p.email && <span className="text-xs text-muted-foreground">{p.email}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <TabsContent value="membros" className="mt-6">
          {renderPessoasList(membros, "Sem pessoas atribuídas a este projeto.")}
        </TabsContent>
        <TabsContent value="voluntarios" className="mt-6">
          {renderPessoasList(voluntariosNoProjeto, "Sem voluntários neste projeto.")}
        </TabsContent>
        <TabsContent value="familias" className="mt-6">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : familiasNoProjeto.length === 0 ? (
            <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">Sem famílias neste projeto.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {familiasNoProjeto.map((f) => (
                <li key={f.id} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{f.nome}</p>
                    <span className="rounded-full bg-muted px-2 text-xs tabular-nums">{f.pessoas.length}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {f.pessoas.map((p) => p.nome_completo).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}