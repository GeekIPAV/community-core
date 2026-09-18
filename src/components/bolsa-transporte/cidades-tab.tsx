import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Car } from "lucide-react";
import { toast } from "sonner";
import { KM_RATE, TRIP_FACTOR } from "@/lib/bolsa-transporte";
import type { Cidade } from "./types";

export function CidadesTab() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<{ nome: string; valor: string; ativo: boolean }>({ nome: "", valor: "", ativo: true });
  const [editing, setEditing] = useState<Cidade | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: cidadesData, isLoading: loadingCidades } = useQuery({
    queryKey: ["bolsas-cidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bolsas_cidades")
        .select("id, nome, valor_sentido, ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Cidade[];
    },
  });

  const invalidateCidades = () => {
    qc.invalidateQueries({ queryKey: ["bolsas-cidades"] });
    qc.invalidateQueries({ queryKey: ["bolsas-pagamentos-full"] });
  };

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
      const { error } = await supabase.from("bolsas_cidades").insert({ nome, valor_sentido: valor, ativo: form.ativo });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cidade adicionada"); invalidateCidades(); setAddOpen(false); setForm({ nome: "", valor: "", ativo: true }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const nome = editing.nome.trim();
      if (!nome) throw new Error("Nome obrigatório");
      const { error } = await supabase
        .from("bolsas_cidades")
        .update({ nome, valor_sentido: editing.valor_sentido, ativo: editing.ativo })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cidade atualizada"); invalidateCidades(); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!deleteId) return;
      const { error } = await supabase.from("bolsas_cidades").delete().eq("id", deleteId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cidade removida"); invalidateCidades(); setDeleteId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("bolsas_cidades").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateCidades(),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Valor por sentido (€) pago a cada participante de uma ação elegível — total = <span className="font-medium">valor × 2 × nº de pessoas</span>.
        </p>
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

      <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-4 text-sm">
        <Car className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="font-medium">Viatura própria</p>
          <p className="text-muted-foreground">
            Quem vier na sua viatura própria recebe <span className="font-medium text-foreground">{KM_RATE.toString().replace(".", ",")}€/km × {TRIP_FACTOR}</span> (ida e volta), pago <span className="font-medium text-foreground">uma vez por carro</span> — pessoas com a mesma matrícula contam como um único carro.
          </p>
        </div>
      </div>

      {loadingCidades ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(cidadesData ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem cidades configuradas.</p>}
          {cidadesData?.map((c) => (
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
    </>
  );
}
