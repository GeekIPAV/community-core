-- 1) tipos_acao
CREATE TABLE public.tipos_acao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  requer_formadores boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tipos_acao TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_acao TO authenticated;
GRANT ALL ON public.tipos_acao TO service_role;

ALTER TABLE public.tipos_acao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_acao_select_all" ON public.tipos_acao
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "tipos_acao_admin_write" ON public.tipos_acao
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE TRIGGER trg_tipos_acao_updated_at
  BEFORE UPDATE ON public.tipos_acao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults
INSERT INTO public.tipos_acao (nome, requer_formadores, ordem) VALUES
  ('Formação', true, 1),
  ('Workshop', true, 2),
  ('Reunião', false, 3),
  ('Evento', false, 4),
  ('Encontro', false, 5),
  ('Visita', false, 6)
ON CONFLICT (nome) DO NOTHING;

-- 2) acoes: tipo_acao_id + formador_ids
ALTER TABLE public.acoes
  ADD COLUMN tipo_acao_id uuid REFERENCES public.tipos_acao(id) ON DELETE SET NULL,
  ADD COLUMN formador_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX idx_acoes_tipo_acao_id ON public.acoes(tipo_acao_id);
CREATE INDEX idx_acoes_formador_ids ON public.acoes USING gin(formador_ids);
