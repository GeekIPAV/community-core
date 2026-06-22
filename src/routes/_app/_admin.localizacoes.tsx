import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";

export const Route = createFileRoute("/_app/_admin/localizacoes")({
  component: LocalizacoesPage,
});

type Localizacao = {
  id: string;
  nome: string;
  link_mapa: string | null;
  proprietario: string | null;
  notas: string | null;
};

const EMPTY = { nome: "", link_mapa: "", proprietario: "", notas: "" };

function LocalizacoesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Localizacao | null>(null);
  const [form, setForm] = useState(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ["localizacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("localizacoes")
        .select("id, nome, link_mapa, proprietario, notas")
        .order("nome");
      if (error) throw error;
      return data as Localizacao[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["localizacoes"] });

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (l: Localizacao) => {
    setEditing(l);
    setForm({
      nome: l.nome,
      link_mapa: l.link_mapa ?? "",
      proprietario: l.proprietario ?? "",
      notas: l.notas ?? "",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome.trim(),
        link_mapa: form.link_mapa.trim() || null,
        proprietario: form.proprietario.trim() || null,
        notas: form.notas.trim() || null,
      };
      if (!payload.nome) throw new Error("Nome obrigatório");
      if (editing) {
        const { error } = await supabase
          .from("localizacoes")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("localizacoes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Localização atualizada" : "Localização criada");
      invalidate();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("localizacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Localização removida");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: unknown }) => {
      const { error } = await supabase
        .from("localizacoes")
        .update({ [field]: value } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const columns = useMemo<SmartColumnDef<Localizacao>[]>(
    () => [
      {
        id: "nome",
        accessorKey: "nome",
        header: "Nome",
        size: 240,
        meta: { label: "Nome", filterVariant: "text", editType: "text" },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2 truncate font-medium">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{row.original.nome}</span>
          </span>
        ),
      },
      {
        id: "proprietario",
        accessorKey: "proprietario",
        header: "Proprietário",
        size: 200,
        meta: { label: "Proprietário", filterVariant: "text", editType: "text", hideOnMobile: true },
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span>
        ),
      },
      {
        id: "link_mapa",
        accessorKey: "link_mapa",
        header: "Mapa",
        size: 160,
        enableSorting: false,
        meta: { label: "Mapa", editType: "text", hideOnMobile: true, noTruncate: true },
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? (
            <a
              href={v}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Ver no mapa <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        id: "notas",
        accessorKey: "notas",
        header: "Notas",
        size: 280,
        meta: { label: "Notas", filterVariant: "text", editType: "text", hideOnMobile: true },
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span>
        ),
      },
      {
        id: "_actions",
        header: "",
        size: 96,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        meta: { label: "Ações", noTruncate: true },
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row.original);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Remover "${row.original.nome}"?`)) remove.mutate(row.original.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [remove],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Localizações</h1>
          <p className="text-sm text-muted-foreground">
            {data?.length ?? 0} localizações disponíveis para eventos
          </p>
        </div>
      </div>

      <SmartTable
        tableId="localizacoes"
        columns={columns}
        data={data}
        isLoading={isLoading}
        editableColumns={["nome", "proprietario", "link_mapa", "notas"]}
        onCellEdit={(rowId, columnId, value) =>
          updateField.mutateAsync({ id: rowId, field: columnId, value })
        }
        toolbarActions={
          <Button size="sm" onClick={openNew} className="h-9">
            <Plus className="mr-2 h-4 w-4" /> Nova localização
          </Button>
        }
        emptyMessage="Sem localizações"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar localização" : "Nova localização"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Centro Comunitário"
              />
            </div>
            <div className="space-y-2">
              <Label>Link do mapa</Label>
              <Input
                value={form.link_mapa}
                onChange={(e) => setForm({ ...form, link_mapa: e.target.value })}
                placeholder="https://maps.google.com/…"
              />
            </div>
            <div className="space-y-2">
              <Label>Proprietário</Label>
              <Input
                value={form.proprietario}
                onChange={(e) => setForm({ ...form, proprietario: e.target.value })}
                placeholder="A quem pertence a localização"
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => save.mutate()}
              disabled={!form.nome.trim() || save.isPending}
            >
              {save.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}