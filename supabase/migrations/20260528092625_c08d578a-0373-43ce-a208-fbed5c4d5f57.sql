ALTER TABLE public.pessoas ADD COLUMN IF NOT EXISTS projeto_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.pessoas
SET projeto_ids = ARRAY[projeto_id]
WHERE projeto_id IS NOT NULL AND (projeto_ids IS NULL OR array_length(projeto_ids, 1) IS NULL);

ALTER TABLE public.pessoas DROP COLUMN IF EXISTS projeto_id;

CREATE INDEX IF NOT EXISTS idx_pessoas_projeto_ids ON public.pessoas USING GIN (projeto_ids);