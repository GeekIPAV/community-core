import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: any) {
  const { data, error } = await ctx.supabase.rpc("is_current_user_admin");
  if (error) throw error;
  if (!data) throw new Error("Acesso restrito a administradores");
}

export const sincronizarEmailPedidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { syncGmailHelpRequests } = await import("./email-pedidos.server");
    return await syncGmailHelpRequests({ maxMessages: 50 });
  });