import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { useRelatorioPeriodData } from "@/lib/relatorios/use-periodo-dados";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

function fmt(d: string) { return new Date(d).toLocaleDateString("pt-PT"); }

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function MiniBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="truncate" title={label}>{label}</span>
        <span className="text-muted-foreground tabular-nums">{count}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function RelatorioDataPanel({
  inicio, fim,
}: { inicio: string; fim: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useRelatorioPeriodData(inicio, fim);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["relatorio-periodo"] });
  };

  return (
    <div data-relatorio-side className="space-y-4 p-4 border rounded-lg bg-card/40">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Período</div>
        <div className="text-xs font-medium mt-0.5">{fmt(inicio)} → {fmt(fim)}</div>
      </div>

      {isLoading || !data ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <>
          <section>
            <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Pessoas & Famílias</h4>
            <Row label="Pessoas (totais ativas)" value={data.pessoas_total} />
            <Row label="Famílias acompanhadas" value={data.familias_total} />
            <Row label="Novos registos no período" value={data.pessoas_novas} />
          </section>

          <section>
            <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Ações & Atividades</h4>
            <Row label="Ações realizadas" value={data.acoes_total} />
            <Row label="Participações totais" value={data.inscricoes_total} />
            <Row label="Participantes únicos" value={data.participantes_unicos} />
          </section>

          <section>
            <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Casos de Apoio</h4>
            <Row label="Casos abertos no período" value={data.casos_abertos} />
            <Row label="Casos concluídos" value={data.casos_concluidos} />
          </section>

          {data.por_projeto.length > 0 && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                Por Projeto <ChevronDown className="h-3 w-3" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 space-y-1.5">
                {data.por_projeto.slice(0, 6).map((p) => {
                  const max = Math.max(...data.por_projeto.map((x) => x.count));
                  return <MiniBar key={p.id} label={p.nome} count={p.count} max={max} />;
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {data.por_nacionalidade.length > 0 && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                Por Nacionalidade (top 5) <ChevronDown className="h-3 w-3" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 space-y-1.5">
                {data.por_nacionalidade.map((n) => {
                  const max = Math.max(...data.por_nacionalidade.map((x) => x.count));
                  return <MiniBar key={n.nome} label={n.nome} count={n.count} max={max} />;
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {data.por_area_caso.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Áreas de apoio</div>
              <div className="flex flex-wrap gap-1">
                {data.por_area_caso.map((a) => (
                  <Badge key={a.nome} variant="secondary" className="font-normal">
                    {a.nome} · {a.count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Button variant="outline" size="sm" className="w-full" onClick={refresh}>
        <RefreshCw className="me-2 h-3.5 w-3.5" /> Atualizar dados
      </Button>
    </div>
  );
}