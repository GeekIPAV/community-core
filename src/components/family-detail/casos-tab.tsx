import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FolderOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDateBR } from "@/lib/utils";
import { CasoNovoSheet } from "@/components/caso-novo-sheet";

export function CasosFamiliaTab({ familiaId }: { familiaId: string }) {
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const { data: casos = [], isLoading } = useQuery({
    queryKey: ["familia-casos", familiaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("casos_apoio")
        .select("id, numero, titulo, area, estado, prioridade, data_abertura, pessoa:pessoas!casos_apoio_pessoa_id_fkey(nome_completo), mediadora:pessoas!casos_apoio_mediadora_id_fkey(nome_completo)")
        .eq("familia_id", familiaId)
        .order("data_abertura", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const novoSheet = (
    <CasoNovoSheet
      open={novoOpen}
      onOpenChange={setNovoOpen}
      mode="staff"
      familiaId={familiaId}
      onCreated={() => qc.invalidateQueries({ queryKey: ["familia-casos", familiaId] })}
    />
  );

  const header = (
    <div className="flex items-center justify-end">
      <Button size="sm" onClick={() => setNovoOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> Novo caso
      </Button>
    </div>
  );

  if (isLoading) return <div className="text-sm text-muted-foreground">A carregar…</div>;
  if (casos.length === 0) {
    return (
      <div className="space-y-3">
        {header}
        <div className="rounded-md border p-8 text-center space-y-2">
          <FolderOpen className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">Sem casos de apoio para esta família.</p>
        </div>
        {novoSheet}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {header}
      <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Área</TableHead>
            <TableHead>Pessoa</TableHead>
            <TableHead>Mediadora</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Abertura</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {casos.map((c) => (
            <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => window.open(`/casos/${c.id}`, "_self")}>
              <TableCell className="font-mono text-xs">
                <Link to="/casos/$id" params={{ id: c.id }} className="text-primary hover:underline">{c.numero}</Link>
              </TableCell>
              <TableCell className="font-medium">{c.titulo}</TableCell>
              <TableCell><Badge variant="outline">{c.area}</Badge></TableCell>
              <TableCell>{c.pessoa?.nome_completo ?? <Badge variant="outline" className="font-normal">Família</Badge>}</TableCell>
              <TableCell>{c.mediadora?.nome_completo ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell><Badge variant="secondary">{c.estado}</Badge></TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatDateBR(c.data_abertura)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
      {novoSheet}
    </div>
  );
}
