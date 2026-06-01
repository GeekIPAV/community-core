import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/_admin/bolsas-transporte")({
  component: BolsasTransportePage,
});

type Cidade = { id: string; nome: string; valor_sentido: number; ativo: boolean };

function BolsasTransportePage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<{ nome: string; valor: string; ativo: boolean }>({ nome: "", valor: "", ativo: true });
  const [editing, setEditing] = useState<Cidade | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["bolsas-cidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bolsas_cidades" as any)
        .select("id, nome, valor_sentido, ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Cidade[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["bolsas-cidades"] });

  const parseValor = (v: string) => {
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) throw new Error("Valor inválido");
    return Math.round(n * 100) / 100;
  };

  const create = useMutation({
    mutationFn: async () => {
      const valor = parseValor(form.valor);
      const nome = form.nome.trim();
      if (!nome) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("bolsas_cidades" as any).insert({ nome, valor_sentido: valor, ativo: form.ativo } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cidade adicionada"); invalidate(); setAddOpen(false); setForm({ nome: "", valor: "", ativo: true }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const nome = editing.nome.trim();
      if (!nome) throw new Error("Nome obrigatório");
      const { error } = await supabase
        .from("bolsas_cidades" as any)
        .update({ nome, valor_sentido: editing.valor_sentido, ativo: editing.ativo } as any)
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cidade atualizada"); invalidate(); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!deleteId) return;
      const { error } = await supabase.from("bolsas_cidades" as any).delete().eq("id", deleteId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cidade removida"); invalidate(); setDeleteId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("bolsas_cidades" as any).update({ ativo } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bolsa de Transporte</h1>
          <p className="text-sm text-muted-foreground">
            Valor por sentido (€) pago a cada participante de uma ação elegível. O total na inscrição é calculado como <span className="font-medium">valor × 2 × nº de pessoas</span>.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setForm({ nome: "", valor: "", ativo: true }); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nova cidade</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova cidade</DialogTitle>
              <DialogDescription>Adiciona uma cidade elegível para bolsa de transporte.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Braga" /></div>
              <div className="space-y-1"><Label>Valor por sentido (€)</Label><Input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="Ex: 3.5" inputMode="decimal" /></div>
              <label className="flex items-center justify-between rounded-md border p-2">
                <span className="text-sm">Ativa</span>
                <Switch checked={form.ativo} onCheckedChange={(c) => setForm({ ...form, ativo: c })} />
              </label>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem cidades configuradas.</p>}
          {data?.map((c) => (
            <Card key={c.id} className={c.ativo ? "" : "opacity-60"}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{c.nome}</CardTitle>
                    <CardDescription>
                      {c.valor_sentido.toFixed(2).replace(".", ",")}€ × 2 = <span className="font-semibold">{(c.valor_sentido * 2).toFixed(2).replace(".", ",")}€</span> por pessoa
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <label className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Ativa</span>
                  <Switch checked={c.ativo} onCheckedChange={(v) => toggleAtivo.mutate({ id: c.id, ativo: v })} />
                </label>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar cidade</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Nome</Label><Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Valor por sentido (€)</Label>
                <Input
                  value={String(editing.valor_sentido).replace(".", ",")}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    setEditing({ ...editing, valor_sentido: Number.isFinite(n) ? n : 0 });
                  }}
                  inputMode="decimal"
                />
              </div>
              <label className="flex items-center justify-between rounded-md border p-2">
                <span className="text-sm">Ativa</span>
                <Switch checked={editing.ativo} onCheckedChange={(c) => setEditing({ ...editing, ativo: c })} />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => update.mutate()} disabled={update.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cidade?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}