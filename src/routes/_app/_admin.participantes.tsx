import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_app/_admin/participantes")({
  component: ParticipantesPage,
});

function ParticipantesPage() {
  const [q, setQ] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["pessoas_com_stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas_com_stats" as any)
        .select("*")
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    if (!s) return data;
    return data.filter((p) =>
      [p.nome_completo, p.email, p.telefone].filter(Boolean).some((v: string) => v.toLowerCase().includes(s)),
    );
  }, [data, q]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Participantes</h1>
          <p className="text-sm text-muted-foreground">Fonte: vista <code>pessoas_com_stats</code></p>
        </div>
        <Input placeholder="Pesquisar…" className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {!isLoading && !error && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Inscrições</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Sem resultados</TableCell>
                </TableRow>
              )}
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome_completo}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.telefone ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{p.tipo_participante ?? "—"}</Badge></TableCell>
                  <TableCell>{p.inscricoes_count ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "ativo" ? "default" : p.status === "suspeito_duplicado" ? "destructive" : "outline"}>
                      {p.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}