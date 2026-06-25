
ALTER TABLE public.financiamentos
  ADD COLUMN IF NOT EXISTS cluster text,
  ADD COLUMN IF NOT EXISTS centros_custos text,
  ADD COLUMN IF NOT EXISTS candidatura_url text,
  ADD COLUMN IF NOT EXISTS contrato_url text,
  ADD COLUMN IF NOT EXISTS distribuicao_url text,
  ADD COLUMN IF NOT EXISTS aprovado_valor numeric,
  ADD COLUMN IF NOT EXISTS orcamento_valor numeric,
  ADD COLUMN IF NOT EXISTS incluido_orcamento boolean,
  ADD COLUMN IF NOT EXISTS metricas text,
  ADD COLUMN IF NOT EXISTS obrigacoes text,
  ADD COLUMN IF NOT EXISTS mais_informacoes text,
  ADD COLUMN IF NOT EXISTS status_externo text;
