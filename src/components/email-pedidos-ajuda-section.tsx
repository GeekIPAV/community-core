import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Mail, RefreshCw, ExternalLink, Inbox, Archive, X, Check } from "lucide-react";
import { sincronizarEmailPedidos } from "@/lib/email-pedidos.functions";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

type Pedido = {
  id: string; gmail_message_id: string; gmail_thread_id: string | null;
  from_email: string | null; from_name: string | null;
  subject: string | null; snippet: string | null; body_text: string | null;
  received_at: string | null; score: number; motivos: string | null;
  resumo: string | null; idioma: string | null; estado: string;
  pessoa_id: string | null; familia_id: string | null; caso_id: string | null;
  notas: string | null;
};

function scoreVariant(s: number): "default" | "secondary" | "destructive" | "outline" {
  if (s >= 75) return "destructive";
  if (s >= 55) return "default";
  return "secondary";
}

export function EmailPedidosAjudaSection() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Pedido | null>(null);
  const sync = useServerFn(sincronizarEmailPedidos);

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["email-pedidos", "novo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_pedidos_ajuda" as any)
        .select("*")
        .eq("estado", "novo")
        .order("score", { ascending: false })
        .order("received_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as Pedido[];
    },
  });

  const syncMut = useMutation({
    mutationFn: async () => await sync({}),
    onSuccess: (r: any) => {
      toast.success(`Sincronizado: ${r?.inserted ?? 0} novo(s) pedido(s) em ${r?.scanned ?? 0} email(s)`);
      qc.invalidateQueries({ queryKey: ["email-pedidos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro a sincronizar"),
  });

  const updateMut = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<Pedido> }) => {
      const { error } = await supabase
        .from("email_pedidos_ajuda" as any)
        .update(vars.patch as any)
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-pedidos"] });
      setOpen(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const criarCaso = useMutation({
    mutationFn: async (p: Pedido) => {
      const titulo = (p.subject || "Pedido por email").slice(0, 200);
      const descricao = [p.resumo, "", "--- Email original ---", p.body_text || p.snippet || ""].filter(Boolean).join("\n");
      const { data, error } = await supabase
        .from("casos_apoio")
        .insert({
          titulo, descricao,
          area: "outro",
          origem: "email",
          estado: "aberto",
          prioridade: "media",
          data_abertura: new Date().toISOString().slice(0, 10),
        } as any)
        .select("id").single();
      if (error) throw error;
      await supabase.from("email_pedidos_ajuda" as any).update({
        estado: "atribuido", caso_id: data.id,
      }).eq("id", p.id);
      return data.id as string;
    },
    onSuccess: (caso_id) => {
      toast.success("Caso de apoio criado");
      qc.invalidateQueries({ queryKey: ["email-pedidos"] });
      qc.invalidateQueries({ queryKey: ["casos"] });
      setOpen(null);
      window.location.href = `/casos/${caso_id}`;
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro a criar caso"),
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4" /> Pedidos de ajuda por email</CardTitle>
            <CardDescription>Emails detetados automaticamente como possíveis pedidos de famílias migrantes.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/pedidos-ajuda"><ExternalLink className="h-4 w-4 mr-1" /> Ver histórico</Link>
            </Button>
            <Button size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
              <RefreshCw className={`h-4 w-4 mr-1 ${syncMut.isPending ? "animate-spin" : ""}`} />
              Sincronizar Gmail
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
          ) : !pedidos?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2 opacity-50" />
              Sem pedidos por triar. Clique em <span className="font-medium mx-1">Sincronizar Gmail</span> para verificar a caixa.
            </div>
          ) : (
            <ul className="divide-y">
              {pedidos.map((p) => (
                <li key={p.id} className="py-3 flex items-start gap-3">
                  <Badge variant={scoreVariant(p.score)} className="shrink-0 mt-0.5">{p.score}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium truncate">{p.from_name || p.from_email}</span>
                      {p.idioma && <Badge variant="outline" className="text-[10px]">{p.idioma}</Badge>}
                      {p.received_at && <span className="text-xs text-muted-foreground ml-auto shrink-0">{new Date(p.received_at).toLocaleString("pt-PT")}</span>}
                    </div>
                    <div className="text-sm truncate">{p.subject || "(sem assunto)"}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{p.resumo || p.snippet}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setOpen(p)}>Abrir</Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge variant={scoreVariant(open.score)}>{open.score}</Badge>
                  {open.subject || "(sem assunto)"}
                </DialogTitle>
                <DialogDescription>
                  De <strong>{open.from_name || ""}</strong> &lt;{open.from_email}&gt;
                  {open.received_at && <> · {new Date(open.received_at).toLocaleString("pt-PT")}</>}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                {open.motivos && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="font-medium text-xs uppercase text-muted-foreground mb-1">Porque foi sinalizado</div>
                    <div>{open.motivos}</div>
                  </div>
                )}
                {open.resumo && (
                  <div>
                    <div className="font-medium text-xs uppercase text-muted-foreground mb-1">Resumo</div>
                    <div>{open.resumo}</div>
                  </div>
                )}
                <div>
                  <div className="font-medium text-xs uppercase text-muted-foreground mb-1">Email</div>
                  <Textarea readOnly value={open.body_text || open.snippet || ""} className="min-h-[200px] font-mono text-xs" />
                </div>
                {open.gmail_thread_id && (
                  <a className="text-xs text-primary underline" target="_blank" rel="noreferrer"
                     href={`https://mail.google.com/mail/u/0/#inbox/${open.gmail_thread_id}`}>
                    Abrir no Gmail
                  </a>
                )}
              </div>

              <DialogFooter className="flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => updateMut.mutate({ id: open.id, patch: { estado: "ignorado" } })}>
                  <X className="h-4 w-4 mr-1" /> Ignorar (não é pedido)
                </Button>
                <Button variant="outline" size="sm" onClick={() => updateMut.mutate({ id: open.id, patch: { estado: "arquivado" } })}>
                  <Archive className="h-4 w-4 mr-1" /> Arquivar
                </Button>
                <Button variant="outline" size="sm" onClick={() => updateMut.mutate({ id: open.id, patch: { estado: "atribuido" } })}>
                  <Check className="h-4 w-4 mr-1" /> Marcar como tratado
                </Button>
                <Button size="sm" onClick={() => criarCaso.mutate(open)} disabled={criarCaso.isPending}>
                  Criar caso de apoio
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}