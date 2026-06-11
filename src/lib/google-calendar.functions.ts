import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: any) {
  const { data, error } = await ctx.supabase.rpc("is_current_user_admin");
  if (error) throw error;
  if (!data) throw new Error("Acesso restrito a administradores");
}

export const syncAcaoToGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { acaoId: string; op: "upsert" | "delete" }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { pushAcaoToGoogle } = await import("./google-calendar.server");
    return await pushAcaoToGoogle(data.acaoId, data.op);
  });

export const resyncAllToGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { resyncAllAcoesToGoogle } = await import("./google-calendar.server");
    return await resyncAllAcoesToGoogle();
  });