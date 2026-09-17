ALTER TABLE public.casos_apoio
  ADD COLUMN IF NOT EXISTS voluntario_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_casos_apoio_voluntario_id ON public.casos_apoio (voluntario_id);