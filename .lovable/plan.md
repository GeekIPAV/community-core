## Problema

Quando um registo de Mapa de KM é criado (ou editado/eliminado), o separador **Transporte** da família e da ação nem sempre reflete a mudança de imediato, porque algumas mutações não invalidam todas as queries relevantes.

## Query keys envolvidas

- `["mapa-km"]` — tabela geral em `/bolsas-transporte`
- `["mapa-km-acao", acaoId]` — registos de KM no separador Transporte da ação
- `["transporte-acao", acaoId]` — famílias visíveis no separador Transporte da ação
- `["bolsa-km-ativos", acaoId]` — famílias com KM no diálogo de inscrição
- `["familia-mapa-km", familiaId]` — separador Transporte de `FamilyDetailDialog`

## Alterações

### 1. `src/routes/_app/_admin.bolsas-transporte.tsx`
Nas mutações `createMapaKm`, `updateMapaKm`, `deleteMapaKm` (linhas ~803–837), adicionar invalidação de:
- `["familia-mapa-km"]` (todas as famílias — invalidação por prefixo)
- `["mapa-km-acao"]`, `["transporte-acao"]`, `["bolsa-km-ativos"]` (todas as ações — prefixo)

### 2. `src/routes/_app/_admin.acoes.tsx`
- Mutação "+ KM" (linha ~648): adicionar `["familia-mapa-km"]`.
- Mutação de update de mapa_km em `TransporteAcaoTab` (linha ~2978): adicionar `["familia-mapa-km"]` e `["transporte-acao", acaoId]`.
- Fluxo de inscrição com KM (linha ~1799): já invalida `["mapa-km"]`; adicionar `["familia-mapa-km"]`, `["mapa-km-acao"]`, `["transporte-acao"]`, `["bolsa-km-ativos"]`.

### 3. `src/components/family-detail.tsx`
Nas mutações de mapa_km da tab Transporte (linha ~464), adicionar invalidação de `["mapa-km-acao"]` e `["transporte-acao"]` para propagar para a vista da ação.

Sem mudanças de UI nem de schema.