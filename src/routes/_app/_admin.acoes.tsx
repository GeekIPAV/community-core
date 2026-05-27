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
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";

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
  descricao: string;
  data_inicio: string;
  data_fim: string;
  status: "ativa" | "cancelada" | "concluida";
  fields: FieldDef[];
};

const EMPTY_FORM: AcaoForm = { nome: "", local: "", descricao: "", data_inicio: "", data_fim: "", status: "ativa", fields: [] };

const STATUS_LABEL: Record<AcaoForm["status"], string> = {
  ativa: "Ativa",
  cancelada: "Cancelada",
  concluida: "Concluída",
};

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

function AcoesPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<AcaoForm>(EMPTY_FORM);

  const [editing, setEditing] = useState<(AcaoForm & { id: string }) | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["acoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("acoes").select("*").order("data_inicio", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["acoes"] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("acoes").insert({
        nome: form.nome,
        local: form.local || null,
        descricao: form.descricao || null,
        data_inicio: fromDtLocal(form.data_inicio),
        data_fim: fromDtLocal(form.data_fim),
        status: form.status,
        config_campos: { fields: form.fields },
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação criada");
      invalidate();
      setAddOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("acoes")
        .update({
          nome: editing.nome,
          local: editing.local || null,
          descricao: editing.descricao || null,
          data_inicio: fromDtLocal(editing.data_inicio),
          data_fim: fromDtLocal(editing.data_fim),
          status: editing.status,
          config_campos: { fields: editing.fields },
        } as any)
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação atualizada");
      invalidate();
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Local</Label><Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as AcaoForm["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABEL).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Data de início</Label><Input type="datetime-local" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
                <div className="space-y-2"><Label>Data de fim</Label><Input type="datetime-local" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
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
            return (
              <Card
                key={a.id}
                className="cursor-pointer transition-colors hover:bg-muted/30"
                onClick={() => setEditing({
                  id: a.id,
                  nome: a.nome ?? "",
                  local: a.local ?? "",
                  descricao: a.descricao ?? "",
                  data_inicio: toDtLocal(a.data_inicio),
                  data_fim: toDtLocal(a.data_fim),
                  status: ((a as any).status ?? "ativa") as AcaoForm["status"],
                  fields,
                })}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>{a.nome}</CardTitle>
                      <CardDescription>{a.local ?? "Sem local"}</CardDescription>
                    </div>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant={((a as any).status ?? "ativa") === "cancelada" ? "destructive" : "outline"}>
                      {STATUS_LABEL[((a as any).status ?? "ativa") as AcaoForm["status"]]}
                    </Badge>
                    {a.data_inicio && (
                      <span>
                        {new Date(a.data_inicio).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}
                        {a.data_fim ? ` → ${new Date(a.data_fim).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}` : ""}
                      </span>
                    )}
                  </div>
                  {a.descricao && <p className="line-clamp-2">{a.descricao}</p>}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {fields.length === 0 ? (
                      <span className="text-xs italic">Sem campos personalizados</span>
                    ) : (
                      fields.map((f) => (
                        <Badge key={f.key} variant="secondary" className="text-[10px]">
                          {f.label} · {TYPE_LABEL[f.type]}{f.required ? " *" : ""}
                        </Badge>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar ação</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Local</Label><Input value={editing.local} onChange={(e) => setEditing({ ...editing, local: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v as AcaoForm["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABEL).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Data de início</Label><Input type="datetime-local" value={editing.data_inicio} onChange={(e) => setEditing({ ...editing, data_inicio: e.target.value })} /></div>
                <div className="space-y-2"><Label>Data de fim</Label><Input type="datetime-local" value={editing.data_fim} onChange={(e) => setEditing({ ...editing, data_fim: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea value={editing.descricao} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} /></div>
              <FieldsEditor fields={editing.fields} setFields={(fields) => setEditing({ ...editing, fields })} />
            </div>
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