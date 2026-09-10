CREATE TABLE public.familia_atividade_voluntarios (
  familia_atividade_id uuid NOT NULL REFERENCES public.familia_atividades(id) ON DELETE CASCADE,
  pessoa_id uuid NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (familia_atividade_id, pessoa_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.familia_atividade_voluntarios TO authenticated;
GRANT ALL ON public.familia_atividade_voluntarios TO service_role;

ALTER TABLE public.familia_atividade_voluntarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fav_staff_all" ON public.familia_atividade_voluntarios
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE POLICY "fav_self_select" ON public.familia_atividade_voluntarios
  FOR SELECT TO authenticated
  USING (pessoa_id = public.current_user_pessoa_id());

CREATE INDEX idx_fav_pessoa ON public.familia_atividade_voluntarios(pessoa_id);