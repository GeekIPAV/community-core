ALTER TABLE public.familias
  ADD COLUMN IF NOT EXISTS contacto_meeru_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS familias_contacto_meeru_id_idx ON public.familias(contacto_meeru_id);