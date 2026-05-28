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
import { Pencil, Plus, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/_app/_admin/projetos")({
  component: ProjetosPage,
});

type Projeto = { id: string; nome: string; descricao: string | null };

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

  const invalidate = () => qc.invalidateQueries({ queryKey: ["projetos"] });

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
    { id: "membros", header: "Membros", accessorFn: (p) => contagens?.get(p.id) ?? 0, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as number}</span>, filterFn: advancedFilterFn as any, meta: { filterVariant: "number", label: "Membros" } satisfies ColumnFilterMeta },
  ], [contagens]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);

  const table = useReactTable({
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar projeto" : "Novo projeto"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
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