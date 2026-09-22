import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Info, Trash2, UserPlus, Users, ExternalLink } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type StatusInscricao = Database["public"]["Enums"]["status_inscricao"];

const STATUS: StatusInscricao[] = ["pendente", "confirmada", "presente", "ausente", "cancelada"];

const STATUS_LABEL: Record<StatusInscricao, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  presente: "Presente",
  ausente: "Ausente",
  cancelada: "Cancelada",
};

function statusVariant(s: StatusInscricao) {
  if (s === "presente" || s === "confirmada") return "default" as const;
  if (s === "cancelada" || s === "ausente") return "destructive" as const;
  return "secondary" as const;
}

type Row = {
  id: string;
  status: StatusInscricao;
  created_at: string;
  pessoa_id: string;
  pessoas: { id: string; nome_completo: string; email: string | null; telefone: string | null } | null;
};

export function AcaoParticipantesTab({
  acaoId,
  participantesExtra = 0,
  onInscreverPessoa,
  onInscreverFamilia,
}: {
  acaoId: string;
  participantesExtra?: number;
  onInscreverPessoa: () => void;
  onInscreverFamilia: () => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"todos" | StatusInscricao>("todos");
  const [extra, setExtra] = useState(String(participantesExtra ?? 0));

  const guardarExtra = useMutation({
    mutationFn: async (valor: number) => {
      const { error } = await supabase.from("acoes").update({ participantes_extra: valor }).eq("id", acaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Participantes não registados atualizados");
      qc.invalidateQueries({ queryKey: ["acao", acaoId] });
      qc.invalidateQueries({ queryKey: ["acoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["acao-inscricoes", acaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inscricoes")
        .select("id, status, created_at, pessoa_id, pessoas(id, nome_completo, email, telefone)")
        .eq("acao_id", acaoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusInscricao }) => {
      const { error } = await supabase.from("inscricoes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado atualizado");
      qc.invalidateQueries({ queryKey: ["acao-inscricoes", acaoId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inscricoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inscrição removida");
      qc.invalidateQueries({ queryKey: ["acao-inscricoes", acaoId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];

  const filtradas = useMemo(() => {
    const termo = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtro !== "todos" && r.status !== filtro) return false;
      if (!termo) return true;
      const p = r.pessoas;
      return [p?.nome_completo, p?.email, p?.telefone].some((v) => (v ?? "").toLowerCase().includes(termo));
    });
  }, [rows, q, filtro]);

  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Aqui pode gerir os participantes desta ação. Para editar todos os detalhes do evento e aceder a
          informação como a bolsa de transporte, utilize o componente de gestão da plataforma.{" "}
          <Link to="/acoes" className="inline-flex items-center gap-1 text-primary hover:underline">
            Abrir gestão de ações <ExternalLink className="h-3 w-3" />
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Participantes</CardTitle>
              <CardDescription>
                {rows.length} inscrição(ões)
                {STATUS.filter((s) => contagem[s]).map((s) => ` · ${contagem[s]} ${STATUS_LABEL[s].toLowerCase()}`).join("")}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onInscreverPessoa}>
                <UserPlus className="h-4 w-4" /> Inscrever pessoa
              </Button>
              <Button variant="outline" size="sm" onClick={onInscreverFamilia}>
                <Users className="h-4 w-4" /> Inscrever família
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Pesquisar por nome, email ou telefone…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 max-w-xs"
            />
            <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os estados</SelectItem>
                {STATUS.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : filtradas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem participantes para mostrar.</p>
          ) : (
            <div className="divide-y rounded-md border">
              {filtradas.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.pessoas?.nome_completo ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[r.pessoas?.email, r.pessoas?.telefone].filter(Boolean).join(" · ") || "Sem contactos"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(r.status)}>{STATUS_LABEL[r.status]}</Badge>
                    <Select
                      value={r.status}
                      onValueChange={(v) => updateStatus.mutate({ id: r.id, status: v as StatusInscricao })}
                    >
                      <SelectTrigger className="h-8 w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS.map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Remover inscrição"
                      onClick={() => {
                        if (window.confirm("Remover esta inscrição?")) remover.mutate(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
