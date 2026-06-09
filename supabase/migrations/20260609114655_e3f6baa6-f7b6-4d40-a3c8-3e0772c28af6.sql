ALTER TABLE public.acoes
  ADD COLUMN IF NOT EXISTS projeto_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS restrito_a_projetos boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_acoes_projeto_ids ON public.acoes USING gin (projeto_ids);