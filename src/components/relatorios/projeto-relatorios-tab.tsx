import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RelatorioNovoSheet } from "./relatorio-novo-sheet";
import { estadoColor, type Relatorio, type RelatorioEstado } from "@/lib/relatorios/types";

const periodoFmt = (a: string, b: string) =>
  `${new Date(a).toLocaleDateString("pt-PT", { month: "short", year: "numeric" })} → ${new Date(b).toLocaleDateString("pt-PT", { month: "short", year: "numeric" })}`;

export function ProjetoRelatoriosTab({ projetoId }: { projetoId: string }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["relatorios", "projeto", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relatorios" as any)
        .select("*")
        .or(`projeto_id.eq.${projetoId},projeto_ids.cs.{${projetoId}}`)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Relatorio[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Relatórios associados a este projeto.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="me-2 h-4 w-4" /> Novo relatório
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : (data?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Sem relatórios associados.
        </div>
      ) : (
        <div className="space-y-2">
          {data!.map((r) => (
            <Link
              key={r.id}
              to="/relatorios/$id"
              params={{ id: r.id }}
              className="flex flex-wrap items-center gap-3 rounded-md border p-3 hover:border-foreground/30 hover:bg-muted/30 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{r.titulo}</div>
                <div className="mt-0.5 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.financiador}</span>
                  <Badge variant="secondary" className="font-normal">{r.tipo}</Badge>
                  <span>{periodoFmt(r.periodo_inicio, r.periodo_fim)}</span>
                </div>
              </div>
              <span className={cn("inline-flex px-2 py-0.5 rounded-md text-xs font-medium", estadoColor[r.estado as RelatorioEstado])}>
                {r.estado}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}

      <RelatorioNovoSheet open={open} onOpenChange={setOpen} projetoIdDefault={projetoId} />
    </div>
  );
}