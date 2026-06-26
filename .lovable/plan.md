## Objetivo
Criar um módulo **Relatórios** que permite à equipa MEERU compor relatórios de impacto para financiadores, combinando dados vivos da plataforma com texto narrativo, com snapshots de auditoria e exportação (clipboard / Word / impressão).

## Part 1 — Base de dados (migration única)
Tabelas em `public` com grants (`authenticated`, `service_role`) e RLS por staff (`is_admin_or_staff()` já existente):

- **`relatorios`** — campos pedidos. FK `projeto_id → projetos`, `criado_por_id → pessoas`. Trigger `updated_at`.
- **`relatorio_secoes`** — `relatorio_id` ON DELETE CASCADE, `tipo` CHECK in (`texto|indicadores|atividades|participantes|casos|citacao|separador`), `position int`.
- **`relatorio_snapshots`** — `dados jsonb`, `criado_em`, `criado_por_id`.

RLS: staff (admin/equipa) faz tudo; sem acesso anon.

## Part 2 — Sidebar + rotas
- Inserir item `Relatórios` em `sidebar_items` no grupo "Projetos & Comunidade", após Projetos (`page="relatorios"`, ícone `FileBarChart`).
- Rotas TanStack:
  - `src/routes/_app/_admin.relatorios.tsx` (layout `<Outlet/>`)
  - `_admin.relatorios.index.tsx` (lista)
  - `_admin.relatorios.$id.tsx` (editor)
- Badge no item via query (`em_revisao` ou `prevista <= today+14`).
- Adicionar ao `command-palette.tsx`.

## Part 3 — Página de lista
- 4 SummaryCards (Rascunhos / Em revisão / A submeter 14d / Submetidos no ano).
- Alert banner vermelho se prazo < 7 dias.
- Toolbar: pesquisa + filtros (financiador, tipo, estado, projeto) + "Novo relatório".
- `SmartTable` com colunas pedidas, badges coloridos por estado, célula "Submissão prevista" com `Atrasado`/contagem decrescente/data.
- Agrupável por financiador/tipo/estado/projeto. Row click → editor.
- **Sheet "Novo relatório"** (max-w-lg) com campos pedidos + datalist de financiadores + passo seguinte de **template** (3 cards): Gulbenkian IGI Intercalar, BPI Solidário Final, Genérico, ou "em branco". Ao gravar: cria `relatorios` + seed das secções do template (ou uma secção `texto`/"Introdução") → navigate.

## Part 4 — Editor `/relatorios/$id`
- Breadcrumb + top bar sticky (título inline editável, badges, estado dropdown, "Guardar" indicator, dropdown Exportar, botão Submeter se `Aprovado`).
- Layout 2 colunas: **Documento** (flex-1) + **Data panel** (w-72 sticky).
- Render ordenado de secções (drag-and-drop com `@dnd-kit` já instalado, ou setas se ausente — verificar).
- Cada secção: handle (`GripVertical` no hover), menu ⋮ (mover/duplicar/eliminar), badge de tipo.
- Entre secções: botão "+ Adicionar secção" com popover (7 tipos).

### Componentes por tipo
- **`SecaoTexto`** — heading editável + `RichTextEditor` existente, autosave debounce 1s.
- **`SecaoIndicadores`** — config (multi-select KPIs do projeto, toggles meta/progresso) + grid 2 cols de cards KPI com barra de progresso (verde/azul/âmbar conforme %).
- **`SecaoAtividades`** — config (projeto, datas, group by) + sumário X ações/Y participações/Z únicos + tabela compacta (data, nome, local, participantes).
- **`SecaoParticipantes`** — config (projetos, breakdown) + top stats + tabela breakdown + barras CSS horizontais.
- **`SecaoCasos`** — config (áreas, estados) + sumário + tabela por área (abertos/concluídos/em curso).
- **`SecaoCitacao`** — bloco grande com `"texto"` + `— autor`, ambos inline editáveis.
- **`SecaoSeparador`** — `<hr>` + label opcional editável; page-break em print.

Hook `useRelatorioSecaoMutation` para PATCH/insert/delete + invalidação otimista.

## Part 5 — Data panel direito
Hook `useRelatorioPeriodData(periodo_inicio, periodo_fim, projeto_ids?)` que faz queries paralelas para:
- pessoas apoiadas / famílias / novos registos
- ações realizadas / participações / únicos
- casos abertos/concluídos
Stats compactos + breakdowns colapsáveis (por projeto / nacionalidade top 5 / área). Botão "Atualizar dados" → `invalidateQueries`.

## Part 6 — Exportação
- **Copiar texto** — função pura que serializa secções → string formatada (regras dadas) → `navigator.clipboard.writeText`.
- **Exportar Word** — usa `docx` (instalar `bun add docx file-saver`). Gera `.docx` no cliente com letterhead MEERU, título, secções (H2, tabelas DXA, blockquotes, hr). Nome: `[financiador]-[tipo]-[periodo_inicio].docx`.
- **Imprimir** — `window.print()` + CSS `@media print` global (em `src/styles.css`): esconde `.no-print` (sidebar, toolbar, menus); `.page-break-before` em separadores.
- **Submeter** — `AlertDialog` confirmação → update estado/data_submissao_real → insert `relatorio_snapshots` com payload do data panel → toast + invalidate.

## Part 7 — Templates
Constante `REPORT_TEMPLATES` em `src/lib/relatorios/templates.ts` com as 3 estruturas pedidas. Aplicação cria secções com `position` sequencial e `config` inicial.

## Part 8 — Tab no projeto
Em `_admin.projetos.$projetoId.tsx`: nova tab "Relatórios" listando `relatorios WHERE projeto_id = $id` em cards compactos + botão "Novo relatório" que abre o Sheet com `projeto_id` pré-preenchido (reaproveita componente extraído).

## Detalhes técnicos
- **Estado**: TanStack Query, optimistic updates ao estilo do resto da app (Participantes/Famílias).
- **Drag & drop**: usar `@dnd-kit/core` + `@dnd-kit/sortable` se já instalados; caso contrário `bun add`. Fallback de setas no menu ⋮.
- **Autosave indicator**: contexto local no editor, mostra "Guardado ✓" / "A guardar…" baseado em `isPending` de mutações ativas.
- **Print CSS**: regras em `src/styles.css` (root); o editor envolve documento em `.relatorio-print-area`.
- **Tipos**: estender `Database` via `as any` nos componentes (tipo regenerado depois da migration).
- **Snapshot payload**: serializa o resultado de `useRelatorioPeriodData` + config das secções no momento da submissão.

## Ficheiros criados/alterados
**Novos**
- `supabase/migrations/*_relatorios.sql` (via tool)
- `src/routes/_app/_admin.relatorios.tsx`, `.index.tsx`, `.$id.tsx`
- `src/components/relatorios/relatorio-novo-sheet.tsx`
- `src/components/relatorios/secao-*.tsx` (7 tipos)
- `src/components/relatorios/secao-add-popover.tsx`
- `src/components/relatorios/data-panel.tsx`
- `src/components/relatorios/relatorio-top-bar.tsx`
- `src/components/relatorios/projeto-relatorios-tab.tsx`
- `src/lib/relatorios/templates.ts`
- `src/lib/relatorios/export-texto.ts`
- `src/lib/relatorios/export-docx.ts`
- `src/lib/relatorios/use-periodo-dados.ts`

**Alterados**
- `src/components/command-palette.tsx` (+ Relatórios)
- `src/components/app-sidebar.tsx` (mapeamento ícone `FileBarChart` para `page="relatorios"`)
- `src/styles.css` (regras `@media print`)
- `src/routes/_app/_admin.projetos.$projetoId.tsx` (nova tab)
- `sidebar_items` (insert via tool de dados)

## Confirmação
Avanço com a migration primeiro (precisa de aprovação), depois construo lista, editor, painel, export, templates e tab do projeto numa única sessão. Confirmas?