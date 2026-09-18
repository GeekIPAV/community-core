import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, Mail, Phone, MapPin, Cake, Briefcase, Globe, HeartHandshake, Users, IdCard, ShieldCheck, Heart, CreditCard, Car } from "lucide-react";
import { EtiquetasPicker } from "@/components/etiquetas-picker";
import { AcoesHoverSummary } from "@/components/acoes-hover-summary";
import { CurriculoSection } from "@/components/curriculo-section";
import { PessoaMapaKmSection } from "@/components/pessoa-mapa-km-section";
import { PessoaAtividadesSection } from "@/components/pessoa-atividades-section";
import { SignaturePad } from "@/components/signature-pad";
import { InviteMemberButton } from "@/components/invite-member";
import type { VisibilityState } from "@tanstack/react-table";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";
import { personIcon, flagFor } from "@/lib/person-display";
import { applyOptimisticRowPatch, rollbackOptimisticRows } from "@/lib/optimistic-row-update";
import { handleSupabaseError } from "@/lib/handle-supabase-error";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/_admin/participantes")({
  component: ParticipantesPage,
  validateSearch: (s: Record<string, unknown>) => ({
    pessoa: typeof s.pessoa === "string" ? s.pessoa : undefined,
  }),
});

type Pessoa = {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  nif: string | null;
  cartao_cidadao: string | null;
  morada: string | null;
  data_nascimento: string | null;
  familia_id: string | null;
  status: string;
  notas: string | null;
  tipo_user_id: string | null;
  genero: string | null;
  nacionalidade: string | null;
  cidade_residencia: string | null;
  religiao: string | null;
  profissao: string | null;
  iban: string | null;
  matricula: string | null;
  assinatura: string | null;
  projeto_ids: string[];
  updated_at: string | null;
  parceiro_id: string | null;
};

const STATUS_OPTS = ["ativo", "suspeito_duplicado", "fundido", "arquivado"];
const GENERO_OPTS = ["Masculino", "Feminino"];

const BULK_COLUMNS = [
  "nome",
  "email",
  "telefone",
  "nif",
  "cartao_cidadao",
  "morada",
  "data_nascimento",
  "genero",
  "nacionalidade",
  "cidade_residencia",
  "religiao",
  "profissao",
  "familia",
  "projeto",
] as const;

const DEFAULT_HIDDEN_COLUMNS: VisibilityState = {
  // Escondidas por omissão para evitar scroll horizontal — reativáveis em "Colunas".
  cartao_cidadao: false,
  morada: false,
  data_nascimento: false,
  genero: false,
  nacionalidade: false,
  cidade_residencia: false,
  religiao: false,
  profissao: false,
  projeto_ids: false,
  nif: false,
};

const GROUP_BY_OPTIONS = [
  { value: "familia_id", label: "Família" },
  { value: "nacionalidade", label: "Nacionalidade" },
  { value: "religiao", label: "Religião" },
  { value: "genero", label: "Género" },
  { value: "projeto_ids", label: "Projetos" },
  { value: "cidade_residencia", label: "Cidade" },
  { value: "status", label: "Estado" },
  { value: "tipos_participante", label: "Tipo" },
];

const EDITABLE_COLUMNS = [
  "nome_completo", "email", "telefone", "nif", "cartao_cidadao", "morada",
  "data_nascimento", "genero", "nacionalidade", "cidade_residencia",
  "religiao", "profissao", "familia_id", "status",
];

const emptyForm: Omit<Pessoa, "id" | "status"> & { status?: string } = {
  nome_completo: "",
  email: "",
  telefone: "",
  nif: "",
  cartao_cidadao: "",
  morada: "",
  data_nascimento: "",
  familia_id: null,
  notas: "",
  tipo_user_id: null,
  genero: null,
  nacionalidade: "",
  cidade_residencia: "",
  religiao: "",
  profissao: "",
  iban: "",
  matricula: "",
  assinatura: null,
  projeto_ids: [],
  updated_at: null,
  parceiro_id: null,
};

function ParticipantesPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [novoTipoIds, setNovoTipoIds] = useState<string[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Pessoa | null>(null);

  const [bulkText, setBulkText] = useState("");

  const [novaFamiliaOpen, setNovaFamiliaOpen] = useState(false);
  const [novaFamiliaNome, setNovaFamiliaNome] = useState("");
  const [novaFamiliaTarget, setNovaFamiliaTarget] = useState<"form" | "editing">("form");

  const [novoParceiroOpen, setNovoParceiroOpen] = useState(false);
  const [novoParceiroNome, setNovoParceiroNome] = useState("");
  const [novoParceiroTarget, setNovoParceiroTarget] = useState<"form" | "editing">("form");

  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkFamilia, setBulkFamilia] = useState<string>("__noop");
  const [bulkStatus, setBulkStatus] = useState<string>("__noop");
  const [bulkTipo, setBulkTipo] = useState<string>("__noop");
  const [bulkGenero, setBulkGenero] = useState<string>("__noop");
  const [bulkNacionalidade, setBulkNacionalidade] = useState<string>("");
  const [bulkCidade, setBulkCidade] = useState<string>("");
  const [bulkReligiao, setBulkReligiao] = useState<string>("");
  const [bulkProjetosMode, setBulkProjetosMode] = useState<"noop" | "set" | "clear">("noop");
  const [bulkProjetos, setBulkProjetos] = useState<string[]>([]);

  const [deleteOne, setDeleteOne] = useState<Pessoa | null>(null);
  const { pessoa: pessoaParam } = Route.useSearch();
  const bulkClearRef = useRef<() => void>(() => {});

  const { data, isLoading, error } = useQuery({
    queryKey: ["pessoas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, telefone, nif, cartao_cidadao, morada, data_nascimento, familia_id, status, notas, tipo_user_id, genero, nacionalidade, cidade_residencia, religiao, profissao, iban, matricula, assinatura, projeto_ids, updated_at, parceiro_id")
        .is("deleted_at", null)
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({ ...p, projeto_ids: p.projeto_ids ?? [] })) as Pessoa[];
    },
  });

  const { data: familias } = useQuery({
    queryKey: ["familias_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("familias").select("id, nome, status").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; status: string | null }[];
    },
  });

  const { data: tipos } = useQuery({
    queryKey: ["tipos_user_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tipos_user").select("id, nome").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  const { data: parceirosLookup } = useQuery({
    queryKey: ["parceiros_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parceiros").select("id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const parceiroTipoId = useMemo(
    () => tipos?.find((t) => t.nome.toLowerCase() === "parceiro")?.id ?? null,
    [tipos],
  );

  const parceiroName = (id: string | null) =>
    id ? parceirosLookup?.find((p) => p.id === id)?.nome ?? "—" : "—";

  const hasParceiroTipoFor = (pessoaId: string | null, tipoUserId: string | null) => {
    if (!parceiroTipoId) return false;
    if (tipoUserId === parceiroTipoId) return true;
    if (!pessoaId) return false;
    return (pessoaTiposMap.get(pessoaId) ?? []).includes(parceiroTipoId);
  };

  const { data: pessoaTiposRows } = useQuery({
    queryKey: ["pessoa_tipos_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoa_tipos")
        .select("pessoa_id, tipo_user_id");
      if (error) throw error;
      return (data ?? []) as { pessoa_id: string; tipo_user_id: string }[];
    },
  });

  const pessoaTiposMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of pessoaTiposRows ?? []) {
      const arr = m.get(r.pessoa_id) ?? [];
      arr.push(r.tipo_user_id);
      m.set(r.pessoa_id, arr);
    }
    return m;
  }, [pessoaTiposRows]);

  const tiposDePessoa = (pessoaId: string): string[] => pessoaTiposMap.get(pessoaId) ?? [];

  const savePessoaTipos = useMutation({
    mutationFn: async ({ pessoaId, tipoIds }: { pessoaId: string; tipoIds: string[] }) => {
      const current = new Set(tiposDePessoa(pessoaId));
      const next = new Set(tipoIds);
      const toAdd = [...next].filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !next.has(id));
      if (toAdd.length) {
        const { error } = await supabase
          .from("pessoa_tipos")
          .insert(toAdd.map((tipo_user_id) => ({ pessoa_id: pessoaId, tipo_user_id })));
        if (error) throw error;
      }
      if (toRemove.length) {
        const { error } = await supabase
          .from("pessoa_tipos")
          .delete()
          .eq("pessoa_id", pessoaId)
          .in("tipo_user_id", toRemove);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pessoa_tipos_all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: projetos } = useQuery({
    queryKey: ["projetos_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  const tipoName = (id: string | null) =>
    id ? tipos?.find((t) => t.id === id)?.nome ?? "—" : "—";

  const familiaName = (id: string | null) =>
    id ? familias?.find((f) => f.id === id)?.nome ?? "—" : "—";

  const saveField = async (id: string, field: keyof Pessoa, v: any) => {
    const prev = await applyOptimisticRowPatch<Pessoa>(qc, ["pessoas"], id, { [field]: v } as Partial<Pessoa>);
    const { error } = await supabase.from("pessoas").update({ [field]: v } as any).eq("id", id);
    if (error) {
      rollbackOptimisticRows(qc, ["pessoas"], prev);
      handleSupabaseError(error);
      throw error;
    }
  };

  const columns = useMemo<SmartColumnDef<Pessoa>[]>(() => {
    const muted = (v: any) => <span className="text-muted-foreground">{(v as string) || "—"}</span>;
    return [
      {
        id: "nome_completo", header: "Nome", accessorKey: "nome_completo", size: 220,
        cell: ({ getValue, row }) => {
          const p = row.original;
          const Icon = personIcon(p.genero, p.data_nascimento);
          return (
            <span className="font-medium inline-flex items-center gap-2">
              <Icon aria-hidden className="h-5 w-5 shrink-0 text-primary" strokeWidth={2.25} />
              <span>{(getValue() as string) ?? "—"}</span>
            </span>
          );
        },
        meta: { filterVariant: "text", label: "Nome", editType: "text", textValue: (p: Pessoa) => [p.nome_completo, p.notas ?? ""].filter(Boolean).join(" — ") },
      },
      { id: "email", header: "Email", accessorKey: "email", size: 200, cell: ({ getValue }) => muted(getValue()), meta: { filterVariant: "text", label: "Email", editType: "text" } },
      { id: "telefone", header: "Telefone", accessorKey: "telefone", size: 140, cell: ({ getValue }) => muted(getValue()), meta: { filterVariant: "text", label: "Telefone", editType: "text" } },
      { id: "nif", header: "NIF", accessorKey: "nif", size: 120, cell: ({ getValue }) => muted(getValue()), meta: { filterVariant: "text", label: "NIF", editType: "text" } },
      { id: "cartao_cidadao", header: "Cartão de Cidadão", accessorKey: "cartao_cidadao", size: 160, cell: ({ getValue }) => muted(getValue()), meta: { filterVariant: "text", label: "Cartão de Cidadão", editType: "text" } },
      { id: "morada", header: "Morada", accessorKey: "morada", size: 200, cell: ({ getValue }) => muted(getValue()), meta: { filterVariant: "text", label: "Morada", editType: "text" } },
      { id: "data_nascimento", header: "Data nascimento", accessorKey: "data_nascimento", size: 150, cell: ({ getValue }) => muted(getValue()), meta: { filterVariant: "date", label: "Data nascimento", editType: "date" } },
      {
        id: "idade", header: "Idade", size: 100, accessorFn: (p) => calcIdade(p.data_nascimento),
        cell: ({ getValue }) => {
          const idade = getValue() as number | null;
          return idade !== null ? <span className="text-muted-foreground">{idade} anos</span> : <span className="text-muted-foreground">—</span>;
        },
        meta: { filterVariant: "number", label: "Idade" },
      },
      {
        id: "genero", header: "Género", accessorKey: "genero", size: 130,
        cell: ({ getValue }) => muted(getValue()),
        meta: {
          filterVariant: "select", filterOptions: GENERO_OPTS, label: "Género",
          editType: "select", editSelectOptions: GENERO_OPTS.map((g) => ({ value: g, label: g })),
        },
      },
      {
        id: "nacionalidade", header: "Nacionalidade", accessorKey: "nacionalidade", size: 160,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          if (!v) return <span className="text-muted-foreground">—</span>;
          return <span className="inline-flex items-center gap-1.5"><span aria-hidden>{flagFor(v)}</span><span>{v}</span></span>;
        },
        meta: { filterVariant: "text", label: "Nacionalidade", editType: "text" },
      },
      { id: "cidade_residencia", header: "Cidade", accessorKey: "cidade_residencia", size: 150, cell: ({ getValue }) => muted(getValue()), meta: { filterVariant: "text", label: "Cidade", editType: "text" } },
      { id: "religiao", header: "Religião", accessorKey: "religiao", size: 140, cell: ({ getValue }) => muted(getValue()), meta: { filterVariant: "text", label: "Religião", editType: "text" } },
      { id: "profissao", header: "Profissão", accessorKey: "profissao", size: 150, cell: ({ getValue }) => muted(getValue()), meta: { filterVariant: "text", label: "Profissão", editType: "text" } },
      {
        id: "familia_id", header: "Família", size: 180,
        accessorFn: (p) => (p.familia_id ? (familias?.find((f) => f.id === p.familia_id)?.nome ?? "") : ""),
        cell: ({ getValue }) => muted(getValue()),
        meta: {
          filterVariant: "select", filterOptions: (familias ?? []).map((f) => f.nome), label: "Família",
          editType: "select", editSelectOptions: (familias ?? []).map((f) => ({ value: f.id, label: f.nome })),
        },
      },
      {
        id: "status_familia", header: "Status Família", size: 150,
        accessorFn: (p) => (p.familia_id ? (familias?.find((f) => f.id === p.familia_id)?.status ?? "") : ""),
        cell: ({ getValue }) => {
          const v = (getValue() as string) || "";
          return v ? <Badge variant="outline">{v}</Badge> : <span className="text-muted-foreground">—</span>;
        },
        meta: {
          filterVariant: "select",
          filterOptions: Array.from(new Set((familias ?? []).map((f) => f.status ?? "").filter(Boolean))) as string[],
          label: "Status Família",
        },
      },
      {
        id: "projeto_ids", header: "Projetos", size: 200,
        accessorFn: (p) => (p.projeto_ids ?? []).map((id) => projetos?.find((x) => x.id === id)?.nome).filter(Boolean).join(", "),
        cell: ({ getValue }) => muted(getValue()),
        meta: { filterVariant: "select", filterOptions: (projetos ?? []).map((x) => x.nome), label: "Projetos" },
      },
      {
        id: "tipos_participante", header: "Tipo", size: 180,
        accessorFn: (p) => {
          const ids = Array.from(new Set([...(p.tipo_user_id ? [p.tipo_user_id] : []), ...(pessoaTiposMap.get(p.id) ?? [])]));
          return ids.map((id) => tipos?.find((t) => t.id === id)?.nome ?? "").filter(Boolean).join(", ");
        },
        cell: ({ row }) => {
          const p = row.original;
          const ids = Array.from(new Set([...(p.tipo_user_id ? [p.tipo_user_id] : []), ...(pessoaTiposMap.get(p.id) ?? [])]));
          if (ids.length === 0) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {ids.map((id) => (
                <Badge key={id} variant="secondary" className="font-normal">{tipos?.find((t) => t.id === id)?.nome ?? id}</Badge>
              ))}
            </div>
          );
        },
        meta: { filterVariant: "select", filterOptions: (tipos ?? []).map((t) => t.nome), label: "Tipo de utilizador" },
      },
      {
        id: "status", header: "Estado", accessorKey: "status", size: 140,
        cell: ({ getValue }) => {
          const s = getValue() as string;
          return <Badge variant={s === "ativo" ? "default" : s === "suspeito_duplicado" ? "destructive" : "outline"}>{s}</Badge>;
        },
        meta: {
          filterVariant: "select", filterOptions: STATUS_OPTS, label: "Estado",
          editType: "select", editSelectOptions: STATUS_OPTS.map((s) => ({ value: s, label: s })),
        },
      },
      {
        id: "updated_at", header: "Última edição", accessorKey: "updated_at", size: 160,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return <span className="text-muted-foreground">{v ? new Date(v).toLocaleString("pt-PT") : "—"}</span>;
        },
        meta: { filterVariant: "date", label: "Última edição" },
      },
      {
        id: "acoes_count", header: "Ações", size: 120, enableSorting: false, accessorFn: () => "",
        cell: ({ row }) => <AcoesHoverSummary pessoaId={row.original.id} label="ver ações" />,
        meta: { label: "Ações", noTruncate: true },
      },
      {
        id: "__apagar", header: "", size: 60, enableSorting: false, enableHiding: false,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Button size="icon" variant="ghost" onClick={() => setDeleteOne(row.original)} title="Apagar">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
        meta: { label: "Apagar", noTruncate: true },
      },
    ];
  }, [familias, tipos, projetos, pessoaTiposMap]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pessoas"] });

  const create = useMutation({
    mutationFn: async () => {
      const tipoIds = novoTipoIds;
      const primaryTipo = tipoIds[0] ?? null;
      const payload = {
        nome_completo: form.nome_completo.trim(),
        email: form.email?.trim() || null,
        telefone: form.telefone?.trim() || null,
        nif: form.nif?.trim() || null,
        cartao_cidadao: form.cartao_cidadao?.trim() || null,
        morada: form.morada?.trim() || null,
        data_nascimento: form.data_nascimento || null,
        familia_id: form.familia_id || null,
        notas: form.notas?.trim() || null,
        tipo_user_id: primaryTipo,
        genero: form.genero || null,
        nacionalidade: form.nacionalidade?.trim() || null,
        cidade_residencia: form.cidade_residencia?.trim() || null,
        religiao: form.religiao?.trim() || null,
        profissao: form.profissao?.trim() || null,
        projeto_ids: form.projeto_ids ?? [],
        parceiro_id:
          (parceiroTipoId ? tipoIds.includes(parceiroTipoId) : false)
            ? form.parceiro_id || null
            : null,
      };
      const { data: inserted, error } = await supabase.from("pessoas").insert(payload).select("id").single();
      if (error) throw error;
      if (tipoIds.length && inserted?.id) {
        const { error: eT } = await supabase
          .from("pessoa_tipos")
          .insert(tipoIds.map((tipo_user_id) => ({ pessoa_id: inserted.id, tipo_user_id })));
        if (eT) throw eT;
      }
    },
    onSuccess: () => {
      toast.success("Pessoa criada");
      invalidate();
      qc.invalidateQueries({ queryKey: ["pessoa_tipos_all"] });
      setAddOpen(false);
      setForm({ ...emptyForm });
      setNovoTipoIds([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("pessoas")
        .update({
          nome_completo: editing.nome_completo,
          email: editing.email || null,
          telefone: editing.telefone || null,
          nif: editing.nif || null,
          cartao_cidadao: editing.cartao_cidadao || null,
          morada: editing.morada || null,
          data_nascimento: editing.data_nascimento || null,
          familia_id: editing.familia_id || null,
          status: editing.status as any,
          notas: editing.notas || null,
          tipo_user_id: editing.tipo_user_id || null,
          genero: editing.genero || null,
          nacionalidade: editing.nacionalidade || null,
          cidade_residencia: editing.cidade_residencia || null,
          religiao: editing.religiao || null,
          profissao: editing.profissao || null,
          iban: editing.iban || null,
          matricula: editing.matricula || null,
          assinatura: editing.assinatura || null,
          projeto_ids: editing.projeto_ids ?? [],
          parceiro_id:
            hasParceiroTipoFor(editing.id, editing.tipo_user_id ?? null)
              ? editing.parceiro_id || null
              : null,
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pessoa atualizada");
      invalidate();
      setEditOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criarFamilia = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase.from("familias").insert({ nome: nome.trim(), status: "Sem estado" }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Família criada");
      qc.invalidateQueries({ queryKey: ["familias_lookup"] });
      if (novaFamiliaTarget === "form") setForm({ ...form, familia_id: id });
      else if (novaFamiliaTarget === "editing" && editing) setEditing({ ...editing, familia_id: id });
      setNovaFamiliaOpen(false);
      setNovaFamiliaNome("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criarParceiro = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase.from("parceiros").insert({ nome: nome.trim() }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Entidade criada");
      qc.invalidateQueries({ queryKey: ["parceiros_lookup"] });
      if (novoParceiroTarget === "form") setForm((prev) => ({ ...prev, parceiro_id: id }));
      else if (novoParceiroTarget === "editing" && editing) setEditing({ ...editing, parceiro_id: id });
      setNovoParceiroOpen(false);
      setNovoParceiroNome("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkCreate = useMutation({
    mutationFn: async () => {
      const rows = parseBulkCsv(bulkText, familias ?? [], projetos ?? []);
      if (rows.length === 0) throw new Error("Nada para importar");
      const { error } = await supabase.from("pessoas").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} pessoas importadas`);
      invalidate();
      setAddOpen(false);
      setBulkText("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkUpdate = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      if (ids.length === 0) throw new Error("Seleciona pelo menos uma pessoa");
      const patch: {
        familia_id?: string | null;
        status?: any;
        tipo_user_id?: string | null;
        genero?: string | null;
        nacionalidade?: string | null;
        cidade_residencia?: string | null;
        religiao?: string | null;
        projeto_ids?: string[];
      } = {};
      if (bulkFamilia !== "__noop") patch.familia_id = bulkFamilia === "__null" ? null : bulkFamilia;
      if (bulkStatus !== "__noop") patch.status = bulkStatus;
      if (bulkTipo !== "__noop") patch.tipo_user_id = bulkTipo === "__null" ? null : bulkTipo;
      if (bulkGenero !== "__noop") patch.genero = bulkGenero === "__null" ? null : bulkGenero;
      if (bulkNacionalidade.trim()) patch.nacionalidade = bulkNacionalidade.trim();
      if (bulkCidade.trim()) patch.cidade_residencia = bulkCidade.trim();
      if (bulkReligiao.trim()) patch.religiao = bulkReligiao.trim();
      if (bulkProjetosMode === "clear") patch.projeto_ids = [];
      else if (bulkProjetosMode === "set") patch.projeto_ids = bulkProjetos;
      if (Object.keys(patch).length === 0) throw new Error("Nada para alterar");
      const { error } = await supabase.from("pessoas").update(patch).in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} pessoas atualizadas`);
      invalidate();
      setBulkEditOpen(false);
      bulkClearRef.current?.();
      setSelected(new Set());
      setBulkFamilia("__noop");
      setBulkStatus("__noop");
      setBulkTipo("__noop");
      setBulkGenero("__noop");
      setBulkNacionalidade("");
      setBulkCidade("");
      setBulkReligiao("");
      setBulkProjetosMode("noop");
      setBulkProjetos([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) throw new Error("Nada para apagar");
      const { error } = await supabase.from("pessoas").update({ deleted_at: new Date().toISOString() } as any).in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} ${n === 1 ? "pessoa apagada" : "pessoas apagadas"}`);
      invalidate();
      setDeleteOne(null);
      setSelected(new Set());
      setEditOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Participantes</h1>
          <p className="text-sm text-muted-foreground">{data?.length ?? 0} pessoas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="h-9" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar
          </Button>
          <InviteMemberButton />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      <SmartTable<Pessoa>
        tableId="participantes-v1"
        savedViewsKey="views:participantes"
        exportFilename="participantes"
        columns={columns}
        data={data ?? []}
        isLoading={isLoading}
        searchPlaceholder="Pesquisar participantes…"
        emptyMessage="Sem resultados"
        defaultColumnVisibility={DEFAULT_HIDDEN_COLUMNS}
        groupByOptions={GROUP_BY_OPTIONS}
        enableSelection
        editableColumns={EDITABLE_COLUMNS}
        onCellEdit={(rowId, columnId, value) =>
          saveField(rowId, columnId as keyof Pessoa, value === "" ? null : value)
        }
        onBulkDelete={async (ids) => { await remove.mutateAsync(ids); }}
        bulkActions={(ids, clear) => (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => {
              setSelected(new Set(ids));
              bulkClearRef.current = clear;
              setBulkEditOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Editar em massa
          </Button>
        )}
        onRowClick={(p) => { setEditing({ ...p }); setEditOpen(true); }}
      />

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova pessoa</DialogTitle></DialogHeader>
          <Tabs defaultValue="individual">
            <TabsList>
              <TabsTrigger value="individual">Individual</TabsTrigger>
              <TabsTrigger value="bulk">Importar em massa</TabsTrigger>
            </TabsList>
            <TabsContent value="individual">
              <div className="grid grid-cols-2 gap-3">
            <Field label="Nome *" className="col-span-2">
              <Input value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} />
            </Field>
            <Field label="Email"><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Telefone"><Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field>
            <Field label="NIF"><Input value={form.nif ?? ""} onChange={(e) => setForm({ ...form, nif: e.target.value })} /></Field>
            <Field label="Cartão de Cidadão"><Input value={form.cartao_cidadao ?? ""} onChange={(e) => setForm({ ...form, cartao_cidadao: e.target.value })} /></Field>
            <Field label="Morada" className="col-span-2"><Input value={form.morada ?? ""} onChange={(e) => setForm({ ...form, morada: e.target.value })} /></Field>
            <Field label="Data nascimento"><Input type="date" value={form.data_nascimento ?? ""} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} /></Field>
            <Field label="Género">
              <Select value={form.genero ?? "__null"} onValueChange={(v) => setForm({ ...form, genero: v === "__null" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__null">— não definido —</SelectItem>
                  {GENERO_OPTS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nacionalidade"><Input value={form.nacionalidade ?? ""} onChange={(e) => setForm({ ...form, nacionalidade: e.target.value })} /></Field>
            <Field label="Cidade residência"><Input value={form.cidade_residencia ?? ""} onChange={(e) => setForm({ ...form, cidade_residencia: e.target.value })} /></Field>
            <Field label="Religião"><Input value={form.religiao ?? ""} onChange={(e) => setForm({ ...form, religiao: e.target.value })} /></Field>
            <Field label="Profissão"><Input value={form.profissao ?? ""} onChange={(e) => setForm({ ...form, profissao: e.target.value })} /></Field>
            <Field label="Família" className="col-span-2">
              <Select value={form.familia_id ?? "__null"} onValueChange={(v) => {
                if (v === "__criar_nova_familia") { setNovaFamiliaTarget("form"); setNovaFamiliaOpen(true); return; }
                setForm({ ...form, familia_id: v === "__null" ? null : v });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__null">— sem família —</SelectItem>
                  {familias?.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  <SelectItem value="__criar_nova_familia" className="text-primary font-medium">+ Criar nova família…</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Projetos" className="col-span-2">
              <MultiSelect
                values={form.projeto_ids ?? []}
                options={(projetos ?? []).map((p) => ({ value: p.id, label: p.nome }))}
                placeholder="sem projetos"
                onChange={(v: string[]) => setForm({ ...form, projeto_ids: v })}
              />
            </Field>
            <Field label="Tipo de utilizador" className="col-span-2">
              <MultiSelect
                values={novoTipoIds}
                options={(tipos ?? []).map((t) => ({ value: t.id, label: t.nome }))}
                placeholder="sem tipos"
                onChange={(v: string[]) => {
                  setNovoTipoIds(v);
                  setForm((prev) => ({ ...prev, tipo_user_id: v[0] ?? null }));
                }}
              />
              <p className="pt-1 text-xs text-muted-foreground">
                Podes selecionar vários tipos para a mesma pessoa.
              </p>
            </Field>
            {(parceiroTipoId ? novoTipoIds.includes(parceiroTipoId) : false) && (
              <Field label="Entidade parceira" className="col-span-2">
                <Select
                  value={form.parceiro_id ?? "__null"}
                  onValueChange={(v) => {
                    if (v === "__criar_nova_entidade") { setNovoParceiroTarget("form"); setNovoParceiroOpen(true); return; }
                    setForm({ ...form, parceiro_id: v === "__null" ? null : v });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="— sem entidade —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__null">— sem entidade —</SelectItem>
                    {parceirosLookup?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    <SelectItem value="__criar_nova_entidade" className="text-primary font-medium">+ Criar nova entidade…</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Notas" className="col-span-2"><Textarea value={form.notas ?? ""} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></Field>
              </div>
              <DialogFooter className="mt-4">
            <Button onClick={() => create.mutate()} disabled={!form.nome_completo.trim() || create.isPending}>
              {create.isPending ? "A guardar…" : "Guardar"}
            </Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="bulk">
              <p className="text-sm text-muted-foreground mb-2">
                Uma pessoa por linha, valores separados por vírgula na ordem:{" "}
                <code>{BULK_COLUMNS.join(", ")}</code>. Só o nome é obrigatório.
                A <code>data_nascimento</code> usa o formato AAAA-MM-DD, o <code>genero</code> é Masculino ou Feminino e a <code>familia</code> deve corresponder ao nome exato de uma família existente.
              </p>
              <Textarea
                rows={10}
                className="font-mono text-xs whitespace-pre"
                placeholder={"Ana Silva, ana@mail.com, 912345678, 123456789, 1990-04-12, Feminino, Portuguesa, Lisboa, Católica, Família Silva\nJoão Costa, , , , , Masculino, , Porto, , "}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <DialogFooter className="mt-4">
                <Button onClick={() => bulkCreate.mutate()} disabled={!bulkText.trim() || bulkCreate.isPending}>
                  {bulkCreate.isPending ? "A importar…" : "Importar"}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar pessoa</DialogTitle></DialogHeader>
          {editing && (
            <Tabs defaultValue="perfil" className="w-full">
              <TabsList>
                <TabsTrigger value="perfil">Perfil</TabsTrigger>
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="acoes">Ações / Eventos</TabsTrigger>
                <TabsTrigger value="etiquetas">Etiquetas</TabsTrigger>
                <TabsTrigger value="atividades">Atividades</TabsTrigger>
                <TabsTrigger value="mapa-km">Mapa de KM</TabsTrigger>
                {(calcIdade(editing.data_nascimento) ?? 0) >= 18 && (
                  <TabsTrigger value="curriculo">Currículo</TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="perfil" className="mt-4">
                <PessoaPerfil
                  pessoa={editing}
                  tipos={tipos ?? []}
                  projetos={projetos ?? []}
                  familias={familias ?? []}
                  onAssinaturaChange={(assinatura) => {
                    setEditing((atual) => atual ? { ...atual, assinatura } : atual);
                  }}
                  onOpenMember={async (id) => {
                    const found = data?.find((p) => p.id === id);
                    if (found) { setEditing({ ...found }); return; }
                    const { data: p } = await supabase
                      .from("pessoas")
                      .select("id, nome_completo, email, telefone, nif, cartao_cidadao, morada, data_nascimento, familia_id, status, notas, tipo_user_id, genero, nacionalidade, cidade_residencia, religiao, profissao, iban, matricula, assinatura, projeto_ids, updated_at, parceiro_id")
                      .eq("id", id)
                      .maybeSingle();
                    if (p) setEditing({ ...(p as any), projeto_ids: (p as any).projeto_ids ?? [] });
                  }}
                />
              </TabsContent>
              <TabsContent value="dados" className="mt-4">
              <div className="grid grid-cols-2 gap-3">
              <Field label="Nome *" className="col-span-2"><Input value={editing.nome_completo} onChange={(e) => setEditing({ ...editing, nome_completo: e.target.value })} /></Field>
              <Field label="Email"><Input value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
              <Field label="Telefone"><Input value={editing.telefone ?? ""} onChange={(e) => setEditing({ ...editing, telefone: e.target.value })} /></Field>
              <Field label="NIF"><Input value={editing.nif ?? ""} onChange={(e) => setEditing({ ...editing, nif: e.target.value })} /></Field>
              <Field label="Cartão de Cidadão"><Input value={editing.cartao_cidadao ?? ""} onChange={(e) => setEditing({ ...editing, cartao_cidadao: e.target.value })} /></Field>
              <Field label="Morada" className="col-span-2"><Input value={editing.morada ?? ""} onChange={(e) => setEditing({ ...editing, morada: e.target.value })} /></Field>
              <Field label="Data nascimento"><Input type="date" value={editing.data_nascimento ?? ""} onChange={(e) => setEditing({ ...editing, data_nascimento: e.target.value })} /></Field>
              <Field label="Género">
                <Select value={editing.genero ?? "__null"} onValueChange={(v) => setEditing({ ...editing, genero: v === "__null" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__null">— não definido —</SelectItem>
                    {GENERO_OPTS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Nacionalidade"><Input value={editing.nacionalidade ?? ""} onChange={(e) => setEditing({ ...editing, nacionalidade: e.target.value })} /></Field>
              <Field label="Cidade residência"><Input value={editing.cidade_residencia ?? ""} onChange={(e) => setEditing({ ...editing, cidade_residencia: e.target.value })} /></Field>
              <Field label="Religião"><Input value={editing.religiao ?? ""} onChange={(e) => setEditing({ ...editing, religiao: e.target.value })} /></Field>
              <Field label="Profissão"><Input value={editing.profissao ?? ""} onChange={(e) => setEditing({ ...editing, profissao: e.target.value })} /></Field>
              <Field label="Família" className="col-span-2">
                <Select value={editing.familia_id ?? "__null"} onValueChange={(v) => {
                  if (v === "__criar_nova_familia") { setNovaFamiliaTarget("editing"); setNovaFamiliaOpen(true); return; }
                  setEditing({ ...editing, familia_id: v === "__null" ? null : v });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__null">— sem família —</SelectItem>
                    {familias?.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    <SelectItem value="__criar_nova_familia" className="text-primary font-medium">+ Criar nova família…</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Projetos" className="col-span-2">
                <MultiSelect
                  values={editing.projeto_ids ?? []}
                  options={(projetos ?? []).map((p) => ({ value: p.id, label: p.nome }))}
                  placeholder="sem projetos"
                  onChange={(v: string[]) => setEditing({ ...editing, projeto_ids: v })}
                />
              </Field>
              <Field label="Tipo de utilizador" className="col-span-2">
                {(() => {
                  const unionIds = Array.from(new Set([
                    ...(editing.tipo_user_id ? [editing.tipo_user_id] : []),
                    ...tiposDePessoa(editing.id),
                  ]));
                  return (
                    <>
                      <MultiSelect
                        values={unionIds}
                        options={(tipos ?? []).map((t) => ({ value: t.id, label: t.nome }))}
                        placeholder="sem tipos"
                        onChange={(v: string[]) => {
                          setEditing({ ...editing, tipo_user_id: v[0] ?? null });
                          savePessoaTipos.mutate({ pessoaId: editing.id, tipoIds: v });
                        }}
                      />
                      <p className="pt-1 text-xs text-muted-foreground">
                        Podes selecionar vários tipos para a mesma pessoa.
                      </p>
                    </>
                  );
                })()}
              </Field>
              {hasParceiroTipoFor(editing.id, editing.tipo_user_id ?? null) && (
                <Field label="Entidade parceira" className="col-span-2">
                  <Select
                    value={editing.parceiro_id ?? "__null"}
                    onValueChange={(v) => {
                      if (v === "__criar_nova_entidade") { setNovoParceiroTarget("editing"); setNovoParceiroOpen(true); return; }
                      setEditing({ ...editing, parceiro_id: v === "__null" ? null : v });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="— sem entidade —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__null">— sem entidade —</SelectItem>
                      {parceirosLookup?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                      <SelectItem value="__criar_nova_entidade" className="text-primary font-medium">+ Criar nova entidade…</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="pt-1 text-xs text-muted-foreground">
                    A pessoa fica como contacto desta entidade.
                  </p>
                </Field>
              )}
              <Field label="Estado" className="col-span-2">
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <div className="col-span-2 pt-2">
                <p className="text-sm font-medium">Dados de pagamento</p>
                <p className="text-xs text-muted-foreground">Usados para preencher as folhas de quilómetros.</p>
              </div>
              <Field label="IBAN"><Input value={editing.iban ?? ""} onChange={(e) => setEditing({ ...editing, iban: e.target.value })} /></Field>
              <Field label="Matrícula"><Input value={editing.matricula ?? ""} onChange={(e) => setEditing({ ...editing, matricula: e.target.value })} /></Field>
              <Field label="Assinatura" className="col-span-2">
                <SignaturePad
                  value={editing.assinatura ?? null}
                  onChange={(dataUrl) => setEditing({ ...editing, assinatura: dataUrl })}
                />
              </Field>
              <Field label="Notas" className="col-span-2"><Textarea value={editing.notas ?? ""} onChange={(e) => setEditing({ ...editing, notas: e.target.value })} /></Field>
              </div>
              </TabsContent>
              <TabsContent value="acoes" className="mt-4">
                <PessoaInscricoes pessoaId={editing.id} />
              </TabsContent>
              <TabsContent value="etiquetas" className="mt-4">
                <EtiquetasPicker pessoaId={editing.id} />
              </TabsContent>
              <TabsContent value="atividades" className="mt-4">
                <PessoaAtividadesSection pessoaId={editing.id} familiaId={editing.familia_id ?? null} />
              </TabsContent>
              <TabsContent value="mapa-km" className="mt-4">
                <PessoaMapaKmSection pessoaId={editing.id} familiaId={editing.familia_id} />
              </TabsContent>
              {(calcIdade(editing.data_nascimento) ?? 0) >= 18 && (
                <TabsContent value="curriculo" className="mt-4">
                  <CurriculoSection pessoaId={editing.id} />
                </TabsContent>
              )}
            </Tabs>
          )}
          <DialogFooter className="sm:justify-between">
            <Button
              variant="destructive"
              onClick={() => editing && setDeleteOne(editing)}
              disabled={!editing || remove.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Apagar
            </Button>
            <Button onClick={() => update.mutate()} disabled={!editing?.nome_completo.trim() || update.isPending}>
              {update.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk add */}
      {/* Bulk edit */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {selected.size} pessoas</DialogTitle>
            <DialogDescription>Só os campos alterados serão aplicados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Família">
              <Select value={bulkFamilia} onValueChange={setBulkFamilia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__noop">— não alterar —</SelectItem>
                  <SelectItem value="__null">— remover família —</SelectItem>
                  {familias?.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Projetos">
              <Select value={bulkProjetosMode} onValueChange={(v) => setBulkProjetosMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="noop">— não alterar —</SelectItem>
                  <SelectItem value="clear">— remover todos —</SelectItem>
                  <SelectItem value="set">Substituir por…</SelectItem>
                </SelectContent>
              </Select>
              {bulkProjetosMode === "set" && (
                <div className="mt-2">
                  <MultiSelect
                    values={bulkProjetos}
                    options={(projetos ?? []).map((p) => ({ value: p.id, label: p.nome }))}
                    placeholder="escolher projetos"
                    onChange={setBulkProjetos}
                  />
                </div>
              )}
            </Field>
            <Field label="Estado">
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__noop">— não alterar —</SelectItem>
                  {STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo de utilizador">
              <Select value={bulkTipo} onValueChange={setBulkTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__noop">— não alterar —</SelectItem>
                  <SelectItem value="__null">— remover tipo —</SelectItem>
                  {tipos?.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Género">
              <Select value={bulkGenero} onValueChange={setBulkGenero}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__noop">— não alterar —</SelectItem>
                  <SelectItem value="__null">— remover género —</SelectItem>
                  {GENERO_OPTS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nacionalidade (deixar vazio = não alterar)">
              <Input value={bulkNacionalidade} onChange={(e) => setBulkNacionalidade(e.target.value)} />
            </Field>
            <Field label="Cidade residência (deixar vazio = não alterar)">
              <Input value={bulkCidade} onChange={(e) => setBulkCidade(e.target.value)} />
            </Field>
            <Field label="Religião (deixar vazio = não alterar)">
              <Input value={bulkReligiao} onChange={(e) => setBulkReligiao(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => bulkUpdate.mutate()} disabled={bulkUpdate.isPending}>
              {bulkUpdate.isPending ? "A guardar…" : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete single */}
      <AlertDialog open={!!deleteOne} onOpenChange={(o) => !o && setDeleteOne(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar pessoa</AlertDialogTitle>
            <AlertDialogDescription>
              Tens a certeza que queres apagar <strong>{deleteOne?.nome_completo}</strong>? Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteOne && remove.mutate([deleteOne.id])}
              disabled={remove.isPending}
            >
              {remove.isPending ? "A apagar…" : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Nova família inline */}
      <Dialog open={novaFamiliaOpen} onOpenChange={setNovaFamiliaOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Criar nova família</DialogTitle>
            <DialogDescription>Introduz o nome da nova família.</DialogDescription>
          </DialogHeader>
          <Input
            value={novaFamiliaNome}
            onChange={(e) => setNovaFamiliaNome(e.target.value)}
            placeholder="Nome da família"
            onKeyDown={(e) => { if (e.key === "Enter" && novaFamiliaNome.trim()) criarFamilia.mutate(novaFamiliaNome); }}
          />
          <DialogFooter>
            <Button onClick={() => criarFamilia.mutate(novaFamiliaNome)} disabled={!novaFamiliaNome.trim() || criarFamilia.isPending}>
              {criarFamilia.isPending ? "A criar…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Nova entidade parceira inline */}
      <Dialog open={novoParceiroOpen} onOpenChange={setNovoParceiroOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Criar nova entidade</DialogTitle>
            <DialogDescription>Introduz o nome da nova entidade parceira.</DialogDescription>
          </DialogHeader>
          <Input
            value={novoParceiroNome}
            onChange={(e) => setNovoParceiroNome(e.target.value)}
            placeholder="Nome da entidade"
            onKeyDown={(e) => { if (e.key === "Enter" && novoParceiroNome.trim()) criarParceiro.mutate(novoParceiroNome); }}
          />
          <DialogFooter>
            <Button onClick={() => criarParceiro.mutate(novoParceiroNome)} disabled={!novoParceiroNome.trim() || criarParceiro.isPending}>
              {criarParceiro.isPending ? "A criar…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function InlineText({
  value,
  onSave,
  type = "text",
}: {
  value: string | null;
  onSave: (v: string | null) => Promise<void> | void;
  type?: "text" | "date";
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  useEffect(() => { setVal(value ?? ""); }, [value]);
  if (!editing) {
    return (
      <span
        className="block min-h-[1.5rem] cursor-text rounded px-1 -mx-1 text-muted-foreground hover:bg-muted/50"
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      >
        {value ? value : <span className="opacity-50">—</span>}
      </span>
    );
  }
  const commit = async () => {
    setEditing(false);
    const next = val.trim() === "" ? null : val;
    if (next !== (value ?? null)) await onSave(next);
  };
  return (
    <Input
      autoFocus
      type={type}
      value={val}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") { setVal(value ?? ""); setEditing(false); }
      }}
      className="h-7 px-1.5 text-sm"
    />
  );
}

function InlineSelect({
  value,
  options,
  onSave,
  placeholder = "—",
  allowClear = true,
}: {
  value: string | null;
  options: { value: string; label: string }[];
  onSave: (v: string | null) => Promise<void> | void;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={value ?? "__null"}
        onValueChange={async (v) => {
          const next = v === "__null" ? null : v;
          if (next !== (value ?? null)) await onSave(next);
        }}
      >
        <SelectTrigger className="h-7 w-full border-transparent bg-transparent px-1.5 text-sm shadow-none hover:border-border hover:bg-muted/50 [&>svg]:opacity-50">
          <SelectValue>
            {current ? (
              <span>{current.label}</span>
            ) : (
              <span className="text-muted-foreground opacity-60">{placeholder}</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {allowClear && <SelectItem value="__null">— {placeholder} —</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MultiSelect({
  values,
  options,
  onChange,
  placeholder = "—",
  triggerClassName = "",
}: {
  values: string[];
  options: { value: string; label: string }[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  triggerClassName?: string;
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
          onClick={(e) => e.stopPropagation()}
          className={`flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-left text-sm shadow-sm hover:bg-muted/50 ${triggerClassName}`}
        >
          <span className={labels.length ? "" : "text-muted-foreground"}>
            {labels.length ? labels.join(", ") : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-1" onClick={(e) => e.stopPropagation()}>
        <div className="max-h-64 overflow-auto">
          {options.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Sem opções</div>
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

function InlineMultiSelect({
  values,
  options,
  onSave,
  placeholder = "—",
}: {
  values: string[];
  options: { value: string; label: string }[];
  onSave: (next: string[]) => Promise<void> | void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState<string[]>(values);
  useEffect(() => { setLocal(values); }, [values.join(",")]);
  const commit = async (next: string[]) => {
    setLocal(next);
    if (next.join(",") !== values.join(",")) await onSave(next);
  };
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <MultiSelect
        values={local}
        options={options}
        placeholder={placeholder}
        onChange={commit}
        triggerClassName="h-7 border-transparent shadow-none hover:border-border px-1.5"
      />
    </div>
  );
}

function parseBulkCsv(text: string, familias: { id: string; nome: string }[], projetos: { id: string; nome: string }[]) {
  const famByName = new Map(familias.map((f) => [f.nome.trim().toLowerCase(), f.id]));
  const projByName = new Map(projetos.map((p) => [p.nome.trim().toLowerCase(), p.id]));
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(",").map((x) => x?.trim() ?? "");
      const [
        nome,
        email,
        telefone,
        nif,
        cartao_cidadao,
        morada,
        data_nascimento,
        genero,
        nacionalidade,
        cidade_residencia,
        religiao,
        profissao,
        familia,
        projeto,
      ] = parts;
      if (!nome) throw new Error(`Linha sem nome: "${line}"`);
      let familia_id: string | null = null;
      if (familia) {
        const id = famByName.get(familia.toLowerCase());
        if (!id) throw new Error(`Família "${familia}" não encontrada (linha: "${line}")`);
        familia_id = id;
      }
      const projeto_ids: string[] = [];
      if (projeto) {
        for (const raw of projeto.split(/[;|]/).map((s) => s.trim()).filter(Boolean)) {
          const id = projByName.get(raw.toLowerCase());
          if (!id) throw new Error(`Projeto "${raw}" não encontrado (linha: "${line}")`);
          projeto_ids.push(id);
        }
      }
      let generoVal: string | null = null;
      if (genero) {
        const g = genero.toLowerCase();
        if (g.startsWith("m")) generoVal = "Masculino";
        else if (g.startsWith("f")) generoVal = "Feminino";
        else throw new Error(`Género inválido "${genero}" (usa Masculino/Feminino)`);
      }
      return {
        nome_completo: nome,
        email: email || null,
        telefone: telefone || null,
        nif: nif || null,
        cartao_cidadao: cartao_cidadao || null,
        morada: morada || null,
        data_nascimento: data_nascimento || null,
        genero: generoVal,
        nacionalidade: nacionalidade || null,
        cidade_residencia: cidade_residencia || null,
        religiao: religiao || null,
        profissao: profissao || null,
        familia_id,
        projeto_ids,
      };
    });
}

function PessoaInscricoes({ pessoaId }: { pessoaId: string }) {
  const qc = useQueryClient();
  const [addAcaoId, setAddAcaoId] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["pessoa-inscricoes", pessoaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inscricoes")
        .select("id, status, created_at, acao:acoes(id, nome, tipo, data_inicio, status)")
        .eq("pessoa_id", pessoaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        status: string;
        created_at: string;
        acao: { id: string; nome: string; tipo: string | null; data_inicio: string | null; status: string | null } | null;
      }>;
    },
  });

  const { data: acoes } = useQuery({
    queryKey: ["acoes-min-for-inscricao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes")
        .select("id, nome, tipo, data_inicio")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; nome: string; tipo: string | null; data_inicio: string | null }>;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pessoa-inscricoes", pessoaId] });
    qc.invalidateQueries({ queryKey: ["acoes"] });
    qc.invalidateQueries({ queryKey: ["inscricoes"] });
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("inscricoes").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Estado atualizado"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  const removeInscricao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inscricoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Inscrição removida"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  const addInscricao = useMutation({
    mutationFn: async (acaoId: string) => {
      const { error } = await supabase
        .from("inscricoes")
        .insert({ pessoa_id: pessoaId, acao_id: acaoId, status: "confirmada" as any });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pessoa inscrita na ação"); setAddAcaoId(""); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao inscrever"),
  });

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const rows = data ?? [];
  const inscritasIds = new Set(rows.filter(r => r.status !== "cancelada").map(r => r.acao?.id).filter(Boolean) as string[]);
  const acoesDisponiveis = (acoes ?? []).filter(a => !inscritasIds.has(a.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={addAcaoId} onValueChange={setAddAcaoId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecionar ação / evento para inscrever..." />
          </SelectTrigger>
          <SelectContent>
            {acoesDisponiveis.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">Sem ações disponíveis</div>
            ) : acoesDisponiveis.map(a => (
              <SelectItem key={a.id} value={a.id}>
                {a.nome} {a.tipo ? `(${a.tipo})` : ""} {a.data_inicio ? `— ${fmt(a.data_inicio)}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          disabled={!addAcaoId || addInscricao.isPending}
          onClick={() => addAcaoId && addInscricao.mutate(addAcaoId)}
        >
          <Plus className="h-4 w-4" /> Inscrever
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem inscrições em ações ou eventos.</p>
      ) : (
      <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ação / Evento</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="w-[160px]">Estado</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.acao?.nome ?? "—"}</TableCell>
              <TableCell><Badge variant="outline">{r.acao?.tipo ?? "—"}</Badge></TableCell>
              <TableCell>{fmt(r.acao?.data_inicio ?? null)}</TableCell>
              <TableCell>
                <Select
                  value={r.status}
                  onValueChange={(v) => updateStatus.mutate({ id: r.id, status: v })}
                  disabled={updateStatus.isPending}
                >
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="confirmada">Confirmada</SelectItem>
                    <SelectItem value="presente">Presente</SelectItem>
                    <SelectItem value="ausente">Ausente</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Remover inscrição"
                  onClick={() => { if (confirm("Remover esta inscrição?")) removeInscricao.mutate(r.id); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
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

type PerfilOpt = { id: string; nome: string };

function calcIdade(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--;
  return age;
}

function fmtData(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
}

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "?";
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium break-words">{value ?? "—"}</div>
      </div>
    </div>
  );
}

function PessoaPerfil({
  pessoa,
  tipos,
  projetos,
  familias,
  onAssinaturaChange,
  onOpenMember,
}: {
  pessoa: Pessoa & { is_voluntario?: boolean; is_admin?: boolean };
  tipos: PerfilOpt[];
  projetos: PerfilOpt[];
  familias: PerfilOpt[];
  onAssinaturaChange?: (assinatura: string | null) => void;
  onOpenMember?: (id: string) => void | Promise<void>;
}) {
  const tipoNome = tipos.find((t) => t.id === pessoa.tipo_user_id)?.nome ?? null;
  const familiaNome = familias.find((f) => f.id === pessoa.familia_id)?.nome ?? null;
  const projetoNomes = (pessoa.projeto_ids ?? [])
    .map((id) => projetos.find((p) => p.id === id)?.nome)
    .filter(Boolean) as string[];
  const idade = calcIdade(pessoa.data_nascimento);

  const { data: pessoaExtra } = useQuery({
    queryKey: ["pessoa-extra", pessoa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("is_voluntario, is_admin")
        .eq("id", pessoa.id)
        .maybeSingle();
      if (error) throw error;
      return data as { is_voluntario: boolean; is_admin: boolean } | null;
    },
  });
  const isVoluntario = pessoaExtra?.is_voluntario ?? pessoa.is_voluntario ?? false;
  const isAdmin = pessoaExtra?.is_admin ?? pessoa.is_admin ?? false;

  const qcPerfil = useQueryClient();
  const [assinaturaLocal, setAssinaturaLocal] = useState<string | null>(pessoa.assinatura ?? null);
  useEffect(() => {
    setAssinaturaLocal(pessoa.assinatura ?? null);
  }, [pessoa.id, pessoa.assinatura]);
  const saveAssinatura = useMutation({
    mutationFn: async (assinatura: string | null) => {
      const { error } = await supabase.from("pessoas").update({ assinatura }).eq("id", pessoa.id);
      if (error) throw error;
      return assinatura;
    },
    onSuccess: (assinatura) => {
      setAssinaturaLocal(assinatura);
      onAssinaturaChange?.(assinatura);
      qcPerfil.setQueryData<Pessoa[]>(["pessoas"], (atuais) =>
        atuais?.map((item) => item.id === pessoa.id ? { ...item, assinatura } : item),
      );
      toast.success("Assinatura atualizada.");
      qcPerfil.invalidateQueries({ queryKey: ["pessoas"] });
      qcPerfil.invalidateQueries({ queryKey: ["participantes"] });
      qcPerfil.invalidateQueries({ queryKey: ["pessoa-perfil", pessoa.id] });
      qcPerfil.invalidateQueries({ queryKey: ["folhas-km"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao guardar a assinatura."),
  });

  const { data: agregado, isLoading: loadingAgregado } = useQuery({
    enabled: !!pessoa.familia_id,
    queryKey: ["pessoa-agregado", pessoa.familia_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, data_nascimento, genero, telefone, email, profissao, is_voluntario, tipo_user_id")
        .eq("familia_id", pessoa.familia_id!)
        .eq("status", "ativo")
        .order("data_nascimento", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const membros = (agregado ?? []) as Array<{
    id: string; nome_completo: string; data_nascimento: string | null; genero: string | null;
    telefone: string | null; email: string | null; profissao: string | null; is_voluntario: boolean;
    tipo_user_id: string | null;
  }>;
  const voluntarios = membros.filter((m) => m.is_voluntario);
  const outrosMembros = membros.filter((m) => m.id !== pessoa.id);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border bg-gradient-to-br from-muted/50 to-background p-5">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-semibold shrink-0">
            {initials(pessoa.nome_completo)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold leading-tight">{pessoa.nome_completo}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {idade !== null && <span>{idade} anos</span>}
              {pessoa.genero && <><span>·</span><span>{pessoa.genero}</span></>}
              {tipoNome && <><span>·</span><span>{tipoNome}</span></>}
              {pessoa.profissao && <><span>·</span><span>{pessoa.profissao}</span></>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant={pessoa.status === "ativo" ? "default" : "secondary"}>{pessoa.status}</Badge>
              {isVoluntario && <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/20"><Heart className="h-3 w-3 mr-1" />Voluntário</Badge>}
              {isAdmin && <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20"><ShieldCheck className="h-3 w-3 mr-1" />Admin</Badge>}
              {familiaNome && <Badge variant="outline"><Users className="h-3 w-3 mr-1" />{familiaNome}</Badge>}
              {projetoNomes.map((p) => <Badge key={p} variant="outline">{p}</Badge>)}
            </div>
          </div>
        </div>
      </div>

      {/* Grid de info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contactos</h3>
          <InfoRow icon={Mail} label="Email" value={pessoa.email || "—"} />
          <InfoRow icon={Phone} label="Telefone" value={pessoa.telefone || "—"} />
          <InfoRow icon={MapPin} label="Morada" value={pessoa.morada || "—"} />
          <InfoRow icon={MapPin} label="Cidade" value={pessoa.cidade_residencia || "—"} />
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados pessoais</h3>
          <InfoRow icon={Cake} label="Data de nascimento" value={`${fmtData(pessoa.data_nascimento)}${idade !== null ? ` · ${idade} anos` : ""}`} />
          <InfoRow icon={Globe} label="Nacionalidade" value={pessoa.nacionalidade || "—"} />
          <InfoRow icon={HeartHandshake} label="Religião" value={pessoa.religiao || "—"} />
          <InfoRow icon={Briefcase} label="Profissão" value={pessoa.profissao || "—"} />
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identificação</h3>
          <InfoRow icon={IdCard} label="NIF" value={pessoa.nif || "—"} />
          <InfoRow icon={IdCard} label="Cartão de Cidadão" value={pessoa.cartao_cidadao || "—"} />
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pagamento</h3>
          <InfoRow icon={CreditCard} label="IBAN" value={pessoa.iban || "—"} />
          <InfoRow icon={Car} label="Matrícula" value={pessoa.matricula || "—"} />
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Assinatura</p>
            <SignaturePad
              key={assinaturaLocal ?? "vazio"}
              value={assinaturaLocal}
              onChange={(dataUrl) => {
                setAssinaturaLocal(dataUrl);
                onAssinaturaChange?.(dataUrl);
                saveAssinatura.mutate(dataUrl);
              }}
            />
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Envolvimento</h3>
          <InfoRow icon={Users} label="Tipo de utilizador" value={tipoNome || "—"} />
          <InfoRow icon={Users} label="Projetos" value={projetoNomes.length ? projetoNomes.join(", ") : "—"} />
        </div>
      </div>

      {pessoa.notas && (
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notas</h3>
          <p className="text-sm whitespace-pre-wrap">{pessoa.notas}</p>
        </div>
      )}

      {/* Agregado familiar */}
      {pessoa.familia_id && (
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Users className="h-4 w-4" /> Agregado familiar — {familiaNome}
            </h3>
            <Badge variant="outline">{membros.length} membro{membros.length === 1 ? "" : "s"}</Badge>
          </div>
          {loadingAgregado ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : outrosMembros.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem outros membros registados.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {outrosMembros.map((m) => {
                const idadeM = calcIdade(m.data_nascimento);
                const tipoM = tipos.find((t) => t.id === m.tipo_user_id)?.nome;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onOpenMember?.(m.id)}
                    className="text-left rounded-md border p-3 bg-card hover:bg-muted/40 hover:border-primary/40 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                        {initials(m.nome_completo)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{m.nome_completo}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[idadeM !== null ? `${idadeM} anos` : null, m.genero, tipoM].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                      {m.is_voluntario && <Heart className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {m.profissao && <div className="flex items-center gap-1.5"><Briefcase className="h-3 w-3" />{m.profissao}</div>}
                      {m.telefone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{m.telefone}</div>}
                      {m.email && <div className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{m.email}</span></div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {voluntarios.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-rose-500" /> Voluntários no agregado ({voluntarios.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {voluntarios.map((v) => (
                  <Badge key={v.id} variant="outline" className="bg-rose-500/5 border-rose-500/30">
                    {v.nome_completo}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}