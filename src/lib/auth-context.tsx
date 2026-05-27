import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type PessoaCtx = {
  id: string;
  nome_completo: string;
  email: string | null;
  familia_id: string | null;
  is_admin: boolean;
  auth_user_id: string | null;
};

type AuthCtx = {
  loading: boolean;
  session: Session | null;
  pessoa: PessoaCtx | null;
  isAdmin: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  loading: true,
  session: null,
  pessoa: null,
  isAdmin: false,
  refresh: async () => {},
});

async function loadPessoa(session: Session | null): Promise<PessoaCtx | null> {
  if (!session?.user) return null;
  const uid = session.user.id;
  const email = session.user.email ?? null;

  const cols = "id, nome_completo, email, familia_id, is_admin, auth_user_id";

  // 1. Prefer match by auth_user_id
  const byId = await supabase.from("pessoas").select(cols).eq("auth_user_id", uid).maybeSingle();
  if (byId.data) return byId.data as PessoaCtx;

  // 2. Fallback by email + silent link
  if (email) {
    const byEmail = await supabase.from("pessoas").select(cols).ilike("email", email).limit(1).maybeSingle();
    if (byEmail.data) {
      if (!byEmail.data.auth_user_id) {
        const upd = await supabase
          .from("pessoas")
          .update({ auth_user_id: uid })
          .eq("id", byEmail.data.id)
          .select(cols)
          .maybeSingle();
        if (upd.data) return upd.data as PessoaCtx;
      }
      return byEmail.data as PessoaCtx;
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [pessoa, setPessoa] = useState<PessoaCtx | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = async (s: Session | null) => {
    setSession(s);
    const p = await loadPessoa(s);
    setPessoa(p);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      hydrate(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      hydrate(s);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthCtx = {
    loading,
    session,
    pessoa,
    isAdmin: pessoa?.is_admin === true,
    refresh: async () => {
      const { data } = await supabase.auth.getSession();
      await hydrate(data.session);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}