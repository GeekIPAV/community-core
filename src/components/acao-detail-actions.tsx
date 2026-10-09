import { CalendarPlus, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { actionIcs, type DatedAcao } from "@/lib/acao-calendar";

export function AcaoDetailActions({ acao }: { acao: DatedAcao & { id: string; nome: string; local: string | null } }) {
  const url = () => `${window.location.origin}/acao/${encodeURIComponent(acao.id)}`;
  const downloadCalendar = () => {
    try {
      const blob = new Blob([actionIcs(acao, url())], { type: "text/calendar;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `acao-${acao.id}.ics`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar o calendário."); }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: acao.nome, url: url() }); return; }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url()); toast.success("Link copiado!"); }
    catch { toast.error("Não foi possível copiar o link. Podes copiar o endereço desta página."); }
  };
  return <div className="flex flex-wrap gap-2">
    {(acao.data_inicio || acao.data_fim) && <Button variant="outline" size="sm" onClick={downloadCalendar}><CalendarPlus className="h-4 w-4" />Adicionar ao calendário</Button>}
    <Button variant="outline" size="sm" onClick={() => void share()}><Share2 className="h-4 w-4" />Partilhar</Button>
  </div>;
}