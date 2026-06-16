## Objetivo

Na página pública `/acao/$id`, quando o utilizador autenticado é admin, mostrar controlos extra:

1. **Lápis de edição** sobre o cartão do evento → abre diálogo para editar a informação principal da ação.
2. **Painel "Ações de admin"** → permite inscrever pessoas individuais e famílias inteiras (incluindo membros) na ação, sem sair da página.

A página continua pública para todos os outros visitantes — nada muda visualmente para não-admins.

## Alterações

### `src/routes/acao.$id.tsx`

- Ler `isAdmin` de `useAuth()`.
- No `Card` do evento, se `isAdmin`:
  - Botão flutuante com ícone `Pencil` (top-right do cartão / sobreposto à imagem) → abre `EditarAcaoDialog`.
  - Secção "Gestão (admin)" abaixo do botão "Inscrever" com dois botões: **Inscrever pessoa** e **Inscrever família**.
- Após edição/inscrição com sucesso → `queryClient.invalidateQueries({ queryKey: ["acao", id] })` e toast.

### Novo: `EditarAcaoDialog` (mesmo ficheiro)

Diálogo com formulário para os campos principais:

- `nome` (texto, obrigatório)
- `descricao` (RichTextEditor reutilizado de `@/components/rich-text-editor`)
- `local`, `mapa_url`
- `data_inicio`, `data_fim` (datetime-local)
- `imagem_url` via `ImageUpload` (`@/components/image-upload`, bucket `acoes-imagens`)
- `publico` (switch), `inscricoes_abertas` (switch)
- `restrito_a_projetos` (switch) + multiselect de projetos quando ligado

Submit faz `supabase.from('acoes').update(...).eq('id', id)`. RLS já permite admins editarem.

### Novo: `AdminInscreverPessoaDialog`

- Combobox/autocomplete (Command) que pesquisa `pessoas` por `nome_completo`/`email` (limite 20, debounced).
- Mostra campos dinâmicos da ação (`parseFields(config_campos)`).
- Submit cria/atualiza row em `inscricoes` (idempotente: verifica `pessoa_id + acao_id` com status ≠ 'cancelada').

### Novo: `AdminInscreverFamiliaDialog`

- Combobox que pesquisa `familias` por nome.
- Após escolher família → lista membros (`pessoas` onde `familia_id = X`), com checkbox por membro (todos marcados por defeito).
- Campos dinâmicos partilhados (mesmos valores aplicam a todos).
- Submit em batch: insere uma `inscricao` por pessoa selecionada, evitando duplicados.

## Notas técnicas

- Tudo client-side via cliente Supabase autenticado — sem nova migration, sem server functions. As policies actuais em `acoes` e `inscricoes` já permitem ações de admin.
- A página continua a usar a query `acoes ... .eq('publico', true)`. Para admins, removo o filtro `publico` na fetch (ou faço fallback) para que admins possam abrir e editar ações privadas também — útil para alternar `publico` ON/OFF.
- Reutilizo `RichTextEditor`, `ImageUpload`, `Command`, `Dialog`, `Switch`, `Button`, `Input` já existentes.
- Sem alterações ao layout/UX para visitantes anónimos.

## Fora de âmbito

- Edição de `config_campos` (campos dinâmicos de inscrição) — já é gerida em `/acoes`. Adiciono apenas link "Editar campos dinâmicos" que abre `/acoes?edit=<id>` (ou mantém-se só na página admin, conforme preferires).
- Remover/cancelar inscrições existentes — continua em `/participantes`.
