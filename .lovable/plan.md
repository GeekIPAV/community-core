# Detecção de pedidos de ajuda via Gmail

Ler periodicamente a caixa Gmail ligada, detetar emails que pareçam pedidos de ajuda de famílias migrantes, e mostrá-los no painel para triagem (atribuir a uma família existente / criar caso de apoio / ignorar).

## 1. Base de dados

Nova tabela `email_pedidos_ajuda`:
- `id`, `gmail_message_id` (único), `gmail_thread_id`
- `from_email`, `from_name`, `subject`, `snippet`, `body_text`, `received_at`
- `score` (0-100) e `motivos` (texto: porque foi sinalizado)
- `idioma` detetado
- `estado`: `novo` | `atribuido` | `ignorado` | `arquivado`
- `pessoa_id` (FK pessoas, opcional), `familia_id` (FK familias, opcional), `caso_id` (FK casos_apoio, opcional)
- `atribuido_a` (auth.uid), `notas`, `created_at`, `updated_at`

RLS: apenas equipa (staff/admin) lê e edita. GRANTs para `authenticated` e `service_role`.

Tabela auxiliar `email_sync_state` (1 linha): `last_history_id`, `last_synced_at` — para sync incremental do Gmail.

## 2. Backend — sync + classificação

Server function `syncGmailPedidos` (auth, role staff):
- Lê via gateway Gmail: `GET /users/me/messages?q=newer_than:30d -in:sent -from:me` (na 1ª run) ou usa `history.list` com `last_history_id` (incremental).
- Para cada mensagem nova: busca `format=full`, extrai cabeçalhos + texto.
- Classifica com Lovable AI (gemini-2.5-flash) com prompt que devolve JSON `{ is_help_request, score, motivos, idioma, resumo }`. Heurísticas: palavras-chave (ajuda, apoio, refugiado, asilo, documentos, SEF/AIMA, habitação, alimentar, escola, saúde, emprego, tradução, intérprete, em PT/EN/UK/RU/AR/FR).
- Insere em `email_pedidos_ajuda` se `score >= 40`. Dedupe por `gmail_message_id`.
- Atualiza `email_sync_state.last_history_id`.

Server route pública `/api/public/cron/gmail-sync` (HMAC com `GMAIL_SYNC_SECRET`) para agendar via pg_cron de 15 em 15 min.

Server fns auxiliares: `listPedidosAjuda(filtros)`, `updatePedidoAjuda(id, { estado, pessoa_id, familia_id, caso_id, notas })`, `criarCasoApoioDePedido(id, dados)`.

## 3. UI — painel

Nova secção no Dashboard "Pedidos de ajuda por email" (cartão colapsável, top da página):
- Lista os `novo` com badge de score, remetente, assunto, snippet, idioma, data.
- Botão **Abrir** → diálogo com email completo, resumo IA, motivos, e ações:
  - Atribuir a pessoa/família existente (autocomplete).
  - **Criar caso de apoio** (abre formulário pré-preenchido).
  - **Ignorar** / **Arquivar**.
- Filtros: estado, score mínimo, intervalo de datas.

Nova página `/pedidos-ajuda` em Gestão com SmartTable completa (histórico, filtros, edição).

Notificação no sino quando entram novos pedidos com score ≥ 70.

## 4. Cron

`pg_cron` job de 15 em 15 min a chamar `/api/public/cron/gmail-sync` com header HMAC.

## Notas técnicas

- Gmail chamado via gateway `https://connector-gateway.lovable.dev/google_mail/gmail/v1/...` com `Authorization: Bearer $LOVABLE_API_KEY` + `X-Connection-Api-Key: $GOOGLE_MAIL_API_KEY`.
- Lê apenas (`gmail.readonly` já concedido). Não modifica/envia.
- Score e motivos guardados para o utilizador poder calibrar.
- Privacidade: emails ficam armazenados na BD; só staff acede via RLS.

Confirmas para avançar?