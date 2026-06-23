# Melhorias propostas para a aplicação MEERU

Plano focado em três frentes que escolheste, organizado por fases para limitar consumo de créditos e risco. Cada fase é executável de forma independente.

---

## Fase 1 — Performance e robustez

Objetivo: tornar a app fluida mesmo com milhares de registos e eliminar refetches desnecessários.

1. **Updates otimistas em todas as tabelas com edição inline**
   Aplicar o mesmo padrão já usado nos Registos de serviço (`onMutate` + `setQueryData` + rollback no `onError`) em:
   - Pessoas/Participantes, Famílias, Ações, Parceiros, Projetos, Financiamentos, Localizações, Colaboradoras, Tipos de serviço, Etiquetas.
   - Resultado: edição de uma célula é instantânea, sem refetch da tabela inteira.

2. **Virtualização das tabelas grandes**
   Adicionar `@tanstack/react-virtual` ao `SmartTable` quando o número de linhas ultrapassa um limiar (ex.: 200). Mantém scroll suave em Participantes (>1k), Ações e Registos.

3. **Redução de queries duplicadas**
   Várias páginas (`servicos`, `colaboradoras/:id`, `acoes`) lançam queries com chaves diferentes para os mesmos dados (`colaboradores_lookup`, `colaboradores_lookup_pag`, `tipos_servico_lookup` em 3 sítios). Unificar chaves para partilhar cache.

4. **Índices em falta na BD**
   Usar `slow_queries` para identificar consultas lentas e adicionar índices em colunas filtradas/ordenadas com frequência: `registos_servico (colaborador_id, estado, data_inicio)`, `acoes (data_inicio)`, `pessoas (deleted_at, nome_completo)`, `parceiro_interacoes (parceiro_id, data)`, `pagamentos (colaborador_id, data_pagamento)`.

5. **Lazy-load do calendário e gráficos pesados**
   `recharts` e `react-big-calendar` (se presente) só devem carregar nas rotas que os usam. Já está em rotas separadas, mas o ficheiro `_admin.servicos.tsx` (1876 linhas) importa `recharts` mesmo quando se está noutro tab.

6. **Tratamento de erros uniforme**
   Substituir os `toast.error(e.message)` ad hoc por um helper `handleSupabaseError(e)` que reconhece códigos comuns (RLS, FK, unique) e mostra mensagens em PT-PT compreensíveis.

---

## Fase 2 — UX e produtividade

Objetivo: reduzir cliques e atrito nas tarefas diárias do staff.

1. **Ações em massa**
   No SmartTable, suportar seleção múltipla (checkbox por linha) e barra de ação flutuante com:
   - Registos: aprovar / marcar pago / eliminar / alterar estado.
   - Pessoas: adicionar etiqueta / mover para família / eliminar.
   - Pagamentos: gerar referência conjunta.

2. **Atalhos de teclado globais**
   - `Cmd/Ctrl+K` paleta de comandos (navegar, criar novo registo/pessoa/ação).
   - `N` em qualquer listagem abre o dialog "Novo …".
   - `E` na linha focada entra em modo edição.
   - `/` foca o campo de pesquisa global.

3. **Feedback visual de loading/saving**
   - Linha em estado "a guardar" com ligeiro fade enquanto a mutação otimista corre.
   - Botão "Guardar" mostra spinner + bloqueia duplo clique.
   - Skeletons consistentes em todas as tabelas (algumas mostram só "A carregar…").

4. **Acessibilidade dos dialogs**
   Corrigir os avisos `Missing Description or aria-describedby` que aparecem na consola em vários `DialogContent` (Sessões, Pagamentos, Bulk import).

5. **Pesquisa global**
   Endpoint único (`rpc search_global`) que devolve resultados de pessoas, ações, parceiros, projetos numa única paleta de comandos.

6. **Vistas guardadas partilhadas**
   A tabela `vistas_guardadas` já existe — falta UI para marcar uma vista como "partilhada com a equipa" e indicador visual de qual a vista ativa.

---

## Fase 3 — Dashboard e relatórios

Objetivo: passar do dashboard atual (estatísticas genéricas) para um painel operacional acionável.

1. **KPIs operacionais no topo do dashboard**
   - € por pagar a colaboradoras (pendente + aprovado).
   - Registos pendentes de aprovação (com link direto).
   - Próximas sessões nos próximos 7 dias.
   - Famílias sem contacto há > 30 dias.
   - Ações sem KPIs preenchidos no mês anterior.
   - Financiamento: % executado por projeto ativo.

2. **Gráficos comparativos por período**
   - Seletor de período (mês / trimestre / ano / custom).
   - Comparação com período homólogo (Δ % e seta).
   - Séries: novos participantes, ações realizadas, horas de serviço, valor pago.

3. **Relatórios exportáveis em PDF**
   Endpoints (server functions) que geram PDF via `@react-pdf/renderer`:
   - Recibo/relatório de pagamento por colaboradora num período.
   - Relatório por projeto (atividades, participantes, KPIs, financiamento associado).
   - Relatório por financiamento (projetos cobertos, valor executado, indicadores).
   Botão "Exportar PDF" nas páginas de detalhe respectivas.

4. **Exportação CSV consistente**
   Já existe em Registos — replicar em Pessoas, Famílias, Ações, Pagamentos, Parceiros, com escolha das colunas visíveis.

5. **Widgets configuráveis**
   A tabela `dashboard_config` já existe; usar para deixar cada utilizador escolher e reordenar os widgets do seu dashboard.

---

## Recomendação de ordem

Sugiro começar pela **Fase 1** (impacto imediato e transversal, baixo risco), depois **Fase 2** (multiplica produtividade do staff), e fechar com **Fase 3** (alto valor mas mais visual/cosmético, pode esperar). Cada fase deve ser uma sessão separada para evitar erros acumulados.

## Notas técnicas

- Toda a edição inline otimista deve usar a mesma forma: `onMutate` cancela queries, snapshot do `getQueryData`, `setQueryData` com novo valor, rollback no `onError`, sem `invalidateQueries` no sucesso.
- A virtualização deve preservar a UX de drag-to-resize, agrupamento e filtros já existentes no `SmartTable`.
- Os PDFs devem correr em `createServerFn` (não browser) para incluírem dados que dependem de RLS de admin.
- Antes de adicionar índices, correr `slow_queries` para confirmar quais valem o custo de manutenção.

Diz qual fase queres avançar primeiro (ou se preferes que detalhe apenas um item específico).
