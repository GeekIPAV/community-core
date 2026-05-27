CREATE TABLE public.projetos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO authenticated;
GRANT ALL ON public.projetos TO service_role;

ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projetos_select_auth" ON public.projetos FOR SELECT TO authenticated USING (true);
CREATE POLICY "projetos_admin_write" ON public.projetos FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE TRIGGER projetos_set_updated_at
  BEFORE UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pessoas ADD COLUMN projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL;
CREATE INDEX idx_pessoas_projeto_id ON public.pessoas(projeto_id);