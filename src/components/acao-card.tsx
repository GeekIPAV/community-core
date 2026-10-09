import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock3, MapPin, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RichTextView } from "@/components/rich-text-view";
import { AcaoCover } from "@/components/acao-cover";
import { acaoDateLabel, acaoPresentation, type AcaoTipo } from "@/lib/acao-presentation";

type PublicAcao = {
  id: string; nome: string; descricao: string | null; local: string | null; mapa_url: string | null;
  imagem_url: string | null; imagem_position: string | null; data_inicio: string | null; data_fim: string | null;
  inscricoes_abertas: boolean; tipo_acao?: AcaoTipo | null;
};

export function AcaoCard({ acao, passado }: { acao: PublicAcao; passado?: boolean }) {
  const date = acaoDateLabel(acao.data_inicio, acao.data_fim);
  const { Icon, tone } = acaoPresentation(acao.tipo_acao);
  const status = passado ? "Realizada" : acao.inscricoes_abertas ? "Inscrições abertas" : "Inscrições fechadas";
  return (
    <Card className="acao-card group relative flex h-full flex-col gap-0 overflow-hidden rounded-none border bg-card py-0 shadow-none">
      <Link to="/acao/$id" params={{ id: acao.id }} aria-label={`Ver ação: ${acao.nome}`} className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" />
      <div className="relative shrink-0 overflow-hidden">
        <AcaoCover nome={acao.nome} imagemUrl={acao.imagem_url} imagemPosition={acao.imagem_position} tipo={acao.tipo_acao} />
        <div className="acao-date absolute left-3 top-3 flex min-h-16 min-w-16 flex-col items-center justify-center px-3 py-2 text-center" aria-label={date.text}>
          {date.kind === "single" ? <><span className="text-3xl font-bold leading-none">{date.day}</span><span className="mt-1 text-xs font-semibold">{date.month}</span></> : <span className="max-w-48 text-xs font-semibold leading-relaxed">{date.text}</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex min-h-6 flex-wrap items-center gap-2">
          {acao.tipo_acao && <span className={`acao-chip inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold ${tone}`}><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{acao.tipo_acao.nome}</span>}
          <span className={`acao-chip px-2 py-1 text-xs font-semibold ${passado ? "acao-chip-sage" : acao.inscricoes_abertas ? "acao-chip-gold" : "acao-chip-muted"}`}>{status}</span>
        </div>
        <h3 className="line-clamp-2 min-h-14 break-words text-xl font-bold leading-7">{acao.nome}</h3>
        <div className="min-h-12 space-y-2 text-sm text-muted-foreground">
          {acao.data_inicio && <p className="flex items-start gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{new Date(acao.data_inicio).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}{acao.data_fim && new Date(acao.data_inicio).toDateString() === new Date(acao.data_fim).toDateString() ? ` – ${new Date(acao.data_fim).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}` : ""}</span></p>}
          {(acao.local || acao.mapa_url) && <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><div className="min-w-0 break-words">{acao.local}{acao.mapa_url && <a href={acao.mapa_url} target="_blank" rel="noopener noreferrer" className="relative z-20 ml-2 inline-flex items-center gap-1 text-foreground underline underline-offset-4">Mapa<ExternalLink className="h-3 w-3" /></a>}</div></div>}
        </div>
        {acao.descricao && <RichTextView className="line-clamp-2 text-sm leading-relaxed text-muted-foreground" html={acao.descricao} />}
        <Button asChild className="relative z-20 mt-auto h-10 w-full justify-between rounded-none px-3" variant={passado ? "secondary" : acao.inscricoes_abertas ? "default" : "outline"}>
          <Link to="/acao/$id" params={{ id: acao.id }}>{passado ? "Ver resumo" : acao.inscricoes_abertas ? "Ver e inscrever" : "Ver detalhes"}<ArrowUpRight className="h-4 w-4" /></Link>
        </Button>
      </div>
    </Card>
  );
}