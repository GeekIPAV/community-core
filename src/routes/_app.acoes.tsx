import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_app/acoes")({
  component: AcoesPage,
});

function AcoesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [configJson, setConfigJson] = useState('{\n  "transporte": "boolean",\n  "alergias": "text"\n}');

  const { data, isLoading } = useQuery({
    queryKey: ["acoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("acoes").select("*").order("data_inicio", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      let config_campos: any = {};
      try { config_campos = JSON.parse(configJson || "{}"); } catch { throw new Error("JSON inválido em config_campos"); }
      const { error } = await supabase.from("acoes").insert({
        nome, local: local || null, descricao: descricao || null, config_campos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação criada");
      qc.invalidateQueries({ queryKey: ["acoes"] });
      setOpen(false);
      setNome(""); setLocal(""); setDescricao("");
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nova ação</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova ação</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
              <div className="space-y-2"><Label>Local</Label><Input value={local} onChange={(e) => setLocal(e.target.value)} /></div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Config campos (JSON)</Label>
                <Textarea className="font-mono text-xs" rows={6} value={configJson} onChange={(e) => setConfigJson(e.target.value)} />
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
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem ações.</p>}
          {data?.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle>{a.nome}</CardTitle>
                <CardDescription>{a.local ?? "Sem local"}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                {a.descricao && <p>{a.descricao}</p>}
                <pre className="rounded bg-muted p-2 text-xs overflow-auto">{JSON.stringify(a.config_campos, null, 2)}</pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}