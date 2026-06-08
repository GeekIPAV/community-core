
CREATE TABLE public.vistas_guardadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key text NOT NULL,
  name text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin_view boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vistas_guardadas_storage_key_idx ON public.vistas_guardadas (storage_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vistas_guardadas TO authenticated;
GRANT ALL ON public.vistas_guardadas TO service_role;

ALTER TABLE public.vistas_guardadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver vistas partilhadas ou proprias"
  ON public.vistas_guardadas FOR SELECT
  TO authenticated
  USING (is_admin_view = true OR created_by = auth.uid());

CREATE POLICY "criar vistas proprias"
  ON public.vistas_guardadas FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "editar vistas proprias ou como admin"
  ON public.vistas_guardadas FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR public.is_current_user_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_current_user_admin());

CREATE POLICY "apagar vistas proprias ou como admin"
  ON public.vistas_guardadas FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR public.is_current_user_admin());

CREATE TRIGGER trg_vistas_guardadas_set_updated_at
  BEFORE UPDATE ON public.vistas_guardadas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.vistas_guardadas_set_admin_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.is_admin_view := public.is_current_user_admin();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vistas_guardadas_admin_flag
  BEFORE INSERT OR UPDATE OF snapshot, name ON public.vistas_guardadas
  FOR EACH ROW EXECUTE FUNCTION public.vistas_guardadas_set_admin_flag();
