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
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Maximize2, Minimize2, ArrowUpDown, UserPlus, Search, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
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
import { matchCidade, formatEuro, type CidadeBolsa, KM_RATE, TRIP_FACTOR, parseViatura, normalizeGrupo } from "@/lib/bolsa-transporte";
import { ChevronDown } from "lucide-react";
import { AcoesPlaneamento } from "@/components/acoes-planeamento";
import { useServerFn } from "@tanstack/react-start";
import {
  syncAcaoToGoogle,
  resyncAllToGoogle,
} from "@/lib/google-calendar.functions";
import { RefreshCw, Calendar as CalendarIcon } from "lucide-react";

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
  imagem_position: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  inscricoes_abertas: boolean;
  bolsa_transporte: boolean;
  projeto_ids: string[];
  restrito_a_projetos: boolean;
  publico: boolean;
  fields: FieldDef[];
  parceiro_ids?: string[];
  tipo_acao_id?: string | null;
  formador_ids?: string[];
};

const EMPTY_FORM: AcaoForm = { nome: "", local: "", mapa_url: "", imagem_url: "", imagem_position: "50% 50%", descricao: "", data_inicio: "", data_fim: "", status: "ativa", inscricoes_abertas: true, bolsa_transporte: false, projeto_ids: [], restrito_a_projetos: false, publico: true, fields: [], parceiro_ids: [], tipo_acao_id: null, formador_ids: [] };

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
    publico: z.boolean(),
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
  const [globalFilter, setGlobalFilter] = useState("");
  
  const { data, isLoading } = useQuery({
    queryKey: ["inscricoes", acaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inscricoes")
        .select("id, status, valores_dinamicos, created_at, pessoa:pessoas(id, nome_completo, email, telefone, data_nascimento, nif, cidade_residencia, genero, nacionalidade, familia_id, familia:familias!pessoas_familia_id_fkey(id, nome))")
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

  const familiasInscritas = useMemo(() => {
    const map = new Map<string, string>();
    baseRows.forEach((r) => {
      const fam = r.pessoa?.familia;
      if (fam?.id && fam?.nome) map.set(fam.id, fam.nome);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [baseRows]);

  const familiasPresentes = useMemo(() => {
    const map = new Map<string, string>();
    baseRows.forEach((r) => {
      if (r.status === "presente") {
        const fam = r.pessoa?.familia;
        if (fam?.id && fam?.nome) map.set(fam.id, fam.nome);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [baseRows]);

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
    {
      id: "nome",
      header: "Nome",
      accessorFn: (r) => r.pessoa?.nome_completo ?? "",
      filterFn: advancedFilterFn as any,
      meta: { filterVariant: "text", label: "Nome" } satisfies ColumnFilterMeta,
      cell: ({ row }) => {
        const p = row.original.pessoa;
        const semRegisto = !!p && !p.email && !p.telefone && !p.familia_id;
        return (
          <div className="flex items-center gap-2">
            <span>{p?.nome_completo ?? "—"}</span>
            {semRegisto && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">Sem registo</Badge>
            )}
          </div>
        );
      },
    },
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
    state: { sorting, columnVisibility, columnOrder, globalFilter },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _id, value) => {
      const q = String(value ?? "").trim().toLowerCase();
      if (!q) return true;
      const p = (row.original as InscricaoRow).pessoa;
      const hay = [
        p?.nome_completo, p?.email, p?.telefone, p?.nif,
        p?.cidade_residencia, p?.familia?.nome,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    },
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
    <div className="space-y-3 pt-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-md border px-3 py-2">
          <p className="text-xs text-muted-foreground">Inscritos</p>
          <p className="text-xl font-semibold">{total}</p>
        </div>
        <div className="rounded-md border px-3 py-2">
          <p className="text-xs text-muted-foreground">Presentes</p>
          <p className="text-xl font-semibold">{presentes}</p>
        </div>
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar nome, email, telefone, família…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8 h-9"
          />
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
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
            Resumo famílias <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-wrap gap-3 mt-2">
            <div className="flex-1 min-w-[240px] rounded-md border px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">Famílias inscritas ({familiasInscritas.length})</p>
              <p className="mt-1 text-sm leading-relaxed">{familiasInscritas.length > 0 ? familiasInscritas.join(", ") : <span className="text-muted-foreground italic">Nenhuma</span>}</p>
            </div>
            <div className="flex-1 min-w-[240px] rounded-md border px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">Famílias presentes ({familiasPresentes.length})</p>
              <p className="mt-1 text-sm leading-relaxed">{familiasPresentes.length > 0 ? familiasPresentes.join(", ") : <span className="text-muted-foreground italic">Nenhuma</span>}</p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
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
  const [tab, setTab] = useState<"pessoas" | "familias" | "nova" | "rapida">("pessoas");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [familiaFilter, setFamiliaFilter] = useState<string>("__all");
  const [cidadeFilter, setCidadeFilter] = useState<string>("__all");
  const [statusPessoaFilter, setStatusPessoaFilter] = useState<string>("ativo");
  const [tipoFilter, setTipoFilter] = useState<string>("__all");
  const [religiaoFilter, setReligiaoFilter] = useState<string>("__all");
  const [nacionalidadeFilter, setNacionalidadeFilter] = useState<string>("__all");
  const [statusFamiliaFilter, setStatusFamiliaFilter] = useState<string>("__all");
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [novoDataNasc, setNovoDataNasc] = useState("");
  const [novoFamiliaId, setNovoFamiliaId] = useState<string>("__none");
  const [novoTipoUserId, setNovoTipoUserId] = useState<string>("__none");
  const [novoNacionalidade, setNovoNacionalidade] = useState("");
  const [novoReligiao, setNovoReligiao] = useState("");
  const [novoNotas, setNovoNotas] = useState("");
  const [novoParceiroId, setNovoParceiroId] = useState<string>("__none");
  const [novaFamiliaNome, setNovaFamiliaNome] = useState("");
  const [nomesRapidos, setNomesRapidos] = useState("");

  const { data: pessoas, isLoading: loadingPessoas } = useQuery({
    queryKey: ["pessoas-atribuir"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, telefone, email, familia_id, cidade_residencia, status, tipo_user_id, religiao, nacionalidade")
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return data as Array<{ id: string; nome_completo: string; telefone: string | null; email: string | null; familia_id: string | null; cidade_residencia: string | null; status: string; tipo_user_id: string | null; religiao: string | null; nacionalidade: string | null }>;
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

  const { data: tipos } = useQuery({
    queryKey: ["tipos-user-atribuir"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_user")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data as Array<{ id: string; nome: string }>;
    },
  });

  const { data: parceirosLookup } = useQuery({
    queryKey: ["parceiros-atribuir"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parceiros")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data as Array<{ id: string; nome: string }>;
    },
  });

  const parceiroTipoId = useMemo(
    () => tipos?.find((t) => t.nome.trim().toLowerCase() === "parceiro")?.id ?? null,
    [tipos],
  );

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
      if (tipoFilter === "__none") {
        if (p.tipo_user_id) return false;
      } else if (tipoFilter !== "__all") {
        if (p.tipo_user_id !== tipoFilter) return false;
      }
      if (religiaoFilter === "__none") {
        if (p.religiao && p.religiao.trim()) return false;
      } else if (religiaoFilter !== "__all") {
        if ((p.religiao ?? "") !== religiaoFilter) return false;
      }
      if (nacionalidadeFilter === "__none") {
        if (p.nacionalidade && p.nacionalidade.trim()) return false;
      } else if (nacionalidadeFilter !== "__all") {
        if ((p.nacionalidade ?? "") !== nacionalidadeFilter) return false;
      }
      return true;
    });
  }, [pessoas, debouncedSearch, familiaFilter, cidadeFilter, statusPessoaFilter, tipoFilter, religiaoFilter, nacionalidadeFilter]);

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

  const religioesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    (pessoas ?? []).forEach((p) => {
      const v = (p.religiao ?? "").trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pessoas]);

  const nacionalidadesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    (pessoas ?? []).forEach((p) => {
      const v = (p.nacionalidade ?? "").trim();
      if (v) set.add(v);
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

  const criarEInscrever = useMutation({
    mutationFn: async () => {
      const nome = novoNome.trim();
      if (!nome) throw new Error("Nome é obrigatório");
      let familiaIdFinal: string | null = null;
      if (novoFamiliaId === "__new") {
        const nomeFam = novaFamiliaNome.trim();
        if (!nomeFam) throw new Error("Nome da nova família é obrigatório");
        const { data: fam, error: fErr } = await supabase
          .from("familias")
          .insert({ nome: nomeFam } as any)
          .select("id")
          .single();
        if (fErr) throw fErr;
        familiaIdFinal = fam.id;
      } else if (novoFamiliaId && novoFamiliaId !== "__none") {
        familiaIdFinal = novoFamiliaId;
      }
      const insertPessoa: any = {
        nome_completo: nome,
        status: "ativo",
      };
      const email = novoEmail.trim();
      const telefone = novoTelefone.trim();
      if (email) insertPessoa.email = email;
      if (telefone) insertPessoa.telefone = telefone;
      if (novoDataNasc) insertPessoa.data_nascimento = novoDataNasc;
      if (familiaIdFinal) insertPessoa.familia_id = familiaIdFinal;
      if (novoTipoUserId && novoTipoUserId !== "__none") insertPessoa.tipo_user_id = novoTipoUserId;
      if (novoNacionalidade.trim()) insertPessoa.nacionalidade = novoNacionalidade.trim();
      if (novoReligiao.trim()) insertPessoa.religiao = novoReligiao.trim();
      if (novoNotas.trim()) insertPessoa.notas = novoNotas.trim();
      if (
        parceiroTipoId &&
        novoTipoUserId === parceiroTipoId &&
        novoParceiroId &&
        novoParceiroId !== "__none"
      ) {
        insertPessoa.parceiro_id = novoParceiroId;
      }
      const { data: pessoa, error: pErr } = await supabase
        .from("pessoas")
        .insert(insertPessoa)
        .select("id")
        .single();
      if (pErr) throw pErr;
      const { error: iErr } = await supabase.from("inscricoes").insert({
        pessoa_id: pessoa.id,
        acao_id: acaoId,
        status: "confirmada" as const,
        valores_dinamicos: {},
      } as any);
      if (iErr) throw iErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inscricoes", acaoId] });
      qc.invalidateQueries({ queryKey: ["inscricao-counts"] });
      qc.invalidateQueries({ queryKey: ["pessoas-atribuir"] });
      qc.invalidateQueries({ queryKey: ["familias-atribuir"] });
      toast.success("Pessoa criada e inscrita");
      setNovoNome(""); setNovoEmail(""); setNovoTelefone(""); setNovoDataNasc("");
      setNovoFamiliaId("__none"); setNovoTipoUserId("__none");
      setNovoNacionalidade(""); setNovoReligiao(""); setNovoNotas(""); setNovaFamiliaNome("");
      setNovoParceiroId("__none");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inscreverRapido = useMutation({
    mutationFn: async () => {
      const nomes = nomesRapidos
        .split(/\r?\n|,/)
        .map((n) => n.trim())
        .filter((n) => n.length > 0);
      if (nomes.length === 0) throw new Error("Indica pelo menos um nome");
      const { data: pessoasCriadas, error: pErr } = await supabase
        .from("pessoas")
        .insert(nomes.map((nome_completo) => ({ nome_completo, status: "ativo" as const })))
        .select("id");
      if (pErr) throw pErr;
      const rows = (pessoasCriadas ?? []).map((p: { id: string }) => ({
        pessoa_id: p.id,
        acao_id: acaoId,
        status: "confirmada" as const,
        valores_dinamicos: {},
      }));
      const { error: iErr } = await supabase.from("inscricoes").insert(rows as any);
      if (iErr) throw iErr;
      return nomes.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["inscricoes", acaoId] });
      qc.invalidateQueries({ queryKey: ["inscricao-counts"] });
      qc.invalidateQueries({ queryKey: ["pessoas-atribuir"] });
      toast.success(`${n} pessoa(s) inscritas`);
      setNomesRapidos("");
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
        <Tabs value={tab} onValueChange={(v) => setTab(v as "pessoas" | "familias" | "nova")} className="flex flex-1 flex-col overflow-hidden">
          <TabsList className="w-full">
            <TabsTrigger value="pessoas" className="flex-1">Pessoas</TabsTrigger>
            <TabsTrigger value="familias" className="flex-1">Famílias</TabsTrigger>
            <TabsTrigger value="nova" className="flex-1">Nova pessoa</TabsTrigger>
            <TabsTrigger value="rapida" className="flex-1">Sem registo</TabsTrigger>
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
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos os tipos</SelectItem>
                  <SelectItem value="__none">Sem tipo</SelectItem>
                  {(tipos ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={religiaoFilter} onValueChange={setReligiaoFilter}>
                <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Religião" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todas as religiões</SelectItem>
                  <SelectItem value="__none">Sem religião</SelectItem>
                  {religioesDisponiveis.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={nacionalidadeFilter} onValueChange={setNacionalidadeFilter}>
                <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Nacionalidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todas as nacionalidades</SelectItem>
                  <SelectItem value="__none">Sem nacionalidade</SelectItem>
                  {nacionalidadesDisponiveis.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(familiaFilter !== "__all" || cidadeFilter !== "__all" || statusPessoaFilter !== "ativo" || tipoFilter !== "__all" || religiaoFilter !== "__all" || nacionalidadeFilter !== "__all") && (
                <Button size="sm" variant="ghost" onClick={() => { setFamiliaFilter("__all"); setCidadeFilter("__all"); setStatusPessoaFilter("ativo"); setTipoFilter("__all"); setReligiaoFilter("__all"); setNacionalidadeFilter("__all"); }}>
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
          <TabsContent value="nova" className="flex-1 overflow-auto">
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground">
                Cria um novo participante na base de dados e inscreve-o automaticamente nesta ação.
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium">Nome completo *</label>
                <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Nome" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Email</label>
                  <Input type="email" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Telefone</label>
                  <Input value={novoTelefone} onChange={(e) => setNovoTelefone(e.target.value)} placeholder="912 345 678" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Data de nascimento</label>
                  <Input type="date" value={novoDataNasc} onChange={(e) => setNovoDataNasc(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Família</label>
                  <Select value={novoFamiliaId} onValueChange={setNovoFamiliaId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Sem família" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sem família</SelectItem>
                      <SelectItem value="__new">+ Criar nova família…</SelectItem>
                      {(familias ?? []).slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {novoFamiliaId === "__new" && (
                <div className="space-y-1">
                  <label className="text-xs font-medium">Nome da nova família *</label>
                  <Input
                    value={novaFamiliaNome}
                    onChange={(e) => setNovaFamiliaNome(e.target.value)}
                    placeholder="Ex: Família Silva"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium">Tipo de utilizador</label>
                <Select value={novoTipoUserId} onValueChange={setNovoTipoUserId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Sem tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem tipo</SelectItem>
                    {(tipos ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {parceiroTipoId && novoTipoUserId === parceiroTipoId && (
                <div className="space-y-1">
                  <label className="text-xs font-medium">Entidade parceira</label>
                  <Select value={novoParceiroId} onValueChange={setNovoParceiroId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="— sem entidade —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— sem entidade —</SelectItem>
                      {(parceirosLookup ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    A pessoa fica como contacto desta entidade.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Nacionalidade</label>
                  <Input
                    value={novoNacionalidade}
                    onChange={(e) => setNovoNacionalidade(e.target.value)}
                    placeholder="Ex: Portuguesa"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Religião</label>
                  <Input
                    value={novoReligiao}
                    onChange={(e) => setNovoReligiao(e.target.value)}
                    placeholder="Ex: Católica"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Notas</label>
                <Textarea
                  value={novoNotas}
                  onChange={(e) => setNovoNotas(e.target.value)}
                  placeholder="Notas adicionais sobre a pessoa"
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="rapida" className="flex-1 overflow-auto">
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground">
                Inscreve várias pessoas de uma só vez indicando apenas o nome. Um nome por linha (ou separados por vírgulas). Os registos ficam sem email, telefone ou família e podem ser completados depois.
              </p>
              <Textarea
                value={nomesRapidos}
                onChange={(e) => setNomesRapidos(e.target.value)}
                placeholder={"Ana Silva\nJoão Pereira\nMaria Santos"}
                className="min-h-[220px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {nomesRapidos.split(/\r?\n|,/).map((n) => n.trim()).filter(Boolean).length} pessoa(s) a inscrever
              </p>
            </div>
          </TabsContent>
        </Tabs>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {tab === "nova" ? (
            <Button
              disabled={
                !novoNome.trim() ||
                (novoFamiliaId === "__new" && !novaFamiliaNome.trim()) ||
                criarEInscrever.isPending
              }
              onClick={() => criarEInscrever.mutate()}
            >
              Criar e inscrever
            </Button>
          ) : tab === "rapida" ? (
            <Button
              disabled={nomesRapidos.trim().length === 0 || inscreverRapido.isPending}
              onClick={() => inscreverRapido.mutate()}
            >
              Inscrever lista
            </Button>
          ) : (
            <Button
              disabled={selected.size === 0 || inscrever.isPending}
              onClick={() => inscrever.mutate(Array.from(selected))}
            >
              Inscrever Selecionados ({selected.size})
            </Button>
          )}
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
        .select("id, status, valores_dinamicos, pessoa:pessoas(id, nome_completo, cidade_residencia, familia:familias!pessoas_familia_id_fkey(id, nome))")
        .eq("acao_id", acaoId)
        .neq("status", "cancelada");
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading || !cidades) return <Skeleton className="h-40 w-full" />;

  const rows = (inscricoes ?? []).map((r: any) => {
    const v = parseViatura(r.valores_dinamicos);
    const cidade = v.viatura_propria ? null : matchCidade(r.pessoa?.cidade_residencia, cidades);
    const valor = cidade ? cidade.valor_sentido * TRIP_FACTOR : 0;
    return {
      id: r.id,
      nome: r.pessoa?.nome_completo ?? "—",
      familia: r.pessoa?.familia?.nome ?? "",
      cidadeResidencia: r.pessoa?.cidade_residencia ?? "",
      cidade,
      valor,
      viatura: v,
    };
  });

  const elegiveis = rows.filter((r) => r.cidade);
  // Viaturas próprias agrupadas por matrícula → uma vez por carro
  const viaturaRows = rows.filter((r) => r.viatura.viatura_propria);
  const grupos = new Map<string, { km: number; nomes: string[]; grupoLabel: string; ids: string[] }>();
  viaturaRows.forEach((r, idx) => {
    const grupoLabel = r.viatura.viatura_grupo?.trim() || `(sem matrícula ${idx + 1})`;
    const key = normalizeGrupo(r.viatura.viatura_grupo) || `__solo_${r.id}`;
    const cur = grupos.get(key) ?? { km: 0, nomes: [], grupoLabel, ids: [] };
    cur.km = Math.max(cur.km, Number(r.viatura.viatura_km ?? 0) || 0);
    cur.nomes.push(r.nome);
    cur.ids.push(r.id);
    grupos.set(key, cur);
  });
  const totalViaturas = Array.from(grupos.values()).reduce((s, g) => s + g.km * KM_RATE * TRIP_FACTOR, 0);
  const totalCidades = elegiveis.reduce((s, r) => s + r.valor, 0);
  const total = totalCidades + totalViaturas;
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
        <Card><CardHeader className="pb-2"><CardDescription>Elegíveis (cidade)</CardDescription><CardTitle className="text-2xl">{elegiveis.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total inscritos</CardDescription><CardTitle className="text-2xl">{rows.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total a pagar</CardDescription><CardTitle className="text-2xl">{formatEuro(total)}</CardTitle></CardHeader></Card>
      </div>

      {grupos.size > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Viaturas próprias</CardTitle><CardDescription>{formatEuro(KM_RATE)}/km · ida e volta · pago uma vez por carro</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Matrícula / grupo</TableHead><TableHead>Ocupantes</TableHead><TableHead className="text-right">Km</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {Array.from(grupos.entries()).map(([key, g]) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{g.grupoLabel}</TableCell>
                    <TableCell className="text-muted-foreground">{g.nomes.join(", ")}</TableCell>
                    <TableCell className="text-right">{g.km}</TableCell>
                    <TableCell className="text-right font-medium">{formatEuro(g.km * KM_RATE * TRIP_FACTOR)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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

type BulkRow = {
  nome: string;
  data_inicio: string; // ISO or ""
  data_fim: string;    // ISO or ""
  local: string;
  mapa_url: string;
  error?: string;
};

function parseBulkDate(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  // DD/MM/YYYY[ HH:MM] or DD-MM-YYYY[ HH:MM]
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (m) {
    const dd = Number(m[1]); const mm = Number(m[2]);
    let yy = Number(m[3]); if (yy < 100) yy += 2000;
    const hh = Number(m[4] ?? "0"); const mi = Number(m[5] ?? "0");
    const d = new Date(yy, mm - 1, dd, hh, mi);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  // ISO-ish YYYY-MM-DD[ HH:MM]
  const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (m2) {
    const d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]), Number(m2[4] ?? "0"), Number(m2[5] ?? "0"));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function parseBulkText(text: string): BulkRow[] {
  const lines = text.split(/\r?\n/).map((l) => l).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  // detect delimiter: tab > ; > ,
  const sample = lines[0];
  const delim = sample.includes("\t") ? "\t" : sample.includes(";") ? ";" : ",";
  // header row?
  const headerCells = lines[0].split(delim).map((c) => c.trim().toLowerCase());
  const headerLikely = headerCells.some((c) => ["nome", "data", "data_inicio", "início", "inicio", "local", "data_fim", "fim", "mapa", "mapa_url"].includes(c));
  let cols: { nome: number; ini: number; fim: number; local: number; mapa: number } = { nome: 0, ini: 1, fim: -1, local: 2, mapa: 3 };
  let start = 0;
  if (headerLikely) {
    const find = (...keys: string[]) => headerCells.findIndex((c) => keys.includes(c));
    cols = {
      nome: Math.max(0, find("nome", "ação", "acao", "evento", "título", "titulo")),
      ini: Math.max(0, find("data", "data_inicio", "início", "inicio", "data início", "data inicio")),
      fim: find("data_fim", "fim", "data fim"),
      local: find("local", "localização", "localizacao"),
      mapa: find("mapa", "mapa_url", "link", "link_mapa"),
    };
    start = 1;
  }
  const rows: BulkRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(delim).map((p) => p.trim());
    const nome = parts[cols.nome] ?? "";
    const iniRaw = parts[cols.ini] ?? "";
    const fimRaw = cols.fim >= 0 ? (parts[cols.fim] ?? "") : "";
    const local = (cols.local >= 0 ? (parts[cols.local] ?? "") : "");
    const mapa = (cols.mapa >= 0 ? (parts[cols.mapa] ?? "") : "");
    const ini = parseBulkDate(iniRaw);
    const fim = parseBulkDate(fimRaw);
    let error: string | undefined;
    if (!nome) error = "Nome em falta";
    else if (iniRaw && !ini) error = "Data de início inválida";
    else if (fimRaw && !fim) error = "Data de fim inválida";
    rows.push({
      nome,
      data_inicio: ini ?? "",
      data_fim: fim ?? "",
      local,
      mapa_url: mapa,
      error,
    });
  }
  return rows;
}

function BulkImportAcoesDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const rows = useMemo(() => parseBulkText(text), [text]);
  const validRows = rows.filter((r) => !r.error);

  const reset = () => { setText(""); setSubmitting(false); };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setSubmitting(true);
    let ok = 0; let fail = 0;
    for (const r of validRows) {
      const { error } = await supabase.from("acoes").insert({
        nome: r.nome,
        local: r.local || null,
        mapa_url: r.mapa_url || null,
        data_inicio: r.data_inicio || null,
        data_fim: r.data_fim || null,
        status: "rascunho",
        inscricoes_abertas: false,
        bolsa_transporte: false,
        projeto_ids: [],
        restrito_a_projetos: false,
        config_campos: { fields: [] },
      } as any);
      if (error) { fail++; continue; }
      if (r.local) await upsertLocalizacao(r.local, r.mapa_url || null);
      ok++;
    }
    setSubmitting(false);
    if (ok > 0) toast.success(`${ok} ${ok === 1 ? "ação criada" : "ações criadas"}`);
    if (fail > 0) toast.error(`${fail} ${fail === 1 ? "ação falhou" : "ações falharam"}`);
    onDone();
    setOpen(false);
    reset();
  };

  const example = `Nome\tData início\tData fim\tLocal\tLink do mapa\nReunião de Acolhimento\t15/01/2026 18:30\t15/01/2026 20:00\tCentro Comunitário Lisboa\thttps://maps.google.com/...\nVoluntariado Banco Alimentar\t22/02/2026 09:00\t22/02/2026 13:00\tArmazém Loures\t`;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="mr-2 h-4 w-4" /> Importar em massa</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar ações em massa</DialogTitle>
          <DialogDescription>
            Cola dados de uma folha de cálculo (Excel, Google Sheets) ou texto separado por tabulações, vírgulas ou ponto e vírgula.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium mb-1">Formato esperado (colunas, por esta ordem):</p>
            <p className="text-muted-foreground mb-2">
              <code className="text-xs">Nome</code> · <code className="text-xs">Data início</code> · <code className="text-xs">Data fim</code> (opcional) · <code className="text-xs">Local</code> (opcional) · <code className="text-xs">Link do mapa</code> (opcional)
            </p>
            <p className="text-muted-foreground text-xs mb-2">
              Datas aceites: <code>DD/MM/AAAA HH:MM</code>, <code>DD-MM-AAAA</code>, <code>AAAA-MM-DD HH:MM</code>. A primeira linha pode ser cabeçalho (será detectada automaticamente).
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setText(example)}>
              Inserir exemplo
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Cola aqui os dados</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={"Nome\tData início\tData fim\tLocal\nReunião\t15/01/2026 18:30\t15/01/2026 20:00\tLisboa"}
              className="font-mono text-xs"
            />
          </div>

          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Pré-visualização ({rows.length} {rows.length === 1 ? "linha" : "linhas"})</span>
                <span className="text-muted-foreground">
                  {validRows.length} válidas · {rows.length - validRows.length} com erro
                </span>
              </div>
              <div className="rounded-md border max-h-64 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Local</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i} className={r.error ? "bg-destructive/5" : ""}>
                        <TableCell>
                          {r.error
                            ? <AlertCircle className="h-4 w-4 text-destructive" aria-label={r.error} />
                            : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        </TableCell>
                        <TableCell className="font-medium">{r.nome || <span className="text-destructive text-xs">— em falta —</span>}</TableCell>
                        <TableCell className="text-xs">{r.data_inicio ? new Date(r.data_inicio).toLocaleString("pt-PT") : "—"}</TableCell>
                        <TableCell className="text-xs">{r.data_fim ? new Date(r.data_fim).toLocaleString("pt-PT") : "—"}</TableCell>
                        <TableCell className="text-xs">{r.local || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.some((r) => r.error) && (
                <p className="text-xs text-destructive">
                  As linhas com erro serão ignoradas. Corrige-as e cola novamente se quiseres incluí-las.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
          <Button onClick={handleImport} disabled={validRows.length === 0 || submitting}>
            {submitting ? "A importar…" : `Criar ${validRows.length} ${validRows.length === 1 ? "ação" : "ações"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AcoesPageInner() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<AcaoForm>(EMPTY_FORM);

  const [editing, setEditing] = useState<(AcaoForm & { id: string }) | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editFullscreen, setEditFullscreen] = useState(false);

  const pushToGoogle = useServerFn(syncAcaoToGoogle);
  const fireGoogleSync = (acaoId: string, op: "upsert" | "delete") => {
    pushToGoogle({ data: { acaoId, op } }).catch((e) => {
      console.error("[google-calendar] sync falhou", e);
    });
  };

  const { data, isLoading } = useQuery({
    queryKey: ["acoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes")
        .select("id, nome, local, mapa_url, imagem_url, data_inicio, data_fim, status, inscricoes_abertas, bolsa_transporte, projeto_ids, restrito_a_projetos, publico, config_campos, tipo_acao_id, formador_ids")
        .order("data_inicio", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: projetos } = useQuery({
    queryKey: ["projetos_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  const { data: tiposAcao } = useQuery({
    queryKey: ["tipos_acao_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_acao")
        .select("id, nome, requer_formadores, ordem")
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; requer_formadores: boolean; ordem: number }[];
    },
  });

  const { data: pessoasLookup } = useQuery({
    queryKey: ["pessoas_lookup_formadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo")
        .eq("status", "ativo")
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []) as { id: string; nome_completo: string }[];
    },
  });

  const { data: parceiros } = useQuery({
    queryKey: ["parceiros_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parceiros")
        .select("id, nome")
        .eq("estado", "Ativa")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const { data: acaoParceiros } = useQuery({
    queryKey: ["acao_parceiros"],
    queryFn: async () => {
      const { data, error } = await supabase.from("acao_parceiros").select("acao_id, parceiro_id");
      if (error) throw error;
      const m = new Map<string, string[]>();
      for (const r of (data ?? []) as { acao_id: string; parceiro_id: string }[]) {
        const arr = m.get(r.acao_id) ?? [];
        arr.push(r.parceiro_id);
        m.set(r.acao_id, arr);
      }
      return m;
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

  const togglePublico = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("acoes").update({ publico: value } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acoes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["acoes"] });
  const invalidateParceiros = () => qc.invalidateQueries({ queryKey: ["acao_parceiros"] });

  const { proximos, passados, semData } = useMemo(() => {
    const now = Date.now();
    const prox: typeof data = [];
    const pas: typeof data = [];
    const sem: typeof data = [];
    for (const a of data ?? []) {
      const fim = a.data_fim ? new Date(a.data_fim).getTime() : a.data_inicio ? new Date(a.data_inicio).getTime() : null;
      if (fim === null) {
        sem.push(a);
      } else if (fim >= now - 24 * 60 * 60 * 1000) {
        prox.push(a);
      } else {
        pas.push(a);
      }
    }
    prox.sort((a, b) => {
      const ta = a.data_inicio ? new Date(a.data_inicio).getTime() : new Date(a.data_fim!).getTime();
      const tb = b.data_inicio ? new Date(b.data_inicio).getTime() : new Date(b.data_fim!).getTime();
      return ta - tb;
    });
    pas.sort((a, b) => {
      const ta = a.data_fim ? new Date(a.data_fim).getTime() : new Date(a.data_inicio!).getTime();
      const tb = b.data_fim ? new Date(b.data_fim).getTime() : new Date(b.data_inicio!).getTime();
      return tb - ta;
    });
    return { proximos: prox, passados: pas, semData: sem };
  }, [data]);

  function renderAcaoCard(a: NonNullable<typeof data>[number]) {
    const fields = parseFields(a.config_campos);
    const counts = inscricaoCounts?.get(a.id) ?? { total: 0, presentes: 0 };
    const inscricoesAbertas = (a as any).inscricoes_abertas ?? true;
    return (
      <Card
        key={a.id}
        className="cursor-pointer transition-colors hover:bg-muted/30"
        onClick={async () => {
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
            projeto_ids: ((a as any).projeto_ids ?? []) as string[],
            restrito_a_projetos: !!(a as any).restrito_a_projetos,
            publico: (a as any).publico ?? true,
            fields,
            parceiro_ids: acaoParceiros?.get(a.id) ?? [],
            tipo_acao_id: (a as any).tipo_acao_id ?? null,
            formador_ids: ((a as any).formador_ids ?? []) as string[],
          });
        }}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle>{a.nome}</CardTitle>
              {a.data_inicio ? (
                <CardDescription>
                  {new Date(a.data_inicio).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}
                  {a.data_fim ? ` → ${new Date(a.data_fim).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}` : ""}
                </CardDescription>
              ) : (
                <CardDescription>Data a definir</CardDescription>
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
          <label
            className="flex items-center justify-between rounded-md border p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs font-medium">Evento público</span>
            <Switch
              checked={(a as any).publico ?? true}
              disabled={togglePublico.isPending}
              onCheckedChange={(c) => togglePublico.mutate({ id: a.id, value: c })}
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
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!validateAcaoForm(form)) throw new Error("Validação falhou");
      const { data: created, error } = await supabase.from("acoes").insert({
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
        projeto_ids: form.projeto_ids ?? [],
        restrito_a_projetos: form.restrito_a_projetos,
        publico: form.publico,
        config_campos: { fields: form.fields },
        tipo_acao_id: form.tipo_acao_id || null,
        formador_ids: form.formador_ids ?? [],
      } as any).select("id").single();
      if (error) throw error;
      await upsertLocalizacao(form.local, form.mapa_url || null);
      if (created?.id) {
        const pids = form.parceiro_ids ?? [];
        if (pids.length > 0) {
          const { error: pe } = await supabase
            .from("acao_parceiros")
            .insert(pids.map((parceiro_id) => ({ acao_id: created.id, parceiro_id })));
          if (pe) throw pe;
        }
      }
      if (created?.id) fireGoogleSync(created.id, "upsert");
    },
    onSuccess: () => {
      toast.success("Ação criada");
      invalidate();
      invalidateParceiros();
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
          projeto_ids: editing.projeto_ids ?? [],
          restrito_a_projetos: editing.restrito_a_projetos,
          publico: editing.publico,
          config_campos: { fields: editing.fields },
          tipo_acao_id: editing.tipo_acao_id || null,
          formador_ids: editing.formador_ids ?? [],
        } as any)
        .eq("id", editing.id);
      if (error) throw error;
      await upsertLocalizacao(editing.local, editing.mapa_url || null);
      await supabase.from("acao_parceiros").delete().eq("acao_id", editing.id);
      const pids = editing.parceiro_ids ?? [];
      if (pids.length > 0) {
        const { error: pe } = await supabase
          .from("acao_parceiros")
          .insert(pids.map((parceiro_id) => ({ acao_id: editing.id, parceiro_id })));
        if (pe) throw pe;
      }
      fireGoogleSync(editing.id, "upsert");
    },
    onSuccess: () => {
      toast.success("Ação atualizada");
      invalidate();
      invalidateParceiros();
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
      const idToRemove = deleteId;
      const { error } = await supabase.from("acoes").delete().eq("id", deleteId);
      if (error) throw error;
      fireGoogleSync(idToRemove, "delete");
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
       <GoogleCalendarSyncCard />
       <div className="flex items-center justify-between">
         <div>
           <h1 className="text-2xl font-semibold">Ações</h1>
           <p className="text-sm text-muted-foreground">Eventos da comunidade</p>
         </div>
         <div className="flex items-center gap-2">
         <BulkImportAcoesDialog onDone={invalidate} />
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
                  <p className="text-sm font-medium">Evento público</p>
                  <p className="text-xs text-muted-foreground">Quando desligado, o evento não aparece no portal público.</p>
                </div>
                <Switch checked={form.publico} onCheckedChange={(c) => setForm({ ...form, publico: c })} />
              </label>
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
              <TipoAcaoBlock
                tipoAcaoId={form.tipo_acao_id}
                formadorIds={form.formador_ids ?? []}
                onTipoChange={(id) => setForm({ ...form, tipo_acao_id: id, formador_ids: id ? (form.formador_ids ?? []) : [] })}
                onFormadoresChange={(ids) => setForm({ ...form, formador_ids: ids })}
                tipos={tiposAcao ?? []}
                pessoas={pessoasLookup ?? []}
              />
              <div className="space-y-2 rounded-md border p-3">
                <Label>Projetos associados</Label>
                <ProjetosMultiSelect
                  values={form.projeto_ids}
                  options={(projetos ?? []).map((p) => ({ value: p.id, label: p.nome }))}
                  onChange={(v) => setForm({ ...form, projeto_ids: v })}
                />
                <label className="flex items-center justify-between gap-3 pt-1">
                  <div>
                    <p className="text-sm font-medium">Restringir a participantes destes projetos</p>
                    <p className="text-xs text-muted-foreground">Quando ligado, apenas participantes inscritos em pelo menos um dos projetos podem inscrever-se. Sem projetos selecionados, qualquer pessoa pode inscrever-se.</p>
                  </div>
                  <Switch
                    checked={form.restrito_a_projetos}
                    disabled={form.projeto_ids.length === 0}
                    onCheckedChange={(c) => setForm({ ...form, restrito_a_projetos: c })}
                  />
                </label>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <Label>Parceiros co-responsáveis</Label>
                <ProjetosMultiSelect
                  values={form.parceiro_ids ?? []}
                  options={(parceiros ?? []).map((p) => ({ value: p.id, label: p.nome }))}
                  onChange={(v) => setForm({ ...form, parceiro_ids: v })}
                />
              </div>
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
      </div>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="tabela">Tabela</TabsTrigger>
          <TabsTrigger value="planeamento">Planeamento</TabsTrigger>
        </TabsList>
        <TabsContent value="lista" className="mt-6 space-y-8">
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-xl font-semibold">Próximas ações</h2>
            {proximos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem próximas ações.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {proximos.map((a) => renderAcaoCard(a))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Data a definir</h2>
            {semData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem ações sem data.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {semData.map((a) => renderAcaoCard(a))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Ações passadas</h2>
            {passados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem ações passadas.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {passados.map((a) => renderAcaoCard(a))}
              </div>
            )}
          </section>
        </>
      )}
        </TabsContent>
        <TabsContent value="tabela" className="mt-6">
          <AcoesBulkTable
            acoes={(data ?? []) as any[]}
            isLoading={isLoading}
            onChanged={invalidate}
            fireGoogleSync={fireGoogleSync}
          />
        </TabsContent>
        <TabsContent value="planeamento" className="mt-6">
          <AcoesPlaneamento
            acoes={(data ?? []) as any}
            projetos={projetos ?? []}
            onEdit={async (id) => {
              const a = (data ?? []).find((x: any) => x.id === id) as any;
              if (!a) return;
              const fields = parseFields(a.config_campos);
              const inscricoesAbertas = a.inscricoes_abertas ?? true;
              const { data: full } = await supabase
                .from("acoes")
                .select("descricao")
                .eq("id", a.id)
                .maybeSingle();
              setEditing({
                id: a.id,
                nome: a.nome ?? "",
                local: a.local ?? "",
                mapa_url: a.mapa_url ?? "",
                imagem_url: a.imagem_url ?? "",
                descricao: full?.descricao ?? "",
                data_inicio: toDtLocal(a.data_inicio),
                data_fim: toDtLocal(a.data_fim),
                status: String(a.status ?? "ativa"),
                inscricoes_abertas: inscricoesAbertas,
                bolsa_transporte: !!a.bolsa_transporte,
                projeto_ids: (a.projeto_ids ?? []) as string[],
                restrito_a_projetos: !!a.restrito_a_projetos,
                publico: a.publico ?? true,
                fields,
                parceiro_ids: acaoParceiros?.get(a.id) ?? [],
                tipo_acao_id: a.tipo_acao_id ?? null,
                formador_ids: (a.formador_ids ?? []) as string[],
              });
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setEditFullscreen(false); } }}>
        <DialogContent
          className={
            editFullscreen
              ? "max-w-none w-screen h-screen sm:rounded-none p-6 overflow-y-auto overflow-x-hidden"
              : "max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden"
          }
        >
          {editing && (
            <Tabs defaultValue="detalhes" className="min-w-0">
              <DialogHeader className="sticky top-0 z-10 -mx-6 -mt-6 border-b bg-background px-6 pt-4 pb-2">
                <div className="flex items-center justify-between gap-2 pr-8">
                  <DialogTitle className="truncate">{editing?.nome || "Editar ação"}</DialogTitle>
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
                <TabsList className="mt-3 self-start">
                  <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                  <TabsTrigger value="inscricoes">Inscrições</TabsTrigger>
                  {editing.bolsa_transporte && <TabsTrigger value="bolsa">Bolsa</TabsTrigger>}
                </TabsList>
              </DialogHeader>
              <TabsContent value="detalhes" className="mt-6 space-y-4 min-w-0">
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
                  <p className="text-sm font-medium">Evento público</p>
                  <p className="text-xs text-muted-foreground">Quando desligado, o evento não aparece no portal público.</p>
                </div>
                <Switch checked={editing.publico} onCheckedChange={(c) => setEditing({ ...editing, publico: c })} />
              </label>
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
              <TipoAcaoBlock
                tipoAcaoId={editing.tipo_acao_id}
                formadorIds={editing.formador_ids ?? []}
                onTipoChange={(id) => setEditing({ ...editing, tipo_acao_id: id, formador_ids: id ? (editing.formador_ids ?? []) : [] })}
                onFormadoresChange={(ids) => setEditing({ ...editing, formador_ids: ids })}
                tipos={tiposAcao ?? []}
                pessoas={pessoasLookup ?? []}
              />
              <div className="space-y-2 rounded-md border p-3">
                <Label>Projetos associados</Label>
                <ProjetosMultiSelect
                  values={editing.projeto_ids}
                  options={(projetos ?? []).map((p) => ({ value: p.id, label: p.nome }))}
                  onChange={(v) => setEditing({ ...editing, projeto_ids: v })}
                />
                <label className="flex items-center justify-between gap-3 pt-1">
                  <div>
                    <p className="text-sm font-medium">Restringir a participantes destes projetos</p>
                    <p className="text-xs text-muted-foreground">Quando ligado, apenas participantes inscritos em pelo menos um dos projetos podem inscrever-se. Sem projetos selecionados, qualquer pessoa pode inscrever-se.</p>
                  </div>
                  <Switch
                    checked={editing.restrito_a_projetos}
                    disabled={editing.projeto_ids.length === 0}
                    onCheckedChange={(c) => setEditing({ ...editing, restrito_a_projetos: c })}
                  />
                </label>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <Label>Parceiros co-responsáveis</Label>
                <ProjetosMultiSelect
                  values={editing.parceiro_ids ?? []}
                  options={(parceiros ?? []).map((p) => ({ value: p.id, label: p.nome }))}
                  onChange={(v) => setEditing({ ...editing, parceiro_ids: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <RichTextEditor value={editing.descricao} onChange={(v) => setEditing({ ...editing, descricao: v })} />
              </div>
              <FieldsEditor fields={editing.fields} setFields={(fields) => setEditing({ ...editing, fields })} />
              </TabsContent>
              <TabsContent value="inscricoes" className="mt-6 min-w-0">
                <InscricoesTab acaoId={editing.id} fields={editing.fields} />
              </TabsContent>
              {editing.bolsa_transporte && (
                <TabsContent value="bolsa" className="mt-6 min-w-0">
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

function TipoAcaoBlock({
  tipoAcaoId,
  formadorIds,
  onTipoChange,
  onFormadoresChange,
  tipos,
  pessoas,
}: {
  tipoAcaoId: string | null | undefined;
  formadorIds: string[];
  onTipoChange: (id: string | null) => void;
  onFormadoresChange: (ids: string[]) => void;
  tipos: { id: string; nome: string; requer_formadores: boolean }[];
  pessoas: { id: string; nome_completo: string }[];
}) {
  const selected = tipos.find((t) => t.id === tipoAcaoId);
  const requerFormadores = !!selected?.requer_formadores;
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoRequer, setNovoRequer] = useState(false);
  const criar = useMutation({
    mutationFn: async () => {
      const nome = novoNome.trim();
      if (!nome) throw new Error("Nome obrigatório");
      const { data, error } = await supabase
        .from("tipos_acao")
        .insert({ nome, requer_formadores: novoRequer } as any)
        .select("id")
        .single();
      if (error) throw error;
      return data?.id as string;
    },
    onSuccess: (id) => {
      toast.success("Tipo criado");
      qc.invalidateQueries({ queryKey: ["tipos_acao_lookup"] });
      setNovoOpen(false);
      setNovoNome("");
      setNovoRequer(false);
      if (id) onTipoChange(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label>Tipo de ação</Label>
        <Button type="button" size="sm" variant="ghost" onClick={() => setNovoOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Novo tipo
        </Button>
      </div>
      <Select
        value={tipoAcaoId ?? "__none"}
        onValueChange={(v) => onTipoChange(v === "__none" ? null : v)}
      >
        <SelectTrigger className="h-9"><SelectValue placeholder="Sem tipo" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">Sem tipo</SelectItem>
          {tipos.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {requerFormadores && (
        <div className="space-y-1 pt-1">
          <Label className="text-xs text-muted-foreground">Formadores</Label>
          <ProjetosMultiSelect
            values={formadorIds}
            options={pessoas.map((p) => ({ value: p.id, label: p.nome_completo }))}
            onChange={onFormadoresChange}
            placeholder="Sem formadores"
          />
          <p className="text-xs text-muted-foreground">Escolhe os formadores da base de dados de participantes.</p>
        </div>
      )}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo tipo de ação</DialogTitle>
            <DialogDescription>Cria um novo tipo para categorizar as ações.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: Formação" />
            </div>
            <label className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Requer formadores</p>
                <p className="text-xs text-muted-foreground">Se ligado, ao escolher este tipo poderás selecionar formadores.</p>
              </div>
              <Switch checked={novoRequer} onCheckedChange={setNovoRequer} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={() => criar.mutate()} disabled={!novoNome.trim() || criar.isPending}>
              {criar.isPending ? "A guardar…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjetosMultiSelect({
  values,
  options,
  onChange,
  placeholder = "Sem projetos",
}: {
  values: string[];
  options: { value: string; label: string }[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const labels = values.map((v) => options.find((o) => o.value === v)?.label).filter(Boolean) as string[];
  const toggle = (v: string) => {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-left text-sm shadow-sm hover:bg-muted/50"
        >
          <span className={labels.length ? "" : "text-muted-foreground"}>
            {labels.length ? labels.join(", ") : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-1">
        <div className="max-h-64 overflow-auto">
          {options.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Sem projetos disponíveis</div>
          )}
          {options.map((o) => {
            const checked = values.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <Checkbox checked={checked} />
                <span>{o.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function GoogleCalendarSyncCard() {
  const resync = useServerFn(resyncAllToGoogle);

  const resyncMutation = useMutation({
    mutationFn: () => resync(),
    onSuccess: (r: any) => {
      toast.success(
        `Reenviado para o Google: ${r?.ok ?? 0}/${r?.total ?? 0}${r?.failed ? ` · ${r.failed} falharam` : ""}`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarIcon className="h-4 w-4" /> Google Calendar
          </CardTitle>
          <CardDescription>
            As ações criadas, editadas ou apagadas aqui são automaticamente sincronizadas para o Google Calendar. Alterações feitas no Google Calendar não são importadas.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={resyncMutation.isPending}
            onClick={() => resyncMutation.mutate()}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${resyncMutation.isPending ? "animate-spin" : ""}`} />
            Re-sincronizar tudo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Ativa</Badge>
          <span>Sincronização unidirecional: app → Google Calendar.</span>
        </div>
      </CardContent>
    </Card>
  );
}

function AcoesBulkTable({
  acoes,
  isLoading,
  onChanged,
  fireGoogleSync,
}: {
  acoes: any[];
  isLoading: boolean;
  onChanged: () => void;
  fireGoogleSync: (id: string, op: "upsert" | "delete") => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<string>("__keep__");
  const [editPublico, setEditPublico] = useState<string>("__keep__");
  const [editInscricoes, setEditInscricoes] = useState<string>("__keep__");
  const [submitting, setSubmitting] = useState(false);

  const allIds = useMemo(() => acoes.map((a) => a.id as string), [acoes]);
  const allSelected = allIds.length > 0 && selected.size === allIds.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(allIds) : new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const resetBulkEdit = () => {
    setEditStatus("__keep__");
    setEditPublico("__keep__");
    setEditInscricoes("__keep__");
  };

  const applyBulkEdit = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const patch: Record<string, any> = {};
    if (editStatus !== "__keep__") patch.status = editStatus;
    if (editPublico !== "__keep__") patch.publico = editPublico === "true";
    if (editInscricoes !== "__keep__") patch.inscricoes_abertas = editInscricoes === "true";
    if (Object.keys(patch).length === 0) {
      toast.info("Sem alterações para aplicar");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("acoes").update(patch as any).in("id", ids);
      if (error) throw error;
      ids.forEach((id) => fireGoogleSync(id, "upsert"));
      toast.success(`${ids.length} ${ids.length === 1 ? "ação atualizada" : "ações atualizadas"}`);
      setBulkEditOpen(false);
      resetBulkEdit();
      setSelected(new Set());
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Falhou ao atualizar");
    } finally {
      setSubmitting(false);
    }
  };

  const applyBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("acoes").delete().in("id", ids);
      if (error) throw error;
      ids.forEach((id) => fireGoogleSync(id, "delete"));
      toast.success(`${ids.length} ${ids.length === 1 ? "ação apagada" : "ações apagadas"}`);
      setBulkDeleteOpen(false);
      setSelected(new Set());
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Falhou ao apagar");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {selected.size > 0
            ? `${selected.size} ${selected.size === 1 ? "selecionada" : "selecionadas"}`
            : `${acoes.length} ${acoes.length === 1 ? "ação" : "ações"}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0}
            onClick={() => setBulkEditOpen(true)}
          >
            <Pencil className="mr-2 h-4 w-4" /> Editar selecionadas
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={selected.size === 0}
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Apagar selecionadas
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(c) => toggleAll(!!c)}
                  aria-label="Selecionar tudo"
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="w-[220px]">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {acoes.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                  Sem ações.
                </TableCell>
              </TableRow>
            )}
            {acoes.map((a) => {
              const isSel = selected.has(a.id);
              return (
                <TableRow
                  key={a.id}
                  data-state={isSel ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={() => toggleOne(a.id, !isSel)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSel}
                      onCheckedChange={(c) => toggleOne(a.id, !!c)}
                      aria-label={`Selecionar ${a.nome}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{a.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.data_inicio
                      ? new Date(a.data_inicio).toLocaleString("pt-PT", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Bulk edit dialog */}
      <Dialog
        open={bulkEditOpen}
        onOpenChange={(o) => {
          setBulkEditOpen(o);
          if (!o) resetBulkEdit();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {selected.size} {selected.size === 1 ? "ação" : "ações"}</DialogTitle>
            <DialogDescription>
              Deixa um campo em "manter" para não alterar esse valor nas ações selecionadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">— manter —</SelectItem>
                  {DEFAULT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Evento público</Label>
              <Select value={editPublico} onValueChange={setEditPublico}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">— manter —</SelectItem>
                  <SelectItem value="true">Público</SelectItem>
                  <SelectItem value="false">Privado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Inscrições abertas</Label>
              <Select value={editInscricoes} onValueChange={setEditInscricoes}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">— manter —</SelectItem>
                  <SelectItem value="true">Abertas</SelectItem>
                  <SelectItem value="false">Fechadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditOpen(false)}>Cancelar</Button>
            <Button onClick={applyBulkEdit} disabled={submitting}>
              {submitting ? "A guardar…" : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirm */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar {selected.size} {selected.size === 1 ? "ação" : "ações"}?</DialogTitle>
            <DialogDescription>
              Esta operação é permanente. As inscrições associadas podem deixar de funcionar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={applyBulkDelete} disabled={submitting}>
              {submitting ? "A apagar…" : "Apagar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
