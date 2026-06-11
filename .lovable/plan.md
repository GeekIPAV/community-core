## Plano de melhorias

Vou organizar as melhorias em fases para entregar valor cedo. Cada fase é independente — podes pedir para implementar só algumas.

---

### Fase 1 — UX & Performance (rápido, alto impacto)

- **Pesquisa global** no topo (Cmd/Ctrl+K): salta para participantes, ações, famílias.
- **Filtros guardados** nas listas (ações, participantes): guardar combinações de filtros como "vistas" reutilizáveis (já existe a tabela `vistas_guardadas` — vou ligá-la à UI).
- **Paginação/virtualização** das tabelas grandes (participantes, ações) para evitar lentidão com muitos registos.
- **Loading skeletons** consistentes em vez de spinners.
- **Atalhos de teclado** nas tabelas: setas para navegar, espaço para selecionar, `e` para editar.

### Fase 2 — Portal Público & SEO

- **Página individual de cada evento** (`/evento/:slug`) partilhável, com metadados Open Graph dinâmicos (título, descrição, imagem do evento).
- **Inscrição online** a partir do portal público com confirmação por email (usa Fase 4).
- **Sitemap dinâmico** que inclui todos os eventos públicos.
- **JSON-LD `Event`** para aparecer melhor no Google (data, local, organizador).
- **Imagem de capa** opcional por evento (já há suporte? verifico e adiciono se faltar).

### Fase 3 — Gestão de Participantes & Relatórios

- **Importação CSV** em massa com mapeamento de colunas e pré-visualização antes de gravar.
- **Exportação** das listas filtradas para CSV/Excel.
- **Histórico de presenças** por participante na ficha individual (cronologia das ações em que esteve).
- **Etiquetas/tags** livres em participantes (ex: "voluntário", "novo", "vulnerável") com filtro.
- **Dashboard com KPIs**: participantes ativos, ações por mês, taxa de presença, top atividades — com gráficos.
- **Exportação PDF/Excel** de relatórios (lista de presenças por ação, resumo mensal).

### Fase 4 — Emails automáticos

Usar o sistema de emails da plataforma (templates React Email, domínio próprio):

- **Confirmação de inscrição** enviada ao participante.
- **Lembrete 24h antes** da ação (cron job que corre de manhã).
- **Follow-up pós-evento** (opcional, 1 dia depois).
- Templates editáveis com cores/branding do Meeru.

> Vou precisar de configurar um domínio de envio (ex: `notify.appmeeru.lovable.app` ou subdomínio teu). Pergunto no momento de implementar.

### Fase 5 — QR Code de presenças

- Cada ação gera um **QR code único** que o coordenador mostra (ou imprime).
- Página `/checkin/:token` onde o participante (autenticado) faz check-in com 1 toque.
- Alternativa: app do coordenador faz scan do cartão do participante.
- Marca presença automática em `inscricoes`/presenças.

---

### Detalhes técnicos

- **Tabelas novas/alteradas**: `etiquetas`, `pessoa_etiquetas`, `acao_checkin_tokens`; colunas `acoes.slug`, `acoes.imagem_capa`, `acoes.descricao_publica`.
- **Server functions novas**: `importParticipantesCSV`, `exportRelatorio`, `enviarLembretes` (cron), `criarTokenCheckin`, `registarPresencaViaQR`.
- **Rotas novas**: `/evento/$slug` (público), `/_app/_admin.dashboard`, `/checkin/$token`, `/_app/_admin.importar`.
- **Cron**: pg_cron diário às 09:00 chama `/api/public/hooks/lembretes-eventos`.
- **Componentes**: `CommandPalette`, `DataTablePro` (virtualizada), `KpiCard`, `EventCard` (público), `QrCodeDisplay`.

---

### Sugestão de ordem

1. **Fase 2** (Portal público + página individual de evento) — entrega visível imediata.
2. **Fase 4** (Emails) — depende do domínio mas alto valor.
3. **Fase 3** (Importação/exportação + dashboard).
4. **Fase 5** (QR check-in).
5. **Fase 1** (UX/performance) — polish contínuo.

Diz-me por **qual fase queres começar** (ex: "Fase 2", ou "Fases 2 e 4"), ou se queres reordenar/cortar algo.