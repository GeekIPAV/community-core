## Objetivo
Importar para a base de dados os 236 registos de serviços do CSV (do Notion) e os pagamentos correspondentes, mantendo a ligação entre cada serviço e o seu pagamento.

## O que vou fazer

### 1. Criar colaboradores em falta
O CSV refere 18 colaboradoras, mas só 7 existem na tabela `colaboradores`. Vou criar registos mínimos (apenas `nome_completo`) para as 12 em falta:
Ilham, Ghufran, Noor, Najeh, Rava, Leila, Manar, Fatima, Hitam, Leen, Fatu, Merna.

(Sem email/IBAN/morada — podem ser completados depois.)

### 2. Mapear tipos de serviço
Mapeamento por nome para os `tipos_servico` já existentes:
- "Embalamento", "Workshop Sabonetes", "Workshop Cozinha", "Reunião de Parceiros", "Feira no Porto", "Tradução de Documento", "Mediação Online", "Reunião Online", "Feira com Viagem", "Participação em Evento", "Tradução 1 Dia", "Participação em Formação", "Mediação Mensal", "Feira com Dormida" → match direto.
- "Visita/Mediação a Família - Tradução" → `Visita/Mediação a Família`.
- "Mediação e Tradução Permanente - Vários" → `Mediação e Tradução Permanente`.
- 12 linhas têm serviço em branco (deslocações, transporte, workshops futuros). Para estas crio um tipo genérico **"Outro / Avulso"** (unidade `serviço`, preço 0) e uso o campo `descricao_override` para guardar o texto da coluna `Propriedade`.

### 3. Importar `registos_servico`
Para cada linha (236):
- `colaborador_id`: lookup por nome.
- `tipo_servico_id`: conforme mapeamento.
- `data`: primeira data extraída de `Data e hora` (formato `dd/mm/aaaa`). Linhas sem data ficam com a data de hoje + nota.
- `quantidade`: coluna `Qtd.` (default 1 se vazio).
- `preco_unitario_override`: coluna `Valor` (quando difere do preço padrão).
- `outros_custos`: coluna `Outros custos` (parse de "€ 6,90").
- `descricao`: texto da coluna `Propriedade` quando útil (ex.: "Visita de Estudo AFAQ…").
- `estado`: `pago` se `Pago = Yes`, senão `aprovado` (das 7 linhas "No", são workshops futuros).
- `notas`: referência ao ID Notion (`Propriedade`).

### 4. Importar `pagamentos`
Agrupar as 229 linhas pagas pela coluna `Pagamentos` (ex.: "30/11 - Rani") — ~30–40 grupos:
- `colaborador_id`: do colaborador do grupo.
- `data_pagamento`: parse da data do label (ex.: "30/11" → 30/11/2024, "16/01/25" → 16/01/2025, "16/1/26" → 16/01/2026).
- `valor_total`: soma de `T. Pagar (H+Tr)` das linhas do grupo.
- `metodo_pagamento`: `Transferência Bancária` (default).
- `notas`: label original do Notion.

Depois atualizo cada `registo_servico` pago com o `pagamento_id` correspondente.

### 5. Execução
Faço tudo via **migração + insert** numa única transação. Gero o SQL a partir de um script Python que lê o CSV; os INSERTs ficam inline (sem dependências de runtime).

## Notas
- Linhas onde `Valor Pago` ≠ soma de `T. Pagar` (ex.: "174" para 7×6+0) representam pagamentos acumulados de várias linhas — fica refletido na soma do grupo.
- Idempotência: vou marcar os registos com `notas` contendo o ID Notion (ex.: `notion:010`) para detetar e evitar duplicados em re-importações.

## Confirmações antes de avançar
1. Criar as 12 colaboradoras em falta apenas com o nome — ok?
2. Criar o tipo genérico **"Outro / Avulso"** para as 12 linhas sem serviço definido — ok, ou prefere ignorá-las?
3. As 7 linhas "Pago = No" (workshops futuros sem data) ficam como `aprovado` — ok?
