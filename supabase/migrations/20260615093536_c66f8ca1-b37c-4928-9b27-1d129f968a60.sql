
CREATE OR REPLACE FUNCTION public.pessoas_restrict_self_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_caller_admin boolean;
BEGIN
  -- Allow service role and admins to bypass
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.is_admin INTO is_caller_admin
  FROM public.pessoas p
  WHERE p.auth_user_id = auth.uid()
  LIMIT 1;

  IF COALESCE(is_caller_admin, false) THEN
    RETURN NEW;
  END IF;

  -- Self-link scenario: OLD.auth_user_id was NULL and NEW.auth_user_id = auth.uid()
  IF OLD.auth_user_id IS NULL AND NEW.auth_user_id = auth.uid() THEN
    -- Only allow auth_user_id and updated_at to change; all other columns must match OLD
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.nome_completo IS DISTINCT FROM OLD.nome_completo
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
      OR NEW.tipo_user_id IS DISTINCT FROM OLD.tipo_user_id
      OR NEW.familia_id IS DISTINCT FROM OLD.familia_id
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Self-link only permits setting auth_user_id; other columns must remain unchanged';
    END IF;

    -- Check all remaining columns dynamically using to_jsonb comparison
    IF (to_jsonb(NEW) - 'auth_user_id' - 'updated_at') <> (to_jsonb(OLD) - 'auth_user_id' - 'updated_at') THEN
      RAISE EXCEPTION 'Self-link only permits setting auth_user_id; other columns must remain unchanged';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pessoas_restrict_self_link_trg ON public.pessoas;
CREATE TRIGGER pessoas_restrict_self_link_trg
BEFORE UPDATE ON public.pessoas
FOR EACH ROW
EXECUTE FUNCTION public.pessoas_restrict_self_link();
