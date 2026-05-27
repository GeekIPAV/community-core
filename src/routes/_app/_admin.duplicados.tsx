import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowRight, Check, X } from "lucide-react";

export const Route = createFileRoute("/_app/_admin/duplicados")({
  component: DuplicadosPage,
});

type Pessoa = {
  id: string;
  nome_completo: string;
  email: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  nif: string | null;
  status: string;
  ignorar_duplicado?: boolean;
  created_at: string;
};

type Grupo = { suspeito: Pessoa; matches: Pessoa[] };

function DuplicadosPage() {
  const qc = useQueryClient();

  const { data: pessoas, isLoading } = useQuery({
    queryKey: ["pessoas", "para-duplicados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, data_nascimento, telefone, nif, status, ignorar_duplicado, created_at")
        .in("status", ["ativo", "suspeito_duplicado"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Pessoa[];
    },
  });

  const grupos: Grupo[] = (() => {
    if (!pessoas) return [];
    const suspeitos = pessoas.filter((p) => p.status === "suspeito_duplicado");
    return suspeitos
      .map((s) => {
        const firstName = (s.nome_completo ?? "").trim().toLowerCase().split(" ")[0];
        const matches = pessoas.filter((o) => {
          if (o.id === s.id) return false;
          const sameEmail = !!s.email && !!o.email && o.email.toLowerCase() === s.email.toLowerCase();
          const otherFirst = (o.nome_completo ?? "").trim().toLowerCase().split(" ")[0];
          const sameDobName =
            !!s.data_nascimento && !!o.data_nascimento && o.data_nascimento === s.data_nascimento && otherFirst === firstName;
          return sameEmail || sameDobName;
        });
        return { suspeito: s, matches };
      })
      .filter((g) => g.matches.length > 0);
  })();

  const refresh = () => qc.invalidateQueries({ queryKey: ["pessoas", "para-duplicados"] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Duplicados</h1>
        <p className="text-sm text-muted-foreground">
          Cada cartão mostra um possível duplicado e os perfis com que se parece. Funde num único perfil ou marca como distintos.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem suspeitos de duplicação 🎉</p>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <GrupoCard key={g.suspeito.id} grupo={g} onChange={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function matchReason(a: Pessoa, b: Pessoa): string[] {
  const r: string[] = [];
  if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) r.push("Email igual");
  const fa = (a.nome_completo ?? "").trim().toLowerCase().split(" ")[0];
  const fb = (b.nome_completo ?? "").trim().toLowerCase().split(" ")[0];
  if (a.data_nascimento && b.data_nascimento && a.data_nascimento === b.data_nascimento && fa === fb) {
    r.push("Mesma data de nascimento e primeiro nome");
  }
  return r;
}

function PessoaBox({ pessoa, highlight }: { pessoa: Pessoa; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-3 text-sm ${highlight ? "border-destructive/60 bg-destructive/5" : "bg-muted/30"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">{pessoa.nome_completo}</div>
        {highlight ? <Badge variant="destructive">suspeito</Badge> : <Badge variant="secondary">existente</Badge>}
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        <div>📧 {pessoa.email ?? "—"}</div>
        <div>🎂 {pessoa.data_nascimento ?? "—"}</div>
        <div>📞 {pessoa.telefone ?? "—"}</div>
        <div>🆔 NIF: {pessoa.nif ?? "—"}</div>
        <div className="opacity-70">Criado em {new Date(pessoa.created_at).toLocaleDateString("pt-PT")}</div>
      </div>
    </div>
  );
}

function GrupoCard({ grupo, onChange }: { grupo: Grupo; onChange: () => void }) {
  const { suspeito, matches } = grupo;

  const fundir = useMutation({
    mutationFn: async ({ principal, duplicado }: { principal: string; duplicado: string }) => {
      const { error } = await supabase.rpc("fundir_perfis", { principal, duplicado });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Perfis fundidos"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const manterSeparados = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("pessoas")
        .update({ status: "ativo", ignorar_duplicado: true })
        .eq("id", suspeito.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marcado como distinto"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Possível duplicado de {suspeito.nome_completo}</CardTitle>
          <Button size="sm" variant="outline" onClick={() => manterSeparados.mutate()} disabled={manterSeparados.isPending}>
            <X className="mr-1 h-3.5 w-3.5" /> Não é duplicado
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-start">
          <PessoaBox pessoa={suspeito} highlight />
          <div className="hidden items-center justify-center text-muted-foreground md:flex md:pt-10">
            <ArrowRight className="h-5 w-5" />
          </div>
          <div className="space-y-3">
            {matches.map((m) => {
              const reasons = matchReason(suspeito, m);
              return (
                <div key={m.id} className="space-y-2">
                  <PessoaBox pessoa={m} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {reasons.map((r) => (
                        <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <FundirButton
                        label="Manter este, fundir suspeito"
                        onConfirm={() => fundir.mutate({ principal: m.id, duplicado: suspeito.id })}
                        disabled={fundir.isPending}
                        principal={m}
                        duplicado={suspeito}
                      />
                      <FundirButton
                        label="Manter suspeito, fundir este"
                        onConfirm={() => fundir.mutate({ principal: suspeito.id, duplicado: m.id })}
                        disabled={fundir.isPending}
                        principal={suspeito}
                        duplicado={m}
                        variant="outline"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FundirButton({
  label, onConfirm, disabled, principal, duplicado, variant,
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  principal: Pessoa;
  duplicado: Pessoa;
  variant?: "default" | "outline";
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={variant ?? "default"} disabled={disabled}>
          <Check className="mr-1 h-3.5 w-3.5" /> {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar fusão</AlertDialogTitle>
          <AlertDialogDescription>
            As inscrições de <strong>{duplicado.nome_completo}</strong> serão movidas para{" "}
            <strong>{principal.nome_completo}</strong>. O perfil duplicado fica marcado como fundido.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Fundir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}