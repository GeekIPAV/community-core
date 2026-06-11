CREATE TABLE public.design_tokens (
  id boolean PRIMARY KEY DEFAULT true,
  tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT design_tokens_singleton CHECK (id = true)
);

GRANT SELECT ON public.design_tokens TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.design_tokens TO authenticated;
GRANT ALL ON public.design_tokens TO service_role;

ALTER TABLE public.design_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ler tokens" ON public.design_tokens
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Staff pode gerir tokens" ON public.design_tokens
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE TRIGGER design_tokens_updated_at
  BEFORE UPDATE ON public.design_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.design_tokens (id, tokens) VALUES (true, '{}'::jsonb);
