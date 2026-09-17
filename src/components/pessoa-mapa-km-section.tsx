import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Download, FileText, Loader2, Pencil, Plus, Send, Trash2, Users } from "lucide-react";
import { FolhaKmDialog } from "@/components/folha-km-dialog";
import { gerarPdfFolhaKm } from "@/lib/gerar-pdf-folha-km";
import { enviarFolhaKm } from "@/lib/folha-km.functions";
import { KM_RATE, formatEuro } from "@/lib/bolsa-transporte";

type Folha = {
  id: string;
  nome: string;
  periodo: string | null;
  estado: string | null;
  total_km: number;
  total_valor: number;
  created_at: string;
  enviado_em: string | null;
};

type MapaFamilia = {
  id: string;
  data: string;
  motivo: string;
  km: number;
  valor: number | null;
  estado: string;
};

const fmtData = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-PT") : "—");

function FolhaEstadoBadge({ estado }: { estado: string | null }) {
  if (estado === "enviada") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Enviada</Badge>;
  if (estado === "erro_envio" || estado === "erro") return <Badge variant="destructive">Erro no envio</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Rascunho</Badge>;
}

function MapaEstadoBadge({ estado }: { estado: string }) {
  if (estado === "pago") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Pago</Badge>;
  if (estado === "cancelado") return <Badge variant="outline" className="text-muted-foreground">Cancelado</Badge>;
  return <Badge className="bg-amber-100 text-amber-900 border-amber-200">Por pagar</Badge>;
}

export function PessoaMapaKmSection({
  pessoaId,
  familiaId,
}: {
  pessoaId: string;
  familiaId: string | null;
}) {
  const qc = useQueryClient();
  const [folhaEdit, setFolhaEdit] = useState<{ folhaId: string; familiaId?: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [apagarId, setApagarId] = useState<string | null>(null);
  const [aCriar, setACriar] = useState(false);

  const { data: folhas, isLoading } = useQuery({
    queryKey: ["folhas-km-pessoa", pessoaId],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folhas_km")
        .select("id, nome, periodo, estado, total_km, total_valor, created_at, enviado_em")
        .eq("pessoa_id", pessoaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Folha[];
    },
  });

  const { data: mapaFamilia } = useQuery({
    enabled: !!familiaId,
    queryKey: ["familia-mapa-km", familiaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapa_km")
        .select("id, data, motivo, km, valor, estado")
        .eq("familia_id", familiaId!)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MapaFamilia[];
    },
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["folhas-km-pessoa", pessoaId] });
    qc.invalidateQueries({ queryKey: ["folhas-km"] });
  };

  const apagar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("folhas_km").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Folha de KM eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const construirPdfFolha = async (id: string) => {
    const { data: f, error } = await supabase.from("folhas_km").select("*").eq("id", id).maybeSingle();
    if (error || !f) throw new Error("Não foi possível carregar a folha.");
    let assinatura: string | null = null;
    if (f.pessoa_id) {
      const { data: p } = await supabase.from("pessoas").select("assinatura").eq("id", f.pessoa_id).maybeSingle();
      assinatura = p?.assinatura ?? null;
    }
    const linhas = (Array.isArray(f.linhas) ? (f.linhas as unknown as Array<Record<string, unknown>>) : []).map((l) => ({
      data: String(l.data ?? ""),
      descricao: String(l.descricao ?? ""),
      percurso: String(l.percurso ?? ""),
      km: Number(l.km ?? 0),
      valor: Number(l.valor ?? 0),
    }));
    const pdf = await gerarPdfFolhaKm({
      dados: {
        nome: f.nome ?? "",
        morada: f.morada ?? "",
        nif: f.nif ?? "",
        iban: f.iban ?? "",
        matricula: f.matricula ?? "",
        email: f.email ?? "",
      },
      linhas,
      totalKm: Number(f.total_km ?? 0),
      totalValor: Number(f.total_valor ?? 0),
      valorKm: Number(f.valor_km ?? KM_RATE),
      assinatura,
      periodo: f.periodo ?? null,
    });
    return { folha: f, ...pdf };
  };

  const descarregar = async (id: string) => {
    setBusyId(id);
    try {
      const { doc, filename } = await construirPdfFolha(id);
      doc.save(filename);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar o PDF.");
    } finally {
      setBusyId(null);
    }
  };

  const reenviar = async (id: string) => {
    setBusyId(id);
    try {
      const { folha, base64, filename } = await construirPdfFolha(id);
      await enviarFolhaKm({
        data: {
          folhaId: id,
          nome: folha.nome ?? "",
          emailPessoa: folha.email ?? null,
          periodo: folha.periodo ?? null,
          totalKm: Number(folha.total_km ?? 0),
          totalValor: Number(folha.total_valor ?? 0),
          ficheiroNome: filename,
          ficheiroBase64: base64,
        },
      });
      toast.success("Folha enviada por email.");
      invalidar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar a folha.");
    } finally {
      setBusyId(null);
    }
  };

  const novaFolha = async () => {
    setACriar(true);
    try {
      const { data: p, error: pErr } = await supabase
        .from("pessoas")
        .select("nome_completo, morada, nif, iban, matricula, email")
        .eq("id", pessoaId)
        .maybeSingle();
      if (pErr) throw pErr;
      const { data, error } = await supabase
        .from("folhas_km")
        .insert({
          pessoa_id: pessoaId,
          nome: p?.nome_completo ?? "",
          morada: p?.morada ?? null,
          nif: p?.nif ?? null,
          iban: p?.iban ?? null,
          matricula: p?.matricula ?? null,
          email: p?.email ?? null,
          valor_km: KM_RATE,
          linhas: [],
          total_km: 0,
          total_valor: 0,
        })
        .select("id")
        .single();
      if (error) throw error;
      invalidar();
      setFolhaEdit({ folhaId: data.id, familiaId: familiaId ?? undefined });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar a folha.");
    } finally {
      setACriar(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border">
        <div className="flex items-center justify-between gap-2 border-b bg-blue-50/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-700" />
            <div>
              <p className="text-sm font-medium">Folhas de quilómetros</p>
              <p className="text-xs text-muted-foreground">Reembolsos individuais desta pessoa</p>
            </div>
          </div>
          <Button size="sm" onClick={novaFolha} disabled={aCriar}>
            {aCriar ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Nova folha de KM
          </Button>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : (folhas ?? []).length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Ainda não há folhas de quilómetros para esta pessoa.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Criada</TableHead>
                <TableHead className="text-right">KM</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[150px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(folhas ?? []).map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.periodo || "—"}</TableCell>
                  <TableCell>{fmtData(f.created_at)}</TableCell>
                  <TableCell className="text-right">{Number(f.total_km).toLocaleString("pt-PT")}</TableCell>
                  <TableCell className="text-right">{formatEuro(Number(f.total_valor))}</TableCell>
                  <TableCell><FolhaEstadoBadge estado={f.estado} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => setFolhaEdit({ folhaId: f.id, familiaId: familiaId ?? undefined })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Descarregar PDF" disabled={busyId === f.id} onClick={() => descarregar(f.id)}>
                        {busyId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" title="Enviar por email" disabled={busyId === f.id} onClick={() => reenviar(f.id)}>
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Apagar" onClick={() => setApagarId(f.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {familiaId && (
        <div className="rounded-lg border">
          <div className="flex items-center gap-2 border-b bg-orange-50/60 px-4 py-3">
            <Users className="h-4 w-4 text-orange-700" />
            <div>
              <p className="text-sm font-medium">Despesas de quilómetros da família</p>
              <p className="text-xs text-muted-foreground">Apenas leitura — geridas em Bolsas de Transporte</p>
            </div>
          </div>
          {(mapaFamilia ?? []).length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Sem deslocações registadas para esta família.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">KM</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(mapaFamilia ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{fmtData(r.data)}</TableCell>
                    <TableCell>{r.motivo || "—"}</TableCell>
                    <TableCell className="text-right">{Number(r.km).toLocaleString("pt-PT")}</TableCell>
                    <TableCell className="text-right">{formatEuro(Number(r.valor ?? 0))}</TableCell>
                    <TableCell><MapaEstadoBadge estado={r.estado} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {folhaEdit && (
        <FolhaKmDialog
          open
          onOpenChange={(o) => { if (!o) { setFolhaEdit(null); invalidar(); } }}
          folhaId={folhaEdit.folhaId}
          familiaId={folhaEdit.familiaId}
        />
      )}

      <AlertDialog open={!!apagarId} onOpenChange={(o) => { if (!o) setApagarId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar folha de KM?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser revertida.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (apagarId) apagar.mutate(apagarId); setApagarId(null); }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
