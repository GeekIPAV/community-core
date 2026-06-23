
CREATE TABLE public.financiamento_projetos (
  financiamento_id uuid NOT NULL REFERENCES public.financiamentos(id) ON DELETE CASCADE,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (financiamento_id, projeto_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financiamento_projetos TO authenticated;
GRANT ALL ON public.financiamento_projetos TO service_role;

ALTER TABLE public.financiamento_projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff lê financiamento_projetos"
  ON public.financiamento_projetos FOR SELECT
  TO authenticated
  USING (public.is_current_user_staff());

CREATE POLICY "admin gere financiamento_projetos"
  ON public.financiamento_projetos FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE INDEX idx_financiamento_projetos_projeto ON public.financiamento_projetos(projeto_id);
