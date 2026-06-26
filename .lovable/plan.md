# Acompanhamento (Casos de Apoio) — módulo novo

**Importante**: módulo **novo e independente**. O módulo existente "Atividades" mantém-se sem alterações. Este novo módulo chama-se **Acompanhamento** e gere **Casos de Apoio**: cada caso tem mediadora atribuída, registo cronológico estruturado, objetivos, transferências, e pode ser aberto por staff ou pela própria pessoa.

## 1. Base de dados (1 migração)

**Tabelas novas** (todas com GRANT + RLS + trigger updated_at):

- `casos_apoio` — `numero` (CASO-YYYY-NNNN, gerado por trigger via sequence anual), `pessoa_id`, `familia_id` (auto-preenchido por trigger a partir de `pessoa`), `mediadora_id`, `area`, `titulo`, `descricao`, `estado` (default 'Novo'), `prioridade`, `origem` ('Mediadora'|'Auto-pedido'), `objetivo`, `resultado_final`, `data_abertura`, `data_conclusao`, `data_prevista_conclusao`, `created_by_auth_id`.
- `caso_registos` — `caso_id`, `autor_id`, `tipo`, `titulo`, `conteudo`, `visivel_para_pessoa`, `estado_anterior`, `estado_novo`, `data`. Trigger atualiza `casos_apoio.updated_at`.
- `caso_objetivos` — `caso_id`, `descricao`, `estado`, `prazo`, `notas`, `position`.
- `caso_transferencias` — `caso_id`, `mediadora_saida_id`, `mediadora_entrada_id`, `data`, `motivo`, `notas_transicao` (NOT NULL).

**RLS** via `is_current_user_staff()` / `current_user_pessoa_id()`:
- Staff/admin: tudo.
- Pessoa autenticada não-staff: SELECT casos próprios; INSERT auto-pedido; SELECT/INSERT em `caso_registos` próprios e visíveis (`Resposta da pessoa`); sem acesso a objetivos/transferências.

**RPC** `count_casos_novos()` para badge.

## 2. Sidebar e rotas

- Insert em `sidebar_items` para **"Acompanhamento"** no grupo "Gestão de Participantes" depois de Projetos (ícone `FolderOpen`, url `/casos`, badge `count_casos_novos`). **Não toca** no item "Atividades" existente.
- Rotas novas:
  - `src/routes/_app/_admin.casos.tsx` (layout `<Outlet />`)
  - `src/routes/_app/_admin.casos.index.tsx` (lista)
  - `src/routes/_app/_admin.casos.$id.tsx` (detalhe)
- Adicionar "Acompanhamento" ao `CommandPalette`.

## 3. Lista `/casos`

4 cards (Novos, Em curso, Alta prioridade, Auto-pedidos pendentes), banner âmbar para casos sem mediadora, toolbar com filtros multi + "Novo caso", `SmartTable` (Nº, Pessoa/Família, Área, Título, Mediadora com popover "Atribuir", Prioridade, Estado, Origem, #Registos, Abertura), agrupável.

## 4. Detalhe `/casos/$id`

Layout 2 colunas:
- **Sidebar `w-80` sticky**: identidade (titulo inline-editable, badges com selects inline), pessoa (clica abre `FamilyDetailDialog`), info do caso (mediadora, datas), objetivo, progresso de objetivos, ações (Adicionar registo, Transferir, Concluir, Arquivar).
- **Tabs**: Registos (default) | Objetivos | Timeline | Transferências.

**Tab Registos**:
- Toggle "Ver como a pessoa vê".
- Cards com bordas distintivas (Nota interna âmbar, Resposta azul), EyeOff para ocultos, toggle de visibilidade por card (staff).
- Compose box **sempre visível** no fundo: select tipo + textarea + switch "Visível para a pessoa" + botão.

**Tab Objetivos**: lista inline-editável, drag-reorder por `position`.

**Tab Timeline**: vista cronológica unificada com filtro.

**Tab Transferências**: lista de handovers.

**Sheets**:
- Transferir: nova mediadora, motivo, notas obrigatórias → cria transferência + update mediadora + registo `Atualização de estado` invisível.
- Concluir: resultado final, data, estado final, checkboxes para fechar objetivos restantes.

## 5. Novo Caso Sheet

Usado em: lista, FamilyDetailDialog, perfil da pessoa.
Campos: pessoa (combobox staff / pré-preenchido pessoa), área (toggle icons), título (auto-sugestão), descrição, objetivo, prioridade (staff), mediadora (staff opcional → estado Novo/Em análise), objetivos específicos.

Staff: cria com `origem='Mediadora'` + registo "Caso aberto" + objetivos + navega.
Pessoa: cria `Auto-pedido` Novo sem mediadora + registo `Resposta da pessoa` visível + notifica staff (`novo_auto_pedido`) + sucesso inline.

## 6. Perfil — "O Meu Apoio"

Secção em `src/routes/_app.perfil.tsx` visível só a não-staff:
- "Pedir apoio" (CTA) abre o Novo Caso Sheet em modo auto-pedido.
- Cards dos casos próprios: área, título, estado, mediadora ou "A aguardar atribuição", últimos 2 registos visíveis com expand, caixa "Responder" (cria registo `Resposta da pessoa` + notifica mediadora `resposta_pessoa`).
- Linguagem calorosa: "o teu pedido", "a tua mediadora", "a equipa MEERU vai responder em breve".

## 7. FamilyDetailDialog

Nova tab "Casos" depois de "Atividades" (não substitui Atividades): lista compacta dos casos dos membros + botão "Novo caso" com família pré-contextualizada.

## 8. Notificações

Em `NotificationsBell` mapear `novo_auto_pedido` (FolderOpen azul, para staff), `resposta_pessoa` (MessageCircle, para mediadora), `caso_sem_mediadora` (AlertCircle âmbar). Usar `notificar_staff()` com `group_key` para deduplicação.

## Notas técnicas

- `numero`: trigger BEFORE INSERT usa sequence anual criada on-the-fly.
- `familia_id` auto-preenchido por trigger se NULL.
- Trigger em `caso_registos` toca `casos_apoio.updated_at`.
- Mudança de `casos_apoio.estado` cria automaticamente registo `Atualização de estado` para garantir histórico.
- Optimistic updates em mudanças inline.
- Reutiliza `SmartTable`, `InlineMultiSelect`, `InlineEdit`, padrões existentes.
- **Não modifica** `atividades_catalogo`, `familia_atividades`, nem a página `/atividades`.

Confirma para avançar.
