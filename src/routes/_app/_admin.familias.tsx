import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AcoesHoverSummary } from "@/components/acoes-hover-summary";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LayoutGrid, List, Pencil, Plus, Search, Upload, Users } from "lucide-react";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FamilyDetailDialog } from "@/components/family-detail";
import { applyOptimisticRowPatch, rollbackOptimisticRows } from "@/lib/optimistic-row-update";
import { handleSupabaseError } from "@/lib/handle-supabase-error";

export const Route = createFileRoute("/_app/_admin/familias")({
  component: FamiliasPage,
  validateSearch: (s: Record<string, unknown>) => ({
    familia: typeof s.familia === "string" ? s.familia : undefined,
  }),
});

const TABLE_ID = "familias-v1";

const STATUS_OPTS = [
  "Sem estado",
  "Em espera",
  "No programa",
  "Não interessada",
  "Concluído",
  "Fora do País",
] as const;
type FamiliaStatus = typeof STATUS_OPTS[number];

const STATUS_STYLES: Record<FamiliaStatus, string> = {
  "Sem estado": "bg-muted text-muted-foreground border-transparent",
  "Em espera": "bg-muted text-muted-foreground border-transparent",
  "No programa": "bg-blue-100 text-blue-700 border-transparent dark:bg-blue-950 dark:text-blue-300",
  "Não interessada": "bg-orange-100 text-orange-700 border-transparent dark:bg-orange-950 dark:text-orange-300",
  "Concluído": "bg-emerald-100 text-emerald-700 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  "Fora do País": "bg-pink-100 text-pink-700 border-transparent dark:bg-pink-950 dark:text-pink-300",
};

type Familia = {
  id: string;
  nome: string;
  notas: string | null;
  status: FamiliaStatus;
  contacto_meeru_id: string | null;
  direito_bolsa?: boolean | null;
  direito_mapa_km?: boolean | null;
  updated_at: string | null;
};

/** Linha da tabela: pode ser a família "pura" ou uma cópia atribuída a um
 * grupo multi-valor (Projeto / Cidade / Religião). */
type FamiliaRow = Familia & { __grupo?: string };

type MultiGroup = "none" | "projeto" | "cidade" | "religiao";

const MULTI_LABEL: Record<Exclude<MultiGroup, "none">, string> = {
  projeto: "Projeto",
  cidade: "Cidade",
  religiao: "Religião",
};

/** id da linha → id real da família (as linhas multi-grupo são duplicadas). */
const baseId = (rowId: string) => rowId.split("::")[0];

function FamiliasPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [notas, setNotas] = useState("");
  const [contactoMeeru, setContactoMeeru] = useState<string>("__none");

  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const [membrosFamilia, setMembrosFamilia] = useState<Familia | null>(null);
  const [detailTab, setDetailTab] = useState<"dados" | "membros" | "projetos" | "acoes" | "atividades">("membros");
  const [view, setView] = useState<"tabela" | "galeria">("tabela");
  const [galeriaQuery, setGaleriaQuery] = useState("");
  const [multiGroup, setMultiGroup] = useState<MultiGroup>("none");

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

  const saveFamilia = async (id: string, field: string, v: any) => {
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

  const rows = data ?? [];

  /** Linhas para a tabela: expandidas quando há agrupamento multi-valor,
   * para que uma família com membros em vários projetos apareça em todos. */
  const tableData = useMemo<FamiliaRow[]>(() => {
    if (multiGroup === "none") return rows;
    const out: FamiliaRow[] = [];
    for (const f of rows) {
      const agg = agregados?.get(f.id);
      const set =
        multiGroup === "projeto" ? agg?.projetos :
        multiGroup === "cidade" ? agg?.cidades :
        agg?.religioes;
      const values = Array.from(set ?? []);
      if (values.length === 0) out.push({ ...f, __grupo: "—" });
      else for (const v of values) out.push({ ...f, __grupo: v || "—" });
    }
    return out;
  }, [rows, agregados, multiGroup]);

  const applyMultiGroup = (v: MultiGroup) => {
    // O SmartTable guarda o "agrupar por" em localStorage; ao mudar de
    // dimensão multi-valor, ajustamos essa chave e remontamos a tabela.
    try {
      window.localStorage.setItem(
        `smarttable:${TABLE_ID}:groupBy`,
        JSON.stringify(v === "none" ? "" : "grupo"),
      );
    } catch { /* ignore */ }
    setMultiGroup(v);
  };

  const columns = useMemo<SmartColumnDef<FamiliaRow>[]>(() => {
    const cols: SmartColumnDef<FamiliaRow>[] = [];
    if (multiGroup !== "none") {
      cols.push({
        id: "grupo",
        header: MULTI_LABEL[multiGroup],
        accessorFn: (f) => f.__grupo ?? "—",
        size: 160,
        meta: { label: MULTI_LABEL[multiGroup], filterVariant: "text", groupValue: (f) => f.__grupo || "—" },
      });
    }
    cols.push(
      {
        id: "nome", header: "Nome", accessorKey: "nome", size: 200,
        cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
        meta: { label: "Nome", filterVariant: "text", editType: "text" },
      },
      {
        id: "status", header: "Status", accessorKey: "status", size: 150,
        cell: ({ getValue }) => {
          const s = (getValue() as FamiliaStatus) ?? "Sem estado";
          return <Badge className={STATUS_STYLES[s] ?? ""} variant="outline">{s}</Badge>;
        },
        meta: {
          label: "Status", filterVariant: "select", filterOptions: [...STATUS_OPTS],
          editType: "select", editSelectOptions: STATUS_OPTS.map((o) => ({ value: o, label: o })),
        },
      },
      {
        id: "membros", header: "Membros", accessorFn: (f) => contagens?.get(f.id) ?? 0, size: 100,
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as number}</span>,
        meta: { label: "Membros", filterVariant: "number" },
      },
      {
        id: "projeto", header: "Projeto", size: 180,
        accessorFn: (f) => Array.from(agregados?.get(f.id)?.projetos ?? []).sort().join(", "),
        cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>,
        meta: { label: "Projeto", filterVariant: "text" },
      },
      {
        id: "cidade", header: "Cidade", size: 150,
        accessorFn: (f) => Array.from(agregados?.get(f.id)?.cidades ?? []).sort().join(", "),
        cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>,
        meta: { label: "Cidade", filterVariant: "text" },
      },
      {
        id: "religiao", header: "Religião", size: 140,
        accessorFn: (f) => Array.from(agregados?.get(f.id)?.religioes ?? []).sort().join(", "),
        cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>,
        meta: { label: "Religião", filterVariant: "text" },
      },
      {
        id: "inscricoes", header: "Inscrições", size: 200,
        accessorFn: (f) => Array.from(agregados?.get(f.id)?.inscricoes ?? []).sort().join(", "),
        cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>,
        meta: { label: "Inscrições", filterVariant: "text" },
      },
      {
        id: "acoes_count", header: "Ações", size: 110, enableSorting: false,
        accessorFn: (f) => agregados?.get(f.id)?.inscricoes.size ?? 0,
        cell: ({ row, getValue }) => {
          const n = getValue() as number;
          return <AcoesHoverSummary familiaId={row.original.id} label={`${n} ${n === 1 ? "ação" : "ações"}`} />;
        },
        meta: { label: "Ações", filterVariant: "number", noTruncate: true },
      },
      {
        id: "contacto_meeru", header: "Contacto MEERU", size: 180,
        accessorFn: (f) => (f.contacto_meeru_id ? (equipaMap.get(f.contacto_meeru_id)?.nome_completo ?? "—") : ""),
        cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "—"}</span>,
        meta: {
          label: "Contacto MEERU", filterVariant: "text",
          editType: "select",
          editSelectOptions: (equipa ?? []).map((p) => ({ value: p.id, label: p.nome_completo })),
        },
      },
      {
        id: "notas", header: "Notas", accessorKey: "notas", size: 200,
        cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span>,
        meta: { label: "Notas", filterVariant: "text", editType: "text" },
      },
      {
        id: "updated_at", header: "Última edição", accessorKey: "updated_at", size: 150,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return <span className="text-muted-foreground">{v ? new Date(v).toLocaleString("pt-PT") : "—"}</span>;
        },
        meta: { label: "Última edição", filterVariant: "date" },
      },
    );
    return cols;
  }, [contagens, agregados, equipaMap, equipa, multiGroup]);

  const groupByOptions = useMemo(() => {
    const base = [
      { value: "status", label: "Status" },
      { value: "contacto_meeru", label: "Contacto MEERU" },
    ];
    return multiGroup === "none"
      ? base
      : [{ value: "grupo", label: MULTI_LABEL[multiGroup] }, ...base];
  }, [multiGroup]);

  const FIELD_BY_COLUMN: Record<string, string> = {
    nome: "nome",
    status: "status",
    notas: "notas",
    contacto_meeru: "contacto_meeru_id",
  };

  const openDetail = (f: Familia, tab: "dados" | "membros" | "projetos" | "acoes" | "atividades" = "membros") => {
    setDetailTab(tab);
    setMembrosFamilia(f);
  };

  // ---------- Galeria ----------
  const galeriaRows = useMemo(() => {
    const q = galeriaQuery.trim().toLowerCase();
    const match = (f: Familia) => {
      if (!q) return true;
      const agg = agregados?.get(f.id);
      return [
        f.nome, f.notas ?? "", f.status,
        ...Array.from(agg?.projetos ?? []),
        ...Array.from(agg?.cidades ?? []),
        ...Array.from(agg?.religioes ?? []),
        ...Array.from(agg?.inscricoes ?? []),
      ].join(" ").toLowerCase().includes(q);
    };
    const filtered = rows.filter(match);
    if (multiGroup === "none") return [{ label: "", familias: filtered }];
    const map = new Map<string, Familia[]>();
    for (const f of filtered) {
      const agg = agregados?.get(f.id);
      const set =
        multiGroup === "projeto" ? agg?.projetos :
        multiGroup === "cidade" ? agg?.cidades :
        agg?.religioes;
      const values = Array.from(set ?? []);
      const keys = values.length === 0 ? ["—"] : values;
      for (const k of keys) {
        const list = map.get(k || "—") ?? [];
        list.push(f);
        map.set(k || "—", list);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, familias]) => ({ label, familias }));
  }, [rows, agregados, galeriaQuery, multiGroup]);

  const renderGalleryCard = (f: Familia, keySuffix = "") => {
    const agg = agregados?.get(f.id);
    const nMembros = contagens?.get(f.id) ?? 0;
    const projetos = Array.from(agg?.projetos ?? []).sort();
    const cidades = Array.from(agg?.cidades ?? []).sort();
    return (
      <Card
        key={`${f.id}${keySuffix}`}
        className="p-4 cursor-pointer hover:bg-muted/40 transition-colors flex flex-col gap-2"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("button, [role=checkbox], input")) return;
          openDetail(f, "membros");
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium truncate">{f.nome}</span>
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

          <Button variant="outline" size="sm" className="h-9" onClick={() => setBulkAddOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importar
          </Button>

          <Select value={multiGroup} onValueChange={(v) => applyMultiGroup(v as MultiGroup)}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue placeholder="Agrupar (multi-valor)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem agrupamento multi-valor</SelectItem>
              <SelectItem value="projeto">Por Projeto</SelectItem>
              <SelectItem value="cidade">Por Cidade</SelectItem>
              <SelectItem value="religiao">Por Religião</SelectItem>
            </SelectContent>
          </Select>

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

          {view === "galeria" && (
            <div className="relative flex-1 min-w-[200px] sm:flex-none sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={galeriaQuery}
                onChange={(e) => setGaleriaQuery(e.target.value)}
                placeholder="Pesquisar famílias…"
                data-smart-table-search
                className="pl-8 h-9"
              />
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : view === "galeria" ? (
        <div className="space-y-6">
          {galeriaRows.every((g) => g.familias.length === 0) && (
            <div className="text-center text-muted-foreground py-8">Sem famílias</div>
          )}
          {galeriaRows.map((g) => (
            <div key={g.label || "__all"} className="space-y-2">
              {g.label && (
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{g.label}</h2>
                  <Badge variant="secondary">{g.familias.length}</Badge>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {g.familias.map((f) => renderGalleryCard(f, `-${g.label}`))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <SmartTable<FamiliaRow>
          key={multiGroup}
          tableId={TABLE_ID}
          savedViewsKey="views:familias"
          exportFilename="familias"
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          getRowId={(f) => (f.__grupo ? `${f.id}::${f.__grupo}` : f.id)}
          groupByOptions={groupByOptions}
          searchPlaceholder="Pesquisar famílias…"
          emptyMessage="Sem famílias"
          enableSelection
          editableColumns={["nome", "status", "notas", "contacto_meeru"]}
          onCellEdit={async (rowId, columnId, value) => {
            const field = FIELD_BY_COLUMN[columnId];
            if (!field) return;
            await saveFamilia(baseId(rowId), field, value === "" ? null : value);
          }}
          onBulkEdit={async (ids, patch) => {
            const unique = Array.from(new Set(ids.map(baseId)));
            const dbPatch: Record<string, unknown> = {};
            for (const [col, v] of Object.entries(patch)) {
              const field = FIELD_BY_COLUMN[col];
              if (field) dbPatch[field] = v === "" ? null : v;
            }
            if (Object.keys(dbPatch).length === 0) return;
            const { error } = await supabase.from("familias").update(dbPatch as any).in("id", unique);
            if (error) { handleSupabaseError(error); return; }
            toast.success(`${unique.length} famílias atualizadas`);
            invalidate();
          }}
          onBulkDelete={async (ids) => {
            const unique = Array.from(new Set(ids.map(baseId)));
            const { error } = await supabase
              .from("familias")
              .update({ deleted_at: new Date().toISOString() } as any)
              .in("id", unique);
            if (error) { handleSupabaseError(error); return; }
            toast.success(`${unique.length} famílias eliminadas`);
            invalidate();
          }}
          onRowClick={(f) => openDetail(f, "membros")}
        />
      )}

      {/* Importação em massa */}
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
