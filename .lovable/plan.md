## Plano — Mapa de KM (bolsas de transporte)

Adicionar uma 4ª aba "Mapa de KM" à página `src/routes/_app/_admin.bolsas-transporte.tsx` para registar deslocações avulsas de famílias (fora das ações), reembolsadas a 0,36€/km × 2 (ida e volta) × nº de carros.

### 1. Migração — nova tabela `mapa_km`
- Campos: `familia_id` (FK cascade), `data`, `motivo`, `km`, `matricula`, `n_carros`, `estado` (por_pagar/pago/cancelado), `metodo_pagamento`, `notas`, `data_pagamento`.
- `valor` como coluna **GENERATED** (`km × 0.36 × 2 × n_carros`) — nunca incluída em inserts/updates.
- GRANTs a `authenticated` e `service_role`.
- RLS ativo, política permissiva para `authenticated` (consistente com `bolsas_pagamentos`).
- Trigger `updated_at`.

### 2. Rota — nova aba na página existente
- Adicionar `<TabsTrigger value="mapa-km">` e respectivo `<TabsContent>`.
- Manter tabs 1, 2, 3 (Pagamentos, Por família, Cidades) intactas.

### 3. Dados
- Query `mapa-km`: SELECT com join a `familias(nome)`, ordenada por data desc.
- Query `familias-lista-bolsa` (para form + filtro).
- Mutations: `createMapaKm`, `updateMapaKm`, `deleteMapaKm` — todas invalidam `["mapa-km"]`. `valor` e `familia_nome` são strippados dos payloads.

### 4. UI da aba
- 4 KPI cards: Por pagar (nº + €), Pago (nº + €), Total KM, Total geral €.
- Filtros: pesquisa (família/motivo), família, estado + botão "Novo registo".
- Tabela: Família · Data · Motivo · KM · Matrícula · Carros · Valor · Estado (Select) · Método (inline) · Notas (inline) · Editar/Eliminar.
- Rodapé com totais filtrados.
- Caixa informativa sobre a fórmula.

### 5. Diálogo criar/editar
- Campos: Família (bloqueada em edição), Data, Estado, Motivo, KM (ida), Matrícula, Nº carros, Método, Notas.
- Preview do valor calculado em tempo real.
- Validação: família, motivo, km > 0.

### 6. Diálogo de confirmação de eliminação (AlertDialog).

### Restrições
- Nunca enviar `valor` (coluna gerada).
- Todo o texto em português europeu.
- Typecheck tem de passar.
- Não alterar `src/lib/bolsa-transporte.ts` nem as outras tabs.

### Ordem
1. Migração (aprovação do utilizador + regeneração de tipos).
2. Editar o ficheiro da rota para adicionar tab, queries, mutations, UI e diálogos.
