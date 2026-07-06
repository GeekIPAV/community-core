## Objetivo
Permitir associar uma pessoa a uma entidade parceira (como pessoa de contacto) directamente no formulário de edição do participante — só quando o tipo "Parceiro" está atribuído.

## 1. Base de dados
Migração:
- `ALTER TABLE public.pessoas ADD COLUMN parceiro_id uuid REFERENCES public.parceiros(id) ON DELETE SET NULL;`
- Índice `idx_pessoas_parceiro_id`.
- Regra de integridade num trigger `BEFORE INSERT/UPDATE` em `pessoas`: se `parceiro_id IS NOT NULL`, a pessoa tem de ter o tipo "Parceiro" (via `tipo_user_id` ou em `pessoa_tipos`). Caso contrário limpa `parceiro_id` para NULL (silencioso, para não bloquear alterações de tipo).

Sem alterações a `parceiros.pessoa_contacto` (mantém-se para retrocompatibilidade).

## 2. UI — `src/routes/_app/_admin.participantes.tsx`
- Query adicional `["parceiros_lookup"]` a `parceiros (id, nome)` ordenada por nome.
- Adicionar `parceiro_id` ao `select(...)` de `pessoas` e ao `Row` type.
- No formulário **Novo participante** e **Editar participante**: após o bloco de tipos, mostrar um `Select` "Entidade parceira" **apenas quando** o tipo Parceiro estiver seleccionado (em `tipo_user_id` ou nos tipos múltiplos via `pessoa_tipos`). Se o utilizador remover o tipo Parceiro, limpar o valor no estado local.
- Ao gravar (create/update): incluir `parceiro_id` no upsert. Se nenhum tipo Parceiro estiver activo, forçar `parceiro_id = null`.
- Nova coluna opcional na SmartTable "Entidade" (`parceiro_id` → nome), escondida por defeito, filtrável.

## 3. UI — página da entidade (`_admin.parceiros.$parceiroId.tsx`)
Adicionar um pequeno card "Pessoas de contacto" que lista `pessoas` com `parceiro_id = :id` (nome + email + telefone, link para `/participantes?...`). Sem edição inline aqui — a associação faz-se no perfil da pessoa.

## Detalhes técnicos
- Detecção do tipo Parceiro faz-se por nome (`lower(nome) = 'parceiro'`) resolvendo o id a partir da query `tipos_user_lookup` já existente.
- Não mexer em `src/integrations/supabase/types.ts` manualmente — é regenerado após a migração.
- Sem alterações a permissões/RLS (herda de `pessoas`).

## Ordem de execução
1. Migração (coluna + trigger).
2. Alterações de UI no formulário de participantes e no lookup de parceiros.
3. Card "Pessoas de contacto" na página da entidade.
