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
import { Badge } from "@/components/ui/badge";
import { AcoesHoverSummary } from "@/components/acoes-hover-summary";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { SavedViews } from "@/components/saved-views";
import { toast } from "sonner";
import { Download, LayoutGrid, List, Pencil, Plus, Search, Upload, Users } from "lucide-react";
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
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { InlineText, InlineSelect, InlineMultiSelect } from "@/components/inline-edit";
import { FamilyDetailDialog } from "@/components/family-detail";
import { applyOptimisticRowPatch, rollbackOptimisticRows } from "@/lib/optimistic-row-update";
import { handleSupabaseError } from "@/lib/handle-supabase-error";
import { downloadCSV, toCSV } from "@/lib/csv";

const PESSOA_STATUS_OPTS = ["ativo", "suspeito_duplicado", "fundido", "arquivado"];
const GENERO_OPTS = ["Masculino", "Feminino"];

export const Route = createFileRoute("/_app/_admin/familias")({
  component: FamiliasPage,
  validateSearch: (s: Record<string, unknown>) => ({
    familia: typeof s.familia === "string" ? s.familia : undefined,
  }),
});

const STATUS_OPTS = [
  "Sem estado",
  "Em espera",
  "No programa",
  "Não interessada",
  "Concluído",
  "Fora do País",
] as const;
type FamiliaStatus = typeof STATUS_OPTS[number];

const STATUS_GROUPS: { label: string; options: FamiliaStatus[] }[] = [
  { label: "A fazer", options: ["Sem estado", "Em espera"] },
  { label: "Em andamento", options: ["No programa"] },
  { label: "Concluídos", options: ["Não interessada", "Concluído", "Fora do País"] },
];

const STATUS_STYLES: Record<FamiliaStatus, string> = {
  "Sem estado": "bg-muted text-muted-foreground border-transparent",
  "Em espera": "bg-muted text-muted-foreground border-transparent",
  "No programa": "bg-blue-100 text-blue-700 border-transparent dark:bg-blue-950 dark:text-blue-300",
  "Não interessada": "bg-orange-100 text-orange-700 border-transparent dark:bg-orange-950 dark:text-orange-300",
  "Concluído": "bg-emerald-100 text-emerald-700 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  "Fora do País": "bg-pink-100 text-pink-700 border-transparent dark:bg-pink-950 dark:text-pink-300",
};

type Familia = { id: string; nome: string; notas: string | null; status: FamiliaStatus; contacto_meeru_id: string | null; direito_bolsa?: boolean | null; direito_mapa_km?: boolean | null; updated_at: string | null };

function FamiliasPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [notas, setNotas] = useState("");
  const [contactoMeeru, setContactoMeeru] = useState<string>("__none");


  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkNotas, setBulkNotas] = useState("");
  const [bulkStatus, setBulkStatus] = useState<string>("__noop");

  const [membrosFamilia, setMembrosFamilia] = useState<Familia | null>(null);
  const [detailTab, setDetailTab] = useState<"dados" | "membros" | "projetos" | "acoes" | "atividades">("membros");
  const [view, setView] = useState<"tabela" | "galeria">("tabela");
  const [globalFilter, setGlobalFilter] = useState("");
  const [inlineEdit, setInlineEdit] = useState(false);
  const [groupBy, setGroupBy] = useState<"none" | "status" | "projeto" | "cidade" | "religiao" | "contacto">("none");


  const { data, isLoading } = useQuery({
    queryKey: ["familias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familias")
        .select("id, nome, notas, status, contacto_meeru_id, direito_bolsa, direito_mapa_km, updated_at")
        .is("deleted_at", null)
        .order("nome");
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

  const { data: agregados } = useQuery({
    queryKey: ["familias", "agregados"],
    queryFn: async () => {
      const [{ data: pessoas, error: e1 }, { data: projetos, error: e2 }, { data: acoes, error: e3 }] = await Promise.all([
        supabase
          .from("pessoas")
          .select("id, familia_id, cidade_residencia, religiao, projeto_ids")
          .eq("status", "ativo")
          .not("familia_id", "is", null),
        supabase.from("projetos").select("id, nome"),
        supabase.from("acoes").select("id, nome"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      const projetoNome = new Map((projetos ?? []).map((p: any) => [p.id, p.nome as string]));
      const acaoNome = new Map((acoes ?? []).map((a: any) => [a.id, a.nome as string]));

      const pessoaIds = (pessoas ?? []).map((p: any) => p.id);
      let inscricoes: { pessoa_id: string; acao_id: string }[] = [];
      if (pessoaIds.length > 0) {
        const { data: ins, error: e4 } = await supabase
          .from("inscricoes")
          .select("pessoa_id, acao_id, status")
          .neq("status", "cancelada")
          .in("pessoa_id", pessoaIds);
        if (e4) throw e4;
        inscricoes = (ins ?? []) as any;
      }
      const insByPessoa = new Map<string, Set<string>>();
      inscricoes.forEach((i) => {
        const s = insByPessoa.get(i.pessoa_id) ?? new Set<string>();
        s.add(i.acao_id);
        insByPessoa.set(i.pessoa_id, s);
      });

      type Agg = { projetos: Set<string>; cidades: Set<string>; religioes: Set<string>; inscricoes: Set<string> };
      const map = new Map<string, Agg>();
      (pessoas ?? []).forEach((p: any) => {
        if (!p.familia_id) return;
        const a = map.get(p.familia_id) ?? { projetos: new Set(), cidades: new Set(), religioes: new Set(), inscricoes: new Set() };
        for (const pid of (p.projeto_ids ?? []) as string[]) {
          const n = projetoNome.get(pid);
          if (n) a.projetos.add(n);
        }
        if (p.cidade_residencia) a.cidades.add(p.cidade_residencia);
        if (p.religiao) a.religioes.add(p.religiao);
        const s = insByPessoa.get(p.id);
        if (s) s.forEach((aid) => {
          const n = acaoNome.get(aid);
          if (n) a.inscricoes.add(n);
        });
        map.set(p.familia_id, a);
      });
      return map;
    },
  });

  const { data: equipa } = useQuery({
    queryKey: ["familias", "equipa-meeru"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, auth_user_id, is_admin, tipo_user_id")
        .eq("status", "ativo")
        .not("auth_user_id", "is", null)
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; nome_completo: string; email: string | null; auth_user_id: string | null; is_admin: boolean; tipo_user_id: string | null }>;
    },
  });
  const equipaMap = useMemo(() => new Map((equipa ?? []).map((p) => [p.id, p])), [equipa]);

  const { data: projetosList } = useQuery({
    queryKey: ["projetos", "lista"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });
  const projetosMap = useMemo(() => new Map((projetosList ?? []).map((p) => [p.id, p.nome])), [projetosList]);

  const saveFamilia = (id: string, field: string) => async (v: any) => {
    const prev = await applyOptimisticRowPatch<{ id: string }>(qc, ["familias"], id, { [field]: v });
    const { error } = await supabase.from("familias").update({ [field]: v } as any).eq("id", id);
    if (error) {
      rollbackOptimisticRows(qc, ["familias"], prev);
      handleSupabaseError(error);
      throw error;
    }
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["familias"] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("familias").insert({
        nome,
        notas: notas || null,
        contacto_meeru_id: contactoMeeru === "__none" ? null : contactoMeeru,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Família criada");
      invalidate();
      setAddOpen(false);
      setNome("");
      setNotas("");
      setContactoMeeru("__none");
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
      const patch: { notas?: string | null; status?: FamiliaStatus } = {};
      if (bulkNotas.trim() || bulkNotas === "") {
        // keep previous behaviour for notes only if status not the only change
      }
      // Notes: apply when user typed something (or explicit clear via "__clear__")
      if (bulkNotas === "__clear__") patch.notas = null;
      else if (bulkNotas.trim()) patch.notas = bulkNotas;
      if (bulkStatus !== "__noop") patch.status = bulkStatus as FamiliaStatus;
      if (Object.keys(patch).length === 0) throw new Error("Nada para alterar");
      const { error } = await supabase.from("familias").update(patch).in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} famílias atualizadas`);
      invalidate();
      setBulkEditOpen(false);
      setSelected(new Set());
      setBulkNotas("");
      setBulkStatus("__noop");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];

  const columns = useMemo<ColumnDef<Familia>[]>(() => [
    { id: "nome", header: "Nome", accessorKey: "nome", cell: ({ getValue, row }) => (
      inlineEdit
        ? <InlineText value={(getValue() as string) ?? ""} onSave={(v) => saveFamilia(row.original.id, "nome")(v ?? "")} />
        : <span className="font-medium">{getValue() as string}</span>
    ), filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Nome" } satisfies ColumnFilterMeta },
    { id: "status", header: "Status", accessorKey: "status", cell: ({ getValue, row }) => {
      const s = (getValue() as FamiliaStatus) ?? "Sem estado";
      if (inlineEdit) {
        return (
          <InlineSelect
            value={s}
            options={STATUS_OPTS.map((o) => ({ value: o, label: o }))}
            onSave={(v) => saveFamilia(row.original.id, "status")(v ?? "Sem estado")}
            allowClear={false}
          />
        );
      }
      return <Badge className={STATUS_STYLES[s] ?? ""} variant="outline">{s}</Badge>;
    }, filterFn: advancedFilterFn as any, meta: { filterVariant: "select", filterOptions: [...STATUS_OPTS], label: "Status" } satisfies ColumnFilterMeta },
    { id: "membros", header: "Membros", accessorFn: (f) => contagens?.get(f.id) ?? 0, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as number}</span>, filterFn: advancedFilterFn as any, meta: { filterVariant: "number", label: "Membros" } satisfies ColumnFilterMeta },
    { id: "projeto", header: "Projeto", accessorFn: (f) => Array.from(agregados?.get(f.id)?.projetos ?? []).sort().join(", "), cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>, filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Projeto" } satisfies ColumnFilterMeta },
    { id: "cidade", header: "Cidade", accessorFn: (f) => Array.from(agregados?.get(f.id)?.cidades ?? []).sort().join(", "), cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>, filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Cidade" } satisfies ColumnFilterMeta },
    { id: "religiao", header: "Religião", accessorFn: (f) => Array.from(agregados?.get(f.id)?.religioes ?? []).sort().join(", "), cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>, filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Religião" } satisfies ColumnFilterMeta },
    { id: "inscricoes", header: "Inscrições", accessorFn: (f) => Array.from(agregados?.get(f.id)?.inscricoes ?? []).sort().join(", "), cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>, filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Inscrições" } satisfies ColumnFilterMeta },
    { id: "acoes_count", header: "Ações", accessorFn: (f) => agregados?.get(f.id)?.inscricoes.size ?? 0, enableSorting: false, cell: ({ row, getValue }) => {
        const n = getValue() as number;
        return <AcoesHoverSummary familiaId={row.original.id} label={`${n} ${n === 1 ? "ação" : "ações"}`} />;
      }, meta: { filterVariant: "number", label: "Ações" } satisfies ColumnFilterMeta },
    { id: "contacto_meeru", header: "Contacto MEERU", accessorFn: (f) => (f.contacto_meeru_id ? (equipaMap.get(f.contacto_meeru_id)?.nome_completo ?? "—") : ""), cell: ({ getValue, row }) => (
      inlineEdit
        ? <InlineSelect
            value={row.original.contacto_meeru_id}
            options={(equipa ?? []).map((p) => ({ value: p.id, label: p.nome_completo }))}
            onSave={(v) => saveFamilia(row.original.id, "contacto_meeru_id")(v)}
            placeholder="Sem contacto"
          />
        : <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>
    ), filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Contacto MEERU" } satisfies ColumnFilterMeta },
    { id: "notas", header: "Notas", accessorKey: "notas", cell: ({ getValue, row }) => (
      inlineEdit
        ? <InlineText value={(getValue() as string) ?? null} onSave={(v) => saveFamilia(row.original.id, "notas")(v)} />
        : <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span>
    ), filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Notas" } satisfies ColumnFilterMeta },
    { id: "updated_at", header: "Última edição", accessorKey: "updated_at",
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return <span className="text-muted-foreground">{v ? new Date(v).toLocaleString("pt-PT") : "—"}</span>;
      },
      filterFn: advancedFilterFn as any, meta: { filterVariant: "date", label: "Última edição" } satisfies ColumnFilterMeta },
  ], [contagens, agregados, equipaMap, equipa, inlineEdit]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);

  const table = useReactTable({
    columnResizeMode: "onChange",
    defaultColumn: { minSize: 60, size: 160, maxSize: 800 },
    data: rows,
    columns,
    state: { sorting, columnVisibility, columnOrder, globalFilter },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _col, filterValue) => {
      const q = String(filterValue ?? "").trim().toLowerCase();
      if (!q) return true;
      const f = row.original;
      const agg = agregados?.get(f.id);
      const haystack = [
        f.nome,
        f.notas ?? "",
        f.status,
        ...Array.from(agg?.projetos ?? []),
        ...Array.from(agg?.cidades ?? []),
        ...Array.from(agg?.religioes ?? []),
        ...Array.from(agg?.inscricoes ?? []),
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (r) => r.id,
  });

  useMobileColumnVisibility(table, ["nome", "status", "membros"]);

  const tableRows = table.getRowModel().rows;
  const groupedRows = useMemo(() => {
    if (groupBy === "none") return null as null | { label: string; rows: typeof tableRows }[];
    const map = new Map<string, typeof tableRows>();
    const push = (key: string, r: typeof tableRows[number]) => {
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    };
    for (const r of tableRows) {
      const f = r.original;
      const agg = agregados?.get(f.id);
      if (groupBy === "status") {
        push(f.status || "Sem estado", r);
      } else if (groupBy === "contacto") {
        const nome = f.contacto_meeru_id ? (equipaMap.get(f.contacto_meeru_id)?.nome_completo ?? "—") : "— Sem contacto —";
        push(nome, r);
      } else {
        const set =
          groupBy === "projeto" ? agg?.projetos :
          groupBy === "cidade" ? agg?.cidades :
          agg?.religioes;
        const values = Array.from(set ?? []);
        if (values.length === 0) push("—", r);
        else for (const v of values) push(v || "—", r);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, rows]) => ({ label, rows }));
  }, [tableRows, groupBy, agregados, equipaMap]);
  const allChecked = tableRows.length > 0 && tableRows.every((r) => selected.has(r.original.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) tableRows.forEach((r) => next.delete(r.original.id));
    else tableRows.forEach((r) => next.add(r.original.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const openDetail = (f: Familia, tab: "dados" | "membros" | "projetos" | "acoes" | "atividades" = "membros") => {
    setDetailTab(tab);
    setMembrosFamilia(f);
  };

  const renderGalleryCard = (row: typeof tableRows[number]) => {
    const f = row.original;
    const agg = agregados?.get(f.id);
    const nMembros = contagens?.get(f.id) ?? 0;
    const projetos = Array.from(agg?.projetos ?? []).sort();
    const cidades = Array.from(agg?.cidades ?? []).sort();
    return (
      <Card
        key={row.id}
        className="p-4 cursor-pointer hover:bg-muted/40 transition-colors flex flex-col gap-2"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("button, [role=checkbox], input")) return;
          openDetail(f, "membros");
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggleOne(f.id)} />
            <span className="font-medium truncate">{f.nome}</span>
          </div>
          <Badge className={STATUS_STYLES[f.status] ?? ""} variant="outline">{f.status}</Badge>
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {nMembros} membro(s)
        </div>
        {projetos.length > 0 && (
          <div className="text-xs text-muted-foreground"><span className="font-medium">Projetos:</span> {projetos.join(", ")}</div>
        )}
        {cidades.length > 0 && (
          <div className="text-xs text-muted-foreground"><span className="font-medium">Cidades:</span> {cidades.join(", ")}</div>
        )}
        {f.notas && <div className="text-xs text-muted-foreground line-clamp-2">{f.notas}</div>}
        <div className="flex justify-end gap-1 pt-1">
          <Button size="icon" variant="ghost" title="Ver membros" onClick={() => openDetail(f, "membros")}>
            <Users className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" title="Editar" onClick={() => openDetail(f, "dados")}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  };

  const renderTableRow = (row: typeof tableRows[number]) => {
    const f = row.original;
    return (
      <TableRow key={row.id} className={inlineEdit ? "" : "cursor-pointer"} onClick={(e) => {
        if (inlineEdit) return;
        const target = e.target as HTMLElement;
        if (target.closest("button, [role=checkbox], input")) return;
        openDetail(f, "membros");
      }}>
        <TableCell><Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggleOne(f.id)} /></TableCell>
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
        ))}
        <TableCell>
          <div className="flex justify-end gap-1">
            <Button size="icon" variant="ghost" title="Ver membros" onClick={() => openDetail(f, "membros")}>
              <Users className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" title="Editar" onClick={() => openDetail(f, "dados")}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Famílias</h1>
          <p className="text-sm text-muted-foreground">{rows.length} famílias</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9"><Plus className="mr-2 h-4 w-4" /> Nova família</Button>
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
                <div className="space-y-2">
                  <Label>Pessoa de Contacto (Equipa MEERU)</Label>
                  <Select value={contactoMeeru} onValueChange={setContactoMeeru}>
                    <SelectTrigger><SelectValue placeholder="Sem contacto" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sem contacto</SelectItem>
                      {(equipa ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!nome || create.isPending}>
                  {create.isPending ? "A guardar…" : "Guardar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <div className="relative flex-1 min-w-[200px] sm:flex-none sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Pesquisar famílias…"
              className="pl-8 h-9"
            />
          </div>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Agrupar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem agrupar</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="projeto">Projeto</SelectItem>
              <SelectItem value="cidade">Cidade</SelectItem>
              <SelectItem value="religiao">Religião</SelectItem>
              <SelectItem value="contacto">Contacto MEERU</SelectItem>
            </SelectContent>
          </Select>
          <AdvancedTableFilters table={table} />
          <DataTableViewOptions table={table} />
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as "tabela" | "galeria")}
            variant="outline"
            size="sm"
            className="h-9"
          >
            <ToggleGroupItem value="tabela" aria-label="Tabela" className="h-9 px-2.5"><List className="h-4 w-4" /></ToggleGroupItem>
            <ToggleGroupItem value="galeria" aria-label="Galeria" className="h-9 px-2.5"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={inlineEdit ? "default" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => setInlineEdit((v) => !v)}
          >
            <Pencil className="mr-2 h-4 w-4" /> {inlineEdit ? "A editar na tabela" : "Editar na tabela"}
          </Button>
          <Button variant="outline" size="sm" className="h-9" disabled={selected.size === 0} onClick={() => setBulkEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Editar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => setBulkAddOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => {
              const headers = ["Nome", "Status", "Membros", "Projetos", "Cidades", "Contacto MEERU", "Última edição"];
              const rowsCsv = rows.map((f) => {
                const agg = agregados?.get(f.id);
                return {
                  "Nome": f.nome ?? "",
                  "Status": f.status ?? "",
                  "Membros": String(contagens?.get(f.id) ?? 0),
                  "Projetos": Array.from(agg?.projetos ?? []).sort().join("; "),
                  "Cidades": Array.from(agg?.cidades ?? []).sort().join("; "),
                  "Contacto MEERU": f.contacto_meeru_id ? (equipaMap.get(f.contacto_meeru_id)?.nome_completo ?? "") : "",
                  "Última edição": f.updated_at ? new Date(f.updated_at).toLocaleDateString("pt-PT") : "",
                };
              });
              downloadCSV(`familias-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rowsCsv, headers));
            }}
          >
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      <SavedViews
        storageKey="views:familias"
        table={table}
        defaultViewName="Ativos"
        extra={{ groupBy }}
        onExtraChange={(e) => {
          if (e?.groupBy) setGroupBy(e.groupBy);
        }}
      />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : view === "galeria" ? (
        groupedRows ? (
          <div className="space-y-6">
            {groupedRows.length === 0 && (
              <div className="text-center text-muted-foreground py-8">Sem famílias</div>
            )}
            {groupedRows.map((g) => (
              <div key={g.label} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{g.label}</h2>
                  <Badge variant="secondary">{g.rows.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {g.rows.map((row) => renderGalleryCard(row))}
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {tableRows.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-8">Sem famílias</div>
          )}
          {tableRows.map((row) => renderGalleryCard(row))}
        </div>
        )
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={allChecked} onCheckedChange={toggleAll} /></TableHead>
                <DraggableTableHeaders table={table} onOrderChange={setColumnOrder} />
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.length === 0 && (
                <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length + 2} className="text-center text-muted-foreground">Sem famílias</TableCell></TableRow>
              )}
              {groupedRows
                ? groupedRows.flatMap((g) => [
                    <TableRow key={`grp-${g.label}`} className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={table.getVisibleLeafColumns().length + 2} className="font-semibold">
                        {g.label} <span className="text-muted-foreground font-normal">({g.rows.length})</span>
                      </TableCell>
                    </TableRow>,
                    ...g.rows.map((row) => renderTableRow(row)),
                  ])
                : tableRows.map((row) => renderTableRow(row))}
            </TableBody>
          </Table>
        </div>
      )}

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
            <DialogDescription>Só os campos alterados serão aplicados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__noop">— não alterar —</SelectItem>
                  {STATUS_GROUPS.map((g) => (
                    <div key={g.label}>
                      <div className="px-2 py-1 text-xs text-muted-foreground">{g.label}</div>
                      {g.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notas (deixar vazio = não alterar)</Label>
              <Textarea value={bulkNotas === "__clear__" ? "" : bulkNotas} onChange={(e) => setBulkNotas(e.target.value)} placeholder="Escreve para substituir" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => bulkUpdate.mutate()} disabled={bulkUpdate.isPending}>
              {bulkUpdate.isPending ? "A guardar…" : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FamilyDetailDialog
        family={membrosFamilia}
        open={!!membrosFamilia}
        onClose={() => setMembrosFamilia(null)}
        siblings={data ?? undefined}
        onSelectSibling={(f) => setMembrosFamilia(f)}
        onUpdate={invalidate}
        defaultTab={detailTab}
      />
    </div>
  );
}

