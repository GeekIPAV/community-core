import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EnviarFolhaKmInput = {
  folhaId: string;
  nome: string;
  emailPessoa: string | null;
  periodo: string | null;
  totalKm: number;
  totalValor: number;
  ficheiroNome: string;
  ficheiroBase64: string;
};

const FINANCE_EMAIL = "finance@meeru.org";

export const enviarFolhaKm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EnviarFolhaKmInput) => input)
  .handler(async ({ data, context }) => {
    const { enviarFolhaPorEmail } = await import("./folha-km.server");

    const destinatarios = [FINANCE_EMAIL];
    if (data.emailPessoa && data.emailPessoa.includes("@")) destinatarios.push(data.emailPessoa);

    const eur = (v: number) => `${v.toFixed(2).replace(".", ",")}€`;
    const corpoHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937">
        <p>Olá,</p>
        <p>Segue em anexo a <strong>Folha de KM</strong> de <strong>${data.nome}</strong>${
          data.periodo ? ` referente a ${data.periodo}` : ""
        }.</p>
        <ul>
          <li>Total de KM: <strong>${data.totalKm.toLocaleString("pt-PT")}</strong></li>
          <li>Total a reembolsar: <strong>${eur(data.totalValor)}</strong></li>
        </ul>
        <p style="color:#6b7280;font-size:12px">Documento gerado automaticamente pela plataforma MEERU.</p>
      </div>`;

    let erro: string | null = null;
    try {
      await enviarFolhaPorEmail({
        para: destinatarios,
        assunto: `Folha de KM — ${data.nome}${data.periodo ? ` (${data.periodo})` : ""}`,
        corpoHtml,
        ficheiroNome: data.ficheiroNome,
        ficheiroBase64: data.ficheiroBase64,
      });
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
    }

    await context.supabase
      .from("folhas_km")
      .update({
        enviado_em: erro ? null : new Date().toISOString(),
        enviado_para: erro ? [] : destinatarios,
        erro_envio: erro,
        estado: erro ? "erro_envio" : "enviada",
      })
      .eq("id", data.folhaId);

    if (erro) throw new Error(erro);
    return { ok: true, destinatarios };
  });
