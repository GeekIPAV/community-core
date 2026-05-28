import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AVAILABLE_PAGES } from "@/lib/permissions";
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

export const Route = createFileRoute("/_app/_admin/tipos-user")({
  component: TiposUserPage,
});

type TipoUser = { id: string; nome: string; paginas: string[] };

// "tipos-user" page is reserved to admins; not selectable as a permission.
const SELECTABLE = AVAILABLE_PAGES.filter((p) => p.key !== "tipos-user");

function TiposUserPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TipoUser | null>(null);
  const [nome, setNome] = useState("");
  const [paginas, setPaginas] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["tipos_user"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_user")
        .select("id, nome, paginas")
        .order("nome");
      if (error) throw error;
      return data as TipoUser[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tipos_user"] });

  const openNew = () => {
    setEditing(null);
    setNome("");
    setPaginas([]);
    setOpen(true);
  };
  const openEdit = (t: TipoUser) => {
    setEditing(t);
    setNome(t.nome);
    setPaginas(t.paginas ?? []);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { nome: nome.trim(), paginas };
      if (editing) {
        const { error } = await supabase.from("tipos_user").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tipos_user").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Tipo atualizado" : "Tipo criado");
      invalidate();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tipos_user").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tipo removido");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (k: string) =>
    setPaginas((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const columns = useMemo<ColumnDef<TipoUser>[]>(() => [
    {
      id: "nome",
      header: "Nome",
      accessorKey: "nome",
      cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
      filterFn: advancedFilterFn as any,
      meta: { filterVariant: "text", label: "Nome" } satisfies ColumnFilterMeta,
    },
    {
      id: "paginas",
      header: "Páginas",
      accessorFn: (t) => (t.paginas ?? []).map((k) => AVAILABLE_PAGES.find((x) => x.key === k)?.label ?? k).join(", "),
      cell: ({ row }) => {
        const t = row.original;
        return (
          <div className="flex flex-wrap gap-1">
            {(t.paginas ?? []).length === 0 && <span className="text-muted-foreground text-sm">Nenhuma</span>}
            {t.paginas?.map((k) => {
              const p = AVAILABLE_PAGES.find((x) => x.key === k);
              return <Badge key={k} variant="secondary">{p?.label ?? k}</Badge>;
            })}
          </div>
        );
      },
      filterFn: advancedFilterFn as any,
      meta: { filterVariant: "text", label: "Páginas" } satisfies ColumnFilterMeta,
    },
  ], []);

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
          <h1 className="text-2xl font-semibold">Tipos de Utilizador</h1>
          <p className="text-sm text-muted-foreground">
            Define perfis com acesso a páginas específicas. Administradores têm sempre acesso total.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdvancedTableFilters table={table} />
          <DataTableViewOptions table={table} />
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Novo tipo
          </Button>
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
                <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length + 1} className="text-center text-muted-foreground">Sem tipos</TableCell></TableRow>
              )}
              {tableRows.map((row) => {
                const t = row.original;
                return (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Remover o tipo "${t.nome}"?`)) remove.mutate(t.id);
                          }}
                        >
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
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tipo" : "Novo tipo de utilizador"}</DialogTitle>
            <DialogDescription>Seleciona as páginas a que este tipo terá acesso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Coordenador" />
            </div>
            <div className="space-y-2">
              <Label>Páginas acessíveis</Label>
              <div className="space-y-2 rounded-md border p-3">
                {SELECTABLE.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={paginas.includes(p.key)} onCheckedChange={() => toggle(p.key)} />
                    <span className="text-sm">{p.label}</span>
                    <code className="ml-auto text-xs text-muted-foreground">{p.path}</code>
                  </label>
                ))}
              </div>
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