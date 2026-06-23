-- Índices para acelerar as consultas mais frequentes identificadas em pg_stat_statements.

-- Pessoas: filtros por status e familia_id, ordenação por nome.
CREATE INDEX IF NOT EXISTS idx_pessoas_status_familia
  ON public.pessoas (status, familia_id)
  WHERE familia_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pessoas_nome_completo
  ON public.pessoas (nome_completo);

CREATE INDEX IF NOT EXISTS idx_pessoas_deleted_at
  ON public.pessoas (deleted_at);

-- Inscrições: consultadas por (pessoa_id, status).
CREATE INDEX IF NOT EXISTS idx_inscricoes_pessoa_status
  ON public.inscricoes (pessoa_id, status);

CREATE INDEX IF NOT EXISTS idx_inscricoes_acao
  ON public.inscricoes (acao_id);

-- Registos de serviço: filtros e ordenação habituais.
CREATE INDEX IF NOT EXISTS idx_registos_servico_colaborador_estado
  ON public.registos_servico (colaborador_id, estado, data_inicio DESC);

CREATE INDEX IF NOT EXISTS idx_registos_servico_pagamento
  ON public.registos_servico (pagamento_id)
  WHERE pagamento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registos_servico_sessao
  ON public.registos_servico (sessao_id)
  WHERE sessao_id IS NOT NULL;

-- Pagamentos: listados por colaborador e data.
CREATE INDEX IF NOT EXISTS idx_pagamentos_colab_data
  ON public.pagamentos (colaborador_id, data_pagamento DESC);

-- Ações: ordenadas por data_inicio.
CREATE INDEX IF NOT EXISTS idx_acoes_data_inicio
  ON public.acoes (data_inicio DESC);

-- Interações de parceiros.
CREATE INDEX IF NOT EXISTS idx_parceiro_interacoes_parceiro_data
  ON public.parceiro_interacoes (parceiro_id, data DESC);
