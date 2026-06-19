import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/_admin/eliminados")({
  component: EliminadosPage,
});

type PessoaDel = { id: string; nome_completo: string; email: string | null; deleted_at: string };
type FamiliaDel = { id: string; nome: string; status: string | null; deleted_at: string };

function fmt(d: string) {
  try { return new Date(d).toLocaleString("pt-PT"); } catch { return d; }
}

function EliminadosPage() {
  const qc = useQueryClient();
  const [purge, setPurge] = useState<{ kind: "pessoa" | "familia"; id: string; nome: string } | null>(null);

  const pessoas = useQuery({
    queryKey: ["eliminados", "pessoas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PessoaDel[];
    },
  });

  const familias = useQuery({
    queryKey: ["eliminados", "familias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familias")
        .select("id, nome, status, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FamiliaDel[];
    },
  });

  const restorePessoa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pessoas").update({ deleted_at: null } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Participante restaurado");
      qc.invalidateQueries({ queryKey: ["eliminados", "pessoas"] });
      qc.invalidateQueries({ queryKey: ["pessoas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreFamilia = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("familias").update({ deleted_at: null } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Família restaurada");
      qc.invalidateQueries({ queryKey: ["eliminados", "familias"] });
      qc.invalidateQueries({ queryKey: ["familias"] });
      qc.invalidateQueries({ queryKey: ["familias_lookup"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const purgePessoa = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("inscricoes").delete().eq("pessoa_id", id);
      const { error } = await supabase.from("pessoas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Participante eliminado permanentemente");
      qc.invalidateQueries({ queryKey: ["eliminados", "pessoas"] });
      setPurge(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const purgeFamilia = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("familias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Família eliminada permanentemente");
      qc.invalidateQueries({ queryKey: ["eliminados", "familias"] });
      setPurge(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Eliminados</h1>
        <p className="text-sm text-muted-foreground">
          Participantes e famílias eliminadas. Podes restaurar ou eliminar permanentemente.
        </p>
      </div>

      <Tabs defaultValue="participantes">
        <TabsList>
          <TabsTrigger value="participantes">
            Participantes {pessoas.data ? `(${pessoas.data.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="familias">
            Famílias {familias.data ? `(${familias.data.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="participantes" className="mt-6">
          {pessoas.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !pessoas.data || pessoas.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem participantes eliminados.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Eliminado em</TableHead>
                    <TableHead className="w-[180px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pessoas.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nome_completo}</TableCell>
                      <TableCell className="text-muted-foreground">{p.email ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{fmt(p.deleted_at)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => restorePessoa.mutate(p.id)}
                          disabled={restorePessoa.isPending}
                        >
                          <RotateCcw className="h-4 w-4 me-1" />
                          Restaurar
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Eliminar permanentemente"
                          onClick={() => setPurge({ kind: "pessoa", id: p.id, nome: p.nome_completo })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="familias" className="mt-6">
          {familias.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !familias.data || familias.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem famílias eliminadas.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Eliminada em</TableHead>
                    <TableHead className="w-[180px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {familias.data.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{f.status ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{fmt(f.deleted_at)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => restoreFamilia.mutate(f.id)}
                          disabled={restoreFamilia.isPending}
                        >
                          <RotateCcw className="h-4 w-4 me-1" />
                          Restaurar
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Eliminar permanentemente"
                          onClick={() => setPurge({ kind: "familia", id: f.id, nome: f.nome })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!purge} onOpenChange={(o) => !o && setPurge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Vais eliminar <strong>{purge?.nome}</strong> de forma permanente. Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!purge) return;
                if (purge.kind === "pessoa") purgePessoa.mutate(purge.id);
                else purgeFamilia.mutate(purge.id);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}