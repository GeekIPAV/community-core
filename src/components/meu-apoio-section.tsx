import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { FolderOpen, Clock, Plus } from "lucide-react";
import { CasoNovoSheet } from "@/components/caso-novo-sheet";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

export function MeuApoioSection({ pessoaId }: { pessoaId: string }) {
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: casos = [] } = useQuery({
    queryKey: ["meus-casos", pessoaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("casos_apoio" as any)
        .select("*, mediadora:pessoas!casos_apoio_mediadora_id_fkey(nome_completo)")
        .eq("pessoa_id", pessoaId)
        .order("data_abertura", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">O Meu Apoio</h2>
          <p className="text-sm text-muted-foreground">Os teus pedidos de apoio à equipa MEERU.</p>
        </div>
        <Button onClick={() => setNovoOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Pedir apoio
        </Button>
      </div>

      {casos.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <FolderOpen className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">Ainda não tens pedidos de apoio.</p>
          <Button onClick={() => setNovoOpen(true)}>Pedir apoio à equipa MEERU</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {casos.map((c) => <MyCasoCard key={c.id} caso={c} pessoaId={pessoaId} />)}
        </div>
      )}

      <CasoNovoSheet open={novoOpen} onOpenChange={setNovoOpen} mode="auto" />
    </div>
  );
}

function MyCasoCard({ caso, pessoaId }: { caso: any; pessoaId: string }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [resposta, setResposta] = useState("");

  const { data: registos = [] } = useQuery({
    queryKey: ["meus-caso-registos", caso.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caso_registos" as any)
        .select("id, tipo, conteudo, data")
        .eq("caso_id", caso.id)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const visiveis = useMemo(() => registos, [registos]);
  const ultimos = expanded ? visiveis : visiveis.slice(0, 2);
  const concluido = ["Concluído", "Arquivado"].includes(caso.estado);

  const enviar = useMutation({
    mutationFn: async () => {
      if (!resposta.trim()) return;
      const { error } = await supabase.from("caso_registos" as any).insert({
        caso_id: caso.id, autor_id: pessoaId,
        tipo: "Resposta da pessoa", conteudo: resposta.trim(), visivel_para_pessoa: true,
      });
      if (error) throw error;
      if (caso.mediadora_id) {
        await supabase.rpc("notificar_mediadora" as any, {
          p_mediadora_id: caso.mediadora_id,
          p_tipo: "resposta_pessoa",
          p_titulo: `Nova resposta ao caso ${caso.numero}`,
          p_descricao: resposta.trim().slice(0, 120),
          p_link: `/casos/${caso.id}`,
          p_group_key: `resposta_pessoa:${caso.id}`,
        });
      }
    },
    onSuccess: () => {
      setResposta("");
      qc.invalidateQueries({ queryKey: ["meus-caso-registos", caso.id] });
      toast.success("Resposta enviada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-normal">{caso.area}</Badge>
            <span className="font-medium">{caso.titulo}</span>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground mt-1">
            {caso.numero} · {new Date(caso.data_abertura).toLocaleDateString("pt-PT")}
          </div>
        </div>
        <Badge variant="secondary">{caso.estado}</Badge>
      </div>

      {caso.mediadora?.nome_completo ? (
        <div className="text-sm">A tua mediadora: <span className="font-medium">{caso.mediadora.nome_completo}</span></div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
          <Clock className="h-3.5 w-3.5" /> A aguardar atribuição de mediadora
        </div>
      )}

      {visiveis.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          {ultimos.map((r) => (
            <div key={r.id} className="text-sm">
              <div className="text-xs text-muted-foreground">
                {r.tipo} · {formatDistanceToNow(new Date(r.data), { addSuffix: true, locale: pt })}
              </div>
              <div className="whitespace-pre-wrap line-clamp-3">{r.conteudo}</div>
            </div>
          ))}
          {visiveis.length > 2 && (
            <button type="button" className="text-xs text-primary hover:underline"
              onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Ver menos" : "Ver histórico completo"}
            </button>
          )}
        </div>
      )}

      {!concluido && (
        <div className="border-t pt-3 space-y-2">
          <Textarea rows={2} value={resposta} onChange={(e) => setResposta(e.target.value)}
            placeholder="Escreve uma resposta para a tua mediadora…" />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => enviar.mutate()} disabled={!resposta.trim() || enviar.isPending}>
              Enviar resposta
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}