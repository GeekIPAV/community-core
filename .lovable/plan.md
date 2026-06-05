## 1. Auto-criar pessoa em novos signups (backend)

Migration:
- Função `public.handle_new_auth_user()` (SECURITY DEFINER, search_path=public):
  - Procura `pessoas` ativa com `lower(email) = lower(NEW.email)` e `auth_user_id IS NULL` → faz `UPDATE` a setar `auth_user_id = NEW.id` (e preenche email se estiver vazio).
  - Caso contrário → `INSERT` em `pessoas` com `email`, `auth_user_id = NEW.id`, `nome_completo` = `raw_user_meta_data->>'full_name'` ou `name` ou parte antes do `@`, `status='ativo'`, `is_admin=false`.
- Trigger `on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW`.

Backfill (insert tool, após a migração):
- Ligar pessoa `1723fcd5-…` (Shahd) ao `auth_user_id 384eaa7b-…` e preencher email `shahd@meeru.org`.
- Para outros users de auth sem pessoa: link por email, ou criar nova pessoa.

## 2. Renomear página "Tipos de Utilizador" → "Utilizadores"

- Renomear `src/routes/_app/_admin.tipos-user.tsx` → `_admin.utilizadores.tsx` (rota `/utilizadores`).
- Atualizar `src/components/app-sidebar.tsx`: label "Utilizadores", `to="/utilizadores"`, ícone Users.
- Atualizar referências a `/tipos-user` (procurar em todo o projeto). Manter `src/routes/_app/_admin.tipos-user.tsx` se necessário com um redirect temporário, ou simplesmente remover.

## 3. Nova tabela de Utilizadores dentro dessa página

A página passa a ter **duas secções/tabs**:

**A) Utilizadores (nova, principal)**
- Lista todos os users de `auth.users` (via server function `listAuthUsers` com `supabaseAdmin.auth.admin.listUsers()`), junta com pessoa associada (via `pessoas.auth_user_id`).
- Colunas: Email, Último login, Pessoa associada (nome), Tipo de perfil, Ações.
- Pesquisa por email/nome.
- Ações por linha:
  - **Associar a participante** (Combobox de `pessoas` sem `auth_user_id`) → server fn `linkAuthUserToPessoa(auth_user_id, pessoa_id)` que faz `UPDATE pessoas SET auth_user_id=…` (admin).
  - **Mudar tipo de perfil** (Select de `tipos_user`) → atualiza `pessoas.tipo_user_id` da pessoa associada.
  - **Editar pessoa** (abre o diálogo de edição da pessoa associada com campos principais: nome, email, telefone, família, tipo, admin).
  - **Desassociar** (limpa `auth_user_id`).

**B) Tipos de perfil (a antiga UI mantém-se aqui)**
- Toda a gestão atual de `tipos_user` (criar, editar nome, páginas) fica num segundo tab "Tipos de perfil".

## 4. Server functions novas (`src/lib/users.functions.ts`)

- `listAuthUsers` (admin) — devolve `{ id, email, last_sign_in_at, created_at, pessoa: {...} | null, tipo_user: {...} | null }[]`. Usa `supabaseAdmin` via `await import` dentro do handler.
- `linkAuthUserToPessoa({ auth_user_id, pessoa_id })` — atualiza pessoa.
- `unlinkAuthUser({ auth_user_id })` — limpa `auth_user_id` da pessoa.
- `setPessoaTipo({ pessoa_id, tipo_user_id })` — atualiza tipo.

Todas com middleware `requireSupabaseAuth` + verificação `is_current_user_admin()` no handler (RPC) antes de operar.

## Fora de âmbito
- Não mexe em RLS existente.
- Não cria UI de criar/apagar users de auth (só listagem + associação + tipo).
