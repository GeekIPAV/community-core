## Objetivo
Tornar a sincronização com o Google Calendar **unidirecional**: apenas o que é criado/editado/eliminado nas Ações é refletido no Google Calendar. Eventos criados ou alterados diretamente no Google Calendar **não** entram na app.

## Alterações

### 1. UI — `src/routes/_app/_admin.acoes.tsx`
- Simplificar o `GoogleCalendarSyncCard`: remover botão "Ativar sincronização" e estado de canal/expiração.
- Manter apenas indicador "Sincronização ativa (app → Google Calendar)" e, opcionalmente, um botão "Re-sincronizar tudo" que faz push em massa das ações existentes.
- Manter `fireGoogleSync` nos mutations de create/update/delete (push para Google).

### 2. Server functions — `src/lib/google-calendar.functions.ts`
- Remover `pullGoogleChanges` e `setupGoogleWatch` (e qualquer função relacionada com watch/sync token).
- Manter apenas as funções de push: criar/atualizar/eliminar evento no Google.
- Adicionar (opcional) `resyncAllAcoes` para reenviar todas as ações públicas/privadas para o Google.

### 3. Server helpers — `src/lib/google-calendar.server.ts`
- Manter `pushAcaoToGoogle` (upsert + delete).
- Remover `pullGoogleChanges`, `setupGoogleWatch` e lógica de `syncToken`/canais.

### 4. Webhook — `src/routes/api/public/webhooks/google-calendar.ts`
- Eliminar o ficheiro. Já não é necessário receber notificações do Google.

### 5. Base de dados — nova migração
- Remover a coluna `google_sync_origin` da tabela `acoes` (já não precisamos da proteção anti-loop, pois não há pull).
- Manter `google_event_id` em `acoes` (necessário para update/delete no Google).
- Eliminar a tabela `google_calendar_sync_state` (já não é usada).

### 6. Limpeza
- Remover imports não usados e referências a `google_sync_origin`, `sync_token`, `channel_*` em todo o código.

## Resultado
- Criar/editar/apagar uma ação na app → cria/atualiza/apaga o evento correspondente no Google Calendar do MEERU.
- Alterações feitas diretamente no Google Calendar são ignoradas pela app.
