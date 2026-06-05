import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { Pencil, Plus, Trash2, Link2, Unlink, Search, ShieldCheck } from "lucide-react";
import { AVAILABLE_PAGES } from "@/lib/permissions";
import {
  listAuthUsers,
  linkAuthUserToPessoa,
  unlinkAuthUser,
  setPessoaTipo,
  setPessoaAdmin,
} from "@/lib/users.functions";
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
  component: UtilizadoresPage,
});

type TipoUser = { id: string; nome: string; paginas: string[] };

// "tipos-user" page is reserved to admins; not selectable as a permission.
const SELECTABLE = AVAILABLE_PAGES.filter((p) => p.key !== "tipos-user");

function UtilizadoresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Utilizadores</h1>
        <p className="text-sm text-muted-foreground">
          Gere os utilizadores autenticados, associa-os a participantes e define o tipo de perfil.
        </p>
      </div>
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Utilizadores</TabsTrigger>
          <TabsTrigger value="tipos">Tipos de perfil</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="space-y-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="tipos" className="space-y-4">
          <TiposTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAuthUsers);
  const linkFn = useServerFn(linkAuthUserToPessoa);
  const unlinkFn = useServerFn(unlinkAuthUser);
  const setTipoFn = useServerFn(setPessoaTipo);
  const setAdminFn = useServerFn(setPessoaAdmin);

  const [search, setSearch] = useState("");

  const usersQ = useQuery({
    queryKey: ["auth_users"],
    queryFn: () => listFn(),
  });

  const tiposQ = useQuery({
    queryKey: ["tipos_user"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tipos_user").select("id, nome").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  const pessoasQ = useQuery({
    queryKey: ["pessoas_all_ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, auth_user_id, status")
        .eq("status", "ativo")
        .order("nome_completo");
      if (error) throw error;
      return data as { id: string; nome_completo: string; email: string | null; auth_user_id: string | null }[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["auth_users"] });
    qc.invalidateQueries({ queryKey: ["pessoas_all_ativas"] });
  };

  const link = useMutation({
    mutationFn: (v: { auth_user_id: string; pessoa_id: string }) => linkFn({ data: v }),
    onSuccess: () => { toast.success("Associado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const unlink = useMutation({
    mutationFn: (v: { auth_user_id: string }) => unlinkFn({ data: v }),
    onSuccess: () => { toast.success("Desassociado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setTipo = useMutation({
    mutationFn: (v: { pessoa_id: string; tipo_user_id: string | null }) => setTipoFn({ data: v }),
    onSuccess: () => { toast.success("Tipo atualizado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setAdmin = useMutation({
    mutationFn: (v: { pessoa_id: string; is_admin: boolean }) => setAdminFn({ data: v }),
    onSuccess: () => { toast.success("Atualizado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const tiposById = useMemo(() => {
    const m = new Map<string, string>();
    (tiposQ.data ?? []).forEach((t) => m.set(t.id, t.nome));
    return m;
  }, [tiposQ.data]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const rows = usersQ.data ?? [];
    if (!s) return rows;
    return rows.filter((u) => {
      const tipo = u.pessoa?.tipo_user_id ? tiposById.get(u.pessoa.tipo_user_id) ?? "" : "";
      return [u.email, u.pessoa?.nome_completo, u.pessoa?.email, tipo]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(s));
    });
  }, [usersQ.data, search, tiposById]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar email, nome, tipo…"
            className="pl-8 w-80"
          />
        </div>
        <div className="ml-auto text-sm text-muted-foreground">
          {filtered.length} utilizador{filtered.length === 1 ? "" : "es"}
        </div>
      </div>

      {usersQ.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : usersQ.isError ? (
        <div className="rounded-md border p-4 text-sm text-destructive">
          Erro a carregar utilizadores: {(usersQ.error as Error).message}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Pessoa associada</TableHead>
                <TableHead>Tipo de perfil</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Último login</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Sem utilizadores</TableCell>
                </TableRow>
              )}
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email ?? "—"}</TableCell>
                  <TableCell>
                    <PessoaPicker
                      pessoas={pessoasQ.data ?? []}
                      currentAuthUserId={u.id}
                      current={u.pessoa}
                      currentUserEmail={u.email}
                      onPick={(pessoa_id) => link.mutate({ auth_user_id: u.id, pessoa_id })}
                    />
                  </TableCell>
                  <TableCell>
                    {u.pessoa ? (
                      <Select
                        value={u.pessoa.tipo_user_id ?? "__none"}
                        onValueChange={(v) =>
                          setTipo.mutate({ pessoa_id: u.pessoa!.id, tipo_user_id: v === "__none" ? null : v })
                        }
                      >
                        <SelectTrigger className="h-8 w-44"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">(sem tipo)</SelectItem>
                          {(tiposQ.data ?? []).map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {u.pessoa ? (
                      <Checkbox
                        checked={u.pessoa.is_admin}
                        onCheckedChange={(c) => setAdmin.mutate({ pessoa_id: u.pessoa!.id, is_admin: !!c })}
                      />
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-PT") : "—"}
                  </TableCell>
                  <TableCell>
                    {u.pessoa ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Desassociar pessoa"
                        onClick={() => {
                          if (confirm("Desassociar este user da pessoa?")) unlink.mutate({ auth_user_id: u.id });
                        }}
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function PessoaPicker({
  pessoas,
  current,
  currentAuthUserId,
  currentUserEmail,
  onPick,
}: {
  pessoas: { id: string; nome_completo: string; email: string | null; auth_user_id: string | null }[];
  current: { id: string; nome_completo: string; email: string | null } | null;
  currentAuthUserId: string;
  currentUserEmail: string | null;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Selectable = unlinked OR currently linked to this user
  const selectable = pessoas.filter(
    (p) => p.auth_user_id === null || p.auth_user_id === currentAuthUserId,
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto min-h-9 justify-start px-2 py-1 text-left font-normal hover:bg-accent"
        >
          {current ? (
            <div className="flex flex-col items-start">
              <span>{current.nome_completo}</span>
              {current.email && current.email !== currentUserEmail && (
                <span className="text-xs text-muted-foreground">{current.email}</span>
              )}
            </div>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <Link2 className="h-3 w-3" /> Sem pessoa
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Procurar pessoa…" />
          <CommandList>
            <CommandEmpty>Sem resultados</CommandEmpty>
            <CommandGroup>
              {selectable.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.nome_completo} ${p.email ?? ""}`}
                  onSelect={() => {
                    if (p.id !== current?.id) onPick(p.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span>
                      {p.nome_completo}
                      {p.id === current?.id && (
                        <span className="ml-2 text-xs text-muted-foreground">(atual)</span>
                      )}
                    </span>
                    {p.email && <span className="text-xs text-muted-foreground">{p.email}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TiposTab() {
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
  const tableRows = table.getRowModel().rows;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Define perfis com acesso a páginas específicas. Administradores têm sempre acesso total.
        </p>
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