import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useMemo, Fragment } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Maximize2, Minimize2, ArrowUpDown, UserPlus, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ImageUpload } from "@/components/image-upload";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  flexRender, type ColumnDef, type SortingState, type VisibilityState, type ColumnOrderState,
} from "@tanstack/react-table";
import { AdvancedTableFilters, advancedFilterFn, type ColumnFilterMeta } from "@/components/advanced-table-filters";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { DraggableTableHeaders } from "@/components/draggable-table-headers";
import { useMobileColumnVisibility } from "@/hooks/use-mobile-columns";
import { matchCidade, formatEuro, type CidadeBolsa } from "@/lib/bolsa-transporte";

export const Route = createFileRoute("/_app/_admin/acoes")({
  component: AcoesPage,
});

type FieldType = "text" | "number" | "date" | "checkbox" | "select" | "multiselect";
type FieldDef = { key: string; label: string; type: FieldType; required?: boolean; options?: string[] };

const TYPE_LABEL: Record<FieldType, string> = {
  text: "Texto",
  number: "Número",
  date: "Data",
  checkbox: "Sim/Não",
  select: "Escolha única",
  multiselect: "Escolha múltipla",
};

function parseFields(config: any): FieldDef[] {
  if (Array.isArray(config?.fields)) {
    return (config.fields as any[]).map((f) => ({
      key: String(f.key ?? ""),
      label: String(f.label ?? f.key ?? ""),
      type: (["text", "number", "date", "checkbox", "select", "multiselect"].includes(f.type) ? f.type : "text") as FieldType,
      required: !!f.required,
      options: Array.isArray(f.options) ? f.options.map((o: any) => String(o)) : undefined,
    }));
  }
  if (config && typeof config === "object") {
    return Object.entries(config).map(([key, t]) => ({
      key,
      label: key,
      type: (t === "boolean" ? "checkbox" : t === "number" ? "number" : t === "date" ? "date" : "text") as FieldType,
      required: false,
    }));
  }
  return [];
}

function slugifyKey(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function FieldsEditor({ fields, setFields }: { fields: FieldDef[]; setFields: (f: FieldDef[]) => void }) {
  const update = (i: number, patch: Partial<FieldDef>) => {
    const next = fields.map((f, idx) => {
      if (idx !== i) return f;
      const merged = { ...f, ...patch };
      if (patch.label !== undefined) {
        const base = slugifyKey(patch.label) || `campo_${i + 1}`;
        let key = base;
        let n = 2;
        const taken = new Set(fields.filter((_, k) => k !== i).map((x) => x.key));
        while (taken.has(key)) key = `${base}_${n++}`;
        merged.key = key;
      }
      return merged;
    });
    setFields(next);
  };
  const remove = (i: number) => setFields(fields.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    setFields(next);
  };
  const add = () => {
    const n = fields.length + 1;
    setFields([...fields, { key: `campo_${n}`, label: `Campo ${n}`, type: "text", required: false }]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Campos do formulário</Label>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar campo
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          Sem campos. Clica em “Adicionar campo” para criar perguntas do formulário de inscrição.
        </p>
      ) : (
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="space-y-2 rounded-md border p-3">
              <div className="grid gap-2 md:grid-cols-[1fr_160px_auto]">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Pergunta</Label>
                <Input
                  value={f.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={f.type} onValueChange={(v) => update(i, { type: v as FieldType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-between gap-1 md:flex-col md:items-stretch">
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={!!f.required} onCheckedChange={(v) => update(i, { required: !!v })} />
                  Obrigatório
                </label>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === fields.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              </div>
              {(f.type === "select" || f.type === "multiselect") && (
                <OptionsEditor
                  options={f.options ?? []}
                  setOptions={(options) => update(i, { options })}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ options, setOptions }: { options: string[]; setOptions: (o: string[]) => void }) {
  return (
    <div className="space-y-1 rounded-md bg-muted/30 p-2">
      <Label className="text-xs text-muted-foreground">Opções</Label>
      {options.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Sem opções. Adiciona pelo menos uma.</p>
      )}
      <div className="space-y-1">
        {options.map((opt, idx) => (
          <div key={idx} className="flex gap-1">
            <Input
              value={opt}
              onChange={(e) => setOptions(options.map((o, k) => (k === idx ? e.target.value : o)))}
              placeholder={`Opção ${idx + 1}`}
            />
            <Button type="button" size="icon" variant="ghost" onClick={() => setOptions(options.filter((_, k) => k !== idx))}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" size="sm" variant="outline" onClick={() => setOptions([...options, ""])}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar opção
      </Button>
    </div>
  );
}

type AcaoForm = {
  nome: string;
  local: string;
  mapa_url: string;
  imagem_url: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  inscricoes_abertas: boolean;
  bolsa_transporte: boolean;
  projeto_ids: string[];
  restrito_a_projetos: boolean;
  fields: FieldDef[];
};

const EMPTY_FORM: AcaoForm = { nome: "", local: "", mapa_url: "", imagem_url: "", descricao: "", data_inicio: "", data_fim: "", status: "ativa", inscricoes_abertas: true, bolsa_transporte: false, projeto_ids: [], restrito_a_projetos: false, fields: [] };

const acaoFormSchema = z
  .object({
    nome: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome demasiado longo"),
    local: z.string().max(500).optional(),
    mapa_url: z
      .string()
      .trim()
      .max(500)
      .refine((v) => !v || /^https?:\/\//i.test(v), "Link do Google Maps deve começar por http(s)://")
      .optional(),
    imagem_url: z.string().max(1000).optional(),
    descricao: z.string().max(20000).optional(),
    data_inicio: z.string(),
    data_fim: z.string(),
    status: z.string().trim().min(1, "Estado é obrigatório").max(50),
    inscricoes_abertas: z.boolean(),
    bolsa_transporte: z.boolean().optional(),
  })
  .refine((v) => !v.data_inicio || !v.data_fim || new Date(v.data_fim) >= new Date(v.data_inicio), {
    message: "Data de fim deve ser igual ou posterior à data de início",
    path: ["data_fim"],
  });

function validateAcaoForm(form: AcaoForm): boolean {
  const result = acaoFormSchema.safeParse(form);
  if (!result.success) {
    toast.error(result.error.issues[0]?.message ?? "Dados inválidos");
    return false;
  }
  return true;
}

const DEFAULT_STATUSES = ["ativa", "cancelada", "concluida"];

type LocalizacaoLite = { id: string; nome: string; link_mapa: string | null };

function useLocalizacoes() {
  return useQuery({
    queryKey: ["localizacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("localizacoes")
        .select("id, nome, link_mapa")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as LocalizacaoLite[];
    },
  });
}

async function upsertLocalizacao(nome: string, linkMapa: string | null) {
  const nomeTrim = nome.trim();
  if (!nomeTrim) return;
  const { data: existing } = await supabase
    .from("localizacoes")
    .select("id, link_mapa")
    .ilike("nome", nomeTrim)
    .limit(1);
  if (existing && existing.length > 0) {
    // Preenche o link do mapa se ainda não tiver
    if (linkMapa && !existing[0].link_mapa) {
      await supabase
        .from("localizacoes")
        .update({ link_mapa: linkMapa })
        .eq("id", existing[0].id);
    }
    return;
  }
  await supabase.from("localizacoes").insert({ nome: nomeTrim, link_mapa: linkMapa });
}

function LocalCombobox({
  value,
  onChange,
  onPickExisting,
}: {
  value: string;
  onChange: (v: string) => void;
  onPickExisting?: (loc: LocalizacaoLite) => void;
}) {
  const { data: locais } = useLocalizacoes();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locais ?? [];
    return (locais ?? []).filter((l) => l.nome.toLowerCase().includes(q));
  }, [locais, query]);

  const exactMatch = (locais ?? []).some(
    (l) => l.nome.toLowerCase() === query.trim().toLowerCase(),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Procura ou escreve um novo local"
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Procurar localização…"
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              onChange(v);
            }}
          />
          <CommandList>
            <CommandEmpty>Sem localizações guardadas.</CommandEmpty>
            {filtered.length > 0 && (
              <CommandGroup heading="Localizações da Meeru">
                {filtered.map((l) => (
                  <CommandItem
                    key={l.id}
                    value={l.nome}
                    onSelect={() => {
                      onChange(l.nome);
                      onPickExisting?.(l);
                      setQuery(l.nome);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{l.nome}</span>
                      {l.link_mapa && (
                        <span className="text-xs text-muted-foreground truncate max-w-[280px]">
                          {l.link_mapa}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {query.trim() && !exactMatch && (
              <CommandGroup heading="Novo">
                <CommandItem
                  value={`__novo_${query}`}
                  onSelect={() => {
                    onChange(query.trim());
                    setOpen(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar “{query.trim()}” — será guardado ao gravar
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function StatusInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const all = Array.from(new Set([...DEFAULT_STATUSES, ...options].filter(Boolean)));
  return (
    <>
      <Input
        list="acao-status-list"
        value={value}
        placeholder="Ex: ativa, em-pausa…"
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id="acao-status-list">
        {all.map((s) => <option key={s} value={s} />)}
      </datalist>
    </>
  );
}

function toDtLocal(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDtLocal(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const INSCRICAO_STATUSES = ["confirmada", "pendente", "presente", "ausente", "cancelada"] as const;
type InscricaoStatus = typeof INSCRICAO_STATUSES[number];

const INSCRICAO_STATUS_LABEL: Record<InscricaoStatus, string> = {
  confirmada: "Confirmada",
  pendente: "Pendente",
  presente: "Presente",
  ausente: "Ausente",
  cancelada: "Cancelada",
};

type InscricaoRow = {
  id: string;
  status: InscricaoStatus;
  valores_dinamicos: Record<string, any> | null;
  pessoa: any;
};

function InscricoesTab({ acaoId, fields }: { acaoId: string; fields: FieldDef[] }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<InscricaoStatus>("presente");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [editingInscricao, setEditingInscricao] = useState<InscricaoRow | null>(null);
  const [editValores, setEditValores] = useState<Record<string, any>>({});
  const [confirmDelete, setConfirmDelete] = useState<InscricaoRow | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<string>("");
  const [bulkEditValue, setBulkEditValue] = useState<any>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [groupByFamilia, setGroupByFamilia] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["inscricoes", acaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inscricoes")
        .select("id, status, valores_dinamicos, created_at, pessoa:pessoas(id, nome_completo, email, telefone, data_nascimento, nif, cidade_residencia, genero, nacionalidade, familia_id, familia:familias(id, nome))")
        .eq("acao_id", acaoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: InscricaoStatus }) => {
      const { error } = await supabase.from("inscricoes").update({ status: status as any }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inscricoes", acaoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateValores = useMutation({
    mutationFn: async ({ id, valores }: { id: string; valores: Record<string, any> }) => {
      const { error } = await supabase.from("inscricoes").update({ valores_dinamicos: valores }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inscricoes", acaoId] });
      toast.success("Respostas atualizadas");
      setEditingInscricao(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteInscricao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inscricoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inscricoes", acaoId] });
      qc.invalidateQueries({ queryKey: ["acoes", "inscricoes-count"] });
      toast.success("Inscrição removida");
      setConfirmDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("inscricoes").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inscricoes", acaoId] });
      qc.invalidateQueries({ queryKey: ["acoes", "inscricoes-count"] });
      toast.success("Inscrições removidas");
      setSelected(new Set());
      setBulkDeleteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkUpdateField = useMutation({
    mutationFn: async ({ ids, key, value }: { ids: string[]; key: string; value: any }) => {
      const rows = (data ?? []).filter((r: any) => ids.includes(r.id));
      for (const r of rows) {
        const next = { ...(r.valores_dinamicos ?? {}), [key]: value };
        const { error } = await supabase.from("inscricoes").update({ valores_dinamicos: next }).eq("id", r.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inscricoes", acaoId] });
      toast.success("Respostas atualizadas");
      setBulkEditOpen(false);
      setBulkEditField("");
      setBulkEditValue(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const baseRows: InscricaoRow[] = useMemo(
    () => (data ?? []).filter((r: any) => r.status !== "cancelada"),
    [data]
  );
  const total = baseRows.length;
  const presentes = baseRows.filter((r) => r.status === "presente").length;
  const inscritosIds = useMemo(
    () => new Set(baseRows.map((r) => r.pessoa?.id).filter(Boolean) as string[]),
    [baseRows]
  );
  const familiasOptions = useMemo(() => {
    const set = new Set<string>();
    baseRows.forEach((r) => { const n = r.pessoa?.familia?.nome; if (n) set.add(n); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [baseRows]);
  const [addOpen, setAddOpen] = useState(false);

  const columns: ColumnDef<InscricaoRow>[] = useMemo(() => [
    {
      id: "status",
      header: "Estado",
      accessorFn: (r) => INSCRICAO_STATUS_LABEL[r.status] ?? r.status,
      filterFn: advancedFilterFn as any,
      meta: { filterVariant: "select", filterOptions: INSCRICAO_STATUSES.map((s) => INSCRICAO_STATUS_LABEL[s]), label: "Estado" } satisfies ColumnFilterMeta,
      cell: ({ row }) => (
        <Select
          value={row.original.status}
          onValueChange={(v) => updateStatus.mutate({ ids: [row.original.id], status: v as InscricaoStatus })}
        >
          <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {INSCRICAO_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{INSCRICAO_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    { id: "nome", header: "Nome", accessorFn: (r) => r.pessoa?.nome_completo ?? "", filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Nome" } satisfies ColumnFilterMeta },
    { id: "email", header: "Email", accessorFn: (r) => r.pessoa?.email ?? "", filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Email" } satisfies ColumnFilterMeta },
    { id: "telefone", header: "Telefone", accessorFn: (r) => r.pessoa?.telefone ?? "", filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Telefone" } satisfies ColumnFilterMeta },
    { id: "data_nascimento", header: "Data nasc.", accessorFn: (r) => r.pessoa?.data_nascimento ?? "", filterFn: advancedFilterFn as any, meta: { filterVariant: "date", label: "Data nascimento" } satisfies ColumnFilterMeta },
    { id: "nif", header: "NIF", accessorFn: (r) => r.pessoa?.nif ?? "", filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "NIF" } satisfies ColumnFilterMeta },
    { id: "cidade", header: "Cidade", accessorFn: (r) => r.pessoa?.cidade_residencia ?? "", filterFn: advancedFilterFn as any, meta: { filterVariant: "text", label: "Cidade" } satisfies ColumnFilterMeta },
    {
      id: "familia",
      header: "Família",
      accessorFn: (r) => r.pessoa?.familia?.nome ?? "",
      filterFn: advancedFilterFn as any,
      meta: { filterVariant: "select", filterOptions: familiasOptions, label: "Família" } satisfies ColumnFilterMeta,
      cell: ({ row }) => row.original.pessoa?.familia?.nome ?? <span className="text-muted-foreground">—</span>,
    },
    ...fields.map<ColumnDef<InscricaoRow>>((f) => {
      const variant: ColumnFilterMeta["filterVariant"] =
        f.type === "date" ? "date" : f.type === "number" ? "number" : (f.type === "select" || f.type === "multiselect") ? "select" : "text";
      return {
        id: `field:${f.key}`,
        header: f.label,
        accessorFn: (r) => {
          const v = r.valores_dinamicos?.[f.key];
          if (v === undefined || v === null) return "";
          return Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Sim" : "Não") : v;
        },
        filterFn: advancedFilterFn as any,
        meta: { filterVariant: variant, filterOptions: f.options, label: f.label } satisfies ColumnFilterMeta,
      };
    }),
    {
      id: "actions",
      header: "",
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => { setEditingInscricao(row.original); setEditValores({ ...(row.original.valores_dinamicos ?? {}) }); }}
            title="Editar respostas"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(row.original)}
            title="Apagar inscrição"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [fields, familiasOptions]);

  const table = useReactTable({
    columnResizeMode: "onChange",
    defaultColumn: { minSize: 60, size: 160, maxSize: 800 },
    data: baseRows,
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

  useMobileColumnVisibility(table, ["status", "nome", "telefone", "actions"]);

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const filteredRows = table.getRowModel().rows;
  const allSelected = filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.original.id));
  const someSelected = selected.size > 0;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filteredRows.map((r) => r.original.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const applyBulk = () => {
    if (selected.size === 0) return;
    updateStatus.mutate(
      { ids: Array.from(selected), status: bulkStatus },
      { onSuccess: () => { qc.invalidateQueries({ queryKey: ["inscricoes", acaoId] }); setSelected(new Set()); toast.success("Estado atualizado"); } },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-md border px-3 py-2">
          <p className="text-xs text-muted-foreground">Inscritos</p>
          <p className="text-xl font-semibold">{total}</p>
        </div>
        <div className="rounded-md border px-3 py-2">
          <p className="text-xs text-muted-foreground">Presentes</p>
          <p className="text-xl font-semibold">{presentes}</p>
        </div>
        <div className="ml-auto">
          <AdvancedTableFilters table={table} />
        </div>
        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
          <Switch id="group-familia" checked={groupByFamilia} onCheckedChange={setGroupByFamilia} />
          <Label htmlFor="group-familia" className="text-xs cursor-pointer">Agrupar por família</Label>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <UserPlus className="mr-1 h-3.5 w-3.5" /> Adicionar Pessoas
        </Button>
        <DataTableViewOptions table={table} />
      </div>
      <AddPessoasDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        acaoId={acaoId}
        inscritosIds={inscritosIds}
      />
      {baseRows.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          Ainda ninguém se inscreveu.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
            <span className="text-xs text-muted-foreground">
              {someSelected ? `${selected.size} selecionada(s)` : "Seleciona inscrições para alterar em massa"}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as InscricaoStatus)}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INSCRICAO_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{INSCRICAO_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!someSelected || updateStatus.isPending} onClick={applyBulk}>
                Aplicar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!someSelected || fields.length === 0}
                onClick={() => { setBulkEditField(fields[0]?.key ?? ""); setBulkEditValue(null); setBulkEditOpen(true); }}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" /> Editar respostas
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={!someSelected}
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Apagar
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Selecionar tudo" />
                  </TableHead>
                  <DraggableTableHeaders table={table} onOrderChange={setColumnOrder} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={table.getVisibleLeafColumns().length + 1} className="text-center text-xs text-muted-foreground">
                      Sem resultados para os filtros aplicados.
                    </TableCell>
                  </TableRow>
                )}
                {(() => {
                  if (!groupByFamilia) {
                    return filteredRows.map((row) => (
                  <TableRow key={row.id} data-state={selected.has(row.original.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selected.has(row.original.id)} onCheckedChange={() => toggleOne(row.original.id)} />
                    </TableCell>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="break-words">
                        {flexRender(cell.column.columnDef.cell ?? ((c: any) => c.getValue() || "—"), cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                    ));
                  }
                  const groups = new Map<string, typeof filteredRows>();
                  filteredRows.forEach((row) => {
                    const key = row.original.pessoa?.familia?.nome ?? "— Sem família —";
                    const arr = groups.get(key) ?? [];
                    arr.push(row);
                    groups.set(key, arr);
                  });
                  const sortedKeys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
                  const colSpan = table.getVisibleLeafColumns().length + 1;
                  const out: any[] = [];
                  sortedKeys.forEach((key) => {
                    const rows = groups.get(key)!;
                    const groupIds = rows.map((r) => r.original.id);
                    const allGroupSelected = groupIds.every((id) => selected.has(id));
                    const toggleGroup = () => {
                      const next = new Set(selected);
                      if (allGroupSelected) groupIds.forEach((id) => next.delete(id));
                      else groupIds.forEach((id) => next.add(id));
                      setSelected(next);
                    };
                    out.push(
                      <TableRow key={`group-${key}`} className="bg-muted/50 hover:bg-muted/50">
                        <TableCell>
                          <Checkbox checked={allGroupSelected} onCheckedChange={toggleGroup} />
                        </TableCell>
                        <TableCell colSpan={colSpan - 1} className="font-medium text-sm">
                          {key} <span className="text-muted-foreground font-normal">({rows.length})</span>
                        </TableCell>
                      </TableRow>
                    );
                    rows.forEach((row) => {
                      out.push(
                        <TableRow key={row.id} data-state={selected.has(row.original.id) ? "selected" : undefined}>
                          <TableCell>
                            <Checkbox checked={selected.has(row.original.id)} onCheckedChange={() => toggleOne(row.original.id)} />
                          </TableCell>
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="break-words">
                              {flexRender(cell.column.columnDef.cell ?? ((c: any) => c.getValue() || "—"), cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    });
                  });
                  return out;
                })()}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog open={!!editingInscricao} onOpenChange={(o) => { if (!o) setEditingInscricao(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar respostas</DialogTitle>
            <DialogDescription>
              {editingInscricao?.pessoa?.nome_completo ?? ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {fields.length === 0 && (
              <p className="text-sm text-muted-foreground">Esta ação não tem campos personalizados.</p>
            )}
            {fields.map((f) => {
              const v = editValores[f.key];
              const setV = (val: any) => setEditValores({ ...editValores, [f.key]: val });
              return (
                <div key={f.key} className="space-y-1.5">
                  <Label>{f.label}{f.required ? " *" : ""}</Label>
                  {f.type === "text" && (
                    <Input value={v ?? ""} onChange={(e) => setV(e.target.value)} />
                  )}
                  {f.type === "number" && (
                    <Input type="number" value={v ?? ""} onChange={(e) => setV(e.target.value === "" ? null : Number(e.target.value))} />
                  )}
                  {f.type === "date" && (
                    <Input type="date" value={v ?? ""} onChange={(e) => setV(e.target.value)} />
                  )}
                  {f.type === "checkbox" && (
                    <div className="flex items-center gap-2">
                      <Checkbox checked={!!v} onCheckedChange={(c) => setV(!!c)} />
                      <span className="text-sm text-muted-foreground">Sim</span>
                    </div>
                  )}
                  {f.type === "select" && (
                    <Select value={v ?? "__none"} onValueChange={(val) => setV(val === "__none" ? null : val)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">—</SelectItem>
                        {(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {f.type === "multiselect" && (
                    <div className="flex flex-wrap gap-2 rounded-md border p-2">
                      {(f.options ?? []).map((o) => {
                        const arr: string[] = Array.isArray(v) ? v : [];
                        const checked = arr.includes(o);
                        return (
                          <label key={o} className="flex items-center gap-1.5 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => setV(c ? [...arr, o] : arr.filter((x) => x !== o))}
                            />
                            <span>{o}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingInscricao(null)}>Cancelar</Button>
            <Button
              onClick={() => editingInscricao && updateValores.mutate({ id: editingInscricao.id, valores: editValores })}
              disabled={updateValores.isPending}
            >
              {updateValores.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apagar inscrição</DialogTitle>
            <DialogDescription>
              Tens a certeza que queres apagar a inscrição de {confirmDelete?.pessoa?.nome_completo ?? "esta pessoa"}? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && deleteInscricao.mutate(confirmDelete.id)}
              disabled={deleteInscricao.isPending}
            >
              {deleteInscricao.isPending ? "A apagar…" : "Apagar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apagar inscrições</DialogTitle>
            <DialogDescription>
              Apagar {selected.size} inscrição(ões) selecionada(s)? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => bulkDelete.mutate(Array.from(selected))}
              disabled={bulkDelete.isPending}
            >
              {bulkDelete.isPending ? "A apagar…" : "Apagar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar respostas em massa</DialogTitle>
            <DialogDescription>
              Aplicar o mesmo valor a {selected.size} inscrição(ões).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Campo</Label>
              <Select value={bulkEditField} onValueChange={(v) => { setBulkEditField(v); setBulkEditValue(null); }}>
                <SelectTrigger><SelectValue placeholder="Escolhe um campo" /></SelectTrigger>
                <SelectContent>
                  {fields.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(() => {
              const f = fields.find((x) => x.key === bulkEditField);
              if (!f) return null;
              const v = bulkEditValue;
              const setV = (val: any) => setBulkEditValue(val);
              return (
                <div className="space-y-1.5">
                  <Label>Novo valor</Label>
                  {f.type === "text" && <Input value={v ?? ""} onChange={(e) => setV(e.target.value)} />}
                  {f.type === "number" && <Input type="number" value={v ?? ""} onChange={(e) => setV(e.target.value === "" ? null : Number(e.target.value))} />}
                  {f.type === "date" && <Input type="date" value={v ?? ""} onChange={(e) => setV(e.target.value)} />}
                  {f.type === "checkbox" && (
                    <div className="flex items-center gap-2">
                      <Checkbox checked={!!v} onCheckedChange={(c) => setV(!!c)} />
                      <span className="text-sm text-muted-foreground">Sim</span>
                    </div>
                  )}
                  {f.type === "select" && (
                    <Select value={v ?? "__none"} onValueChange={(val) => setV(val === "__none" ? null : val)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">—</SelectItem>
                        {(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {f.type === "multiselect" && (
                    <div className="flex flex-wrap gap-2 rounded-md border p-2">
                      {(f.options ?? []).map((o) => {
                        const arr: string[] = Array.isArray(v) ? v : [];
                        const checked = arr.includes(o);
                        return (
                          <label key={o} className="flex items-center gap-1.5 text-sm">
                            <Checkbox checked={checked} onCheckedChange={(c) => setV(c ? [...arr, o] : arr.filter((x) => x !== o))} />
                            <span>{o}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => bulkUpdateField.mutate({ ids: Array.from(selected), key: bulkEditField, value: bulkEditValue })}
              disabled={!bulkEditField || bulkUpdateField.isPending}
            >
              {bulkUpdateField.isPending ? "A guardar…" : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AcoesPage() {
  return <AcoesPageInner />;
}

function AddPessoasDialog({
  open,
  onOpenChange,
  acaoId,
  inscritosIds,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  acaoId: string;
  inscritosIds: Set<string>;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pessoas" | "familias">("pessoas");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [familiaFilter, setFamiliaFilter] = useState<string>("__all");
  const [cidadeFilter, setCidadeFilter] = useState<string>("__all");
  const [statusPessoaFilter, setStatusPessoaFilter] = useState<string>("ativo");
  const [statusFamiliaFilter, setStatusFamiliaFilter] = useState<string>("__all");

  const { data: pessoas, isLoading: loadingPessoas } = useQuery({
    queryKey: ["pessoas-atribuir"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, telefone, email, familia_id, cidade_residencia, status")
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return data as Array<{ id: string; nome_completo: string; telefone: string | null; email: string | null; familia_id: string | null; cidade_residencia: string | null; status: string }>;
    },
  });

  const { data: familias, isLoading: loadingFamilias } = useQuery({
    queryKey: ["familias-atribuir"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familias")
        .select("id, nome, status");
      if (error) throw error;
      return data as Array<{ id: string; nome: string; status: string }>;
    },
  });

  const familiaMembros = useMemo(() => {
    const m = new Map<string, Array<{ id: string; nome_completo: string }>>();
    (pessoas ?? []).forEach((p) => {
      if (!p.familia_id) return;
      const arr = m.get(p.familia_id) ?? [];
      arr.push({ id: p.id, nome_completo: p.nome_completo });
      m.set(p.familia_id, arr);
    });
    return m;
  }, [pessoas]);

  const filteredPessoas = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const list = pessoas ?? [];
    return list.filter((p) => {
      if (q && ![p.nome_completo, p.telefone ?? "", p.email ?? ""].some((v) => v.toLowerCase().includes(q))) return false;
      if (statusPessoaFilter !== "__all" && p.status !== statusPessoaFilter) return false;
      if (familiaFilter === "__none") {
        if (p.familia_id) return false;
      } else if (familiaFilter !== "__all") {
        if (p.familia_id !== familiaFilter) return false;
      }
      if (cidadeFilter === "__none") {
        if (p.cidade_residencia && p.cidade_residencia.trim()) return false;
      } else if (cidadeFilter !== "__all") {
        if ((p.cidade_residencia ?? "") !== cidadeFilter) return false;
      }
      return true;
    });
  }, [pessoas, debouncedSearch, familiaFilter, cidadeFilter, statusPessoaFilter]);

  const statusesPessoa = useMemo(() => {
    const set = new Set<string>();
    (pessoas ?? []).forEach((p) => { if (p.status) set.add(p.status); });
    return Array.from(set).sort();
  }, [pessoas]);

  const cidadesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    (pessoas ?? []).forEach((p) => {
      const c = (p.cidade_residencia ?? "").trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pessoas]);

  const filteredFamilias = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const list = familias ?? [];
    return list.filter((f) => {
      if (q && !f.nome.toLowerCase().includes(q)) return false;
      if (statusFamiliaFilter !== "__all" && (f.status ?? "") !== statusFamiliaFilter) return false;
      return true;
    });
  }, [familias, debouncedSearch, statusFamiliaFilter]);

  const statusesFamilia = useMemo(() => {
    const set = new Set<string>();
    (familias ?? []).forEach((f) => { if (f.status) set.add(f.status); });
    return Array.from(set).sort();
  }, [familias]);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectablePessoas = filteredPessoas.filter((p) => !inscritosIds.has(p.id));
  const allPessoasSelected = selectablePessoas.length > 0 && selectablePessoas.every((p) => selected.has(p.id));
  const togglePessoasAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPessoasSelected) selectablePessoas.forEach((p) => next.delete(p.id));
      else selectablePessoas.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const getFamiliaState = (familiaId: string) => {
    const membros = familiaMembros.get(familiaId) ?? [];
    if (membros.length === 0) return { label: "Sem membros", variant: "outline" as const, selectable: [] as string[], allInscritos: false };
    const inscritos = membros.filter((m) => inscritosIds.has(m.id));
    const naoInscritos = membros.filter((m) => !inscritosIds.has(m.id));
    if (inscritos.length === membros.length) return { label: "Totalmente inscrita", variant: "secondary" as const, selectable: [], allInscritos: true };
    if (inscritos.length > 0) return { label: `Parcialmente inscrita (${inscritos.length}/${membros.length})`, variant: "outline" as const, selectable: naoInscritos.map((m) => m.id), allInscritos: false };
    return { label: `Não inscrita (${membros.length})`, variant: "outline" as const, selectable: naoInscritos.map((m) => m.id), allInscritos: false };
  };

  const toggleFamilia = (familiaId: string) => {
    const { selectable } = getFamiliaState(familiaId);
    if (selectable.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const allIn = selectable.every((id) => next.has(id));
      if (allIn) selectable.forEach((id) => next.delete(id));
      else selectable.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectableFamiliasIds = filteredFamilias
    .map((f) => getFamiliaState(f.id))
    .flatMap((s) => s.selectable);
  const allFamiliasSelected = selectableFamiliasIds.length > 0 && selectableFamiliasIds.every((id) => selected.has(id));
  const toggleFamiliasAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFamiliasSelected) selectableFamiliasIds.forEach((id) => next.delete(id));
      else selectableFamiliasIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const inscrever = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const rows = ids.map((pessoa_id) => ({
        pessoa_id,
        acao_id: acaoId,
        status: "confirmada" as const,
        valores_dinamicos: {},
      }));
      const { error } = await supabase.from("inscricoes").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inscricoes", acaoId] });
      qc.invalidateQueries({ queryKey: ["inscricao-counts"] });
      toast.success("Pessoas inscritas com sucesso");
      setSelected(new Set());
      setSearch("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = (nome: string) =>
    nome.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Atribuição Manual</SheetTitle>
          <SheetDescription>Adiciona pessoas ou famílias inteiras a esta ação.</SheetDescription>
        </SheetHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, telefone ou email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "pessoas" | "familias")} className="flex flex-1 flex-col overflow-hidden">
          <TabsList className="w-full">
            <TabsTrigger value="pessoas" className="flex-1">Pessoas</TabsTrigger>
            <TabsTrigger value="familias" className="flex-1">Famílias</TabsTrigger>
          </TabsList>
          <TabsContent value="pessoas" className="flex-1 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 py-2">
              <Select value={statusPessoaFilter} onValueChange={setStatusPessoaFilter}>
                <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos os estados</SelectItem>
                  {statusesPessoa.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={familiaFilter} onValueChange={setFamiliaFilter}>
                <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Família" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todas as famílias</SelectItem>
                  <SelectItem value="__none">Sem família</SelectItem>
                  {(familias ?? []).slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={cidadeFilter} onValueChange={setCidadeFilter}>
                <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Cidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todas as cidades</SelectItem>
                  <SelectItem value="__none">Sem cidade</SelectItem>
                  {cidadesDisponiveis.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(familiaFilter !== "__all" || cidadeFilter !== "__all" || statusPessoaFilter !== "ativo") && (
                <Button size="sm" variant="ghost" onClick={() => { setFamiliaFilter("__all"); setCidadeFilter("__all"); setStatusPessoaFilter("ativo"); }}>
                  Limpar
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 border-b py-2">
              <Checkbox
                checked={allPessoasSelected}
                onCheckedChange={togglePessoasAll}
                disabled={selectablePessoas.length === 0}
                aria-label="Selecionar visíveis"
              />
              <span className="text-xs text-muted-foreground">
                Selecionar visíveis ({selectablePessoas.length} disponíveis)
              </span>
            </div>
            <ScrollArea className="h-[60vh]">
              {loadingPessoas ? (
                <Skeleton className="m-2 h-32" />
              ) : filteredPessoas.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Sem resultados.</p>
              ) : (
                <ul className="divide-y">
                  {filteredPessoas.map((p) => {
                    const inscrito = inscritosIds.has(p.id);
                    return (
                      <li key={p.id} className="flex items-center gap-3 px-1 py-2">
                        <Checkbox
                          checked={selected.has(p.id)}
                          disabled={inscrito}
                          onCheckedChange={() => toggleOne(p.id)}
                        />
                        <div className="grid h-8 w-8 place-content-center rounded-full bg-muted text-xs font-medium">
                          {initials(p.nome_completo) || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.nome_completo}</p>
                          {(p.telefone || p.email) && (
                            <p className="truncate text-xs text-muted-foreground">
                              {p.telefone ?? p.email}
                            </p>
                          )}
                        </div>
                        {inscrito && <Badge variant="secondary">Já inscrito</Badge>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="familias" className="flex-1 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 py-2">
              <Select value={statusFamiliaFilter} onValueChange={setStatusFamiliaFilter}>
                <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos os estados</SelectItem>
                  {statusesFamilia.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {statusFamiliaFilter !== "__all" && (
                <Button size="sm" variant="ghost" onClick={() => setStatusFamiliaFilter("__all")}>Limpar</Button>
              )}
            </div>
            <div className="flex items-center gap-2 border-b py-2">
              <Checkbox
                checked={allFamiliasSelected}
                onCheckedChange={toggleFamiliasAll}
                disabled={selectableFamiliasIds.length === 0}
                aria-label="Selecionar visíveis"
              />
              <span className="text-xs text-muted-foreground">
                Selecionar visíveis ({selectableFamiliasIds.length} membros disponíveis)
              </span>
            </div>
            <ScrollArea className="h-[60vh]">
              {loadingFamilias || loadingPessoas ? (
                <Skeleton className="m-2 h-32" />
              ) : filteredFamilias.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Sem resultados.</p>
              ) : (
                <ul className="divide-y">
                  {filteredFamilias.map((f) => {
                    const state = getFamiliaState(f.id);
                    const membros = familiaMembros.get(f.id) ?? [];
                    const checked = state.selectable.length > 0 && state.selectable.every((id) => selected.has(id));
                    return (
                      <li key={f.id} className="flex items-center gap-3 px-1 py-2">
                        <Checkbox
                          checked={checked}
                          disabled={state.selectable.length === 0}
                          onCheckedChange={() => toggleFamilia(f.id)}
                        />
                        <div className="grid h-8 w-8 place-content-center rounded-full bg-muted text-xs font-medium">
                          {initials(f.nome) || "F"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{f.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {membros.length} membro(s)
                          </p>
                        </div>
                        <Badge variant={state.variant}>{state.label}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={selected.size === 0 || inscrever.isPending}
            onClick={() => inscrever.mutate(Array.from(selected))}
          >
            Inscrever Selecionados ({selected.size})
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function BolsaTab({ acaoId }: { acaoId: string }) {
  const { data: cidades } = useQuery({
    queryKey: ["bolsas-cidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bolsas_cidades" as any)
        .select("id, nome, valor_sentido, ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as CidadeBolsa[];
    },
  });

  const { data: inscricoes, isLoading } = useQuery({
    queryKey: ["bolsa-inscricoes", acaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inscricoes")
        .select("id, status, pessoa:pessoas(id, nome_completo, cidade_residencia, familia:familias(id, nome))")
        .eq("acao_id", acaoId)
        .neq("status", "cancelada");
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading || !cidades) return <Skeleton className="h-40 w-full" />;

  const rows = (inscricoes ?? []).map((r: any) => {
    const cidade = matchCidade(r.pessoa?.cidade_residencia, cidades);
    const valor = cidade ? cidade.valor_sentido * 2 : 0;
    return {
      id: r.id,
      nome: r.pessoa?.nome_completo ?? "—",
      familia: r.pessoa?.familia?.nome ?? "",
      cidadeResidencia: r.pessoa?.cidade_residencia ?? "",
      cidade,
      valor,
    };
  });

  const elegiveis = rows.filter((r) => r.cidade);
  const total = elegiveis.reduce((s, r) => s + r.valor, 0);
  const porCidade = new Map<string, { count: number; total: number }>();
  for (const r of elegiveis) {
    const key = r.cidade!.nome;
    const cur = porCidade.get(key) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += r.valor;
    porCidade.set(key, cur);
  }

  type Row = (typeof rows)[number];
  const porFamilia = new Map<string, { nome: string; membros: Row[]; total: number; elegiveis: number }>();
  for (const r of rows) {
    const key = r.familia || "__sem_familia__";
    const cur = porFamilia.get(key) ?? { nome: r.familia || "(Sem família)", membros: [] as Row[], total: 0, elegiveis: 0 };
    cur.membros.push(r);
    cur.total += r.valor;
    if (r.cidade) cur.elegiveis += 1;
    porFamilia.set(key, cur);
  }
  const familias = Array.from(porFamilia.values()).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Elegíveis</CardDescription><CardTitle className="text-2xl">{elegiveis.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total inscritos</CardDescription><CardTitle className="text-2xl">{rows.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total a pagar</CardDescription><CardTitle className="text-2xl">{formatEuro(total)}</CardTitle></CardHeader></Card>
      </div>

      {porCidade.size > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Por cidade</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Cidade</TableHead><TableHead className="text-right">Pessoas</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {Array.from(porCidade.entries()).map(([nome, v]) => (
                  <TableRow key={nome}><TableCell>{nome}</TableCell><TableCell className="text-right">{v.count}</TableCell><TableCell className="text-right font-medium">{formatEuro(v.total)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Por família</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cidade do perfil</TableHead><TableHead>Cidade aplicada</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
            <TableBody>
              {familias.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Sem inscritos.</TableCell></TableRow>}
              {familias.map((f) => (
                <Fragment key={f.nome}>
                  <TableRow className="bg-muted/40">
                    <TableCell colSpan={3} className="font-medium">
                      {f.nome} <span className="text-xs text-muted-foreground font-normal">· {f.membros.length} {f.membros.length === 1 ? "pessoa" : "pessoas"} ({f.elegiveis} elegíve{f.elegiveis === 1 ? "l" : "is"})</span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatEuro(f.total)}</TableCell>
                  </TableRow>
                  {f.membros.map((r) => (
                    <TableRow key={r.id} className={r.cidade ? "" : "opacity-60"}>
                      <TableCell className="pl-6">{r.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{r.cidadeResidencia || "—"}</TableCell>
                      <TableCell>{r.cidade ? <Badge variant="secondary">{r.cidade.nome}</Badge> : <span className="text-xs text-muted-foreground">Sem correspondência</span>}</TableCell>
                      <TableCell className="text-right font-medium">{r.cidade ? formatEuro(r.valor) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AcoesPageInner() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<AcaoForm>(EMPTY_FORM);

  const [editing, setEditing] = useState<(AcaoForm & { id: string }) | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editFullscreen, setEditFullscreen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["acoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes")
        .select("id, nome, local, mapa_url, imagem_url, data_inicio, data_fim, status, inscricoes_abertas, bolsa_transporte, config_campos")
        .order("data_inicio", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: inscricaoCounts } = useQuery({
    queryKey: ["acoes", "inscricoes-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inscricoes")
        .select("acao_id, status");
      if (error) throw error;
      const map = new Map<string, { total: number; presentes: number }>();
      for (const r of (data ?? []) as any[]) {
        if (r.status === "cancelada") continue;
        const cur = map.get(r.acao_id) ?? { total: 0, presentes: 0 };
        cur.total += 1;
        if (r.status === "presente") cur.presentes += 1;
        map.set(r.acao_id, cur);
      }
      return map;
    },
  });

  const toggleInscricoesAbertas = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("acoes").update({ inscricoes_abertas: value } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acoes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["acoes"] });

  const create = useMutation({
    mutationFn: async () => {
      if (!validateAcaoForm(form)) throw new Error("Validação falhou");
      const { error } = await supabase.from("acoes").insert({
        nome: form.nome,
        local: form.local || null,
        mapa_url: form.mapa_url || null,
        imagem_url: form.imagem_url || null,
        descricao: form.descricao || null,
        data_inicio: fromDtLocal(form.data_inicio),
        data_fim: fromDtLocal(form.data_fim),
        status: form.status,
        inscricoes_abertas: form.inscricoes_abertas,
        bolsa_transporte: form.bolsa_transporte,
        config_campos: { fields: form.fields },
      } as any);
      if (error) throw error;
      await upsertLocalizacao(form.local, form.mapa_url || null);
    },
    onSuccess: () => {
      toast.success("Ação criada");
      invalidate();
      qc.invalidateQueries({ queryKey: ["localizacoes"] });
      setAddOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => {
      if (e.message !== "Validação falhou") toast.error(e.message);
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if (!validateAcaoForm(editing)) throw new Error("Validação falhou");
      const { error } = await supabase
        .from("acoes")
        .update({
          nome: editing.nome,
          local: editing.local || null,
          mapa_url: editing.mapa_url || null,
          imagem_url: editing.imagem_url || null,
          descricao: editing.descricao || null,
          data_inicio: fromDtLocal(editing.data_inicio),
          data_fim: fromDtLocal(editing.data_fim),
          status: editing.status,
          inscricoes_abertas: editing.inscricoes_abertas,
          bolsa_transporte: editing.bolsa_transporte,
          config_campos: { fields: editing.fields },
        } as any)
        .eq("id", editing.id);
      if (error) throw error;
      await upsertLocalizacao(editing.local, editing.mapa_url || null);
    },
    onSuccess: () => {
      toast.success("Ação atualizada");
      invalidate();
      qc.invalidateQueries({ queryKey: ["localizacoes"] });
      setEditing(null);
    },
    onError: (e: Error) => {
      if (e.message !== "Validação falhou") toast.error(e.message);
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!deleteId) return;
      const { error } = await supabase.from("acoes").delete().eq("id", deleteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação apagada");
      invalidate();
      setDeleteId(null);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ações</h1>
          <p className="text-sm text-muted-foreground">Eventos da comunidade</p>
        </div>
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setForm(EMPTY_FORM); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nova ação</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova ação</DialogTitle>
              <DialogDescription>Define os dados da ação e que campos os participantes vão preencher.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Imagem do evento</Label>
                <ImageUpload value={form.imagem_url} onChange={(url) => setForm({ ...form, imagem_url: url ?? "" })} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Local</Label>
                  <LocalCombobox
                    value={form.local}
                    onChange={(v) => setForm({ ...form, local: v })}
                    onPickExisting={(loc) =>
                      setForm((f) => ({
                        ...f,
                        local: loc.nome,
                        mapa_url: f.mapa_url || loc.link_mapa || "",
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <StatusInput
                    value={form.status}
                    onChange={(v) => setForm({ ...form, status: v })}
                    options={(data ?? []).map((a: any) => a.status).filter(Boolean)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Link do Google Maps</Label>
                <Input
                  type="url"
                  placeholder="https://maps.app.goo.gl/…"
                  value={form.mapa_url}
                  onChange={(e) => setForm({ ...form, mapa_url: e.target.value })}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Data de início</Label><Input type="datetime-local" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Data de fim <span className="text-xs text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input type="datetime-local" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Deixa vazio se o evento for num único dia.</p>
                </div>
              </div>
              <label className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Inscrições abertas</p>
                  <p className="text-xs text-muted-foreground">Quando desligado, a ação não mostra o botão "Inscrever" no portal público.</p>
                </div>
                <Switch checked={form.inscricoes_abertas} onCheckedChange={(c) => setForm({ ...form, inscricoes_abertas: c })} />
              </label>
              <label className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Bolsa de transporte</p>
                  <p className="text-xs text-muted-foreground">Quando ligada, mostra ao participante (com base na cidade do perfil) quanto receberá por pessoa inscrita.</p>
                </div>
                <Switch checked={form.bolsa_transporte} onCheckedChange={(c) => setForm({ ...form, bolsa_transporte: c })} />
              </label>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <RichTextEditor value={form.descricao} onChange={(v) => setForm({ ...form, descricao: v })} />
              </div>
              <FieldsEditor fields={form.fields} setFields={(fields) => setForm({ ...form, fields })} />
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!form.nome || create.isPending}>
                {create.isPending ? "A guardar…" : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem ações.</p>}
          {data?.map((a) => {
            const fields = parseFields(a.config_campos);
            const counts = inscricaoCounts?.get(a.id) ?? { total: 0, presentes: 0 };
            const inscricoesAbertas = (a as any).inscricoes_abertas ?? true;
            return (
              <Card
                key={a.id}
                className="cursor-pointer transition-colors hover:bg-muted/30"
                onClick={async () => {
                  // Lazy-load the heavy `descricao` HTML only when opening the editor.
                  const { data: full } = await supabase
                    .from("acoes")
                    .select("descricao")
                    .eq("id", a.id)
                    .maybeSingle();
                  setEditing({
                    id: a.id,
                    nome: a.nome ?? "",
                    local: a.local ?? "",
                    mapa_url: (a as any).mapa_url ?? "",
                    imagem_url: (a as any).imagem_url ?? "",
                    descricao: full?.descricao ?? "",
                    data_inicio: toDtLocal(a.data_inicio),
                    data_fim: toDtLocal(a.data_fim),
                    status: String((a as any).status ?? "ativa"),
                    inscricoes_abertas: inscricoesAbertas,
                    bolsa_transporte: !!(a as any).bolsa_transporte,
                    fields,
                  });
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle>{a.nome}</CardTitle>
                      {a.data_inicio && (
                        <CardDescription>
                          {new Date(a.data_inicio).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}
                          {a.data_fim ? ` → ${new Date(a.data_fim).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}` : ""}
                        </CardDescription>
                      )}
                    </div>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                  <label
                    className="flex items-center justify-between rounded-md border p-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs font-medium">Inscrições abertas</span>
                    <Switch
                      checked={inscricoesAbertas}
                      disabled={toggleInscricoesAbertas.isPending}
                      onCheckedChange={(c) => toggleInscricoesAbertas.mutate({ id: a.id, value: c })}
                    />
                  </label>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Inscritos</span>
                    <span className="text-sm font-semibold text-foreground">{counts.total}</span>
                  </div>
                  {counts.presentes > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Presentes</span>
                      <span className="text-sm font-semibold text-foreground">{counts.presentes}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setEditFullscreen(false); } }}>
        <DialogContent
          className={
            editFullscreen
              ? "max-w-none w-screen h-screen sm:rounded-none p-6 overflow-y-auto overflow-x-hidden"
              : "max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden"
          }
        >
          <DialogHeader className="sticky top-0 z-10 -mx-6 -mt-6 border-b bg-background px-6 py-4">
            <div className="flex items-center justify-between gap-2 pr-8">
              <DialogTitle>{editing?.nome || "Editar ação"}</DialogTitle>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setEditFullscreen((v) => !v)}
                title={editFullscreen ? "Sair do ecrã inteiro" : "Ecrã inteiro"}
              >
                {editFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </DialogHeader>
          {editing && (
            <Tabs defaultValue="detalhes" className="min-w-0">
              <TabsList>
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="inscricoes">Inscrições</TabsTrigger>
                {editing.bolsa_transporte && <TabsTrigger value="bolsa">Bolsa</TabsTrigger>}
              </TabsList>
              <TabsContent value="detalhes" className="space-y-4 min-w-0">
              <div className="space-y-2"><Label>Nome</Label><Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Imagem do evento</Label>
                <ImageUpload value={editing.imagem_url} onChange={(url) => setEditing({ ...editing, imagem_url: url ?? "" })} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Local</Label>
                  <LocalCombobox
                    value={editing.local}
                    onChange={(v) => setEditing({ ...editing, local: v })}
                    onPickExisting={(loc) =>
                      setEditing((e) =>
                        e
                          ? {
                              ...e,
                              local: loc.nome,
                              mapa_url: e.mapa_url || loc.link_mapa || "",
                            }
                          : e,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <StatusInput
                    value={editing.status}
                    onChange={(v) => setEditing({ ...editing, status: v })}
                    options={(data ?? []).map((a: any) => a.status).filter(Boolean)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Link do Google Maps</Label>
                <Input
                  type="url"
                  placeholder="https://maps.app.goo.gl/…"
                  value={editing.mapa_url}
                  onChange={(e) => setEditing({ ...editing, mapa_url: e.target.value })}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Data de início</Label><Input type="datetime-local" value={editing.data_inicio} onChange={(e) => setEditing({ ...editing, data_inicio: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Data de fim <span className="text-xs text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input type="datetime-local" value={editing.data_fim} onChange={(e) => setEditing({ ...editing, data_fim: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Deixa vazio se o evento for num único dia.</p>
                </div>
              </div>
              <label className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Inscrições abertas</p>
                  <p className="text-xs text-muted-foreground">Quando desligado, a ação não mostra o botão "Inscrever" no portal público.</p>
                </div>
                <Switch checked={editing.inscricoes_abertas} onCheckedChange={(c) => setEditing({ ...editing, inscricoes_abertas: c })} />
              </label>
              <label className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Bolsa de transporte</p>
                  <p className="text-xs text-muted-foreground">Quando ligada, mostra ao participante (com base na cidade do perfil) quanto receberá por pessoa inscrita.</p>
                </div>
                <Switch checked={editing.bolsa_transporte} onCheckedChange={(c) => setEditing({ ...editing, bolsa_transporte: c })} />
              </label>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <RichTextEditor value={editing.descricao} onChange={(v) => setEditing({ ...editing, descricao: v })} />
              </div>
              <FieldsEditor fields={editing.fields} setFields={(fields) => setEditing({ ...editing, fields })} />
              </TabsContent>
              <TabsContent value="inscricoes" className="min-w-0">
                <InscricoesTab acaoId={editing.id} fields={editing.fields} />
              </TabsContent>
              {editing.bolsa_transporte && (
                <TabsContent value="bolsa" className="min-w-0">
                  <BolsaTab acaoId={editing.id} />
                </TabsContent>
              )}
            </Tabs>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="destructive" onClick={() => editing && setDeleteId(editing.id)}>
              <Trash2 className="mr-1 h-4 w-4" /> Apagar
            </Button>
            <Button onClick={() => update.mutate()} disabled={!editing?.nome || update.isPending}>
              {update.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar ação?</DialogTitle>
            <DialogDescription>
              Esta ação será removida permanentemente. As inscrições associadas podem deixar de funcionar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending ? "A apagar…" : "Apagar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}