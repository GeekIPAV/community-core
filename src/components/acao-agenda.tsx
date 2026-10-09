import { Link } from "@tanstack/react-router";
import { MapPin, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PublicAcao } from "@/components/acao-card";
import { acaoPresentation } from "@/lib/acao-presentation";

export function AcaoAgenda({ dias }: { dias: Map<string, PublicAcao[]> }) {
  const months = new Map<string, { date: Date; acoes: PublicAcao[] }[]>();
  for (const [key, acoes] of [...dias.entries()].sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())) {
    const date = new Date(key);
    const month = date.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
    months.set(month, [...(months.get(month) ?? []), { date, acoes }]);
  }
  return <div className="space-y-8 sm:hidden" aria-label="Agenda de ações">
    {months.size === 0 && <p className="text-sm text-muted-foreground">Ainda não há ações com data marcada.</p>}
    {[...months.entries()].map(([month, days]) => <section key={month} className="space-y-4">
      <h2 className="border-b pb-2 text-lg font-semibold capitalize">{month}</h2>
      {days.map(({ date, acoes }) => <div key={date.toDateString()} className="grid grid-cols-[3rem_1fr] gap-3">
        <div className="pt-1 text-center"><p className="text-2xl font-semibold">{date.getDate()}</p><p className="text-xs text-muted-foreground">{date.toLocaleDateString("pt-PT", { weekday: "short" })}</p></div>
        <div className="min-w-0 space-y-3">{acoes.map((acao) => {
          const { Icon, tone } = acaoPresentation(acao.tipo_acao);
          return <Link key={acao.id} to="/acao/$id" params={{ id: acao.id }} className="block space-y-2 rounded-lg border bg-card p-3 transition-colors hover:bg-accent">
            <Badge variant="outline" className={`max-w-full gap-1.5 ${tone}`}><Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{acao.tipo_acao?.nome ?? "Ação"}</span></Badge>
            <h3 className="break-words text-sm font-semibold">{acao.nome}</h3>
            {acao.data_inicio && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5 shrink-0" />{new Date(acao.data_inicio).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</p>}
            {acao.local && <p className="flex items-start gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="break-words">{acao.local}</span></p>}
          </Link>;
        })}</div>
      </div>)}
    </section>)}
  </div>;
}