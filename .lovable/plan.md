# SmartTable v2 — features universais + migração das tabelas restantes

## Estado atual

Já em SmartTable:
- Serviços, Financiamentos, Casos, Relatórios, Localizações, Meus Serviços

Ainda usam `<Table>` cru ou `useReactTable` direto:
- Famílias, Participantes, Ações, Tipos de utilizador, Eliminados, Indicadores, Projetos (lista), Parceiros (lista), Currículos, Duplicados, Emails, Bolsas de transporte, Pedidos de ajuda

O SmartTable já tem: edição inline, agrupar, filtrar (avançado), ordenar, redimensionar, mostrar/esconder colunas, vistas guardadas, paginação, search global, persistência em localStorage.

Falta: **seleção de linhas (checkboxes), ações em massa, edição em massa, exportar CSV.**

## Fase 1 — Estender o SmartTable (uma vez, serve todas as tabelas)

1. **Seleção de linhas**
   - Coluna virtual `__select` com checkbox no header (toggle de página) e por linha.
   - Estado `rowSelection` ligado ao TanStack Table (`enableRowSelection: true`).
   - Toolbar mostra "N selecionadas" + botão "Limpar seleção".

2. **Barra de ações em massa**
   - Quando `rowSelection` > 0 a toolbar mostra um bloco de ações:
     - **Editar em massa** (abre diálogo com os campos `editableColumns` — aplica o mesmo valor a todas as selecionadas via `onBulkEdit(ids, patch)`).
     - **Eliminar** (se for passado `onBulkDelete(ids)`).
     - **Exportar selecionadas** (CSV apenas das linhas marcadas).
     - Slot `bulkActions` para botões custom por tabela.

3. **Exportar CSV**
   - Botão "Exportar CSV" sempre presente (exporta linhas filtradas/visíveis).
   - Usa colunas visíveis na ordem atual; respeita `meta.label` e `meta.textValue`.
   - Reutiliza `src/lib/csv.ts` (cria `downloadCSV(filename, rows)` se ainda não existir).

4. **Novos props no `SmartTableProps`** (todos opcionais — retro-compatível):
   ```ts
   enableSelection?: boolean;
   onBulkEdit?: (ids: string[], patch: Record<string, unknown>) => Promise<void> | void;
   onBulkDelete?: (ids: string[]) => Promise<void> | void;
   bulkActions?: (ids: string[], clear: () => void) => ReactNode;
   exportFilename?: string;        // default: `${tableId}.csv`
   disableExport?: boolean;
   ```

## Fase 2 — Migrar as tabelas restantes

Para cada uma:
- Definir `columns: SmartColumnDef<Row>[]` com `meta.label`, `meta.filterVariant`, `meta.editType` quando aplicável.
- Substituir o `<Table>` manual por `<SmartTable tableId="..." columns={...} data={...} enableSelection ... />`.
- Onde já há mutações de update, ligar `onCellEdit` e `onBulkEdit` à mesma função (reutiliza `applyOptimisticRowPatch`).
- Preservar comportamentos especiais (linhas com cor, ações por linha, navegação ao clicar).

Ordem de migração (das mais simples às mais complexas):
1. Tipos de utilizador, Localizações (já feita), Eliminados, Duplicados, Emails — listas simples.
2. Pedidos de ajuda, Bolsas de transporte, Currículos — listas de leitura + ação.
3. Indicadores, Projetos, Parceiros — leitura + agrupamento.
4. Famílias, Participantes, Ações — as mais densas, com edição inline já parcialmente em uso.

## Detalhes técnicos

- A coluna `__select` tem `size: 40`, sem sort, sem resize, sem filter, sem hide.
- `onBulkEdit` recebe o `patch` num único objeto; o componente decide se é UPDATE em loop ou em bulk no Supabase (cada call site escolhe — o SmartTable não impõe).
- O export ignora a coluna `__select` e qualquer coluna sem `accessorKey`/`accessorFn` (ex. ações).
- O `EditBulkDialog` é renderizado dentro do SmartTable; usa os mesmos `editableColumns` declarados nas colunas, lendo `meta.editType` / `meta.editSelectOptions`.
- Não toco em ficheiros auto-gerados nem em rotas de auth.

## Entrega

Single pass, sem confirmação intermédia. No fim faço um build + smoke check às tabelas migradas. O resultado: toda a plataforma usa SmartTable com os mesmos super-poderes (selecionar, agrupar, filtrar, editar inline, editar em massa, exportar CSV, vistas guardadas).
