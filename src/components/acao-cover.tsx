import { useState } from "react";
import { acaoPresentation, type AcaoTipo } from "@/lib/acao-presentation";
import { cn } from "@/lib/utils";

export function AcaoCover({ nome, imagemUrl, imagemPosition, tipo, className }: {
  nome: string;
  imagemUrl?: string | null;
  imagemPosition?: string | null;
  tipo?: AcaoTipo | null;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const { Icon } = acaoPresentation(tipo);
  if (imagemUrl && failedUrl !== imagemUrl) {
    return <img src={imagemUrl} alt={nome} loading="lazy" onError={() => setFailedUrl(imagemUrl)} className={cn("aspect-video w-full rounded-lg object-cover", className)} style={{ objectPosition: imagemPosition ?? "50% 50%" }} />;
  }
  return (
    <div role="img" aria-label={nome} className={cn("bg-primary text-primary-foreground relative flex aspect-video w-full items-end justify-between gap-4 overflow-hidden rounded-lg p-5 sm:p-6", className)}>
      <span aria-hidden="true" className="line-clamp-3 max-w-[80%] break-words text-xl font-bold leading-tight sm:text-2xl">{nome}</span>
      <Icon aria-hidden="true" className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" strokeWidth={1.5} />
    </div>
  );
}