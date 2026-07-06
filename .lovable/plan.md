## 1. Top 5 nacionalidades
`src/components/meeru-em-numeros.tsx`: `slice(0, 3)` → `slice(0, 5)`, título "Top 5 nacionalidades".

## 2. Voluntários com filtro correcto
Migração: actualizar `get_estatisticas_publicas` para calcular `voluntarios_total` como:
```sql
COUNT(*) FROM pessoas WHERE is_voluntario = true AND status = 'ativo' AND deleted_at IS NULL
```

## 3. Múltiplos tipos de participante por pessoa
Migração:
- Nova tabela `public.pessoa_tipos (pessoa_id, tipo_user_id, created_at)` com PK composta, FKs com `ON DELETE CASCADE`.
- GRANTs (`authenticated`, `service_role`) + RLS.
- Políticas: staff/admin lê e escreve tudo; utilizador lê os próprios tipos.

UI (`src/routes/_app/_admin.participantes.tsx`):
- Query adicional a `pessoa_tipos` + `tipos_user`.
- Multi-select popover (checkboxes) na ficha/edição da pessoa que faz upsert/delete em `pessoa_tipos`.
- Badges com os tipos actuais tanto na ficha como na coluna da listagem (mantém `tipo_user_id` para retrocompatibilidade).

## 4. Distribuição por idade em `/resultados`
Migração: adicionar `idades_detalhe` ao RPC `get_estatisticas_publicas` com faixas `< 18`, `18–25`, `26–35`, `36–45`, `46–60`, `> 60` (só `status='ativo'`, `deleted_at IS NULL`, `data_nascimento IS NOT NULL`).

UI (`src/routes/resultados.tsx`):
- Novo Card com `BarChart` (recharts) usando o mesmo `ChartContainer`/estilo dos gráficos existentes, colocado na grelha `lg:grid-cols-2`.

## Ordem de execução
1. Migração SQL única (tabela `pessoa_tipos` + RPC actualizado com `voluntarios_total` corrigido e `idades_detalhe`).
2. Após aprovação: alterações de UI nos 3 ficheiros.
