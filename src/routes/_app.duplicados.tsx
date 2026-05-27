import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/duplicados")({
  component: DuplicadosPage,
});

function DuplicadosPage() {
  const qc = useQueryClient();

  const { data: suspeitos, isLoading } = useQuery({
    queryKey: ["pessoas", "suspeitos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pessoas").select("*").eq("status", "suspeito_duplicado").order("nome_completo");
      if (error) throw error;
      return data;
    },
  });

  const { data: ativos } = useQuery({
    queryKey: ["pessoas", "ativos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pessoas").select("id, nome_completo, email").eq("status", "ativo").order("nome_completo");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Duplicados</h1>
        <p className="text-sm text-muted-foreground">Perfis marcados pelo soft-match. Funde para um principal.</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (suspeitos ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem suspeitos de duplicação 🎉</p>
      ) : (
        <div className="space-y-3">
          {suspeitos?.map((p) => (
            <DuplicadoCard key={p.id} pessoa={p} candidatos={ativos ?? []} onMerged={() => qc.invalidateQueries()} />
          ))}
        </div>
      )}
    </div>
  );
}

function DuplicadoCard({ pessoa, candidatos, onMerged }: { pessoa: any; candidatos: any[]; onMerged: () => void }) {
  const [principal, setPrincipal] = useState<string>("");

  const fundir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("fundir_perfis", { principal, duplicado: pessoa.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Perfis fundidos"); onMerged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{pessoa.nome_completo}</CardTitle>
            <CardDescription>{pessoa.email ?? "sem email"} · {pessoa.data_nascimento ?? "sem data nasc."}</CardDescription>
          </div>
          <Badge variant="destructive">suspeito</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Fundir em perfil principal</label>
          <Select value={principal} onValueChange={setPrincipal}>
            <SelectTrigger><SelectValue placeholder="Escolher principal…" /></SelectTrigger>
            <SelectContent>
              {candidatos.filter((c) => c.id !== pessoa.id).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome_completo} {c.email ? `· ${c.email}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button disabled={!principal || fundir.isPending} onClick={() => fundir.mutate()}>
          {fundir.isPending ? "A fundir…" : "Fundir"}
        </Button>
      </CardContent>
    </Card>
  );
}