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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LayoutGrid, List, Pencil, Plus, Trash2, Upload, UserMinus, Users } from "lucide-react";
import { formatDateBR } from "@/lib/utils";
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
import { personIcon, flagFor } from "@/lib/person-display";

const PESSOA_STATUS_OPTS = ["ativo", "suspeito_duplicado", "fundido", "arquivado"];
const GENERO_OPTS = ["Masculino", "Feminino"];

export const Route = createFileRoute("/_app/_admin/familias")({
  component: FamiliasPage,
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

type Familia = { id: string; nome: string; notas: string | null; status: FamiliaStatus };

function FamiliasPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [notas, setNotas] = useState("");

  const [editing, setEditing] = useState<Familia | null>(null);

  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkNotas, setBulkNotas] = useState("");
  const [bulkStatus, setBulkStatus] = useState<string>("__noop");

  const [membrosFamilia, setMembrosFamilia] = useState<Familia | null>(null);
  const [view, setView] = useState<"tabela" | "galeria">("tabela");
  const [detailTab, setDetailTab] = useState<"dados" | "membros" | "acoes">("membros");

  const [addMembroOpen, setAddMembroOpen] = useState(false);
  const emptyMembro = {
    nome_completo: "",
    email: "",
    telefone: "",
    data_nascimento: "",
    genero: "" as string,
    cidade_residencia: "",
    nacionalidade: "",
    religiao: "",
    nif: "",
    projeto_ids: [] as string[],
    status: "ativo" as string,
  };
  const [novoMembro, setNovoMembro] = useState(emptyMembro);

  const addMembro = useMutation({
    mutationFn: async () => {
      if (!membrosFamilia) throw new Error("Família não selecionada");
      const nome = novoMembro.nome_completo.trim();
      if (!nome) throw new Error("Nome é obrigatório");
      const { error } = await supabase.from("pessoas").insert({
        nome_completo: nome,
        email: novoMembro.email.trim() || null,
        telefone: novoMembro.telefone.trim() || null,
        data_nascimento: novoMembro.data_nascimento || null,
        genero: novoMembro.genero || null,
        cidade_residencia: novoMembro.cidade_residencia.trim() || null,
        nacionalidade: novoMembro.nacionalidade.trim() || null,
        religiao: novoMembro.religiao.trim() || null,
        nif: novoMembro.nif.trim() || null,
        projeto_ids: novoMembro.projeto_ids,
        status: novoMembro.status,
        familia_id: membrosFamilia.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro adicionado");
      qc.invalidateQueries({ queryKey: ["familias", "membros", membrosFamilia?.id] });
      qc.invalidateQueries({ queryKey: ["familias", "contagens"] });
      qc.invalidateQueries({ queryKey: ["familias", "agregados"] });
      qc.invalidateQueries({ queryKey: ["pessoas"] });
      setAddMembroOpen(false);
      setNovoMembro(emptyMembro);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeFromFamilia = useMutation({
    mutationFn: async (pessoaId: string) => {
      const { error } = await supabase.from("pessoas").update({ familia_id: null } as any).eq("id", pessoaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro removido da família");
      qc.invalidateQueries({ queryKey: ["familias", "membros", membrosFamilia?.id] });
      qc.invalidateQueries({ queryKey: ["familias", "contagens"] });
      qc.invalidateQueries({ queryKey: ["familias", "agregados"] });
      qc.invalidateQueries({ queryKey: ["pessoas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePessoa = useMutation({
    mutationFn: async (pessoaId: string) => {
      await supabase.from("inscricoes").delete().eq("pessoa_id", pessoaId);
      const { error } = await supabase.from("pessoas").delete().eq("id", pessoaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Utilizador apagado");
      qc.invalidateQueries({ queryKey: ["familias", "membros", membrosFamilia?.id] });
      qc.invalidateQueries({ queryKey: ["familias", "contagens"] });
      qc.invalidateQueries({ queryKey: ["familias", "agregados"] });
      qc.invalidateQueries({ queryKey: ["familias", "acoes", membrosFamilia?.id] });
      qc.invalidateQueries({ queryKey: ["pessoas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["familias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familias")
        .select("id, nome, notas, status")
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

  const { data: membros, isLoading: loadingMembros } = useQuery({
    queryKey: ["familias", "membros", membrosFamilia?.id],
    enabled: !!membrosFamilia,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, telefone, data_nascimento, status, genero, cidade_residencia, nacionalidade, religiao, nif, projeto_ids")
        .eq("familia_id", membrosFamilia!.id)
        .order("nome_completo");
      if (error) throw error;
      return data as Array<{
        id: string; nome_completo: string; email: string | null; telefone: string | null;
        data_nascimento: string | null; status: string; genero: string | null;
        cidade_residencia: string | null; nacionalidade: string | null; religiao: string | null;
        nif: string | null; projeto_ids: string[] | null;
      }>;
    },
  });

  const { data: projetosList } = useQuery({
    queryKey: ["projetos", "lista"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });
  const projetosMap = useMemo(() => new Map((projetosList ?? []).map((p) => [p.id, p.nome])), [projetosList]);

  const savePessoa = (id: string, field: string) => async (v: any) => {
    const { error } = await supabase.from("pessoas").update({ [field]: v } as any).eq("id", id);
    if (error) { toast.error(error.message); throw error; }
    qc.invalidateQueries({ queryKey: ["familias", "membros", membrosFamilia?.id] });
    qc.invalidateQueries({ queryKey: ["familias", "contagens"] });
    qc.invalidateQueries({ queryKey: ["familias", "agregados"] });
    qc.invalidateQueries({ queryKey: ["pessoas"] });
  };

  const { data: acoesFamilia, isLoading: loadingAcoesFamilia } = useQuery({
    queryKey: ["familias", "acoes", membrosFamilia?.id],
    enabled: !!membrosFamilia && !!membros,
    queryFn: async () => {
      const ids = (membros ?? []).map((m) => m.id);
      if (ids.length === 0) return [] as Array<{ inscricao_id: string; acao_id: string; nome: string; data_inicio: string | null; local: string | null; status: string; pessoa_id: string; pessoa_nome: string }>;
      const { data, error } = await supabase
        .from("inscricoes")
        .select("id, status, pessoa_id, acao:acoes(id, nome, data_inicio, local)")
        .in("pessoa_id", ids)
        .neq("status", "cancelada");
      if (error) throw error;
      const nomeById = new Map((membros ?? []).map((m) => [m.id, m.nome_completo]));
      return (data ?? []).map((r: any) => ({
        inscricao_id: r.id,
        acao_id: r.acao?.id,
        nome: r.acao?.nome ?? "—",
        data_inicio: r.acao?.data_inicio ?? null,
        local: r.acao?.local ?? null,
        status: r.status,
        pessoa_id: r.pessoa_id,
        pessoa_nome: nomeById.get(r.pessoa_id) ?? "—",
      }));
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
        .update({ nome: editing.nome, notas: editing.notas || null, status: editing.status })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Família atualizada");
      invalidate();
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
    { id: "nome", header: "Nome", accessorKey: "nome", cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>, filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Nome" } satisfies ColumnFilterMeta },
    { id: "status", header: "Status", accessorKey: "status", cell: ({ getValue }) => {
      const s = (getValue() as FamiliaStatus) ?? "Sem estado";
      return <Badge className={STATUS_STYLES[s] ?? ""} variant="outline">{s}</Badge>;
    }, filterFn: advancedFilterFn as any, meta: { filterVariant: "select", filterOptions: [...STATUS_OPTS], label: "Status" } satisfies ColumnFilterMeta },
    { id: "membros", header: "Membros", accessorFn: (f) => contagens?.get(f.id) ?? 0, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as number}</span>, filterFn: advancedFilterFn as any, meta: { filterVariant: "number", label: "Membros" } satisfies ColumnFilterMeta },
    { id: "projeto", header: "Projeto", accessorFn: (f) => Array.from(agregados?.get(f.id)?.projetos ?? []).sort().join(", "), cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>, filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Projeto" } satisfies ColumnFilterMeta },
    { id: "cidade", header: "Cidade", accessorFn: (f) => Array.from(agregados?.get(f.id)?.cidades ?? []).sort().join(", "), cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>, filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Cidade" } satisfies ColumnFilterMeta },
    { id: "religiao", header: "Religião", accessorFn: (f) => Array.from(agregados?.get(f.id)?.religioes ?? []).sort().join(", "), cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>, filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Religião" } satisfies ColumnFilterMeta },
    { id: "inscricoes", header: "Inscrições", accessorFn: (f) => Array.from(agregados?.get(f.id)?.inscricoes ?? []).sort().join(", "), cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>, filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Inscrições" } satisfies ColumnFilterMeta },
    { id: "notas", header: "Notas", accessorKey: "notas", cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span>, filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Notas" } satisfies ColumnFilterMeta },
  ], [contagens, agregados]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);

  const table = useReactTable({
    columnResizeMode: "onChange",
    defaultColumn: { minSize: 60, size: 160, maxSize: 800 },
    data: rows,
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

  useMobileColumnVisibility(table, ["nome", "status", "membros"]);

  const tableRows = table.getRowModel().rows;
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

  const openDetail = (f: Familia, tab: "dados" | "membros" | "acoes" = "membros") => {
    setMembrosFamilia(f);
    setEditing({ ...f });
    setDetailTab(tab);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Famílias</h1>
          <p className="text-sm text-muted-foreground">{rows.length} famílias</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdvancedTableFilters table={table} />
          <DataTableViewOptions table={table} />
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as "tabela" | "galeria")} variant="outline" size="sm">
            <ToggleGroupItem value="tabela" aria-label="Tabela"><List className="h-4 w-4" /></ToggleGroupItem>
            <ToggleGroupItem value="galeria" aria-label="Galeria"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
          </ToggleGroup>
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
      ) : view === "galeria" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {tableRows.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-8">Sem famílias</div>
          )}
          {tableRows.map((row) => {
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
          })}
        </div>
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
              {tableRows.map((row) => {
                const f = row.original;
                return (
                  <TableRow key={row.id} className="cursor-pointer" onClick={(e) => {
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
              })}
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

      {/* Detalhe da família */}
      <Dialog open={!!membrosFamilia} onOpenChange={(o) => { if (!o) { setMembrosFamilia(null); setEditing(null); } }}>
        <DialogContent className="max-w-[min(1200px,95vw)] w-[95vw] sm:w-full p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle>{membrosFamilia?.nome}</DialogTitle>
            <DialogDescription>
              {loadingMembros ? "A carregar…" : `${membros?.length ?? 0} membro(s)`}
            </DialogDescription>
          </DialogHeader>
          </div>
          <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as "dados" | "membros" | "acoes")} className="flex flex-col flex-1 min-h-0 px-6 pb-6">
            <TabsList className="w-full">
              <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
              <TabsTrigger value="membros" className="flex-1">Membros</TabsTrigger>
              <TabsTrigger value="acoes" className="flex-1">Ações</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 pt-4">
              {editing && (
                <>
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v as FamiliaStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
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
                    <Label>Notas</Label>
                    <Textarea value={editing.notas ?? ""} onChange={(e) => setEditing({ ...editing, notas: e.target.value })} />
                  </div>
                  <DialogFooter>
                    <Button onClick={() => update.mutate()} disabled={!editing.nome.trim() || update.isPending}>
                      {update.isPending ? "A guardar…" : "Guardar"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </TabsContent>

            <TabsContent value="membros" className="pt-4 flex-1 min-h-0 overflow-hidden">
              <div className="flex flex-col h-full min-h-0 gap-3">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setAddMembroOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Adicionar membro
                  </Button>
                </div>
                <div className="flex-1 min-h-0 max-h-[60vh] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Data nasc.</TableHead>
                      <TableHead>Género</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Nacionalidade</TableHead>
                      <TableHead>Religião</TableHead>
                      <TableHead>NIF</TableHead>
                      <TableHead>Projetos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!membros || membros.length === 0) && !loadingMembros && (
                      <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">Sem membros</TableCell></TableRow>
                    )}
                     {membros?.map((m) => {
                       const PersonIco = personIcon(m.genero, m.data_nascimento);
                       return (
                         <TableRow key={m.id}>
                         <TableCell className="font-medium whitespace-nowrap min-w-[180px]">
                           <span className="inline-flex items-center gap-2">
                              <PersonIco aria-hidden className="h-5 w-5 shrink-0 text-primary" strokeWidth={2.25} />
                             <InlineText value={m.nome_completo} onSave={async (v) => { if (v) await savePessoa(m.id, "nome_completo")(v); }} />
                           </span>
                         </TableCell>
                         <TableCell className="min-w-[200px]"><InlineText value={m.email} onSave={savePessoa(m.id, "email")} /></TableCell>
                         <TableCell className="min-w-[140px]"><InlineText value={m.telefone} onSave={savePessoa(m.id, "telefone")} /></TableCell>
                         <TableCell className="min-w-[140px]"><InlineText value={m.data_nascimento} type="date" onSave={savePessoa(m.id, "data_nascimento")} /></TableCell>
                         <TableCell className="min-w-[120px]">
                           <InlineSelect value={m.genero} options={GENERO_OPTS.map((g) => ({ value: g, label: g }))} placeholder="não definido" onSave={savePessoa(m.id, "genero")} />
                         </TableCell>
                         <TableCell className="min-w-[160px]"><InlineText value={m.cidade_residencia} onSave={savePessoa(m.id, "cidade_residencia")} /></TableCell>
                         <TableCell className="min-w-[140px]">
                           {m.nacionalidade ? (
                             <span className="inline-flex items-center gap-1.5">
                               <span aria-hidden>{flagFor(m.nacionalidade)}</span>
                               <InlineText value={m.nacionalidade} onSave={savePessoa(m.id, "nacionalidade")} />
                             </span>
                           ) : (
                             <InlineText value={m.nacionalidade} onSave={savePessoa(m.id, "nacionalidade")} />
                           )}
                         </TableCell>
                         <TableCell className="min-w-[140px]"><InlineText value={m.religiao} onSave={savePessoa(m.id, "religiao")} /></TableCell>
                         <TableCell className="min-w-[120px]"><InlineText value={m.nif} onSave={savePessoa(m.id, "nif")} /></TableCell>
                        <TableCell>
                          <InlineMultiSelect
                            values={m.projeto_ids ?? []}
                            options={(projetosList ?? []).map((p) => ({ value: p.id, label: p.nome }))}
                            placeholder="sem projetos"
                            onSave={(v) => savePessoa(m.id, "projeto_ids")(v)}
                          />
                        </TableCell>
                        <TableCell>
                          <InlineSelect
                            value={m.status}
                            options={PESSOA_STATUS_OPTS.map((s) => ({ value: s, label: s }))}
                            allowClear={false}
                            onSave={savePessoa(m.id, "status")}
                          />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Remover da família"
                              onClick={() => {
                                if (confirm(`Remover ${m.nome_completo} desta família? O utilizador continua a existir.`)) {
                                  removeFromFamilia.mutate(m.id);
                                }
                              }}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Apagar utilizador"
                              onClick={() => {
                                if (confirm(`Apagar ${m.nome_completo} definitivamente? Esta ação não pode ser desfeita.`)) {
                                  deletePessoa.mutate(m.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                         </TableCell>
                         </TableRow>
                       );
                     })}
                  </TableBody>
                </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="acoes" className="pt-4 flex-1 min-h-0 overflow-hidden">
              <div className="h-full max-h-[65vh] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Membro</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingAcoesFamilia && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">A carregar…</TableCell></TableRow>
                    )}
                    {!loadingAcoesFamilia && (!acoesFamilia || acoesFamilia.length === 0) && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem inscrições</TableCell></TableRow>
                    )}
                    {acoesFamilia?.map((a) => (
                      <TableRow key={a.inscricao_id}>
                        <TableCell className="font-medium whitespace-nowrap">{a.nome}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{a.data_inicio ? formatDateBR(a.data_inicio) : "—"}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{a.local ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{a.pessoa_nome}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{a.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Adicionar membro à família */}
      <Dialog open={addMembroOpen} onOpenChange={setAddMembroOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar membro</DialogTitle>
            <DialogDescription>
              {membrosFamilia ? `Família: ${membrosFamilia.nome}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="membro-nome">Nome completo</Label>
              <Input id="membro-nome" value={novoMembro.nome_completo} onChange={(e) => setNovoMembro({ ...novoMembro, nome_completo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="membro-email">Email</Label>
              <Input id="membro-email" type="email" value={novoMembro.email} onChange={(e) => setNovoMembro({ ...novoMembro, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="membro-telefone">Telefone</Label>
              <Input id="membro-telefone" value={novoMembro.telefone} onChange={(e) => setNovoMembro({ ...novoMembro, telefone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="membro-data">Data de nascimento</Label>
              <Input id="membro-data" type="date" value={novoMembro.data_nascimento} onChange={(e) => setNovoMembro({ ...novoMembro, data_nascimento: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Género</Label>
              <Select value={novoMembro.genero || "__none"} onValueChange={(v) => setNovoMembro({ ...novoMembro, genero: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {GENERO_OPTS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="membro-cidade">Cidade</Label>
              <Input id="membro-cidade" value={novoMembro.cidade_residencia} onChange={(e) => setNovoMembro({ ...novoMembro, cidade_residencia: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="membro-nacionalidade">Nacionalidade</Label>
              <Input id="membro-nacionalidade" value={novoMembro.nacionalidade} onChange={(e) => setNovoMembro({ ...novoMembro, nacionalidade: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="membro-religiao">Religião</Label>
              <Input id="membro-religiao" value={novoMembro.religiao} onChange={(e) => setNovoMembro({ ...novoMembro, religiao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="membro-nif">NIF</Label>
              <Input id="membro-nif" value={novoMembro.nif} onChange={(e) => setNovoMembro({ ...novoMembro, nif: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Projetos</Label>
              <InlineMultiSelect
                values={novoMembro.projeto_ids}
                options={(projetosList ?? []).map((p) => ({ value: p.id, label: p.nome }))}
                placeholder="sem projetos"
                onSave={(v) => setNovoMembro({ ...novoMembro, projeto_ids: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={novoMembro.status} onValueChange={(v) => setNovoMembro({ ...novoMembro, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PESSOA_STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addMembro.mutate()} disabled={!novoMembro.nome_completo.trim() || addMembro.isPending}>
              {addMembro.isPending ? "A guardar…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}