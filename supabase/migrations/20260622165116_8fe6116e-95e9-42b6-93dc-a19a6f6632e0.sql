ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS matricula text,
  ADD COLUMN IF NOT EXISTS morada text,
  ADD COLUMN IF NOT EXISTS nif text;