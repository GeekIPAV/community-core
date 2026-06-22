# Plano — 3 funcionalidades

## 1. Indicadores de M&A na ficha de projeto

**BD — nova tabela `projeto_kpis`**
`id, projeto_id (FK projetos ON DELETE CASCADE), nome, meta numeric, unidade, fonte text CHECK IN ('acoes','atividades','participantes','manual'), narrativa, valor_manual numeric, position int default 0, created_at, updated_at`. RLS: admin/staff escrevem (via `is_current_user_staff()`), autenticados leem. GRANTs e trigger `set_updated_at`.

**Frontend**
- Nova rota `/_app/_admin.projetos.$projetoId.tsx` (ficha de projeto) com tabs **Geral** (info atual do projeto) e **Indicadores**.
- Tab Indicadores: tabela com colunas Indicador | Meta | Valor Atual | Unidade | Progresso | Fonte | Narrativa | Ações, edição inline (`InlineText`), barra `h-1.5` com cores verde/âmbar/vermelho consoante %.
- Cálculo de `valor_atual` por fonte:
  - `acoes`: count `acoes` com `projeto_ids @> ARRAY[projeto_id]`
  - `participantes`: count `pessoas` com `projeto_ids @> ARRAY[projeto_id]` e `status='ativo'`
  - `atividades`: count `familia_atividades` cujas famílias têm membros (`pessoas`) com este `projeto_id` (join via `familias`→`pessoas.projeto_ids`)
  - `manual`: `valor_manual`
- Modal "Adicionar/editar indicador" com Nome, Meta, Unidade (datalist), Fonte (select; mostra Valor atual quando manual), Narrativa.
- Botão **Exportar para relatório** → gera texto formatado com barra ASCII e copia para o clipboard (toast).

**Tornar projetos clicáveis**: na lista `_admin.projetos.tsx`, o nome do projeto navega para `/projetos/:projetoId`.

## 2. Módulo de Parceiros Institucionais

**BD — 4 tabelas novas**
- `parceiros (id, nome, tipo, estado default 'Ativa', pessoa_contacto, email_contacto, notas, created_at, updated_at)`
- `parceiro_projetos (parceiro_id, projeto_id, PK composta)`
- `parceiro_interacoes (id, parceiro_id, data, tipo, notas, created_at)`
- `acao_parceiros (acao_id, parceiro_id, PK composta)`
RLS staff escreve, autenticados leem; GRANTs.

**Sidebar**: novo item "Parceiros" (ícone `Handshake`) no grupo existente "Gestão de Participantes" (ou o mais próximo de Projetos & Comunidade), visível a admin/staff. Adicionado via seed em `sidebar_items` no mesmo migration.

**Rotas novas**
- `/_app/_admin.parceiros.tsx` — lista (SmartTable + filtros tipo/estado + pesquisa + botão Novo parceiro).
- `/_app/_admin.parceiros.$parceiroId.tsx` — detalhe com sidebar sticky (nome, badges tipo/estado, contacto, email, projetos count, botão editar) + tabs **Projetos** e **Interações** (timeline com formulário de registo).

**Modal Add/Edit parceiro**: Nome, Tipo, Estado, Pessoa contacto, Email, Projetos associados (multi-select), Notas. Save → upsert `parceiros` + sync `parceiro_projetos`.

**Integração com Ações**: em `_admin.acoes.tsx` (dialog de edição) adiciono campo "Parceiros co-responsáveis" com `InlineMultiSelect`, persistido em `acao_parceiros`. Na vista pública `/acao/$id` e admin views, mostro chips dos parceiros.

## 3. Contexto Relacional na ficha de família

**BD — nova tabela `familia_contexto`**
`familia_id PK FK familias ON DELETE CASCADE, territorio text, linguas text[], tradicao_cultural text, redes_suporte text[], frequencia_participacao text, notas_relacionais text, updated_at`. RLS: staff escreve; membros da própria família leem via `current_user_familia_id()`. GRANTs e trigger `set_updated_at`.

**Frontend — `src/components/family-detail.tsx`**
- Tipo `detailTab` ganha `"contexto"`. Nova tab "Contexto Relacional" após "Atividades", com dot ● se existir registo com algum campo preenchido.
- Lazy fetch ao abrir tab. Secções com headers `text-xs font-semibold uppercase tracking-wide text-muted-foreground`:
  1. **Localização e Línguas** — Território (text) + Línguas (chips toggle: PT, Árabe, Inglês, Francês, Tigrínia, Wolof, Sorani, Russo, Ucraniano, Outro)
  2. **Cultura e Identidade** — Tradição cultural/religiosa (Textarea 2 rows) com sublabel confidencial em itálico
  3. **Redes de Suporte** — checkboxes (Família alargada presente, Amigos da comunidade, Vizinhos de referência, Comunidade religiosa, Sem redes identificadas — esta exclui as outras)
  4. **Participação** — Select frequência (Muito frequente semanal, Frequente mensal, Ocasional, Inativa)
  5. **Notas relacionais** — Textarea 4 rows
- Auto-save por campo no blur (upsert) + botão "Guardar tudo" como fallback. Toast em cada gravação.

## Migrations

Tudo num único migration (3 features). Inclui CREATE TABLE + GRANTs (authenticated + service_role) + ENABLE RLS + POLICIES + triggers `set_updated_at` + seed do `sidebar_items` para Parceiros.

## Ficheiros

**Novos**: `_admin.projetos.$projetoId.tsx`, `_admin.parceiros.tsx`, `_admin.parceiros.$parceiroId.tsx`.
**Editados**: `_admin.projetos.tsx` (nome clicável), `_admin.acoes.tsx` (campo parceiros), `family-detail.tsx` (tab contexto), rota pública da ação para mostrar chips de parceiros.

## Assunções

1. "Ações associadas a este projeto" = `acoes.projeto_ids @> ARRAY[projeto_id]` (mesmo padrão usado em pessoas). Se preferires count via `inscricoes`→`pessoas`→`projeto_ids`, diz.
2. "Atividades do projeto" = `familia_atividades` cujas famílias têm pelo menos uma pessoa no projeto. Aproximação razoável dado o schema; se houver melhor ligação, ajusto.
3. Exportar para relatório = texto markdown/plain copiado para clipboard (não PDF).
4. Sidebar: grupo onde meto "Parceiros" — uso o existente mais próximo ("Gestão de Participantes" ou equivalente). Confirma se preferes outro.

Confirmas para avançar com o migration + código?
