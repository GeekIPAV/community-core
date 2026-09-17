import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EnviarFolhaKmInput = {
  folhaId: string;
  nome: string;
  emailPessoa: string | null;
  periodo?: string | null;
  totalKm: number;
  totalValor: number;
  ficheiroNome: string;
  ficheiroBase64: string;
};

const FINANCE_EMAIL = "finance@meeru.org";

const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

// Mês da folha: inferido das datas das linhas de KM (mês mais frequente);
// em alternativa usa o período guardado ou o mês atual.
function calcularMes(linhas: Array<Record<string, unknown>>, periodo?: string | null): string {
  const contagem = new Map<string, number>();
  for (const linha of linhas) {
    const data = typeof linha?.data === "string" ? linha.data : "";
    const m = data.match(/^(\d{4})-(\d{2})/);
    if (m) contagem.set(`${m[1]}-${m[2]}`, (contagem.get(`${m[1]}-${m[2]}`) ?? 0) + 1);
  }
  let melhor: { chave: string; n: number } | null = null;
  for (const [chave, n] of contagem)
    if (!melhor || n > melhor.n || (n === melhor.n && chave < melhor.chave)) melhor = { chave, n };
  if (melhor) {
    const [ano, mes] = melhor.chave.split("-").map(Number);
    return `${MESES_PT[mes - 1]} de ${ano}`;
  }
  if (periodo && periodo.trim()) return periodo.trim();
  const hoje = new Date();
  return `${MESES_PT[hoje.getMonth()]} de ${hoje.getFullYear()}`;
}

export const enviarFolhaKm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EnviarFolhaKmInput) => input)
  .handler(async ({ data, context }) => {
    const { enviarFolhaPorEmail } = await import("./folha-km.server");

    const destinatarios = [FINANCE_EMAIL];
    if (data.emailPessoa && data.emailPessoa.includes("@")) destinatarios.push(data.emailPessoa);

    const eur = (v: number) => `${v.toFixed(2).replace(".", ",")}€`;

    const { data: folha } = await context.supabase
      .from("folhas_km")
      .select("iban, matricula, linhas, periodo")
      .eq("id", data.folhaId)
      .maybeSingle();

    const iban = folha?.iban?.trim() || "(por preencher)";
    const mes = calcularMes(
      Array.isArray(folha?.linhas) ? (folha!.linhas as Array<Record<string, unknown>>) : [],
      data.periodo,
    );
    const vars: Record<string, string> = {
      pessoa_nome: data.nome,
      mes,
      mes_sufixo: ` — ${mes}`,
      mes_frase: ` referente a ${mes}`,
      periodo: data.periodo ?? mes,
      periodo_sufixo: ` — ${mes}`,
      periodo_frase: ` referente a ${mes}`,
      total_km: data.totalKm.toLocaleString("pt-PT"),
      total_valor: eur(data.totalValor),
      iban,
      matricula: folha?.matricula ?? "",
    };
    const render = (tpl: string) =>
      tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k: string) => vars[k] ?? "");

    const { data: template } = await context.supabase
      .from("email_templates")
      .select("assunto, conteudo_html, ativo")
      .eq("chave", "folha_km")
      .maybeSingle();

    const assunto =
      template?.ativo && template.assunto
        ? render(template.assunto)
        : `Folha de KM — ${data.nome}${vars.periodo_sufixo}`;

    const corpoHtml =
      template?.ativo && template.conteudo_html
        ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937">${render(template.conteudo_html)}</div>`
        : `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937">
        <p>Olá,</p>
        <p>Segue em anexo a <strong>Folha de KM</strong> de <strong>${data.nome}</strong>${vars.periodo_frase}.</p>
        <ul>
          <li>Total de KM: <strong>${vars.total_km}</strong></li>
          <li>Total a reembolsar: <strong>${vars.total_valor}</strong></li>
          <li>IBAN para pagamento: <strong>${iban}</strong></li>
        </ul>
        <p style="color:#6b7280;font-size:12px">Documento gerado automaticamente pela plataforma MEERU.</p>
      </div>`;

    let erro: string | null = null;
    try {
      await enviarFolhaPorEmail({
        para: destinatarios,
        assunto,
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
