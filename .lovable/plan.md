## Objetivo

Em `src/routes/_app/_admin.acoes.tsx`, as abas **Bolsas** e **Transporte** de uma ação devem listar apenas as famílias para as quais foi explicitamente ativado KM ou Bolsa na aba de Inscrições (via os botões "+ KM" / "+ Bolsa" no cabeçalho de família em modo "Agrupar por família"). Famílias sem esses registos deixam de aparecer.

## Alteração de schema (migração)

`mapa_km` hoje não tem `acao_id`, portanto um KM criado para uma família aparece em qualquer ação dessa família. Para respeitar o pedido ("só as famílias que na inscrição têm assinalado KM ou Bolsa"), a ligação tem de ser por ação.

- Migração: `ALTER TABLE public.mapa_km ADD COLUMN acao_id uuid REFERENCES public.acoes(id) ON DELETE SET NULL;` + índice `(acao_id)`. Coluna nullable para não partir registos existentes.

## Alterações no ficheiro

### 1. `criarKmFamilia` (InscricoesTab)
- No `insert` em `mapa_km`, passar também `acao_id: acaoId`.
- Resto igual (km=1, motivo="A completar", estado="por_pagar").

### 2. `TransporteAcaoTab`
- Query `mapaKmRows`: adicionar `.eq("acao_id", acaoId)` (para além do filtro por `familia_id`).
- Após construir `familias`, filtrar: manter apenas famílias com `f.bolsas.length > 0 || f.kmRows.length > 0`.
- Atualizar mensagem do estado vazio para: "Nenhuma família ativada para bolsa ou KM. Ativa nos botões + KM / + Bolsa na aba Inscrições."

### 3. `BolsaTab`
- Adicionar queries:
  - `bolsas_pagamentos` filtradas por `acao_id = acaoId` (lista de `pessoa_id` e `inscricao_id` elegíveis).
  - `mapa_km` filtradas por `acao_id = acaoId` (lista de `familia_id` elegíveis).
- Calcular `familiasComRegisto = Set<familia_id>` = união das famílias em qualquer dos dois conjuntos (usar `pessoa.familia.id` dos `bolsas_pagamentos.pessoa_id`).
- Filtrar `rows` para incluir apenas inscritos cujo `familia.id` está em `familiasComRegisto`.
- Todos os agregados (`elegiveis`, `porCidade`, `porFamilia`, viaturas próprias, totais) recalculam a partir desse `rows` filtrado — nenhum outro código é tocado.
- Mensagem quando vazio: "Nenhuma família ativada para bolsa nesta ação."

### 4. Botões "+ KM" / "+ Bolsa" no cabeçalho de família
- Sem alteração de layout. Opcional (dentro do escopo): passar a mostrar um `Badge` "Ativo" ou estado `disabled` quando já existe registo para a família nesta ação, para evitar cliques duplicados. Para isso, adicionar no `InscricoesTab` duas queries leves (`bolsas_pagamentos` por `acao_id` e `mapa_km` por `acao_id`) e usar sets `familiasComBolsa` / `familiasComKm` na renderização do cabeçalho.

## Verificação
- Typecheck deve passar. Textos em português europeu. Sem alterações a `AddPessoasDialog` nem a outros componentes.
