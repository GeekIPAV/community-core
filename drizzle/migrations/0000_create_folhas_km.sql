CREATE TABLE public.folhas_km (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  auth_user_id uuid,
  nome text NOT NULL,
  morada text,
  nif text,
  iban text,
  matricula text,
  email text,
  valor_km numeric NOT NULL DEFAULT 0.36,
  linhas jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_km numeric NOT NULL DEFAULT 0,
  total_valor numeric NOT NULL DEFAULT 0,
  periodo text,
  estado text NOT NULL DEFAULT 'submetida',
  enviado_em timestamptz,
  enviado_para text[] NOT NULL DEFAULT '{}',
  erro_envio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.folhas_km TO authenticated;
GRANT ALL ON public.folhas_km TO service_role;

ALTER TABLE public.folhas_km ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff gere folhas km" ON public.folhas_km
  FOR ALL TO authenticated
  USING (public.is_current_user_admin() OR public.is_current_user_staff())
  WITH CHECK (public.is_current_user_admin() OR public.is_current_user_staff());

CREATE POLICY "pessoa ve as suas folhas" ON public.folhas_km
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR pessoa_id = public.current_user_pessoa_id());

CREATE POLICY "pessoa cria as suas folhas" ON public.folhas_km
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE INDEX idx_folhas_km_pessoa ON public.folhas_km(pessoa_id);
CREATE INDEX idx_folhas_km_created ON public.folhas_km(created_at DESC);

CREATE TRIGGER folhas_km_touch
  BEFORE UPDATE ON public.folhas_km
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();