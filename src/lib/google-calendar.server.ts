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

function parseGoogleDate(g: any): string | null {
  if (!g) return null;
  if (g.dateTime) return new Date(g.dateTime).toISOString();
  if (g.date) return new Date(`${g.date}T00:00:00Z`).toISOString();
  return null;
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

  // anti-loop: if last write came from google, don't push back
  if ((acao as any).google_sync_origin === "google") {
    return { ok: false, skipped: "origem-google" };
  }

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
    .update({ google_event_id: eventId, google_sync_origin: "app" } as any)
    .eq("id", acaoId);
  return { ok: true, eventId };
}

export async function pullGoogleChanges(): Promise<{
  imported: number;
  updated: number;
  deleted: number;
}> {
  const admin = getAdminClient();
  const { data: state } = await admin
    .from("google_calendar_sync_state")
    .select("*")
    .eq("id", "primary")
    .maybeSingle();
  const syncToken = (state as any)?.sync_token ?? null;

  const fetchPage = async (pageToken?: string) => {
    const params = new URLSearchParams();
    if (syncToken && !pageToken) {
      params.set("syncToken", syncToken);
    } else if (!syncToken) {
      params.set("timeMin", new Date().toISOString());
      params.set("singleEvents", "true");
    }
    if (pageToken) params.set("pageToken", pageToken);
    params.set("maxResults", "250");
    return gFetch(`/calendars/${CALENDAR_ID}/events?${params.toString()}`);
  };

  let imported = 0;
  let updated = 0;
  let deleted = 0;
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  try {
    do {
      const page: any = await fetchPage(pageToken);
      for (const ev of (page?.items ?? []) as any[]) {
        if (ev.status === "cancelled") {
          const { data: existing } = await admin
            .from("acoes")
            .select("id")
            .eq("google_event_id", ev.id)
            .maybeSingle();
          if (existing) {
            await admin.from("acoes").delete().eq("id", (existing as any).id);
            deleted++;
          }
          continue;
        }
        const start = parseGoogleDate(ev.start);
        const end = parseGoogleDate(ev.end);
        if (!start) continue;
        const payload: any = {
          nome: ev.summary || "(sem título)",
          local: ev.location || null,
          data_inicio: start,
          data_fim: end,
          google_event_id: ev.id,
          google_sync_origin: "google",
        };
        const { data: existing } = await admin
          .from("acoes")
          .select("id")
          .eq("google_event_id", ev.id)
          .maybeSingle();
        if (existing) {
          await admin.from("acoes").update(payload).eq("id", (existing as any).id);
          updated++;
        } else {
          await admin.from("acoes").insert({
            ...payload,
            status: "rascunho",
            inscricoes_abertas: false,
            bolsa_transporte: false,
            projeto_ids: [],
            restrito_a_projetos: false,
            config_campos: { fields: [] },
          });
          imported++;
        }
      }
      pageToken = page?.nextPageToken;
      nextSyncToken = page?.nextSyncToken ?? nextSyncToken;
    } while (pageToken);
  } catch (e) {
    if (/ 410/.test(String(e))) {
      await admin
        .from("google_calendar_sync_state")
        .upsert({ id: "primary", sync_token: null });
      throw new Error("Token de sincronização expirou. Clica em 'Sincronizar agora' novamente.");
    }
    throw e;
  }

  await admin.from("google_calendar_sync_state").upsert({
    id: "primary",
    sync_token: nextSyncToken ?? syncToken,
    last_synced_at: new Date().toISOString(),
    channel_id: (state as any)?.channel_id ?? null,
    channel_resource_id: (state as any)?.channel_resource_id ?? null,
    channel_expires_at: (state as any)?.channel_expires_at ?? null,
  });

  return { imported, updated, deleted };
}

export async function setupGoogleWatch(): Promise<{
  channelId: string;
  expiresAt: string | null;
}> {
  const admin = getAdminClient();

  // stop previous channel if any
  const { data: prev } = await admin
    .from("google_calendar_sync_state")
    .select("*")
    .eq("id", "primary")
    .maybeSingle();
  if ((prev as any)?.channel_id && (prev as any)?.channel_resource_id) {
    try {
      await gFetch(`/channels/stop`, {
        method: "POST",
        body: JSON.stringify({
          id: (prev as any).channel_id,
          resourceId: (prev as any).channel_resource_id,
        }),
      });
    } catch {
      /* ignore */
    }
  }

  // do an initial pull first so we have a syncToken
  await pullGoogleChanges();

  const channelId = crypto.randomUUID();
  const token = process.env.GOOGLE_CALENDAR_WEBHOOK_TOKEN!;
  const address = `${publicAppUrl()}/api/public/webhooks/google-calendar`;
  const res: any = await gFetch(`/calendars/${CALENDAR_ID}/events/watch`, {
    method: "POST",
    body: JSON.stringify({ id: channelId, type: "web_hook", address, token }),
  });
  const expiresAt = res?.expiration
    ? new Date(Number(res.expiration)).toISOString()
    : null;
  await admin.from("google_calendar_sync_state").upsert({
    id: "primary",
    channel_id: res?.id ?? channelId,
    channel_resource_id: res?.resourceId ?? null,
    channel_expires_at: expiresAt,
  });
  return { channelId: res?.id ?? channelId, expiresAt };
}