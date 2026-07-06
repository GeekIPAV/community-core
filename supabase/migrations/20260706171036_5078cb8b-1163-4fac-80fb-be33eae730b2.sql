
ALTER TABLE public.pessoas
  ADD COLUMN IF NOT EXISTS parceiro_id uuid REFERENCES public.parceiros(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pessoas_parceiro_id ON public.pessoas(parceiro_id);

CREATE OR REPLACE FUNCTION public.pessoas_enforce_parceiro_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parceiro_tipo_id uuid;
  v_has_tipo boolean := false;
BEGIN
  IF NEW.parceiro_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_parceiro_tipo_id
    FROM public.tipos_user
   WHERE lower(nome) = 'parceiro'
   LIMIT 1;

  IF v_parceiro_tipo_id IS NULL THEN
    NEW.parceiro_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.tipo_user_id = v_parceiro_tipo_id THEN
    v_has_tipo := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.pessoa_tipos
       WHERE pessoa_id = NEW.id AND tipo_user_id = v_parceiro_tipo_id
    ) INTO v_has_tipo;
  END IF;

  IF NOT v_has_tipo THEN
    NEW.parceiro_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pessoas_enforce_parceiro_link ON public.pessoas;
CREATE TRIGGER trg_pessoas_enforce_parceiro_link
BEFORE INSERT OR UPDATE OF parceiro_id, tipo_user_id ON public.pessoas
FOR EACH ROW EXECUTE FUNCTION public.pessoas_enforce_parceiro_link();
