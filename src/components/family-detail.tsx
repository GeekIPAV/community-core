import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Trash2, UserMinus } from "lucide-react";
import { formatDateBR } from "@/lib/utils";
import { InlineText, InlineSelect, InlineMultiSelect } from "@/components/inline-edit";
import { personIcon, flagFor } from "@/lib/person-display";

// ── Constants ──────────────────────────────────────────────────────────────
const PESSOA_STATUS_OPTS = ["ativo", "suspeito_duplicado", "fundido", "arquivado"];
const GENERO_OPTS = ["Masculino", "Feminino"];

export const STATUS_OPTS = [
  "Sem estado",
  "Em espera",
  "No programa",
  "Não interessada",
  "Concluído",
  "Fora do País",
] as const;
export type FamiliaStatus = typeof STATUS_OPTS[number];

export const STATUS_GROUPS: { label: string; options: FamiliaStatus[] }[] = [
  { label: "A fazer", options: ["Sem estado", "Em espera"] },
  { label: "Em andamento", options: ["No programa"] },
  { label: "Concluídos", options: ["Não interessada", "Concluído", "Fora do País"] },
];

export type Familia = {
  id: string;
  nome: string;
  notas: string | null;
  status: FamiliaStatus;
  contacto_meeru_id: string | null;
  updated_at: string | null;
};

type Membro = {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  status: string;
  genero: string | null;
  cidade_residencia: string | null;
  nacionalidade: string | null;
  religiao: string | null;
  nif: string | null;
  projeto_ids: string[] | null;
  is_voluntario: boolean | null;
};

// ── AtividadesFamiliaTab ────────────────────────────────────────────────────
type AtividadeCatalogo = { id: string; nome: string; categoria: string | null };
type FamiliaAtividadeRow = {
  id: string;
  data: string | null;
  descricao: string | null;
  created_at: string;
  atividade: { id: string; nome: string; categoria: string | null } | null;
};

function AtividadesFamiliaTab({ familiaId }: { familiaId: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [atividadeId, setAtividadeId] = useState<string>("");
  const [dataVal, setDataVal] = useState<string>("");
  const [descricao, setDescricao] = useState<string>("");
  const [novaOpen, setNovaOpen] = useState(false);
  const [novaNome, setNovaNome] = useState("");
  const [novaCategoria, setNovaCategoria] = useState<string>("");

  const { data: catalogo } = useQuery({
    queryKey: ["atividades-catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atividades_catalogo" as any)
        .select("id, nome, categoria")
        .eq("ativo", true)
        .order("categoria")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as AtividadeCatalogo[];
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["familia-atividades", familiaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familia_atividades" as any)
        .select("id, data, descricao, created_at, atividade:atividades_catalogo(id, nome, categoria)")
        .eq("familia_id", familiaId)
        .order("data", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FamiliaAtividadeRow[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!atividadeId) throw new Error("Escolha uma atividade");
      const { error } = await supabase.from("familia_atividades" as any).insert({
        familia_id: familiaId,
        atividade_id: atividadeId,
        data: dataVal || null,
        descricao: descricao.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atividade registada");
      qc.invalidateQueries({ queryKey: ["familia-atividades", familiaId] });
      setAddOpen(false);
      setAtividadeId("");
      setDataVal("");
      setDescricao("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("familia_atividades" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atividade removida");
      qc.invalidateQueries({ queryKey: ["familia-atividades", familiaId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criarAtividade = useMutation({
    mutationFn: async () => {
      const nome = novaNome.trim();
      if (!nome) throw new Error("Nome obrigatório");
      const { data: inserted, error } = await supabase
        .from("atividades_catalogo" as any)
        .insert({ nome, categoria: novaCategoria.trim() || null })
        .select("id")
        .single();
      if (error) throw error;
      return (inserted as any).id as string;
    },
    onSuccess: (id) => {
      toast.success("Atividade criada");
      qc.invalidateQueries({ queryKey: ["atividades-catalogo"] });
      setNovaOpen(false);
      setNovaNome("");
      setNovaCategoria("");
      setAtividadeId(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const categorias = Array.from(new Set((catalogo ?? []).map((c) => c.categoria || "(Sem categoria)")));

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Registar atividade
        </Button>
      </div>
      <div className="flex-1 min-h-0 max-h-[60vh] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Data</TableHead>
              <TableHead>Atividade</TableHead>
              <TableHead className="w-40">Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-16 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">A carregar…</TableCell></TableRow>
            )}
            {!isLoading && (!rows || rows.length === 0) && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem atividades registadas</TableCell></TableRow>
            )}
            {(() => {
              if (!rows) return null;
              const groups = new Map<string, typeof rows>();
              for (const r of rows) {
                const k = r.atividade?.categoria || "(Sem categoria)";
                const list = groups.get(k) ?? [];
                list.push(r);
                groups.set(k, list);
              }
              const sorted = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
              return sorted.flatMap(([cat, items]) => [
                <TableRow key={`grp-${cat}`} className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={5} className="font-semibold">
                    {cat} <span className="text-muted-foreground font-normal">({items.length})</span>
                  </TableCell>
                </TableRow>,
                ...items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{r.data ? formatDateBR(r.data) : "—"}</TableCell>
                    <TableCell className="font-medium">{r.atividade?.nome ?? "—"}</TableCell>
                    <TableCell>{r.atividade?.categoria ? <Badge variant="secondary">{r.atividade.categoria}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-pre-wrap">{r.descricao || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Remover"
                        onClick={() => { if (confirm("Remover esta atividade?")) remove.mutate(r.id); }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )),
              ]);
            })()}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Registar atividade</DialogTitle>
            <DialogDescription>Escolha uma atividade do catálogo. Se não encontrar, pode criar uma nova.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Atividade</Label>
              <div className="flex gap-2">
                <Select value={atividadeId} onValueChange={setAtividadeId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Escolher…" /></SelectTrigger>
                  <SelectContent className="max-h-[60vh]">
                    {categorias.map((cat) => (
                      <div key={cat}>
                        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{cat}</div>
                        {(catalogo ?? []).filter((c) => (c.categoria || "(Sem categoria)") === cat).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setNovaOpen(true)} title="Criar nova atividade">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={dataVal} onChange={(e) => setDataVal(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Notas, contexto, observações…" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => add.mutate()} disabled={!atividadeId || add.isPending}>
              {add.isPending ? "A guardar…" : "Registar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova atividade</DialogTitle>
            <DialogDescription>Adiciona uma nova atividade ao catálogo para todas as famílias.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={novaNome} onChange={(e) => setNovaNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={novaCategoria || "__none"} onValueChange={(v) => setNovaCategoria(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">(Sem categoria)</SelectItem>
                  <SelectItem value="Cultural">Cultural</SelectItem>
                  <SelectItem value="Relacional">Relacional</SelectItem>
                  <SelectItem value="Mediação">Mediação</SelectItem>
                  <SelectItem value="Económica Educacional e da Saúde">Económica Educacional e da Saúde</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => criarAtividade.mutate()} disabled={!novaNome.trim() || criarAtividade.isPending}>
              {criarAtividade.isPending ? "A criar…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── FamilyDetailDialog ───────────────────────────────────────────────────────

export interface FamilyDetailDialogProps {
  family: Familia | null;
  open: boolean;
  onClose: () => void;
  /** Full list of siblings to enable prev/next navigation */
  siblings?: Familia[];
  /** Called when user navigates to a different sibling */
  onSelectSibling?: (f: Familia) => void;
  /** Called after any successful mutation so the parent can refresh its queries */
  onUpdate?: () => void;
  /** Which tab to open first (defaults to "membros") */
  defaultTab?: "dados" | "membros" | "projetos" | "acoes" | "atividades" | "contexto";
}

export function FamilyDetailDialog({
  family,
  open,
  onClose,
  siblings,
  onSelectSibling,
  onUpdate,
  defaultTab = "membros",
}: FamilyDetailDialogProps) {
  const qc = useQueryClient();

  // ── tab + editing state ───────────────────────────────────────────────────
  const [detailTab, setDetailTab] = useState<"dados" | "membros" | "projetos" | "acoes" | "atividades" | "contexto">(defaultTab);
  const [editing, setEditing] = useState<Familia | null>(family);

  // When the selected family changes reset editing state
  useEffect(() => {
    if (family) {
      setEditing({ ...family });
      setDetailTab(defaultTab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family?.id]);

  // ── sub-dialog states ─────────────────────────────────────────────────────
  const [addMembroOpen, setAddMembroOpen] = useState(false);
  const [addAcaoOpen, setAddAcaoOpen] = useState(false);
  const [novaAcao, setNovaAcao] = useState<{ pessoa_id: string; acao_id: string }>({ pessoa_id: "", acao_id: "" });
  const [bulkProjetoId, setBulkProjetoId] = useState<string>("");

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
  const [bulkMembrosText, setBulkMembrosText] = useState("");
  const [bulkMembrosVoluntario, setBulkMembrosVoluntario] = useState(false);

  const BULK_MEMBROS_PLACEHOLDER =
    "nome, email, telefone, data_nascimento (AAAA-MM-DD), genero, cidade, nacionalidade, religiao, nif\n" +
    "Maria Silva, maria@exemplo.pt, 912345678, 1985-03-12, Feminino, Lisboa, Portuguesa, Católica, 123456789\n" +
    "João Costa, , 933221100, 1990-07-25, Masculino, Porto, Portuguesa, , ";

  // ── queries ───────────────────────────────────────────────────────────────
  const { data: membros, isLoading: loadingMembros } = useQuery({
    queryKey: ["familias", "membros", family?.id],
    enabled: !!family,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, telefone, data_nascimento, status, genero, cidade_residencia, nacionalidade, religiao, nif, projeto_ids, is_voluntario")
        .eq("familia_id", family!.id)
        .order("nome_completo");
      if (error) throw error;
      return data as Membro[];
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

  const { data: projetosList } = useQuery({
    queryKey: ["projetos", "lista"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });
  const projetosMap = useMemo(() => new Map((projetosList ?? []).map((p) => [p.id, p.nome])), [projetosList]);

  const { data: acoesFamilia, isLoading: loadingAcoesFamilia } = useQuery({
    queryKey: ["familias", "acoes", family?.id],
    enabled: !!family && !!membros,
    queryFn: async () => {
      const ids = (membros ?? []).map((m) => m.id);
      if (ids.length === 0)
        return [] as Array<{ inscricao_id: string; acao_id: string; nome: string; data_inicio: string | null; local: string | null; status: string; pessoa_id: string; pessoa_nome: string }>;
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

  const { data: acoesList } = useQuery({
    queryKey: ["acoes", "lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes")
        .select("id, nome, data_inicio")
        .order("data_inicio", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; data_inicio: string | null }[];
    },
  });

  // ── invalidation helpers ──────────────────────────────────────────────────
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["familias"] });
    qc.invalidateQueries({ queryKey: ["pessoas"] });
    onUpdate?.();
  };

  const invalidateMembros = () => {
    qc.invalidateQueries({ queryKey: ["familias", "membros", family?.id] });
    qc.invalidateQueries({ queryKey: ["familias", "contagens"] });
    qc.invalidateQueries({ queryKey: ["familias", "agregados"] });
    qc.invalidateQueries({ queryKey: ["pessoas"] });
    onUpdate?.();
  };

  // ── mutations ─────────────────────────────────────────────────────────────
  const savePessoa = (id: string, field: string) => async (v: any) => {
    const { error } = await supabase.from("pessoas").update({ [field]: v } as any).eq("id", id);
    if (error) { toast.error(error.message); throw error; }
    invalidateMembros();
  };

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("familias")
        .update({
          nome: editing.nome,
          notas: editing.notas || null,
          status: editing.status,
          contacto_meeru_id: editing.contacto_meeru_id,
        } as any)
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Família atualizada");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFamilia = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("familias").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Família eliminada");
      invalidateAll();
      qc.invalidateQueries({ queryKey: ["familias", "contagens"] });
      qc.invalidateQueries({ queryKey: ["familias", "agregados"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMembro = useMutation({
    mutationFn: async () => {
      if (!family) throw new Error("Família não selecionada");
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
        familia_id: family.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro adicionado");
      invalidateMembros();
      setAddMembroOpen(false);
      setNovoMembro(emptyMembro);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkAddMembros = useMutation({
    mutationFn: async () => {
      if (!family) throw new Error("Família não selecionada");
      const lines = bulkMembrosText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .filter((l) => !/^nome\s*,/i.test(l));
      if (lines.length === 0) throw new Error("Nada para importar");
      const rows = lines.map((line, idx) => {
        const cols = line.split(",").map((c) => c.trim());
        const [nomeCol, email, telefone, data_nascimento, genero, cidade, nacionalidade, religiao, nif] = cols;
        if (!nomeCol) throw new Error(`Linha ${idx + 1}: nome é obrigatório`);
        if (data_nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(data_nascimento)) {
          throw new Error(`Linha ${idx + 1}: data deve estar em AAAA-MM-DD`);
        }
        return {
          nome_completo: nomeCol,
          email: email || null,
          telefone: telefone || null,
          data_nascimento: data_nascimento || null,
          genero: genero || null,
          cidade_residencia: cidade || null,
          nacionalidade: nacionalidade || null,
          religiao: religiao || null,
          nif: nif || null,
          status: "ativo",
          is_voluntario: bulkMembrosVoluntario,
          familia_id: family.id,
        };
      });
      const { error } = await supabase.from("pessoas").insert(rows as any);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} ${bulkMembrosVoluntario ? "voluntário(s)" : "membro(s)"} adicionado(s)`);
      invalidateMembros();
      setAddMembroOpen(false);
      setBulkMembrosText("");
      setBulkMembrosVoluntario(false);
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
      invalidateMembros();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePessoa = useMutation({
    mutationFn: async (pessoaId: string) => {
      const { error } = await supabase.from("pessoas").update({ deleted_at: new Date().toISOString() } as any).eq("id", pessoaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Utilizador apagado");
      invalidateMembros();
      qc.invalidateQueries({ queryKey: ["familias", "acoes", family?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkAssignProjeto = useMutation({
    mutationFn: async ({ projetoId, action }: { projetoId: string; action: "add" | "remove" }) => {
      const lista = membros ?? [];
      if (lista.length === 0) throw new Error("Sem membros");
      const updates = lista.map(async (m) => {
        const atuais = new Set<string>(m.projeto_ids ?? []);
        if (action === "add") atuais.add(projetoId);
        else atuais.delete(projetoId);
        const novos = Array.from(atuais);
        const { error } = await supabase.from("pessoas").update({ projeto_ids: novos } as any).eq("id", m.id);
        if (error) throw error;
      });
      await Promise.all(updates);
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.action === "add" ? "Projeto atribuído a todos os membros" : "Projeto removido de todos os membros");
      qc.invalidateQueries({ queryKey: ["familias", "membros", family?.id] });
      qc.invalidateQueries({ queryKey: ["familias", "agregados"] });
      qc.invalidateQueries({ queryKey: ["pessoas"] });
      setBulkProjetoId("");
      onUpdate?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addInscricaoFamilia = useMutation({
    mutationFn: async () => {
      if (!novaAcao.pessoa_id || !novaAcao.acao_id) throw new Error("Escolha membro e ação");
      const { data: existing } = await supabase
        .from("inscricoes")
        .select("id, status")
        .eq("pessoa_id", novaAcao.pessoa_id)
        .eq("acao_id", novaAcao.acao_id)
        .neq("status", "cancelada")
        .maybeSingle();
      if (existing) throw new Error("Este membro já está inscrito nesta ação");
      const { error } = await supabase.from("inscricoes").insert({ pessoa_id: novaAcao.pessoa_id, acao_id: novaAcao.acao_id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inscrição adicionada");
      qc.invalidateQueries({ queryKey: ["familias", "acoes", family?.id] });
      qc.invalidateQueries({ queryKey: ["familias", "agregados"] });
      setAddAcaoOpen(false);
      setNovaAcao({ pessoa_id: "", acao_id: "" });
      onUpdate?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── navigation ────────────────────────────────────────────────────────────
  const siblingIdx = siblings && family ? siblings.findIndex((f) => f.id === family.id) : -1;
  const hasPrev = siblingIdx > 0;
  const hasNext = siblings != null && siblingIdx >= 0 && siblingIdx < siblings.length - 1;

  const goPrev = () => {
    if (hasPrev && siblings && onSelectSibling) onSelectSibling(siblings[siblingIdx - 1]);
  };
  const goNext = () => {
    if (hasNext && siblings && onSelectSibling) onSelectSibling(siblings[siblingIdx + 1]);
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-[min(1200px,95vw)] w-[95vw] sm:w-full p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-6 pb-0">
            <DialogHeader>
              <div className="flex items-center justify-between gap-3">
                <DialogTitle>{family?.nome}</DialogTitle>
                {siblings && onSelectSibling && (
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" title="Família anterior" onClick={goPrev} disabled={!hasPrev}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Família seguinte" onClick={goNext} disabled={!hasNext}>
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                )}
              </div>
              <DialogDescription>
                {loadingMembros ? "A carregar…" : `${membros?.length ?? 0} membro(s)`}
              </DialogDescription>
            </DialogHeader>
          </div>

          <Tabs
            value={detailTab}
            onValueChange={(v) => setDetailTab(v as typeof detailTab)}
            className="flex flex-col flex-1 min-h-0 px-6 pb-6"
          >
            <TabsList className="w-full">
              <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
              <TabsTrigger value="membros" className="flex-1">Membros</TabsTrigger>
              <TabsTrigger value="projetos" className="flex-1">Projetos</TabsTrigger>
              <TabsTrigger value="acoes" className="flex-1">Ações</TabsTrigger>
              <TabsTrigger value="atividades" className="flex-1">Atividades</TabsTrigger>
              <TabsTrigger value="contexto" className="flex-1">
                {family && <ContextoTabLabel familiaId={family.id} />}
              </TabsTrigger>
            </TabsList>

            {/* ── Dados ── */}
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
                  <div className="space-y-2">
                    <Label>Pessoa de Contacto (Equipa MEERU)</Label>
                    <Select
                      value={editing.contacto_meeru_id ?? "__none"}
                      onValueChange={(v) => setEditing({ ...editing, contacto_meeru_id: v === "__none" ? null : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Sem contacto" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Sem contacto</SelectItem>
                        {(equipa ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter className="flex justify-between gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`Eliminar a família "${editing.nome}"? Os membros ficarão sem família e as atividades associadas serão removidas. Esta ação não pode ser desfeita.`)) {
                          deleteFamilia.mutate(editing.id);
                        }
                      }}
                      disabled={deleteFamilia.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deleteFamilia.isPending ? "A eliminar…" : "Eliminar família"}
                    </Button>
                    <Button onClick={() => update.mutate()} disabled={!editing.nome.trim() || update.isPending}>
                      {update.isPending ? "A guardar…" : "Guardar"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </TabsContent>

            {/* ── Membros ── */}
            <TabsContent value="membros" className="pt-4 flex-1 min-h-0 overflow-hidden">
              {(() => {
                const membrosNormais = (membros ?? []).filter((m) => !m.is_voluntario);
                const voluntarios = (membros ?? []).filter((m) => !!m.is_voluntario);
                const renderTable = (lista: typeof membrosNormais, emptyLabel: string) => (
                  <div className="flex-1 min-h-0 max-h-[55vh] overflow-auto rounded-md border">
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
                        {lista.length === 0 && !loadingMembros && (
                          <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">{emptyLabel}</TableCell></TableRow>
                        )}
                        {lista.map((m) => {
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
                );
                return (
                  <div className="flex flex-col h-full min-h-0 gap-3">
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => setAddMembroOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Adicionar membro
                      </Button>
                    </div>
                    <Tabs defaultValue="membros" className="flex flex-col flex-1 min-h-0">
                      <TabsList className="w-full">
                        <TabsTrigger value="membros" className="flex-1">Membros ({membrosNormais.length})</TabsTrigger>
                        <TabsTrigger value="voluntarios" className="flex-1">Voluntários ({voluntarios.length})</TabsTrigger>
                      </TabsList>
                      <TabsContent value="membros" className="pt-3 flex-1 min-h-0">
                        {renderTable(membrosNormais, "Sem membros")}
                      </TabsContent>
                      <TabsContent value="voluntarios" className="pt-3 flex-1 min-h-0">
                        {renderTable(voluntarios, "Sem voluntários")}
                      </TabsContent>
                    </Tabs>
                  </div>
                );
              })()}
            </TabsContent>

            {/* ── Projetos ── */}
            <TabsContent value="projetos" className="pt-4 flex-1 min-h-0 overflow-auto">
              {(() => {
                const lista = membros ?? [];
                const porProjeto = new Map<string, { nome: string; membros: { id: string; nome: string }[] }>();
                for (const m of lista) {
                  for (const pid of (m.projeto_ids ?? [])) {
                    const nome = projetosMap.get(pid) ?? "(projeto removido)";
                    const entry = porProjeto.get(pid) ?? { nome, membros: [] };
                    entry.membros.push({ id: m.id, nome: m.nome_completo });
                    porProjeto.set(pid, entry);
                  }
                }
                const resumo = Array.from(porProjeto.entries()).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
                const todosTemProjeto = (pid: string) => lista.length > 0 && lista.every((m) => (m.projeto_ids ?? []).includes(pid));
                return (
                  <div className="space-y-5">
                    <div className="rounded-md border p-4 space-y-3">
                      <div className="text-sm font-medium">Atribuir projeto a todos os membros</div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Select value={bulkProjetoId} onValueChange={setBulkProjetoId}>
                          <SelectTrigger className="sm:w-72"><SelectValue placeholder="Escolher projeto…" /></SelectTrigger>
                          <SelectContent>
                            {(projetosList ?? []).map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => bulkAssignProjeto.mutate({ projetoId: bulkProjetoId, action: "add" })}
                          disabled={!bulkProjetoId || lista.length === 0 || bulkAssignProjeto.isPending}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Atribuir a todos ({lista.length})
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Adiciona o projeto escolhido a todos os membros desta família. Membros que já estejam no projeto mantêm-se.
                      </p>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Resumo dos projetos</div>
                      {resumo.length === 0 ? (
                        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                          Nenhum membro está atribuído a projetos.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {resumo.map(([pid, info]) => (
                            <div key={pid} className="rounded-md border p-3 flex flex-col gap-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{info.nome}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {info.membros.length} de {lista.length} membro(s)
                                    {todosTemProjeto(pid) && " · todos"}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    if (confirm(`Remover o projeto "${info.nome}" de todos os membros desta família?`)) {
                                      bulkAssignProjeto.mutate({ projetoId: pid, action: "remove" });
                                    }
                                  }}
                                  disabled={bulkAssignProjeto.isPending}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" /> Remover de todos
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {info.membros.map((m) => (
                                  <Badge key={m.id} variant="secondary" className="text-[11px]">{m.nome}</Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </TabsContent>

            {/* ── Ações ── */}
            <TabsContent value="acoes" className="pt-4 flex-1 min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Inscrições dos membros desta família</span>
                <Button
                  size="sm"
                  onClick={() => {
                    setNovaAcao({ pessoa_id: (membros?.[0]?.id ?? ""), acao_id: "" });
                    setAddAcaoOpen(true);
                  }}
                  disabled={!membros || membros.length === 0}
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar ação
                </Button>
              </div>
              <div className="h-full max-h-[60vh] overflow-auto rounded-md border">
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

            {/* ── Atividades ── */}
            <TabsContent value="atividades" className="pt-4 flex-1 min-h-0 overflow-hidden">
              {family && <AtividadesFamiliaTab familiaId={family.id} />}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ── Add ação sub-dialog ── */}
      <Dialog open={addAcaoOpen} onOpenChange={setAddAcaoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar ação</DialogTitle>
            <DialogDescription>{family ? `Família: ${family.nome}` : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Membro</Label>
              <Select value={novaAcao.pessoa_id || undefined} onValueChange={(v) => setNovaAcao((s) => ({ ...s, pessoa_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Escolher membro…" /></SelectTrigger>
                <SelectContent>
                  {(membros ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ação</Label>
              <Select value={novaAcao.acao_id || undefined} onValueChange={(v) => setNovaAcao((s) => ({ ...s, acao_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Escolher ação…" /></SelectTrigger>
                <SelectContent>
                  {(acoesList ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}{a.data_inicio ? ` — ${formatDateBR(a.data_inicio)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addInscricaoFamilia.mutate()}
              disabled={!novaAcao.pessoa_id || !novaAcao.acao_id || addInscricaoFamilia.isPending}
            >
              {addInscricaoFamilia.isPending ? "A guardar…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add membro sub-dialog ── */}
      <Dialog open={addMembroOpen} onOpenChange={setAddMembroOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar membro</DialogTitle>
            <DialogDescription>{family ? `Família: ${family.nome}` : ""}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="individual" className="flex flex-col gap-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="individual">Individual</TabsTrigger>
              <TabsTrigger value="massa">Importar em massa</TabsTrigger>
            </TabsList>
            <TabsContent value="individual">
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
              <DialogFooter className="mt-4">
                <Button onClick={() => addMembro.mutate()} disabled={!novoMembro.nome_completo.trim() || addMembro.isPending}>
                  {addMembro.isPending ? "A guardar…" : "Adicionar"}
                </Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="massa">
              <div className="space-y-3">
                <Textarea
                  rows={10}
                  className="font-mono text-xs"
                  placeholder={BULK_MEMBROS_PLACEHOLDER}
                  value={bulkMembrosText}
                  onChange={(e) => setBulkMembrosText(e.target.value)}
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={bulkMembrosVoluntario}
                    onCheckedChange={(v) => setBulkMembrosVoluntario(!!v)}
                  />
                  Adicionar como voluntários
                </label>
                <p className="text-xs text-muted-foreground">
                  Colunas: nome, email, telefone, data_nascimento (AAAA-MM-DD), genero, cidade, nacionalidade, religiao, nif. Só o nome é obrigatório — deixa as restantes em branco entre vírgulas.
                </p>
              </div>
              <DialogFooter className="mt-4">
                <Button
                  onClick={() => bulkAddMembros.mutate()}
                  disabled={!bulkMembrosText.trim() || bulkAddMembros.isPending}
                >
                  {bulkAddMembros.isPending ? "A importar…" : "Importar"}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
