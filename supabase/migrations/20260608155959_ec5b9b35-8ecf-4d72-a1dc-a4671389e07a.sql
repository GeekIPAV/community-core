
CREATE TABLE public.localizacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  link_mapa text,
  proprietario text,
  notas text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.localizacoes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.localizacoes TO authenticated;
GRANT ALL ON public.localizacoes TO service_role;

ALTER TABLE public.localizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "localizacoes_select_all" ON public.localizacoes
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "localizacoes_admin_write" ON public.localizacoes
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "localizacoes_staff_write" ON public.localizacoes
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE TRIGGER trg_localizacoes_updated_at
  BEFORE UPDATE ON public.localizacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.acoes
  ADD COLUMN localizacao_id uuid REFERENCES public.localizacoes(id) ON DELETE SET NULL;

CREATE INDEX idx_acoes_localizacao_id ON public.acoes(localizacao_id);
