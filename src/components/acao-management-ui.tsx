import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Users, Pencil, AlertTriangle, Globe, LockKeyhole, FolderLock, Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AcaoCover } from "@/components/acao-cover";
import { AcaoCard, type PublicAcao } from "@/components/acao-card";
import { acaoDateLabel, acaoPresentation, type AcaoTipo } from "@/lib/acao-presentation";
import { acaoQualityWarnings, type AcaoQualityData } from "@/lib/acao-management";

export type ManagedAcao = AcaoQualityData & {
  id: string; nome: string; status: string; publico: boolean; restrito_a_projetos: boolean;
  bolsa_transporte: boolean; imagem_position?: string | null; participantes_extra?: number;
};

export function useAcaoManagementView(userId?: string) {
  const [view, setView] = useState("lista");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    try {
      const stored = localStorage.getItem(`acoes-view:${userId}`);
      setView(stored === "tabela" || stored === "lista" ? stored : "lista");
    } catch { setView("lista"); }
    setLoadedFor(userId);
  }, [userId]);
  const changeView = (next: string) => {
    setView(next);
    if (!userId || loadedFor !== userId || next === "planeamento") return;
    try { localStorage.setItem(`acoes-view:${userId}`, next); } catch { /* Storage can be unavailable. */ }
  };
  return [view, changeView] as const;
}

export function AcaoWarnings({ acao }: { acao: AcaoQualityData }) {
  const warnings = acaoQualityWarnings(acao);
  if (!warnings.length) return null;
  return <TooltipProvider delayDuration={150}><Tooltip><TooltipTrigger asChild>
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" aria-label={`${warnings.length} avisos: ${warnings.map(w => w.message).join(", ")}`}>
      <AlertTriangle className="h-4 w-4" />
    </Button>
  </TooltipTrigger><TooltipContent className="max-w-64"><ul className="space-y-1">{warnings.map(w => <li key={w.field}>{w.message}</li>)}</ul></TooltipContent></Tooltip></TooltipProvider>;
}

export function AcaoFieldWarning({ acao, field }: { acao: AcaoQualityData; field: string }) {
  const warning = acaoQualityWarnings(acao).find(w => w.field === field);
  if (!warning) return null;
  return <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{warning.message}</span></p>;
}

export function AcaoManagementBadges({ acao, tipo }: { acao: ManagedAcao; tipo?: AcaoTipo | null }) {
  const { Icon, tone } = acaoPresentation(tipo);
  const labels: Record<string, string> = { ativa: "Ativa", cancelada: "Cancelada", concluida: "Terminada", rascunho: "Rascunho" };
  return <div className="flex flex-wrap items-center gap-1.5">
    <Badge variant="outline" className={`gap-1 ${tone}`}><Icon className="h-3 w-3 shrink-0" />{tipo?.nome ?? "Sem tipo"}</Badge>
    <Badge variant={acao.status === "ativa" ? "secondary" : "outline"}>{labels[acao.status] ?? acao.status}</Badge>
    <Badge variant={acao.inscricoes_abertas ? "default" : "outline"}>{acao.inscricoes_abertas ? "Inscrições abertas" : "Inscrições fechadas"}</Badge>
    <Badge variant="outline" className="gap-1 text-muted-foreground">{acao.publico ? <Globe className="h-3 w-3" /> : <LockKeyhole className="h-3 w-3" />}{acao.publico ? "Pública" : "Privada"}</Badge>
    {acao.restrito_a_projetos && <Badge variant="secondary" className="gap-1"><FolderLock className="h-3 w-3" />Restrita a projetos</Badge>}
    {acao.bolsa_transporte && <Badge variant="secondary" className="gap-1"><Car className="h-3 w-3" />Bolsa de transporte</Badge>}
  </div>;
}

export function AcaoManagementDate({ acao }: { acao: AcaoQualityData }) {
  const date = acaoDateLabel(acao.data_inicio, acao.data_fim);
  return <div className="flex items-start gap-2 text-sm text-muted-foreground"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0"><span className="font-medium text-foreground">{date.text}</span>{acao.data_inicio && <span className="block text-xs">{new Date(acao.data_inicio).getFullYear()} · {new Date(acao.data_inicio).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</span>}</div></div>;
}

export function AcaoManagementCard({ acao, tipo, participantes, presentes, onEdit, onInscricoesChange, onPublicoChange, inscricoesPending, publicoPending }: {
  acao: ManagedAcao; tipo?: AcaoTipo | null; participantes: number; presentes: number; onEdit: () => void;
  onInscricoesChange: (value: boolean) => void; onPublicoChange: (value: boolean) => void;
  inscricoesPending: boolean; publicoPending: boolean;
}) {
  const date = acaoDateLabel(acao.data_inicio, acao.data_fim);
  return <Card className="group min-w-0 gap-0 overflow-hidden py-0 shadow-none transition-colors hover:border-primary">
    <div className="relative">
      <AcaoCover nome={acao.nome} imagemUrl={acao.imagem_url} imagemPosition={acao.imagem_position} tipo={tipo} />
      <div className="absolute left-3 top-3 flex min-h-16 min-w-16 flex-col items-center justify-center rounded-md bg-foreground px-3 py-2 text-center text-background" aria-label={date.text}>
        {date.kind === "single" ? <><span className="text-3xl font-bold leading-none">{date.day}</span><span className="mt-1 text-xs font-semibold">{date.month}</span></> : <span className="max-w-44 text-xs font-semibold">{date.text}</span>}
      </div>
    </div>
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2"><h3 className="min-w-0 break-words text-xl font-semibold leading-7">{acao.nome}</h3><AcaoWarnings acao={acao} /></div>
      <AcaoManagementBadges acao={acao} tipo={tipo} />
      <div className="space-y-2"><AcaoManagementDate acao={acao} /><p className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0 break-words">{acao.local || "Local a definir"}</span></p></div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm"><span className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><strong>{participantes}</strong> participantes</span>{presentes > 0 && <span className="text-xs text-muted-foreground">{presentes} presentes</span>}</div>
      <div className="mt-auto space-y-2 border-t pt-3">
        <label className="flex items-center justify-between gap-3 text-xs font-medium">Inscrições abertas<Switch checked={!!acao.inscricoes_abertas} disabled={inscricoesPending} onCheckedChange={onInscricoesChange} /></label>
        <label className="flex items-center justify-between gap-3 text-xs font-medium">Evento público<Switch checked={acao.publico} disabled={publicoPending} onCheckedChange={onPublicoChange} /></label>
      </div>
      <Button variant="outline" className="w-full justify-between" onClick={onEdit}>Gerir ação<Pencil className="h-4 w-4" /></Button>
    </div>
  </Card>;
}

export function AcaoFormPreview({ form, tipo }: { form: {
  id?: string; nome: string; descricao: string; local: string; mapa_url: string; imagem_url: string;
  imagem_position: string; data_inicio: string; data_fim: string; inscricoes_abertas: boolean;
}; tipo?: AcaoTipo | null }) {
  const acao: PublicAcao = { ...form, id: form.id ?? "preview", nome: form.nome || "Nova ação", tipo_acao: tipo ?? null };
  return <section className="space-y-3 border-t pt-5"><h3 className="text-sm font-semibold">Pré-visualização do cartão público</h3><div className="pointer-events-none mx-auto max-w-sm select-none" inert><AcaoCard acao={acao} /></div></section>;
}