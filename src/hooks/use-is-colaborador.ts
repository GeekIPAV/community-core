import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export function useIsColaborador() {
  const { pessoa } = useAuth();
  const [authUid, setAuthUid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthUid(data.user?.id ?? null));
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["is_colaborador", authUid, pessoa?.id, pessoa?.email],
    enabled: !!authUid,
    queryFn: async () => {
      const byAuth = await supabase.from("colaboradores").select("id").eq("auth_user_id", authUid!).maybeSingle();
      if (byAuth.data) return true;
      if (pessoa?.id) {
        const byPessoa = await supabase.from("colaboradores").select("id").eq("pessoa_id", pessoa.id).maybeSingle();
        if (byPessoa.data) return true;
      }
      if (pessoa?.email) {
        const byEmail = await supabase.from("colaboradores").select("id").ilike("email", pessoa.email).maybeSingle();
        if (byEmail.data) return true;
      }
      return false;
    },
  });

  return { isColaborador: !!data, isLoading: isLoading || !authUid };
}
