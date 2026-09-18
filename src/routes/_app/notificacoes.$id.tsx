import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink, Bell, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/notificacoes/$id")({
  component: NotificacaoDetalhePage,
});

type NotifDetalhe = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  lida: boolean;
  lida_em: string | null;
  created_at: string;
  updated_at: string | null;
  count: number | null;
};

const TIPO_LABEL: Record<string, string> = {
  servicos_por_pagar: "Serviços por pagar",
  novo_auto_pedido: "Novo pedido",
  resposta_pessoa: "Resposta de participante",
  caso_sem_mediadora: "Caso sem mediador/a",
  nova_inscricao: "Nova inscrição",
  nova_acao: "Nova ação",
  nova_pessoa: "Novo participante",
  novo_curriculo: "Novo currículo",
  inscricao_status: "Estado de inscrição",
  nova_familia_atividade: "Nova atividade de família",
};

function formatarData(valor: string | null) {
  if (!valor) return "—";
  try {
    return format(new Date(valor), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt });
  } catch {
    return valor;
  }
}

function NotificacaoDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["notificacao", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes" as any)
        .select("id, tipo, titulo, descricao, link, lida, lida_em, created_at, updated_at, count")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as any as NotifDetalhe) ?? null;
    },
  });

  // Marca como lida ao abrir os detalhes
  useEffect(() => {
    if (!data || data.lida) return;
    supabase
      .from("notificacoes" as any)
      .update({ lida: true, lida_em: new Date().toISOString() })
      .eq("id", data.id)
      .then(() => {
        qc.invalidateQueries({ queryKey: ["notificacao", id] });
      });
  }, [data?.id, data?.lida]);

  const apagar = async () => {
    const { error } = await supabase.from("notificacoes" as any).delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível apagar a notificação.");
      return;
    }
    toast.success("Notificação apagada.");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 md:p-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => window.history.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      {isLoading ? (
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ) : error || !data ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notificação não encontrada</CardTitle>
            <CardDescription>
              Esta notificação já não existe ou não tem permissão para a ver.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Bell className="h-3 w-3" />
                {TIPO_LABEL[data.tipo] ?? data.tipo}
              </Badge>
              {(data.count ?? 1) > 1 && <Badge variant="outline">{data.count} ocorrências</Badge>}
              <Badge variant={data.lida ? "outline" : "default"}>{data.lida ? "Lida" : "Por ler"}</Badge>
            </div>
            <CardTitle className="text-xl">{data.titulo}</CardTitle>
            <CardDescription>Recebida a {formatarData(data.created_at)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {data.descricao || "Sem descrição adicional."}
            </div>

            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Recebida</dt>
                <dd>{formatarData(data.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Última atualização</dt>
                <dd>{formatarData(data.updated_at ?? data.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Lida em</dt>
                <dd>{data.lida_em ? formatarData(data.lida_em) : "—"}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              {data.link && (
                <Button asChild>
                  <Link to={data.link as any}>
                    <ExternalLink className="mr-2 h-4 w-4" /> Ver na plataforma
                  </Link>
                </Button>
              )}
              <Button variant="outline" onClick={apagar}>
                <Trash2 className="mr-2 h-4 w-4" /> Apagar notificação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
