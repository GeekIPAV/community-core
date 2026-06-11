## Objetivo

Ligar o calendário Google da conta Meeru à app, de forma que:
- Criar/editar/apagar uma ação na app → reflete-se imediatamente no Google Calendar.
- Criar/editar/apagar um evento no Google Calendar da Meeru → reflete-se imediatamente como ação na app.
- Mapeamento: **nome, data início/fim, local, link para a página da ação**.

## Pré-requisitos (passo manual do utilizador)

1. Ligar o **conector Google Calendar do Lovable** com a conta Google da Meeru (o conector usa OAuth dessa conta — todas as chamadas vão para o calendário "primary" dessa conta).
2. Confirmar que é mesmo o calendário principal dessa conta (ou indicar o ID se for outro).

## O que vou construir

### 1. Base de dados (migração)

- Adicionar a `acoes`:
  - `google_event_id text` — ID do evento no Google Calendar (para conseguir editar/apagar do outro lado).
  - `google_sync_origin text` — marca a última origem do save (`app` ou `google`) para evitar loops.
- Nova tabela `google_calendar_sync_state` com um único registo: `sync_token text`, `channel_id text`, `channel_resource_id text`, `channel_expires_at timestamptz`. Guarda o estado da sincronização incremental e do canal de push notifications.

### 2. App → Google (push para o calendário)

- Server function `syncAcaoToGoogle({ acaoId, op: 'upsert' | 'delete' })`:
  - Lê a ação, chama a API do Google Calendar via gateway do conector:
    - `POST /calendars/primary/events` (criar) ou `PATCH /calendars/primary/events/{id}` (editar) ou `DELETE` (apagar).
  - Mapeia: `summary = nome`, `start/end = data_inicio/data_fim`, `location = local`, `description` inclui o link `https://<app>/acao/<id>`.
  - Guarda o `google_event_id` devolvido e marca `google_sync_origin='app'`.
- Disparada **automaticamente** ao guardar/apagar ações nas páginas de admin (`/acoes`, importação em massa, edição inline) e ao alterar via detalhe da ação.
- Se a sincronização falhar, a operação local não é revertida; mostra-se toast "Guardado, mas falhou sincronizar com Google Calendar" com botão "Tentar novamente".

### 3. Google → App (puxar do calendário) em tempo real

Tempo real no Google Calendar funciona por **push notifications**: registamos um canal (`events.watch`) que aponta para um webhook nosso; quando algo muda, a Google faz um POST a esse webhook (sem o conteúdo da mudança), e nós chamamos `events.list` com `syncToken` para obter o delta.

- Rota pública `POST /api/public/webhooks/google-calendar`:
  - Valida o header `X-Goog-Channel-Token` (segredo partilhado guardado em secret).
  - Chama uma server function interna que faz `events.list?syncToken=...` ao calendário, percorre o delta:
    - Para cada evento: se tem `google_event_id` correspondente em `acoes` → atualiza; senão → cria nova ação (`status='rascunho'`, `google_sync_origin='google'`).
    - `status='cancelled'` no Google → apaga (ou marca como cancelada) a ação correspondente.
  - Atualiza o `sync_token`.
- Server function `ensureGoogleCalendarWatch()` que (re)regista o canal de push se não existir ou se estiver perto de expirar (canais Google duram no máximo ~7 dias). Chamada:
  - Manualmente via botão "Ativar sincronização" na página de administração (primeira vez).
  - Por um `pg_cron` diário que renova canais a < 24 h da expiração.

### 4. Anti-loop

Quando o webhook do Google traz uma alteração, gravamos com `google_sync_origin='google'`. O hook de "App → Google" ignora saves cuja origem é `google`. Mesma lógica no sentido inverso: alterações vindas da app não voltam a ser empurradas para o Google a partir do delta (porque já têm o mesmo `google_event_id` e os mesmos campos — fazemos diff antes de chamar a API).

### 5. UI

- Em `/acoes`, novo card "Google Calendar" com:
  - Estado: "Ligado / Não ligado / Canal expira em X dias".
  - Botão "Ativar sincronização" (chama `ensureGoogleCalendarWatch`).
  - Botão "Sincronizar agora" (força um `events.list` manual — útil para o primeiro carregamento e debug).
- Em cada ação, badge discreto "↻ Google" quando tem `google_event_id`.

## Detalhes técnicos

- **Conector**: `google_calendar` via `connector-gateway.lovable.dev/google_calendar/calendar/v3/...`. Todas as chamadas autenticadas com `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${GOOGLE_CALENDAR_API_KEY}` dentro de server functions (nunca no browser).
- **Webhook URL** registado na Google: `https://project--<id>.lovable.app/api/public/webhooks/google-calendar` (URL estável, não muda em renomeações).
- **Segredos**:
  - `GOOGLE_CALENDAR_API_KEY` (vem automático ao ligar o conector).
  - `GOOGLE_CALENDAR_WEBHOOK_TOKEN` (gero e peço para guardares — usado como `X-Goog-Channel-Token`).
- **Renovação do canal**: job `pg_cron` que chama um endpoint `/api/public/cron/renew-google-watch` autenticado pelo `apikey` do Supabase.

## Limitações conhecidas (que aceitas implicitamente ao escolher bidirecional)

- Eventos recorrentes da Google são tratados como uma única ação "mestre" (não criamos uma ação por ocorrência); editar uma ocorrência individual no Google só atualiza a master.
- Conflitos resolvidos por last-write-wins (quem guardou mais tarde ganha).
- Eventos criados pelo Google sem data de fim assumem 1h de duração.
- Convidados/lembretes do Google não são importados (não há campo correspondente em `acoes`).

## Ordem de implementação

```text
1. Ligar conector Google Calendar (passo manual teu)
2. Migração: colunas em acoes + tabela google_calendar_sync_state
3. Server fns: syncAcaoToGoogle (upsert/delete) + integrar nos saves
4. Webhook /api/public/webhooks/google-calendar + processador de delta
5. ensureGoogleCalendarWatch + UI (card em /acoes)
6. Cron diário de renovação do canal
7. Backfill inicial: importar eventos existentes do Google (botão "Importar tudo agora")
```

Confirma o passo 1 (ligar o conector com a conta Google da Meeru) e eu avanço com tudo o resto.