
CREATE TABLE public.tipos_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  paginas text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_user TO authenticated;
GRANT ALL ON public.tipos_user TO service_role;

ALTER TABLE public.pessoas
  ADD COLUMN tipo_user_id uuid REFERENCES public.tipos_user(id) ON DELETE SET NULL;

CREATE INDEX idx_pessoas_tipo_user_id ON public.pessoas(tipo_user_id);

ALTER TABLE public.tipos_user ENABLE ROW LEVEL SECURITY;

CREATE POLICY tipos_user_admin_all ON public.tipos_user
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY tipos_user_self_select ON public.tipos_user
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT tipo_user_id FROM public.pessoas
      WHERE id = public.current_user_pessoa_id()
    )
  );
