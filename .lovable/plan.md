
## Contexto

Hoje, na página `/resultados`:
- A página é **pública** e **qualquer pessoa** vê os botões "Nova métrica" / "Novo gráfico" / editar / remover.
- As alterações são guardadas só em **`localStorage`** do browser (`resultados.charts.v1`, `resultados.kpis.v1`), por isso **não ficam guardadas** para os outros utilizadores — cada pessoa vê a sua própria configuração local, e tu vês configurações diferentes em browsers/dispositivos diferentes.

Objetivo: tornar a configuração de KPIs e gráficos **partilhada para todos** (uma única configuração global guardada no Lovable Cloud), e permitir **editar apenas a admins**. Visitantes anónimos e utilizadores não-admin continuam a ver tudo, mas em modo leitura.

## Mudanças

### 1. Base de dados (migração)

Nova tabela `dashboard_config` para guardar uma única configuração global:

- `id` (uuid, PK)
- `key` (text, unique) — `"resultados"`
- `charts` (jsonb) — array de `ChartConfig`
- `kpis` (jsonb) — array de `KPIConfig`
- `updated_at`, `created_at`

RLS:
- `SELECT` aberto a `anon` + `authenticated` (a página é pública).
- `INSERT` / `UPDATE` apenas se `is_current_user_admin()` (reutiliza a função já existente).
- `DELETE` bloqueado.

GRANTs:
- `SELECT` a `anon` e `authenticated`.
- `INSERT, UPDATE` a `authenticated`.
- `ALL` a `service_role`.

Seed inicial: inserir uma linha `key='resultados'` com os defaults atuais (`DEFAULT_CHARTS` / `DEFAULT_KPIS`) para que a primeira visita já mostre a configuração standard.

### 2. Frontend — `src/routes/resultados.tsx`

- Substituir os dois `useState` + `localStorage` por **um único `useQuery`** que lê `dashboard_config` (`key = 'resultados'`) via cliente Supabase do browser.
- Criar uma `useMutation` que faz `upsert` em `dashboard_config` com `{ charts, kpis }`; é chamada sempre que um admin guarda, adiciona ou remove um gráfico/KPI.
- Ler `isAdmin` do `useAuth()` (já existente em `src/lib/auth-context.tsx`).
- Condicionar à flag `isAdmin`:
  - Botões "Nova métrica" e "Novo gráfico" no topo de cada secção.
  - Botões de editar / remover no `KPI` e `ChartBlock` (passar `isAdmin` como prop e esconder os controlos quando `false`).
  - Os diálogos `ChartConfigDialog` e equivalente para KPIs só abrem para admins.
- Remover o fallback de criação no estado vazio (cartão "Sem gráficos. Adiciona o primeiro.") para não-admins; mostrar apenas "Sem gráficos ainda."
- Apagar o código que lê/escreve `STORAGE_KEY` e `KPI_STORAGE_KEY` (já não é preciso).
- Mostrar um toast de erro com `sonner` quando o `upsert` falhar (ex.: utilizador não admin que tente forçar).

### 3. Sem alterações a:
- `get_estatisticas_publicas` (continua a alimentar os números).
- Restantes páginas.
- Sidebar / tradução.

## Detalhes técnicos

- Acesso à BD a partir do componente é feito com o `supabase` client do browser (já é o padrão usado nesta página, ex.: `useQuery` para `estatisticas`). RLS protege as escritas — não é preciso server function.
- O `upsert` usa `onConflict: 'key'` para manter sempre uma única linha por `key`.
- A query e a mutação invalidam a mesma `queryKey: ['dashboard-config','resultados']` para refletir mudanças imediatamente.
- Tipos: criar `type DashboardConfigRow = { charts: ChartConfig[]; kpis: KPIConfig[] }` e fazer cast do `jsonb` ao ler.
- Para evitar o problema de hidratação SSR atual (a configuração inicial dependia de `localStorage`), passar a usar sempre o valor do servidor — render consistente entre server e client.

## Ordem de execução

1. Criar e aplicar a migração (`dashboard_config` + RLS + GRANTs).
2. Fazer o seed inicial com os defaults via `insert`.
3. Refactor de `resultados.tsx` para usar o Supabase e a flag `isAdmin`.
