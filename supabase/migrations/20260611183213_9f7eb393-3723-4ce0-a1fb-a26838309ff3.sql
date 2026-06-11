ALTER TABLE public.acoes ADD COLUMN publico boolean NOT NULL DEFAULT true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acoes TO authenticated;
GRANT ALL ON public.acoes TO service_role;