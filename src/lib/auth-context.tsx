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
  tipo_user_id: string | null;
};

type AuthCtx = {
  loading: boolean;
  session: Session | null;
  pessoa: PessoaCtx | null;
  isAdmin: boolean;
  isStaff: boolean;
  permissions: string[];
  hasPage: (key: string) => boolean;
  refresh: () => Promise<void>;
  // Impersonation (admin only)
  realPessoa: PessoaCtx | null;
  realIsAdmin: boolean;
  impersonating: boolean;
  startImpersonation: (pessoaId: string) => Promise<void>;
  stopImpersonation: () => void;
};

const Ctx = createContext<AuthCtx>({
  loading: true,
  session: null,
  pessoa: null,
  isAdmin: false,
  isStaff: false,
  permissions: [],
  hasPage: () => false,
  refresh: async () => {},
  realPessoa: null,
  realIsAdmin: false,
  impersonating: false,
  startImpersonation: async () => {},
  stopImpersonation: () => {},
});

async function loadPessoa(session: Session | null): Promise<PessoaCtx | null> {
  if (!session?.user) return null;
  const uid = session.user.id;
  const email = session.user.email ?? null;

  const cols = "id, nome_completo, email, familia_id, is_admin, auth_user_id, tipo_user_id, cidade_residencia";

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
  const [realPessoa, setRealPessoa] = useState<PessoaCtx | null>(null);
  const [impersonated, setImpersonated] = useState<PessoaCtx | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [tipoNome, setTipoNome] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTipo = async (tipoUserId: string | null) => {
    if (tipoUserId) {
      const { data } = await supabase
        .from("tipos_user")
        .select("paginas, nome")
        .eq("id", tipoUserId)
        .maybeSingle();
      setPermissions((data?.paginas as string[]) ?? []);
      setTipoNome((data?.nome as string) ?? null);
    } else {
      setPermissions([]);
      setTipoNome(null);
    }
  };

  const loadPessoaById = async (id: string): Promise<PessoaCtx | null> => {
    const cols = "id, nome_completo, email, familia_id, is_admin, auth_user_id, tipo_user_id";
    const { data } = await supabase.from("pessoas").select(cols).eq("id", id).maybeSingle();
    return (data as PessoaCtx) ?? null;
  };

  const hydrate = async (s: Session | null) => {
    setSession(s);
    const p = await loadPessoa(s);
    setRealPessoa(p);

    // Check stored impersonation (only honored if real user is admin)
    let active: PessoaCtx | null = p;
    if (typeof window !== "undefined" && p?.is_admin) {
      const impId = window.localStorage.getItem("impersonate_pessoa_id");
      if (impId && impId !== p.id) {
        const imp = await loadPessoaById(impId);
        if (imp) {
          setImpersonated(imp);
          active = imp;
        } else {
          window.localStorage.removeItem("impersonate_pessoa_id");
          setImpersonated(null);
        }
      } else {
        setImpersonated(null);
      }
    } else {
      setImpersonated(null);
    }

    await loadTipo(active?.tipo_user_id ?? null);
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

  const pessoa = impersonated ?? realPessoa;
  const isStaff = (tipoNome ?? "").trim().toLowerCase() === "equipa";
  const effectiveIsAdmin = pessoa?.is_admin === true;
  const value: AuthCtx = {
    loading,
    session,
    pessoa,
    isAdmin: effectiveIsAdmin,
    isStaff,
    permissions,
    hasPage: (key: string) =>
      effectiveIsAdmin || (isStaff && key !== "tipos-user") || permissions.includes(key),
    refresh: async () => {
      const { data } = await supabase.auth.getSession();
      await hydrate(data.session);
    },
    realPessoa,
    realIsAdmin: realPessoa?.is_admin === true,
    impersonating: !!impersonated,
    startImpersonation: async (pessoaId: string) => {
      if (!realPessoa?.is_admin) return;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("impersonate_pessoa_id", pessoaId);
      }
      const imp = await loadPessoaById(pessoaId);
      setImpersonated(imp);
      await loadTipo(imp?.tipo_user_id ?? null);
    },
    stopImpersonation: () => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("impersonate_pessoa_id");
      }
      setImpersonated(null);
      loadTipo(realPessoa?.tipo_user_id ?? null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}