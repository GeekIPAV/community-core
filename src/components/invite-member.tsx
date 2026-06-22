import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Copy, Mail, UserPlus, Check, X, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type Convite = {
  id: string;
  email: string;
  token: string;
  enviado: boolean;
  usado_em: string | null;
  expira_em: string;
  created_at: string;
};

function randomToken(len = 40) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, len);
}

function inviteUrl(token: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/convite/${token}`;
}

async function sendInviteEmail(email: string, url: string, expiraEm: string) {
  const { data: tpl } = await supabase
    .from("email_templates")
    .select("assunto, conteudo_html, ativo")
    .eq("chave", "convite_membro")
    .maybeSingle();
  if (!tpl || !tpl.ativo) return { ok: false, reason: "template_inativo" };
  const vars: Record<string, string> = {
    convite_url: url,
    email,
    expira_em: new Date(expiraEm).toLocaleDateString("pt-PT"),
  };
  const render = (s: string) =>
    s.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vars[k] ?? `[${k}]`);
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) return { ok: false, reason: "sem_sessao" };
  try {
    const res = await fetch("/lovable/email/transactional/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        templateName: "convite-membro",
        recipientEmail: email,
        idempotencyKey: `convite-${url.split("/").pop()}`,
        subject: render(tpl.assunto),
        templateData: {
          email,
          conviteUrl: url,
          expiraEm: vars.expira_em,
          bodyHtml: render(tpl.conteudo_html),
        },
      }),
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "rede" };
  }
}

export function InviteMemberButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-9">
          <UserPlus className="mr-2 h-4 w-4" /> Convidar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
          <DialogDescription>
            Envia um link de registo para um email. A pessoa preenche os dados de perfil e fica ativa na plataforma.
          </DialogDescription>
        </DialogHeader>
        <InvitePanel />
      </DialogContent>
    </Dialog>
  );
}

function InvitePanel() {
  const qc = useQueryClient();
  const { pessoa } = useAuth();
  const [email, setEmail] = useState("");

  const { data: convites } = useQuery({
    queryKey: ["convites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convites")
        .select("id,email,token,enviado,usado_em,expira_em,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Convite[];
    },
  });

  const criar = useMutation({
    mutationFn: async (e: string) => {
      const emailNorm = e.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) throw new Error("Email inválido");
      const token = randomToken();
      const { data, error } = await supabase
        .from("convites")
        .insert({ email: emailNorm, token, criado_por: pessoa?.id ?? null })
        .select("id,email,token,enviado,usado_em,expira_em,created_at")
        .single();
      if (error) throw error;
      const row = data as Convite;
      const url = inviteUrl(row.token);
      const r = await sendInviteEmail(row.email, url, row.expira_em);
      if (r.ok) {
        await supabase.from("convites").update({ enviado: true }).eq("id", row.id);
      }
      return { row, enviado: r.ok, url };
    },
    onSuccess: ({ enviado, url }) => {
      if (enviado) toast.success("Convite enviado por email");
      else {
        navigator.clipboard?.writeText(url).catch(() => {});
        toast.success("Convite criado · link copiado", {
          description: "Email automático indisponível — partilha o link manualmente.",
        });
      }
      setEmail("");
      qc.invalidateQueries({ queryKey: ["convites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reenviar = useMutation({
    mutationFn: async (c: Convite) => {
      const url = inviteUrl(c.token);
      const r = await sendInviteEmail(c.email, url, c.expira_em);
      if (r.ok) await supabase.from("convites").update({ enviado: true }).eq("id", c.id);
      return { ok: r.ok, url };
    },
    onSuccess: ({ ok, url }) => {
      if (ok) toast.success("Email reenviado");
      else {
        navigator.clipboard?.writeText(url).catch(() => {});
        toast.success("Link copiado", { description: "Email automático indisponível." });
      }
      qc.invalidateQueries({ queryKey: ["convites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apagar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("convites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convite removido");
      qc.invalidateQueries({ queryKey: ["convites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="invite-email">Email a convidar</Label>
        <div className="flex gap-2">
          <Input
            id="invite-email"
            type="email"
            placeholder="pessoa@exemplo.pt"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && email.trim()) criar.mutate(email);
            }}
          />
          <Button onClick={() => criar.mutate(email)} disabled={!email.trim() || criar.isPending}>
            <Mail className="mr-2 h-4 w-4" />
            {criar.isPending ? "A enviar…" : "Enviar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          O texto do email é editável em <strong>Emails → Convite de membro</strong>.
        </p>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Convites recentes</Label>
          <span className="text-xs text-muted-foreground">{convites?.length ?? 0}</span>
        </div>
        <div className="max-h-[320px] overflow-y-auto rounded-md border">
          {(convites?.length ?? 0) === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Sem convites por agora.</p>
          ) : (
            <ul className="divide-y">
              {convites!.map((c) => {
                const usado = !!c.usado_em;
                const expirado = !usado && new Date(c.expira_em) < new Date();
                const url = inviteUrl(c.token);
                return (
                  <li key={c.id} className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{c.email}</span>
                        {usado ? (
                          <Badge variant="secondary" className="gap-1">
                            <Check className="h-3 w-3" /> Registado
                          </Badge>
                        ) : expirado ? (
                          <Badge variant="destructive" className="gap-1">
                            <X className="h-3 w-3" /> Expirado
                          </Badge>
                        ) : c.enviado ? (
                          <Badge variant="outline">Email enviado</Badge>
                        ) : (
                          <Badge variant="outline">Pendente</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Criado {new Date(c.created_at).toLocaleDateString("pt-PT")} · Expira{" "}
                        {new Date(c.expira_em).toLocaleDateString("pt-PT")}
                      </p>
                    </div>
                    {!usado && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Copiar link"
                          onClick={() => {
                            navigator.clipboard?.writeText(url);
                            toast.success("Link copiado");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Reenviar email"
                          disabled={reenviar.isPending}
                          onClick={() => reenviar.mutate(c)}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Apagar"
                      onClick={() => apagar.mutate(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <DialogFooter />
    </div>
  );
}