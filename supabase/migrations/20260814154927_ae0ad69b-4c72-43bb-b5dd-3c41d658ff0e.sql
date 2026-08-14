ALTER TABLE public.curriculos
  ADD COLUMN IF NOT EXISTS carta_conducao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS carta_conducao_categorias text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linguas jsonb NOT NULL DEFAULT '[]'::jsonb;