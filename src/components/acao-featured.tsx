import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MapPin, Clock3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AcaoCover } from "@/components/acao-cover";
import type { PublicAcao } from "@/components/acao-card";
import { RichTextView } from "@/components/rich-text-view";
import { acaoDateLabel, acaoPresentation } from "@/lib/acao-presentation";

export function AcaoFeatured({ acao, passado = false, participantes }: { acao: PublicAcao; passado?: boolean; participantes?: number }) {
  const date = acaoDateLabel(acao.data_inicio, acao.data_fim);
  const { Icon, tone } = acaoPresentation(acao.tipo_acao);
  return (
    <article aria-label={passado ? "Última ação realizada" : "Próxima ação em destaque"} className="grid overflow-hidden border bg-card md:grid-cols-[3fr_2fr]">
      <Link to="/acao/$id" params={{ id: acao.id }} className="relative block min-w-0 overflow-hidden" aria-label={`Ver ação: ${acao.nome}`}>
        <AcaoCover nome={acao.nome} imagemUrl={acao.imagem_url} imagemPosition={acao.imagem_position} tipo={acao.tipo_acao} className="h-full min-h-56" />
        <div className="acao-date absolute left-4 top-4 flex min-h-20 min-w-20 flex-col items-center justify-center px-4 py-3 text-center" aria-label={date.text}>
          {date.kind === "single" ? <><span className="text-4xl font-bold leading-none">{date.day}</span><span className="mt-2 text-sm font-semibold">{date.month}</span></> : <span className="max-w-48 text-sm font-semibold">{date.text}</span>}
        </div>
      </Link>
      <div className="flex min-w-0 flex-col items-start gap-4 p-6 lg:p-8">
        <div className="flex flex-wrap gap-2">
          {acao.tipo_acao && <span className={`inline-flex items-center gap-2 px-2 py-1 text-xs font-semibold ${tone}`}><Icon className="h-4 w-4" />{acao.tipo_acao.nome}</span>}
          {passado && <span className="acao-chip-sage px-2 py-1 text-xs font-semibold">Realizada</span>}
        </div>
        <h2 className="break-words text-2xl font-bold leading-tight lg:text-3xl">{acao.nome}</h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          {acao.local && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0 break-words">{acao.local}</span></p>}
          {acao.data_inicio && <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 shrink-0" />{new Date(acao.data_inicio).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</p>}
          {passado && participantes !== undefined && participantes > 0 && <p className="flex items-center gap-2"><Users className="h-4 w-4 shrink-0" />{participantes} {participantes === 1 ? "participante" : "participantes"}</p>}
        </div>
        {acao.descricao && <RichTextView html={acao.descricao} className="line-clamp-4 text-base leading-relaxed text-muted-foreground" />}
        <Button asChild variant={passado ? "secondary" : "default"} className="mt-auto h-11 gap-3 rounded-none">
          <Link to="/acao/$id" params={{ id: acao.id }}>{passado ? "Ver resumo" : acao.inscricoes_abertas ? "Inscrever-me" : "Ver detalhes"}<ArrowUpRight className="h-4 w-4" /></Link>
        </Button>
      </div>
    </article>
  );
}