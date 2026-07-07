CREATE TABLE IF NOT EXISTS public.mapa_km (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT current_date,
  motivo text NOT NULL,
  km numeric(8,2) NOT NULL CHECK (km > 0),
  matricula text,
  n_carros integer NOT NULL DEFAULT 1 CHECK (n_carros >= 1),
  valor numeric(8,2) GENERATED ALWAYS AS (round(km * 0.36 * 2 * n_carros, 2)) STORED,
  estado text NOT NULL DEFAULT 'por_pagar' CHECK (estado IN ('por_pagar','pago','cancelado')),
  metodo_pagamento text,
  notas text,
  data_pagamento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapa_km TO authenticated;
GRANT ALL ON public.mapa_km TO service_role;

ALTER TABLE public.mapa_km ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_mapa_km" ON public.mapa_km
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS mapa_km_familia_id_idx ON public.mapa_km(familia_id);
CREATE INDEX IF NOT EXISTS mapa_km_data_idx ON public.mapa_km(data DESC);
CREATE INDEX IF NOT EXISTS mapa_km_estado_idx ON public.mapa_km(estado);

CREATE TRIGGER mapa_km_set_updated_at
  BEFORE UPDATE ON public.mapa_km
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
