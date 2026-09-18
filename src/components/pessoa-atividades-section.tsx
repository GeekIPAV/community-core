import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { RegistarAtividadeDialog } from "@/components/registar-atividade-dialog";

type Linha = {
  id: string;
  data: string | null;
  descricao: string | null;
  atividade_nome: string;
  categoria: string | null;
  participantes: string[];
  voluntarios: string[];
};

export function PessoaAtividadesSection({
  pessoaId,
  familiaId: _familiaId,
}: {
  pessoaId: string;
  familiaId?: string | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pessoa-atividades", pessoaId],
    queryFn: async () => {
      const { data: ligacoes, error: eL } = await supabase
        .from("atividade_registo_participantes")
        .select("atividade_registo_id")
        .eq("pessoa_id", pessoaId);
      if (eL) throw eL;
      const ids = ((ligacoes ?? []) as any[]).map((r) => r.atividade_registo_id as string);
      if (ids.length === 0) return [] as Linha[];

      const { data, error } = await supabase
        .from("atividade_registos")
        .select(
          "id, data, descricao, atividades_catalogo(nome, categoria), atividade_registo_participantes(pessoas(nome_completo)), atividade_registo_voluntarios(pessoas(nome_completo))",
        )
        .in("id", ids)
        .order("data", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        data: r.data,
        descricao: r.descricao,
        atividade_nome: r.atividades_catalogo?.nome ?? "(atividade removida)",
        categoria: r.atividades_catalogo?.categoria ?? null,
        participantes: (r.atividade_registo_participantes ?? [])
          .map((v: any) => v.pessoas?.nome_completo)
          .filter(Boolean),
        voluntarios: (r.atividade_registo_voluntarios ?? [])
          .map((v: any) => v.pessoas?.nome_completo)
          .filter(Boolean),
      })) as Linha[];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">Atividades em que esta pessoa participou.</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Atribuir atividade
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Ainda não participou em nenhuma atividade.
        </div>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((l) => (
            <div key={l.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{l.atividade_nome}</span>
                {l.categoria && <Badge variant="secondary">{l.categoria}</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">
                  {l.data ? new Date(l.data).toLocaleDateString("pt-PT") : "sem data"}
                </span>
              </div>
              {l.descricao && <p className="mt-1 text-sm text-muted-foreground">{l.descricao}</p>}
              {l.participantes.length > 1 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Participantes: {l.participantes.join(", ")}
                </p>
              )}
              {l.voluntarios.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Voluntários e equipa: {l.voluntarios.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <RegistarAtividadeDialog
        open={open}
        onOpenChange={setOpen}
        participanteIdsFixos={[pessoaId]}
        escolherParticipantes
        titulo="Atribuir atividade"
        onRegistado={() => qc.invalidateQueries({ queryKey: ["pessoa-atividades", pessoaId] })}
      />
    </div>
  );
}
