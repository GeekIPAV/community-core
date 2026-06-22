import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/convite/$token")({
  component: ConvitePage,
});

type Estado =
  | { fase: "loading" }
  | { fase: "invalido"; motivo: string }
  | { fase: "form"; email: string }
  | { fase: "ok" };

function motivoTexto(motivo: string) {
  if (motivo === "ja_usado") return "Este convite já foi utilizado.";
  if (motivo === "expirado") return "Este convite expirou. Pede um novo à equipa.";
  return "Convite inválido ou inexistente.";
}

function ConvitePage() {
  const { token } = Route.useParams();
  const [estado, setEstado] = useState<Estado>({ fase: "loading" });
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataNasc, setDataNasc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("convite_validar", { p_token: token });
      if (error) {
        setEstado({ fase: "invalido", motivo: "inexistente" });
        return;
      }
      const r = data as { valido: boolean; motivo?: string; email?: string };
      if (!r.valido) setEstado({ fase: "invalido", motivo: r.motivo ?? "inexistente" });
      else setEstado({ fase: "form", email: r.email ?? "" });
    })();
  }, [token]);

  const submeter = async () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("convite_consumir", {
      p_token: token,
      p_nome: nome.trim(),
      p_telefone: telefone.trim() || undefined,
      p_data_nascimento: dataNasc || undefined,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEstado({ fase: "ok" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        {estado.fase === "loading" && (
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        )}

        {estado.fase === "invalido" && (
          <>
            <CardHeader>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Convite inválido</CardTitle>
              </div>
              <CardDescription>{motivoTexto(estado.motivo)}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/" className="text-sm text-primary hover:underline">← Voltar ao início</Link>
            </CardContent>
          </>
        )}

        {estado.fase === "form" && (
          <>
            <CardHeader>
              <CardTitle>Completar registo</CardTitle>
              <CardDescription>
                Bem-vindo(a)! Preenche os teus dados para concluíres o registo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={estado.email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo *</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tel">Telefone</Label>
                <Input id="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dn">Data de nascimento</Label>
                <Input id="dn" type="date" value={dataNasc} onChange={(e) => setDataNasc(e.target.value)} />
              </div>
              <Button className="w-full" onClick={submeter} disabled={submitting || !nome.trim()}>
                {submitting ? "A registar…" : "Concluir registo"}
              </Button>
            </CardContent>
          </>
        )}

        {estado.fase === "ok" && (
          <>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <CardTitle>Registo concluído</CardTitle>
              </div>
              <CardDescription>
                Os teus dados foram guardados. Já podes entrar com o teu email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/login" className="text-sm text-primary hover:underline">
                Ir para a página de login →
              </Link>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}