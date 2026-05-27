import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    </div>
  );
}