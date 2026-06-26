
-- Allow caso to be linked to a family alone (without a specific person)
ALTER TABLE public.casos_apoio ALTER COLUMN pessoa_id DROP NOT NULL;

ALTER TABLE public.casos_apoio
  DROP CONSTRAINT IF EXISTS casos_apoio_alvo_chk;
ALTER TABLE public.casos_apoio
  ADD CONSTRAINT casos_apoio_alvo_chk CHECK (pessoa_id IS NOT NULL OR familia_id IS NOT NULL);

-- Trigger: keep existing auto-fill of familia_id from pessoa, but no-op when pessoa is null
CREATE OR REPLACE FUNCTION public.casos_apoio_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year int := EXTRACT(YEAR FROM COALESCE(NEW.data_abertura, CURRENT_DATE));
  v_seq int;
BEGIN
  IF NEW.familia_id IS NULL AND NEW.pessoa_id IS NOT NULL THEN
    SELECT familia_id INTO NEW.familia_id FROM public.pessoas WHERE id = NEW.pessoa_id;
  END IF;
  IF NEW.pessoa_id IS NULL AND NEW.familia_id IS NULL THEN
    RAISE EXCEPTION 'Caso requer pessoa ou família';
  END IF;
  IF NEW.numero IS NULL THEN
    SELECT COALESCE(MAX(SUBSTRING(numero FROM '\d+$')::int), 0) + 1
      INTO v_seq
      FROM public.casos_apoio
      WHERE numero LIKE 'CASO-' || v_year || '-%';
    NEW.numero := 'CASO-' || v_year || '-' || LPAD(v_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- Extend self-select to include cases for the user's own family
DROP POLICY IF EXISTS casos_self_select ON public.casos_apoio;
CREATE POLICY casos_self_select ON public.casos_apoio
  FOR SELECT
  USING (
    pessoa_id = public.current_user_pessoa_id()
    OR (pessoa_id IS NULL AND familia_id IS NOT NULL AND familia_id = public.current_user_familia_id())
  );

-- Extend registos self-select / insert to family-only cases too
DROP POLICY IF EXISTS registos_self_select ON public.caso_registos;
CREATE POLICY registos_self_select ON public.caso_registos
  FOR SELECT
  USING (
    visivel_para_pessoa = true AND EXISTS (
      SELECT 1 FROM public.casos_apoio c
      WHERE c.id = caso_registos.caso_id
        AND (
          c.pessoa_id = public.current_user_pessoa_id()
          OR (c.pessoa_id IS NULL AND c.familia_id = public.current_user_familia_id())
        )
    )
  );

DROP POLICY IF EXISTS registos_self_insert ON public.caso_registos;
CREATE POLICY registos_self_insert ON public.caso_registos
  FOR INSERT
  WITH CHECK (
    tipo = 'Resposta da pessoa' AND visivel_para_pessoa = true AND EXISTS (
      SELECT 1 FROM public.casos_apoio c
      WHERE c.id = caso_registos.caso_id
        AND (
          c.pessoa_id = public.current_user_pessoa_id()
          OR (c.pessoa_id IS NULL AND c.familia_id = public.current_user_familia_id())
        )
    )
  );
