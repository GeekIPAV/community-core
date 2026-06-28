import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/_admin/pedidos-ajuda")({
  head: () => ({ meta: [{ title: "Pedidos de ajuda — Meeru" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: PedidosAjudaPage,
});

function PedidosAjudaPage() {
  const [estado, setEstado] = useState<string>("todos");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["email-pedidos-historico", estado],
    queryFn: async () => {
      let q = supabase.from("email_pedidos_ajuda" as any).select("*").order("received_at", { ascending: false }).limit(200);
      if (estado !== "todos") q = q.eq("estado", estado);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const updMut = useMutation({
    mutationFn: async (vars: { id: string; estado: string }) => {
      const { error } = await supabase.from("email_pedidos_ajuda" as any).update({ estado: vars.estado }).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-pedidos-historico"] }),
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos de ajuda</h1>
          <p className="text-sm text-muted-foreground">Emails detetados como pedidos de ajuda de famílias.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os estados</SelectItem>
              <SelectItem value="novo">Novos</SelectItem>
              <SelectItem value="atribuido">Atribuídos</SelectItem>
              <SelectItem value="arquivado">Arquivados</SelectItem>
              <SelectItem value="ignorado">Ignorados</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild variant="outline"><Link to="/dashboard">Sincronizar no painel</Link></Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>Ordenado pelo mais recente.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem registos.</p>
          ) : (
            <ul className="divide-y">
              {data.map((p: any) => (
                <li key={p.id} className="py-3 flex flex-wrap items-start gap-3">
                  <Badge variant={p.score >= 75 ? "destructive" : p.score >= 55 ? "default" : "secondary"}>{p.score}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{p.subject || "(sem assunto)"}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.from_name || ""} &lt;{p.from_email}&gt; · {p.received_at ? new Date(p.received_at).toLocaleString("pt-PT") : ""}</div>
                    {p.resumo && <div className="text-xs mt-1 line-clamp-2">{p.resumo}</div>}
                  </div>
                  <Badge variant="outline">{p.estado}</Badge>
                  <div className="flex gap-1">
                    {p.estado !== "arquivado" && (
                      <Button size="sm" variant="ghost" onClick={() => updMut.mutate({ id: p.id, estado: "arquivado" })}>Arquivar</Button>
                    )}
                    {p.estado === "ignorado" || p.estado === "arquivado" ? (
                      <Button size="sm" variant="ghost" onClick={() => updMut.mutate({ id: p.id, estado: "novo" })}>Reabrir</Button>
                    ) : null}
                    {p.caso_id && (
                      <Button size="sm" variant="outline" asChild><Link to="/casos/$id" params={{ id: p.caso_id }}>Caso</Link></Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}