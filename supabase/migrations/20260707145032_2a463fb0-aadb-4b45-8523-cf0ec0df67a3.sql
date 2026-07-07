ALTER TABLE public.mapa_km ADD COLUMN IF NOT EXISTS acao_id uuid REFERENCES public.acoes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS mapa_km_acao_id_idx ON public.mapa_km(acao_id);