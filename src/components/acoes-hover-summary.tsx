import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  pessoaId?: string;
  familiaId?: string;
  label: string;
};

type Row = {
  status: string;
  pessoa?: { nome_completo: string } | null;
  acao: {
    id: string;
    nome: string;
    tipo: string | null;
    data_inicio: string | null;
    status: string | null;
  } | null;
};

export function AcoesHoverSummary({ pessoaId, familiaId, label }: Props) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["acoes-hover", pessoaId, familiaId],
    enabled: open,
    staleTime: 60_000,
    queryFn: async (): Promise<Row[]> => {
      if (pessoaId) {
        const { data, error } = await supabase
          .from("inscricoes")
          .select("status, acao:acoes(id, nome, tipo, data_inicio, status)")
          .eq("pessoa_id", pessoaId)
          .neq("status", "cancelada")
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) throw error;
        return (data ?? []) as unknown as Row[];
      }
      if (familiaId) {
        const { data: pessoas } = await supabase
          .from("pessoas")
          .select("id, nome_completo")
          .eq("familia_id", familiaId)
          .eq("status", "ativo");
        const pessoaIds = (pessoas ?? []).map((p) => p.id);
        if (!pessoaIds.length) return [];
        const { data, error } = await supabase
          .from("inscricoes")
          .select("status, pessoa:pessoas(nome_completo), acao:acoes(id, nome, tipo, data_inicio, status)")
          .in("pessoa_id", pessoaIds)
          .neq("status", "cancelada")
          .order("created_at", { ascending: false })
          .limit(30);
        if (error) throw error;
        return (data ?? []) as unknown as Row[];
      }
      return [];
    },
  });

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" }) : null;

  const statusColor = (s: string) => {
    if (s === "presente") return "text-green-600";
    if (s === "ausente") return "text-red-500";
    if (s === "confirmada" || s === "pendente") return "text-amber-600";
    return "text-muted-foreground";
  };

  const statusLabel: Record<string, string> = {
    presente: "Presente",
    ausente: "Ausente",
    confirmada: "Confirmada",
    pendente: "Pendente",
    cancelada: "Cancelada",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        >
          <Badge variant="outline" className="hover:bg-muted transition-colors">
            {label}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        side="left"
        align="start"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="p-3 border-b">
          <p className="text-sm font-medium">Ações / Eventos</p>
          <p className="text-xs text-muted-foreground">Últimas inscrições activas</p>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !data?.length ? (
            <p className="p-3 text-sm text-muted-foreground">Sem inscrições activas.</p>
          ) : (
            <ul className="divide-y">
              {data.map((r, i) => (
                <li key={i} className="px-3 py-2 space-y-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight line-clamp-1">
                      {r.acao?.nome ?? "—"}
                    </p>
                    <span className={`text-[10px] shrink-0 font-medium ${statusColor(r.status)}`}>
                      {statusLabel[r.status] ?? r.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {r.acao?.tipo && <span>{r.acao.tipo}</span>}
                    {r.acao?.data_inicio && (<><span>·</span><span>{fmt(r.acao.data_inicio)}</span></>)}
                    {r.pessoa && (<><span>·</span><span>{r.pessoa.nome_completo}</span></>)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}