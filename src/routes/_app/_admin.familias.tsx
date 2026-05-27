import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_app/_admin/familias")({
  component: FamiliasPage,
});

function FamiliasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [notas, setNotas] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["familias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("familias").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("familias").insert({ nome, notas: notas || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Família criada");
      qc.invalidateQueries({ queryKey: ["familias"] });
      setOpen(false);
      setNome("");
      setNotas("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Famílias</h1>
          <p className="text-sm text-muted-foreground">Agrupamento de pessoas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nova família</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova família</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notas">Notas</Label>
                <Textarea id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!nome || create.isPending}>
                {create.isPending ? "A guardar…" : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Nome</TableHead><TableHead>Notas</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Sem famílias</TableCell></TableRow>
              )}
              {data?.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{f.notas ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}