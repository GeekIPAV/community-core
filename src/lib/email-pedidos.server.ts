import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1";

function admin() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function gmailHeaders() {
  return {
    Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": process.env.GOOGLE_MAIL_API_KEY!,
  };
}

async function gmailGet(path: string) {
  const res = await fetch(`${GATEWAY}${path}`, { headers: gmailHeaders() });
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${await res.text()}`);
  return res.json();
}

function decodeB64Url(s: string) {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    // eslint-disable-next-line no-undef
    return new TextDecoder("utf-8").decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  } catch {
    return "";
  }
}

function extractText(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeB64Url(payload.body.data);
  if (payload.parts) {
    for (const p of payload.parts) {
      if (p.mimeType === "text/plain" && p.body?.data) return decodeB64Url(p.body.data);
    }
    for (const p of payload.parts) {
      const t = extractText(p);
      if (t) return t;
    }
  }
  if (payload.body?.data) {
    const html = decodeB64Url(payload.body.data);
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}

function header(headers: any[], name: string) {
  return headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseFrom(raw: string): { from_email: string; from_name: string } {
  const m = raw.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { from_name: m[1].replace(/"/g, "").trim(), from_email: m[2].trim().toLowerCase() };
  return { from_name: "", from_email: raw.trim().toLowerCase() };
}

async function classify(subject: string, body: string): Promise<{
  is_help_request: boolean; score: number; motivos: string; idioma: string; resumo: string;
}> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { is_help_request: false, score: 0, motivos: "no api key", idioma: "", resumo: "" };
  const text = `${subject}\n\n${body}`.slice(0, 6000);
  const sys = `Analisa emails recebidos pela MEERU (organização de apoio a famílias migrantes em Portugal). Determina se o remetente está a pedir ajuda/apoio direto (ex.: documentos AIMA/SEF, habitação, alimentar, escola, saúde, emprego, tradução/intérprete, asilo, etc.). NÃO considerar pedido de ajuda: spam, newsletters, marketing, notificações automáticas, faturas, currículos para emprego na MEERU, parcerias institucionais.
Responde APENAS JSON: {"is_help_request": bool, "score": 0-100, "motivos": "frase curta em pt-PT", "idioma": "pt|en|uk|ru|ar|fr|outro", "resumo": "1-2 frases pt-PT"}`;
  const res = await fetch(`${AI_GATEWAY}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "system", content: sys }, { role: "user", content: text }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return { is_help_request: false, score: 0, motivos: `AI ${res.status}`, idioma: "", resumo: "" };
  const json: any = await res.json();
  try {
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    return {
      is_help_request: !!parsed.is_help_request,
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      motivos: String(parsed.motivos ?? ""),
      idioma: String(parsed.idioma ?? ""),
      resumo: String(parsed.resumo ?? ""),
    };
  } catch {
    return { is_help_request: false, score: 0, motivos: "parse error", idioma: "", resumo: "" };
  }
}

export async function syncGmailHelpRequests(opts: { maxMessages?: number } = {}) {
  const max = opts.maxMessages ?? 30;
  const sb = admin();

  const { data: state } = await sb.from("email_sync_state").select("*").eq("id", 1).maybeSingle();
  const lastInternal = state?.last_message_internal_date ? Number(state.last_message_internal_date) : 0;

  // Search inbox, exclude sent/spam/trash and self
  const q = encodeURIComponent("in:inbox -from:me newer_than:60d");
  const list = await gmailGet(`/users/me/messages?maxResults=${max}&q=${q}`);
  const messages: Array<{ id: string }> = list.messages ?? [];

  let inserted = 0, scanned = 0, maxInternal = lastInternal;

  for (const m of messages) {
    // Skip if already stored
    const { data: exists } = await sb
      .from("email_pedidos_ajuda")
      .select("id")
      .eq("gmail_message_id", m.id)
      .maybeSingle();
    if (exists) continue;

    const msg: any = await gmailGet(`/users/me/messages/${m.id}?format=full`);
    const internalDate = Number(msg.internalDate || 0);
    if (internalDate && internalDate > maxInternal) maxInternal = internalDate;
    if (lastInternal && internalDate && internalDate <= lastInternal) continue;

    scanned++;
    const headers = msg.payload?.headers ?? [];
    const subject = header(headers, "Subject");
    const fromRaw = header(headers, "From");
    const { from_email, from_name } = parseFrom(fromRaw);
    const body = extractText(msg.payload);
    const snippet = msg.snippet || "";

    const cls = await classify(subject, body || snippet);
    if (!cls.is_help_request || cls.score < 40) continue;

    const { error } = await sb.from("email_pedidos_ajuda").insert({
      gmail_message_id: m.id,
      gmail_thread_id: msg.threadId,
      from_email, from_name, subject, snippet,
      body_text: body.slice(0, 20000),
      received_at: internalDate ? new Date(internalDate).toISOString() : null,
      score: cls.score,
      motivos: cls.motivos,
      resumo: cls.resumo,
      idioma: cls.idioma,
      estado: "novo",
    });
    if (!error) inserted++;
  }

  await sb.from("email_sync_state").update({
    last_message_internal_date: maxInternal || lastInternal || null,
    last_synced_at: new Date().toISOString(),
    last_error: null,
  }).eq("id", 1);

  return { scanned, inserted, messages_total: messages.length };
}