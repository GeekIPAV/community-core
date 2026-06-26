
ALTER TABLE public.relatorios
  ADD COLUMN IF NOT EXISTS projeto_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS geral boolean NOT NULL DEFAULT false;

UPDATE public.relatorios
   SET projeto_ids = ARRAY[projeto_id]
 WHERE projeto_id IS NOT NULL
   AND (projeto_ids IS NULL OR array_length(projeto_ids, 1) IS NULL);
