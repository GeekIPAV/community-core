# Biblioteca de Componentes no Style Guide

Adiciona uma nova tab **"Componentes"** ao `/style-guide` existente, com um catálogo pesquisável de componentes/padrões visuais do Meeru. Cada entrada mostra: preview ao vivo + prompt copiável (PT e EN) + snippet de código + tokens usados. Tudo editável no próprio app e guardado na BD para poderes adicionar novas entradas sem tocar em código.

## O que passa a existir

**1. Nova tab "Componentes"** ao lado de Cores/Tipografia/Espaçamento/Componentes  
   → renomeio a tab atual "Componentes" para **"Primitivos"** (Buttons/Inputs/Cards/Badges shadcn) e crio a nova **"Biblioteca"** para os padrões Meeru.

**2. Cada entrada da biblioteca contém:**
   - Título + descrição curta + categoria (KPIs, Tabelas, Sheets, Formulários, Navegação, Feedback, Layouts, Dados)
   - **Preview ao vivo** (renderiza o componente real com dados mock)
   - **Prompt copiável** — o texto que colas noutra app Lovable para recriar o componente, com placeholders `{{...}}` para adaptares
   - Toggle **PT / EN** para o prompt
   - **Snippet de código** (colapsado, com botão "copiar")
   - **Tokens usados** (chips com --primary, --card, etc — clicáveis para saltar à tab Cores)
   - Botão **"Copiar tudo"** (prompt + snippet)

**3. Catálogo inicial (~15 entradas)** cobrindo os padrões repetidos do Meeru:
   - KPI Card (grid 4/6 col com ícone + valor + label + delta)
   - SmartTable (com filtros avançados, saved views, bulk edit, export CSV)
   - Family Group Header (avatar + nome + badges "Direito a bolsa/KM" + contagem de ações)
   - AcoesHoverSummary (badge com popover de ações)
   - InlineEditCell (edição inline com estado + método + notas)
   - FrostedCard (glass surface)
   - Empty State
   - Loading Skeletons
   - Sheet lateral de edição (pessoa-edit-sheet pattern)
   - Command Palette
   - Sidebar com grupos + colapso
   - Tabs com ícones lucide
   - Badge de estado (pago/pendente/cancelado com cores semânticas)
   - Dialog de "Adicionar" com tabs internas + toggles por família
   - Confirm delete + toast

**4. Gestão (BD + UI):**
   - Nova tabela `component_library` com RLS admin-only
   - Seed inicial na migration com as ~15 entradas
   - Botão **"+ Novo componente"** no topo da tab → sheet lateral com campos: título, descrição, categoria, prompt PT, prompt EN, snippet, tokens (multi-select), preview_key (identifica qual React component renderizar)
   - Botão **"Editar"** em cada card
   - Botão **"Duplicar"** e **"Eliminar"**

**5. Pesquisa e filtros:**
   - Barra de pesquisa (título + descrição + prompt)
   - Filtro por categoria (chips)
   - Ordenação: alfabética / mais usados / recentes

## Detalhes técnicos

**Migration:**
```sql
create table public.component_library (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  categoria text not null,
  prompt_pt text not null,
  prompt_en text,
  snippet text,
  tokens text[] default '{}',
  preview_key text,           -- ex "kpi-card", "smart-table"; mapa fixo no front
  ordem int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
grant select, insert, update, delete on public.component_library to authenticated;
grant all on public.component_library to service_role;
alter table public.component_library enable row level security;
create policy "admin all" on public.component_library
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
```
+ INSERT das ~15 entradas na mesma migration.

**Frontend:**
- `src/routes/_app/_admin.style-guide.tsx` — adiciona a 5.ª tab "Biblioteca"
- `src/components/style-guide/library-tab.tsx` — grelha, pesquisa, filtros
- `src/components/style-guide/library-card.tsx` — card com preview + prompt + snippet
- `src/components/style-guide/library-editor-sheet.tsx` — sheet de criação/edição
- `src/components/style-guide/previews/` — pasta com um ficheiro por `preview_key` (mapa `Record<string, React.FC>`); render mock isolado (sem chamadas a Supabase)

Cada preview usa dados hard-coded para renderizar sem dependências. Se `preview_key` não existir no mapa, mostra um placeholder "Preview indisponível".

**Copiar:** usa `navigator.clipboard.writeText` + toast (já existe padrão no projeto com `sonner`).

**Sem alterações** em nada fora do Style Guide, sidebar ou tabelas existentes.

## Fora deste plano
- Exportar a biblioteca inteira como ficheiro/zip (posso adicionar depois se quiseres)
- Versioning das entradas
- Screenshots automáticos dos previews
