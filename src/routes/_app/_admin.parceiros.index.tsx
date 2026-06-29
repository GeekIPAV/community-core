import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { InlineMultiSelect } from "@/components/inline-edit";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";
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

export const Route = createFileRoute("/_app/_admin/parceiros/")({
  component: ParceirosPage,
});

export type Parceiro = {
  id: string;
  nome: string;
  tipo: string | null;
  estado: string;
  pessoa_contacto: string | null;
  email_contacto: string | null;
  notas: string | null;
};

export const TIPOS_PARCEIRO = ["Institucional", "Financiador", "Comunitário", "Outro"];
export const ESTADOS_PARCEIRO = ["Ativa", "Em negociação", "Inativa"];

export function tipoBadgeClass(tipo: string | null) {
  switch (tipo) {
    case "Institucional": return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
    case "Financiador": return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "Comunitário": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function estadoBadgeClass(estado: string) {
  switch (estado) {
    case "Ativa": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "Em negociação": return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function ParceirosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Parceiro | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);

  const { data: parceiros, isLoading } = useQuery({
    queryKey: ["parceiros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parceiros")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Parceiro[];
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["parceiros", "projeto-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parceiro_projetos").select("parceiro_id");
      if (error) throw error;
      const m = new Map<string, number>();
      for (const r of (data ?? []) as { parceiro_id: string }[]) {
        m.set(r.parceiro_id, (m.get(r.parceiro_id) ?? 0) + 1);
      }
      return m;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parceiros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Parceiro removido"); qc.invalidateQueries({ queryKey: ["parceiros"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (p: Parceiro) => { setEditing(p); setOpen(true); };

  const columns = useMemo<SmartColumnDef<Parceiro>[]>(() => [
    {
      id: "nome",
      accessorKey: "nome",
      header: "Nome",
      size: 240,
      meta: { label: "Nome", filterVariant: "text", editType: "text" },
      cell: ({ row }) => (
        <Link
          to="/parceiros/$parceiroId"
          params={{ parceiroId: row.original.id }}
          className="font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.nome}
        </Link>
      ),
    },
    {
      id: "tipo",
      accessorKey: "tipo",
      header: "Tipo",
      size: 140,
      meta: {
        label: "Tipo",
        filterVariant: "select",
        filterOptions: TIPOS_PARCEIRO,
        editType: "select",
        editSelectOptions: TIPOS_PARCEIRO.map((t) => ({ value: t, label: t })),
      },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <Badge variant="outline" className={tipoBadgeClass(v)}>{v}</Badge> : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: "estado",
      accessorKey: "estado",
      header: "Estado",
      size: 140,
      meta: {
        label: "Estado",
        filterVariant: "select",
        filterOptions: ESTADOS_PARCEIRO,
        editType: "select",
        editSelectOptions: ESTADOS_PARCEIRO.map((t) => ({ value: t, label: t })),
      },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <Badge variant="outline" className={estadoBadgeClass(v)}>{v}</Badge>;
      },
    },
    {
      id: "pessoa_contacto",
      accessorKey: "pessoa_contacto",
      header: "Contacto",
      size: 180,
      meta: { label: "Contacto", filterVariant: "text", editType: "text" },
      cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span>,
    },
    {
      id: "email_contacto",
      accessorKey: "email_contacto",
      header: "Email",
      size: 220,
      meta: { label: "Email", filterVariant: "text", editType: "text" },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? (
          <a href={`mailto:${v}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{v}</a>
        ) : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: "projetos",
      header: "Projetos",
      size: 100,
      enableSorting: true,
      accessorFn: (r) => counts?.get(r.id) ?? 0,
      meta: { label: "Projetos", filterVariant: "number" },
      cell: ({ getValue }) => (
        <span className="inline-flex h-6 min-w-8 items-center justify-center rounded-full bg-muted px-2 text-xs font-medium tabular-nums">
          {(getValue() as number) ?? 0}
        </span>
      ),
    },
    {
      id: "_actions",
      header: "",
      size: 80,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: { label: "Ações", noTruncate: true },
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row.original); }} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); if (confirm(`Remover "${row.original.nome}"?`)) remove.mutate(row.original.id); }}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ], [counts, remove]);

  const handleCellEdit = async (rowId: string, columnId: string, value: unknown) => {
    const { error } = await supabase
      .from("parceiros")
      .update({ [columnId]: value === "" ? null : value } as any)
      .eq("id", rowId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["parceiros"] });
  };

  const handleBulkEdit = async (ids: string[], patch: Record<string, unknown>) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) clean[k] = v === "" ? null : v;
    const { error } = await supabase.from("parceiros").update(clean as any).in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} parceiro(s) atualizados`);
    qc.invalidateQueries({ queryKey: ["parceiros"] });
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteIds) return;
    const { error } = await supabase.from("parceiros").delete().in("id", bulkDeleteIds);
    if (error) { toast.error(error.message); return; }
    toast.success(`${bulkDeleteIds.length} parceiro(s) eliminados`);
    qc.invalidateQueries({ queryKey: ["parceiros"] });
    setBulkDeleteIds(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Parceiros</h1>
          <p className="text-sm text-muted-foreground">{parceiros?.length ?? 0} parceiros</p>
        </div>
      </div>

      <SmartTable
        tableId="parceiros-v1"
        columns={columns}
        data={parceiros}
        isLoading={isLoading}
        editableColumns={["nome", "tipo", "estado", "pessoa_contacto", "email_contacto"]}
        onCellEdit={handleCellEdit}
        enableSelection
        onBulkEdit={handleBulkEdit}
        onBulkDelete={(ids) => setBulkDeleteIds(ids)}
        exportFilename="parceiros"
        emptyMessage="Sem parceiros"
        toolbarActions={
          <>
            <Button size="sm" variant="outline" className="h-9" onClick={() => setImportOpen(true)}>
              Importar (colar)
            </Button>
            <Button size="sm" onClick={openNew} className="h-9">
              <Plus className="mr-2 h-4 w-4" /> Novo parceiro
            </Button>
          </>
        }
      />

      <ParceiroDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["parceiros"] })}
      />
      <ParceirosImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => qc.invalidateQueries({ queryKey: ["parceiros"] })}
      />

      <AlertDialog open={!!bulkDeleteIds} onOpenChange={(o) => !o && setBulkDeleteIds(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar {bulkDeleteIds?.length ?? 0} parceiros?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmBulkDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ParceiroDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Parceiro | null;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [estado, setEstado] = useState("Ativa");
  const [contacto, setContacto] = useState("");
  const [email, setEmail] = useState("");
  const [notas, setNotas] = useState("");
  const [projetoIds, setProjetoIds] = useState<string[]>([]);

  const { data: projetos } = useQuery({
    queryKey: ["projetos", "lista-parceiro"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const { data: existentes } = useQuery({
    queryKey: ["parceiro-projetos", editing?.id],
    enabled: !!editing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parceiro_projetos")
        .select("projeto_id")
        .eq("parceiro_id", editing!.id);
      if (error) throw error;
      return ((data ?? []) as { projeto_id: string }[]).map((r) => r.projeto_id);
    },
  });

  useEffect(() => {
    if (!open) return;
    setNome(editing?.nome ?? "");
    setTipo(editing?.tipo ?? "");
    setEstado(editing?.estado ?? "Ativa");
    setContacto(editing?.pessoa_contacto ?? "");
    setEmail(editing?.email_contacto ?? "");
    setNotas(editing?.notas ?? "");
    setProjetoIds(existentes ?? []);
  }, [open, editing, existentes]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: nome.trim(),
        tipo: tipo || null,
        estado,
        pessoa_contacto: contacto.trim() || null,
        email_contacto: email.trim() || null,
        notas: notas.trim() || null,
      };
      let id = editing?.id;
      if (editing) {
        const { error } = await supabase.from("parceiros").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("parceiros").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      if (id) {
        await supabase.from("parceiro_projetos").delete().eq("parceiro_id", id);
        if (projetoIds.length > 0) {
          const { error } = await supabase
            .from("parceiro_projetos")
            .insert(projetoIds.map((pid) => ({ parceiro_id: id!, projeto_id: pid })));
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Parceiro atualizado" : "Parceiro criado");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar parceiro" : "Novo parceiro"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo || "__none"} onValueChange={(v) => setTipo(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {TIPOS_PARCEIRO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS_PARCEIRO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Pessoa de contacto</Label>
            <Input value={contacto} onChange={(e) => setContacto(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email de contacto</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Projetos associados</Label>
            <InlineMultiSelect
              values={projetoIds}
              options={(projetos ?? []).map((p) => ({ value: p.id, label: p.nome }))}
              onSave={(v) => setProjetoIds(v)}
              placeholder="Sem projetos"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea rows={4} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!nome.trim() || save.isPending}>
            {save.isPending ? "A guardar…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParceirosImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
}) {
  const [text, setText] = useState("");

  const parsed = useMemo(() => parsePastedParceiros(text), [text]);

  const importMut = useMutation({
    mutationFn: async () => {
      if (parsed.rows.length === 0) throw new Error("Nada para importar");
      const { error } = await supabase.from("parceiros").insert(parsed.rows);
      if (error) throw error;
      return parsed.rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} parceiro(s) importado(s)`);
      setText("");
      onImported();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar parceiros (colar)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cola dados de uma folha de cálculo ou texto. Colunas suportadas (separadas por tab, vírgula ou ponto-e-vírgula):
            <span className="font-mono"> nome, tipo, estado, contacto, email, notas</span>. Se só houver uma coluna, é usada como nome.
            A primeira linha pode ser cabeçalho.
          </p>
          <Textarea
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Nome\tTipo\tEstado\tContacto\tEmail\nACME\tInstitucional\tAtiva\tJoão\tjoao@acme.pt"}
            className="font-mono text-xs"
          />
          <div className="text-xs text-muted-foreground">
            {parsed.rows.length} linha(s) válida(s)
            {parsed.skipped > 0 ? ` · ${parsed.skipped} ignorada(s)` : ""}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => importMut.mutate()} disabled={parsed.rows.length === 0 || importMut.isPending}>
            {importMut.isPending ? "A importar…" : `Importar ${parsed.rows.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parsePastedParceiros(text: string): {
  rows: Array<Omit<Parceiro, "id">>;
  skipped: number;
} {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { rows: [], skipped: 0 };

  const splitLine = (l: string): string[] => {
    if (l.includes("\t")) return l.split("\t").map((s) => s.trim());
    if (l.includes(";")) return l.split(";").map((s) => s.trim());
    if (l.includes(",")) return l.split(",").map((s) => s.trim());
    return [l.trim()];
  };

  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  const known = ["nome", "tipo", "estado", "contacto", "pessoa_contacto", "email", "email_contacto", "notas"];
  const hasHeader = header.some((h) => known.includes(h));
  const startIdx = hasHeader ? 1 : 0;

  const map = (key: string) => header.findIndex((h) => h === key);
  const idx = hasHeader
    ? {
        nome: map("nome"),
        tipo: map("tipo"),
        estado: map("estado"),
        contacto: Math.max(map("contacto"), map("pessoa_contacto")),
        email: Math.max(map("email"), map("email_contacto")),
        notas: map("notas"),
      }
    : { nome: 0, tipo: 1, estado: 2, contacto: 3, email: 4, notas: 5 };

  const rows: Array<Omit<Parceiro, "id">> = [];
  let skipped = 0;
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const nome = idx.nome >= 0 ? cols[idx.nome] : cols[0];
    if (!nome || !nome.trim()) { skipped++; continue; }
    const tipoRaw = idx.tipo >= 0 ? cols[idx.tipo] : undefined;
    const estadoRaw = idx.estado >= 0 ? cols[idx.estado] : undefined;
    const tipo = tipoRaw && TIPOS_PARCEIRO.find((t) => t.toLowerCase() === tipoRaw.toLowerCase()) || null;
    const estado = (estadoRaw && ESTADOS_PARCEIRO.find((t) => t.toLowerCase() === estadoRaw.toLowerCase())) || "Ativa";
    rows.push({
      nome: nome.trim(),
      tipo,
      estado,
      pessoa_contacto: (idx.contacto >= 0 ? cols[idx.contacto] : "")?.trim() || null,
      email_contacto: (idx.email >= 0 ? cols[idx.email] : "")?.trim() || null,
      notas: (idx.notas >= 0 ? cols[idx.notas] : "")?.trim() || null,
    });
  }
  return { rows, skipped };
}