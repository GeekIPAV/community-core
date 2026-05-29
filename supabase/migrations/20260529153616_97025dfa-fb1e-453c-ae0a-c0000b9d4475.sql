CREATE TABLE public.dashboard_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  charts jsonb NOT NULL DEFAULT '[]'::jsonb,
  kpis jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dashboard_config TO anon;
GRANT SELECT, INSERT, UPDATE ON public.dashboard_config TO authenticated;
GRANT ALL ON public.dashboard_config TO service_role;

ALTER TABLE public.dashboard_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_config_select_all"
  ON public.dashboard_config FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "dashboard_config_admin_insert"
  ON public.dashboard_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "dashboard_config_admin_update"
  ON public.dashboard_config FOR UPDATE
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE TRIGGER dashboard_config_set_updated_at
  BEFORE UPDATE ON public.dashboard_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.dashboard_config (key, charts, kpis) VALUES (
  'resultados',
  '[
    {"id":"c1","title":"Distribuição por género","tabela":"pessoas","coluna":"genero","type":"pie"},
    {"id":"c2","title":"Religiões","tabela":"pessoas","coluna":"religiao","type":"pie"},
    {"id":"c3","title":"Nacionalidades","tabela":"pessoas","coluna":"nacionalidade","type":"bar"},
    {"id":"c4","title":"Participantes por projeto","tabela":"inscricoes","coluna":"acao","type":"bar"}
  ]'::jsonb,
  '[]'::jsonb
);