import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { pessoa, session, isAdmin } = useAuth();

  const { data: familiares } = useQuery({
    queryKey: ["familiares", pessoa?.familia_id],
    enabled: !!pessoa?.familia_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email")
        .eq("familia_id", pessoa!.familia_id!);
      if (error) throw error;
      return data;
    },
  });

  const { data: familiasResponsavel } = useQuery({
    queryKey: ["perfil", "familias-responsavel", pessoa?.id],
    enabled: !!pessoa?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familias")
        .select("id, nome, status, notas")
        .eq("contacto_meeru_id", pessoa!.id)
        .order("nome");
      if (error) throw error;
      return data as Array<{ id: string; nome: string; status: string; notas: string | null }>;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">O Meu Perfil</h1>
        <p className="text-sm text-muted-foreground">Os teus dados na comunidade Meeru.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{pessoa?.nome_completo ?? session?.user?.email ?? "Sem perfil"}</CardTitle>
          <CardDescription>
            {pessoa?.email ?? session?.user?.email}
            {isAdmin && <Badge className="ml-2">admin</Badge>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!pessoa && (
            <p className="text-muted-foreground">
              Ainda não estás associado a um perfil da comunidade. Contacta a equipa Meeru para vinculares a tua conta.
            </p>
          )}
          {pessoa && (
            <>
              <p><span className="text-muted-foreground">Família:</span> {pessoa.familia_id ?? "sem família"}</p>
              {familiares && familiares.length > 0 && (
                <div>
                  <p className="text-muted-foreground">Agregado:</p>
                  <ul className="list-disc pl-5">
                    {familiares.map((f) => <li key={f.id}>{f.nome_completo}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {familiasResponsavel && familiasResponsavel.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Famílias pelas quais és responsável</CardTitle>
            <CardDescription>És a pessoa de contacto da Equipa MEERU para estas famílias.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {familiasResponsavel.map((f) => (
                <li key={f.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link to="/familias" className="font-medium hover:underline">{f.nome}</Link>
                    {f.notas && <div className="text-xs text-muted-foreground line-clamp-1">{f.notas}</div>}
                  </div>
                  <Badge variant="outline">{f.status}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}