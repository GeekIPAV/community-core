ALTER TABLE public.familias
  ADD COLUMN IF NOT EXISTS direito_bolsa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS direito_mapa_km boolean NOT NULL DEFAULT false;