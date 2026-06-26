## Contexto

Já existe `src/components/smart-table/` em uso em ~10 páginas (Participantes, Famílias, Ações, Projetos, Tipos de utilizador, Localizações, Casos, Financiamentos, Colaboradoras, Serviços, Relatórios). A arquitectura actual usa virtualização própria, grouping manual em memória e estado persistido fatiado em vários hooks. O pedido reescreve este wrapper com o modelo nativo da TanStack Table (`getGroupedRowModel`, `getPaginationRowModel`, `getExpandedRowModel`) e divide-o em ficheiros mais pequenos, mantendo as definições de colunas e fetching das páginas inalterados.

## O que vou construir

### 1. Reescrever `src/components/smart-table/`

```text
SmartTable.tsx          (orquestrador + wrapColumnsForEditMode + paginação)
SmartTableToolbar.tsx   (search, AdvancedFilters, GroupBy, SavedViews, Cols, Editar, ações)
SmartTableBody.tsx      (loading skeletons, empty, linhas, células editáveis)
SmartTableGroupRow.tsx  (linha de cabeçalho de grupo expansível)
useSmartTableState.ts   (sort/cols/sizing/group persistidos em localStorage)
index.ts                (exports públicos)
```

- Hook auxiliar `src/hooks/use-local-storage.ts` (não existe ainda).
- Substituir as variantes `usePersistedFlag/Sorting/Sizing/...` actuais por `useSmartTableState`.
- Manter `SmartTableCell.tsx` como helper interno de edição (`InlineText`/`InlineSelect`) — reusado pelo wrapper.
- Manter os tipos em `types.ts` mas alinhados aos novos props (campos novos: `groupByOptions`, `editableColumns`, `onCellEdit`, `pageSize`, `savedViewsKey`, `defaultSortBy`, `defaultColumnVisibility`, `getRowClassName`, `searchPlaceholder`, `emptyIcon`).

### 2. Comportamentos

- Search global via `globalFilterFn` em todas as células string.
- Grouping nativo TanStack (`getGroupedRowModel` + `getExpandedRowModel`) — substitui o agrupamento manual actual.
- Paginação opcional (`pageSize` default 50; `undefined` = sem paginação, com virtualização opcional preservada quando o dataset for grande — para já uso paginação simples como pedido).
- Modo de edição: barra âmbar no topo, botão `Editar/Bloquear edição`, células com `ring` âmbar. `wrapColumnsForEditMode` injecta `InlineText`/`InlineSelect` apenas em modo edição.
- Resize de colunas (`columnResizeMode: "onChange"`) e drag de headers — reuso do `DraggableTableHeaders` já existente, com indicador de sort (ArrowUp/Down/UpDown).
- `SavedViews` só renderiza se `savedViewsKey` for passado (componente já existe).
- `AdvancedTableFilters` mantém-se integrado.

### 3. Atualizar `DraggableTableHeaders`

Adicionar ícones de sort e estilo `uppercase tracking-wide muted-foreground` consistente. Manter funcionalidade de drag/resize.

### 4. Migrar páginas existentes

As páginas já usam SmartTable. Vou:

1. Alinhar props ao novo contrato (renomear/ajustar onde necessário: `defaultCollapsedGroups` deixa de existir — passa a depender do estado de expansão nativo; `hideSearch` mantém-se).
2. Adicionar `groupByOptions`, `editableColumns`, `onCellEdit`, `savedViewsKey` conforme indicado no pedido para:
   - Participantes (`pessoas`)
   - Famílias (`familias`)
   - Ações (`acoes`)
   - + manter funcionamento de Localizações, Projetos, Casos, Financiamentos, Colaboradoras, Serviços, Relatórios sem regressão (apenas adaptar tipos onde mudaram).
3. Remover qualquer state manual residual que tenha ficado nas páginas.

### 5. Não vou mexer

- Column definitions de cada página.
- Queries / mutations / fetching.
- Lógica de negócio dos diálogos e ações.
- `AdvancedTableFilters`, `SavedViews`, `DataTableViewOptions` (apenas consumo).

## Pontos a confirmar antes de avançar

1. **Substituir o agrupamento manual actual pelo nativo da TanStack Table** muda subtilmente a UI: deixo de ter `defaultCollapsedGroups` (que está em uso em `Financiamentos` com `ENCERRADO` colapsado por defeito). Posso preservar este comportamento via estado inicial de `expanded` — confirmas que sim?
2. **Virtualização**: o SmartTable actual usa `@tanstack/react-virtual` para datasets grandes (Participantes >1k linhas). O novo modelo do pedido é paginação (50/pág.). Proponho: paginação por defeito conforme pedido, e remover virtualização. OK?
3. **Edição inline**: nas páginas indicadas (Participantes/Famílias) a edição actual passa por diálogos. Vou adicionar `editableColumns`/`onCellEdit` como camada extra (botão "Editar" no toolbar) sem remover os diálogos existentes. OK?

Se confirmares estes três pontos, avanço e entrego tudo numa só sessão.
