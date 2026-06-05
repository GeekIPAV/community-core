import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("pessoas")
    .select("is_admin")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.is_admin) throw new Error("Forbidden: admin only");
}

export type AuthUserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  pessoa: {
    id: string;
    nome_completo: string;
    email: string | null;
    is_admin: boolean;
    tipo_user_id: string | null;
    familia_id: string | null;
    status: string;
  } | null;
};

export const listAuthUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const all: any[] = [];
    let page = 1;
    // paginate
    // perPage max is 1000
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      all.push(...data.users);
      if (data.users.length < 200) break;
      page += 1;
      if (page > 50) break;
    }

    const ids = all.map((u) => u.id);
    const { data: pessoas, error: pErr } = await admin
      .from("pessoas")
      .select("id, nome_completo, email, is_admin, tipo_user_id, familia_id, status, auth_user_id")
      .in("auth_user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    if (pErr) throw new Error(pErr.message);

    const byAuth = new Map<string, any>();
    (pessoas ?? []).forEach((p: any) => byAuth.set(p.auth_user_id, p));

    const rows: AuthUserRow[] = all.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      pessoa: byAuth.get(u.id)
        ? {
            id: byAuth.get(u.id).id,
            nome_completo: byAuth.get(u.id).nome_completo,
            email: byAuth.get(u.id).email,
            is_admin: byAuth.get(u.id).is_admin,
            tipo_user_id: byAuth.get(u.id).tipo_user_id,
            familia_id: byAuth.get(u.id).familia_id,
            status: byAuth.get(u.id).status,
          }
        : null,
    }));

    rows.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
    return rows;
  });

export const linkAuthUserToPessoa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { auth_user_id: string; pessoa_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    // Clear any pessoa currently linked to this auth user
    await admin.from("pessoas").update({ auth_user_id: null }).eq("auth_user_id", data.auth_user_id);
    const { error } = await admin
      .from("pessoas")
      .update({ auth_user_id: data.auth_user_id })
      .eq("id", data.pessoa_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unlinkAuthUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { auth_user_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await admin
      .from("pessoas")
      .update({ auth_user_id: null })
      .eq("auth_user_id", data.auth_user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPessoaTipo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pessoa_id: string; tipo_user_id: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await admin
      .from("pessoas")
      .update({ tipo_user_id: data.tipo_user_id })
      .eq("id", data.pessoa_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPessoaAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pessoa_id: string; is_admin: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await admin
      .from("pessoas")
      .update({ is_admin: data.is_admin })
      .eq("id", data.pessoa_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });