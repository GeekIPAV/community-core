DO $$ BEGIN
  CREATE TYPE public.status_acao AS ENUM ('ativa', 'cancelada', 'concluida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.acoes
  ADD COLUMN IF NOT EXISTS status public.status_acao NOT NULL DEFAULT 'ativa';