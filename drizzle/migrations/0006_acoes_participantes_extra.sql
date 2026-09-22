ALTER TABLE public.acoes
  ADD COLUMN IF NOT EXISTS participantes_extra integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.acoes.participantes_extra IS 'Número de participantes não registados (participantes fantasma) associados à ação; contam para relatórios e indicadores.';