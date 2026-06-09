## Alterações em `src/routes/_app/_admin.participantes.tsx`

### 1. Barra de ações (top)
- Remover o botão "Importar" autónomo (linhas 557-559).
- Converter os botões "Editar" e "Apagar" em botões apenas com ícone:
  - `size="icon"`, sem texto, com `title` para tooltip ("Editar (N)" / "Apagar (N)").
  - Mantém o estado `disabled` quando `selected.size === 0`.
  - O badge da contagem deixa de aparecer no botão (já que é só ícone). Mantém-se a contagem no tooltip.

### 2. Diálogo "Nova pessoa"
- Adicionar import de `Tabs, TabsList, TabsTrigger, TabsContent` de `@/components/ui/tabs`.
- Envolver o conteúdo atual do diálogo em `<Tabs defaultValue="individual">` com duas tabs:
  - **Individual** — formulário existente + botão Guardar no `DialogFooter`.
  - **Importar em massa** — `Textarea` com placeholder (estrutura sugerida via `BULK_COLUMNS`), descrição das colunas, e botão "Importar".
- Eliminar o diálogo separado `bulkAddOpen` (linhas 803-827).
- A mutação `bulkCreate.onSuccess` passa a fechar o diálogo `addOpen` (`setAddOpen(false)`) em vez de `setBulkAddOpen(false)`. Remover state `bulkAddOpen` / setter.

### 3. Sem outras alterações
- Lógica de parsing, mutações e queries permanecem iguais.
- Não tocar nas outras páginas.
