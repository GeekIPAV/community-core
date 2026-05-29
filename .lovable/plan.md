## Objetivo

Quando o utilizador troca para árabe a plataforma deve sentir-se nativa: sidebar à direita, conteúdo a fluir da direita para a esquerda, ícones direcionais espelhados, e tudo a comportar-se bem em ecrãs pequenos (independente do idioma).

## 1. Trocar a orientação quando idioma = árabe

Hoje só fazemos `document.documentElement.dir = "rtl"` em `src/lib/i18n.ts`. Isso vira o texto mas a sidebar do shadcn continua "side=left", os menus continuam ancorados a `align="end"` em coordenadas LTR, e várias classes usam `ml-/mr-/left-/right-` fixas.

Mudanças:

- **Hook `useDir()`** novo em `src/lib/i18n.ts` que devolve `"rtl" | "ltr"` reactivo (reage a `i18n.on("languageChanged")`), para os componentes poderem condicionar comportamento.
- **`AppSidebar`** (`src/components/app-sidebar.tsx`): passar `side={dir === "rtl" ? "right" : "left"}` ao `<Sidebar>`. Assim o painel encaixa do lado correto e o botão de colapsar fica no sítio certo.
- **Substituir margens/paddings direcionais** por equivalentes lógicos nos componentes partilhados que aparecem em todas as páginas: `ml-* → ms-*`, `mr-* → me-*`, `pl-* → ps-*`, `pr-* → pe-*`, `left-* → start-*`, `right-* → end-*`, `text-left → text-start`, `text-right → text-end`. Alvo: `app-sidebar.tsx`, header de `_app.tsx`, header/cards de `resultados.tsx`, dialogs partilhados (`DropdownMenu`, `Dialog` já usam `align="end"` que o Radix trata bem; deixar como está).
- **Ícones direcionais** (`ChevronLeft/Right`, `ArrowLeft/Right`, setas de mover) — onde representam navegação (voltar, próximo, breadcrumb), espelhar com `className="rtl:rotate-180"`. Não espelhar ícones neutros (lupa, lixo, lápis, etc.).
- **Recharts**: legendas/tooltips ficam OK; apenas garantir que o container do gráfico tem `dir="ltr"` interno (os números/eixos têm de ler-se LTR mesmo em RTL). Isto é uma `<div dir="ltr">` à volta do `<ResponsiveContainer>` em `ChartBlock` (`src/routes/resultados.tsx`).
- **Inputs numéricos / email / tel**: forçar `dir="ltr"` quando o conteúdo é inerentemente LTR (números, emails). Aplicar nos `Input` dessas colunas em `participantes`/`familias` quando `type` é `email`, `tel`, `number`, `date`.

## 2. Tradução em falta

Para o árabe parecer completo, precisamos de traduzir o que ainda está só em PT no shell visível:

- Cabeçalho do `/resultados`: "Resultados e Impacto", "Resumo", "Gráficos", "Nova métrica", "Novo gráfico", "Configurar", "Mover para cima/baixo", "Remover", "Sem métricas/gráficos".
- Header global (`_app.tsx`): nome/área pessoal, "Entrar".
- Vamos adicionar chaves novas em `pt/en/ar` no `src/lib/i18n.ts` (namespaces `results` e `header`) e usar `useTranslation()` nesses sítios. Não vamos traduzir o backoffice todo neste passo — só o que está visível ao público + à barra lateral.

## 3. Responsive

Problemas conhecidos a corrigir:

- **`/resultados`**: grelha de KPIs passa para `sm:grid-cols-2 lg:grid-cols-4` mas o header da página ("Resumo" + botão "Nova métrica") encosta-se ao limite em 375px → trocar para `flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`. Mesma coisa para "Gráficos".
- **`ChartBlock`**: hoje a altura está fixa em `h-80` e a Card é 1 coluna até `lg`. Em mobile com tooltip do recharts a legenda corta. Reduzir para `h-64 sm:h-80` e adicionar `overflow-hidden` à Card.
- **Tabelas em `/participantes` e `/familias`**: garantir wrapper `overflow-x-auto` no container da tabela; barra de filtros (pesquisa + colunas + ações) deve ser `flex-wrap gap-2` em vez de uma única linha que estoura. Adicionar `min-w-0` aos filhos que truncam.
- **Sidebar mobile**: já usa Sheet — apenas verificar que ao passar para `dir=rtl` o Sheet abre do lado direito (passar `side="right"` no `SheetContent` quando RTL).
- **Header global**: stack vertical em <640px (logo em cima, ações em baixo) com `flex-wrap`.

## 4. Detalhes técnicos

- Tailwind v4 já suporta variantes `rtl:` e utilitários lógicos (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) sem config extra.
- O `useDir()` hook subscreve `i18n.on("languageChanged", ...)` e devolve `i18n.dir()`. Inicializa com `i18n.dir(i18n.language)` para SSR.
- Para evitar mismatch de hidratação no SSR (o servidor não sabe o idioma do utilizador), o `<html dir>` continua a ser actualizado no cliente; nenhum componente deve ler `document.documentElement.dir` durante render — usar sempre o hook.
- Ficheiros tocados:
  - `src/lib/i18n.ts` (novo hook + novas chaves de tradução)
  - `src/components/app-sidebar.tsx` (side dinâmico + classes lógicas)
  - `src/routes/_app.tsx` (header responsive + traduções + classes lógicas)
  - `src/routes/resultados.tsx` (header responsive, ChartBlock dir="ltr" interno, traduções, classes lógicas)
  - `src/routes/_app/_admin.participantes.tsx` e `_admin.familias.tsx` (filtros `flex-wrap`, `overflow-x-auto` na tabela, inputs `dir="ltr"` onde aplicável)

## Fora de âmbito

- Tradução completa de todos os formulários e dialogs de admin (fica para um passo seguinte).
- Mudança de fontes para uma família que renderize melhor árabe (podemos discutir se quiseres — Tajawal/IBM Plex Sans Arabic).
