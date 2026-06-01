
CREATE TABLE public.bolsas_cidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  valor_sentido numeric(10,2) NOT NULL CHECK (valor_sentido >= 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bolsas_cidades TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bolsas_cidades TO authenticated;
GRANT ALL ON public.bolsas_cidades TO service_role;

ALTER TABLE public.bolsas_cidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY bolsas_cidades_select_all ON public.bolsas_cidades
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY bolsas_cidades_admin_write ON public.bolsas_cidades
  FOR ALL TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

CREATE TRIGGER trg_bolsas_cidades_updated_at
  BEFORE UPDATE ON public.bolsas_cidades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.bolsas_cidades (nome, valor_sentido) VALUES
  ('São João da Madeira', 4.5),
  ('Braga', 3.5),
  ('Barcelos', 4.5),
  ('Porto/Gaia', 1.5),
  ('Trofa', 2);

ALTER TABLE public.acoes
  ADD COLUMN bolsa_transporte boolean NOT NULL DEFAULT false;
