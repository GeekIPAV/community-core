import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { formatDateBR } from "@/lib/utils";
import { RegistarAtividadeDialog, fetchMembrosAtivos } from "@/components/registar-atividade-dialog";

type RegistoFamiliaRow = {
  id: string;
  data: string | null;
  descricao: string | null;
  created_at: string;
  atividade: { id: string; nome: string; categoria: string | null } | null;
  participantes: { nome: string; daFamilia: boolean }[];
  voluntarios: string[];
};

export function AtividadesFamiliaTab({ familiaId }: { familiaId: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const { data: membros } = useQuery({
    queryKey: ["familia-membros-ativos", familiaId],
    queryFn: () => fetchMembrosAtivos([familiaId]),
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["atividade-registos-familia", familiaId],
    queryFn: async () => {
      const { data: ligacoes, error: eL } = await supabase
        .from("atividade_registo_participantes")
        .select("atividade_registo_id, pessoas!inner(familia_id)")
        .eq("pessoas.familia_id", familiaId);
      if (eL) throw eL;
      const ids = Array.from(
        new Set(((ligacoes ?? []) as any[]).map((r) => r.atividade_registo_id as string)),
      );
      if (ids.length === 0) return [] as RegistoFamiliaRow[];
      const { data, error } = await supabase
        .from("atividade_registos")
        .select(
          "id, data, descricao, created_at, atividade:atividades_catalogo(id, nome, categoria), participantes:atividade_registo_participantes(pessoa:pessoas(id, nome_completo, familia_id)), voluntarios:atividade_registo_voluntarios(pessoa:pessoas(id, nome_completo))",
        )
        .in("id", ids)
        .order("data", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id as string,
        data: r.data as string | null,
        descricao: r.descricao as string | null,
        created_at: r.created_at as string,
        atividade: r.atividade ?? null,
        participantes: (r.participantes ?? [])
          .map((p: any) => p.pessoa)
          .filter(Boolean)
          .map((p: any) => ({ nome: p.nome_completo as string, daFamilia: p.familia_id === familiaId })),
        voluntarios: (r.voluntarios ?? []).map((v: any) => v.pessoa?.nome_completo).filter(Boolean),
      })) as RegistoFamiliaRow[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("atividade_registos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registo removido");
      qc.invalidateQueries({ queryKey: ["atividade-registos-familia", familiaId] });
      qc.invalidateQueries({ queryKey: ["atividade-registos-admin"] });
      qc.invalidateQueries({ queryKey: ["pessoa-atividades"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Registar atividade
        </Button>
      </div>
      <div className="flex-1 min-h-0 max-h-[60vh] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Data</TableHead>
              <TableHead>Atividade</TableHead>
              <TableHead className="w-40">Categoria</TableHead>
              <TableHead className="w-56">Participantes</TableHead>
              <TableHead className="w-48">Voluntários e equipa</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-16 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">A carregar…</TableCell></TableRow>
            )}
            {!isLoading && (!rows || rows.length === 0) && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sem atividades registadas</TableCell></TableRow>
            )}
            {(rows ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground whitespace-nowrap">{r.data ? formatDateBR(r.data) : "—"}</TableCell>
                <TableCell className="font-medium">{r.atividade?.nome ?? "—"}</TableCell>
                <TableCell>
                  {r.atividade?.categoria ? <Badge variant="secondary">{r.atividade.categoria}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {r.participantes.map((p) => (
                      <Badge key={p.nome} variant={p.daFamilia ? "secondary" : "outline"} className="text-xs">
                        {p.nome}{p.daFamilia ? "" : " (outra família)"}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {r.voluntarios.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {r.voluntarios.map((v) => (
                        <Badge key={v} variant="outline" className="text-xs">{v}</Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-pre-wrap">{r.descricao || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" title="Remover" onClick={() => setConfirmRemoveId(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <RegistarAtividadeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        participanteIdsFixos={(membros ?? []).map((m) => m.id)}
        escolherParticipantes
        descricaoDialogo="Os membros ativos desta família já estão incluídos — pode remover ou juntar outras pessoas."
        onRegistado={() => qc.invalidateQueries({ queryKey: ["atividade-registos-familia", familiaId] })}
      />

      <AlertDialog open={!!confirmRemoveId} onOpenChange={(o) => !o && setConfirmRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover registo</AlertDialogTitle>
            <AlertDialogDescription>Remover este registo de atividade?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRemoveId) remove.mutate(confirmRemoveId);
                setConfirmRemoveId(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
