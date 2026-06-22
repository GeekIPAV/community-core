Hoje os indicadores M&A só existem dentro da ficha de cada projeto (`/projetos/:id` → separador "Indicadores"). Não há ainda uma vista global agregada. Proponho criar essa página.

## Nova página `/indicadores`

Acessível pela sidebar (grupo "Gestão") com ícone de gráfico, restrita a staff.

### Topo — Resumo geral
Quatro cartões com os totais cruzados de todos os projetos:
- Total de indicadores
- Em execução
- Concluídos
- % média de execução global

### Filtros
- Projeto (todos / um específico)
- Estado (todos / Por iniciar / Em execução / Concluído)
- Fonte (todas / Manual / Ações / Inscrições / Participantes / Atividades / Total únicos)
- Pesquisa por nome do indicador

### Tabela principal
Uma linha por indicador, com colunas:
- Projeto (clicável, leva à ficha do projeto)
- Indicador
- Estado (badge)
- Meta
- Valor atual (calculado ao vivo, igual à lógica da ficha do projeto)
- Progresso (barra colorida: vermelho <30 %, amarelo 30–70 %, verde >70 %)
- Fonte
- Narrativa (truncada, com tooltip)

Ordenável por projeto, % execução, estado.

### Agrupamento por projeto
Toggle "Agrupar por projeto" que dobra a tabela em secções colapsáveis, cada uma com mini-resumo (nº de KPIs, % média do projeto).

### Exportar relatório global
Botão "Exportar relatório Gulbenkian" que copia para a área de transferência um bloco de texto formatado:
- Cabeçalho com data
- Resumo geral
- Secção por projeto com todos os indicadores (mesmo formato do exportador atual, com barras ASCII)

```text
═════════════════════════════
RELATÓRIO M&A — MEERU
Exportado em 22/06/2026
═════════════════════════════
Resumo: 19 indicadores · 12 em execução · 1 concluído · 48 % média

── APROXIMA ──
Pessoas imigrantes diretamente envolvidas
Estado: Em execução
Meta: 200 participantes
Valor atual: 87 (44 %)
████░░░░░░ 44 %
Narrativa: ...
```

## Detalhes técnicos

Novo ficheiro `src/routes/_app/_admin.indicadores.tsx` que:
1. Faz `select *` em `projeto_kpis` com join implícito ao nome do projeto (uma query única ordenada por projeto + position).
2. Reutiliza o hook `useKpiValue` já existente em `_admin.projetos.$projetoId.tsx` — extrai esse hook + tipos (`Kpi`, `KpiFiltro`, `Estado`, `Fonte`, `ESTADO_LABELS`, `FONTE_LABELS`, `CATEGORIAS_ACAO`) para um módulo partilhado `src/lib/kpi.ts` para evitar duplicação.
3. Cada linha usa o componente `KpiRow` (versão simplificada, só leitura + link para o projeto) que dispara `useKpiValue` individualmente; resultados sobem via callback para o resumo no topo e para o exportador.
4. Filtros e ordenação ficam em search params (`useNavigate` + `validateSearch`) para serem partilháveis por URL.
5. Acesso restrito: ficheiro fica em `_app/_admin.*` (já cobre o gating de staff existente).
6. Sidebar: adicionar item "Indicadores M&A" no grupo apropriado em `sidebar_items` (mesma mecânica dos restantes itens administrativos).

Não exige migração de base de dados — toda a info já está em `projeto_kpis` + tabelas referenciadas.
