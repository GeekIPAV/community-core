ALTER TABLE public.acoes
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE text USING status::text,
  ALTER COLUMN status SET DEFAULT 'ativa';

ALTER TABLE public.acoes
  ADD COLUMN IF NOT EXISTS inscricoes_abertas boolean NOT NULL DEFAULT true;