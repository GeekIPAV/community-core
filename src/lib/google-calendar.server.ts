import { createClient } from "@supabase/supabase-js";

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const CALENDAR_ID = "primary";

function getAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function gatewayHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.LOVABLE_API_KEY!}`,
    "X-Connection-Api-Key": process.env.GOOGLE_CALENDAR_API_KEY!,
    "Content-Type": "application/json",
  };
}

function publicAppUrl(): string {
  return process.env.PUBLIC_APP_URL || "https://appmeeru.lovable.app";
}

async function gFetch(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...gatewayHeaders(), ...((init.headers as Record<string, string>) ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Calendar ${res.status}: ${body.slice(0, 500)}`);
  }
  if (res.status === 204) return null;
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

function acaoToEventBody(acao: any) {
  const start = acao.data_inicio ? new Date(acao.data_inicio) : null;
  const endRaw = acao.data_fim ? new Date(acao.data_fim) : null;
  const end = endRaw ?? (start ? new Date(start.getTime() + 60 * 60 * 1000) : null);
  if (!start || !end) throw new Error("Ação sem data de início válida para sincronizar");
  const url = `${publicAppUrl()}/acao/${acao.id}`;
  const desc = [acao.descricao?.trim(), url].filter(Boolean).join("\n\n");
  return {
    summary: acao.nome || "(sem título)",
    location: acao.local || undefined,
    description: desc,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };
}

export async function pushAcaoToGoogle(
  acaoId: string,
  op: "upsert" | "delete",
): Promise<{ ok: boolean; eventId?: string | null; skipped?: string }> {
  const admin = getAdminClient();
  const { data: acao, error } = await admin
    .from("acoes")
    .select("*")
    .eq("id", acaoId)
    .maybeSingle();
  if (error) throw error;

  if (op === "delete") {
    if (acao && (acao as any).google_event_id) {
      try {
        await gFetch(
          `/calendars/${CALENDAR_ID}/events/${(acao as any).google_event_id}`,
          { method: "DELETE" },
        );
      } catch (e) {
        if (!/ 410| 404/.test(String(e))) throw e;
      }
    }
    return { ok: true };
  }

  if (!acao) throw new Error("Ação não encontrada");
  if (!(acao as any).data_inicio) return { ok: false, skipped: "sem-data" };

  const body = acaoToEventBody(acao);
  let eventId: string | null = (acao as any).google_event_id ?? null;
  if (eventId) {
    try {
      await gFetch(`/calendars/${CALENDAR_ID}/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (/ 404| 410/.test(String(e))) {
        eventId = null;
      } else {
        throw e;
      }
    }
  }
  if (!eventId) {
    const created = await gFetch(`/calendars/${CALENDAR_ID}/events`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    eventId = created?.id ?? null;
  }
  await admin
    .from("acoes")
    .update({ google_event_id: eventId } as any)
    .eq("id", acaoId);
  return { ok: true, eventId };
}

export async function resyncAllAcoesToGoogle(): Promise<{
  total: number;
  ok: number;
  failed: number;
}> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("acoes")
    .select("id")
    .not("data_inicio", "is", null);
  if (error) throw error;
  const rows = (data ?? []) as { id: string }[];
  let ok = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      await pushAcaoToGoogle(r.id, "upsert");
      ok++;
    } catch (e) {
      console.error("[google-calendar] resync falhou", r.id, e);
      failed++;
    }
  }
  return { total: rows.length, ok, failed };
}