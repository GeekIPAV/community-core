## Rebuild `src/routes/_app/_admin.bolsas-transporte.tsx` with payment management

### 1. Migration — create `bolsas_pagamentos` table
New table (doesn't exist yet) with:
- `inscricao_id` (unique, FK cascade), `pessoa_id` (FK), `acao_id` (FK)
- `valor numeric(8,2)`, `estado` (`por_pagar`/`pago`/`cancelado`)
- `metodo_pagamento`, `notas`, `data_pagamento`
- Standard `created_at`/`updated_at` + trigger
- GRANTs to `authenticated` + `service_role`
- RLS enabled with policies matching `bolsas_cidades` pattern (staff/admin write, authenticated read)

### 2. Rebuild the route file with 3 Tabs

**Tab "Pagamentos"** (default)
- Fetches actions with `bolsa_transporte = true`, their non-cancelled inscriptions, related pessoas/famílias, active cidades, and existing pagamentos in one query
- Computes `valor_calculado` per inscription:
  - Own car → `viatura_km × KM_RATE × TRIP_FACTOR`
  - Otherwise → `matchCidade().valor_sentido × TRIP_FACTOR`
- 4 KPI cards: Por pagar, Pago, Ações com bolsa, Total geral
- Search input + estado filter (Todos / Por pagar / Pago / Cancelado)
- Accordion per ação → expandable Table with columns: Pessoa · Família · Cidade · Transporte · Valor · Estado · Método · Notas · Ações
- Estado via Select; Método & Notas inline-editable (blur/Enter to save)
- "Marcar pago" quick button; "Reverter" for pagos
- Warning row when multiple inscriptions share the same `viatura_grupo` (normalized)

**Tab "Por família"**
- Search by family name
- One Collapsible per família showing totals (recebido / por receber) + inner table of inscriptions
- Sort: families with `por receber > 0` first, then alphabetical

**Tab "Cidades"**
- Existing cities configuration UI moved verbatim into a `TabsContent`

### 3. Mutations
- `upsertPagamento` via `.upsert(..., { onConflict: "inscricao_id" })` — auto-fills `data_pagamento` when marking as pago
- Invalidates `["bolsas-pagamentos-full"]`
- Helpers: `marcarPago`, `reverter`, `changeEstado`, inline metodo/notas save

### 4. Imports & types
- Add Tabs, Collapsible, Select, Badge, Table, icons per spec
- Import `matchCidade`, `parseViatura`, `formatEuro`, `KM_RATE`, `TRIP_FACTOR`, `normalizeGrupo`, `CidadeBolsa` from `@/lib/bolsa-transporte`
- Local types: `BolsaPagamento`, `InscricaoComBolsa`, `AcaoComBolsa`, `FamiliaResumo`
- Use `@ts-expect-error` on `bolsas_cidades` / `bolsas_pagamentos` `.from()` calls (not in generated types until types regenerate)

### 5. Constraints
- Do not modify `src/lib/bolsa-transporte.ts`
- Keep existing cities UI unchanged (only wrapped in TabsContent)
- All copy in European Portuguese
- Typecheck must pass

### Order of execution
1. Run migration (creates `bolsas_pagamentos`, waits for approval)
2. After migration approved & types regenerated, rewrite the route file
