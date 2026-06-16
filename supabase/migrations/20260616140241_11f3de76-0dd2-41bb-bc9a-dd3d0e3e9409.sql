
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := NEW.email;
  v_existing_id uuid;
  v_nome text;
  v_equipa_id uuid;
  v_is_meeru boolean;
BEGIN
  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RETURN NEW;
  END IF;

  v_is_meeru := lower(v_email) LIKE '%@meeru.org';
  IF v_is_meeru THEN
    SELECT id INTO v_equipa_id FROM public.tipos_user WHERE lower(nome) = 'equipa' LIMIT 1;
  END IF;

  SELECT id INTO v_existing_id
    FROM public.pessoas
   WHERE status = 'ativo'
     AND auth_user_id IS NULL
     AND email IS NOT NULL
     AND lower(email) = lower(v_email)
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.pessoas
       SET auth_user_id = NEW.id,
           email = COALESCE(email, v_email),
           tipo_user_id = CASE
             WHEN v_is_meeru AND tipo_user_id IS NULL THEN v_equipa_id
             ELSE tipo_user_id
           END
     WHERE id = v_existing_id;
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.pessoas WHERE auth_user_id = NEW.id) THEN
    IF v_is_meeru AND v_equipa_id IS NOT NULL THEN
      UPDATE public.pessoas
         SET tipo_user_id = v_equipa_id
       WHERE auth_user_id = NEW.id AND tipo_user_id IS NULL;
    END IF;
    RETURN NEW;
  END IF;

  v_nome := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(v_email, '@', 1)
  );

  INSERT INTO public.pessoas (nome_completo, email, auth_user_id, status, is_admin, tipo_user_id)
  VALUES (v_nome, v_email, NEW.id, 'ativo', false, v_equipa_id);

  RETURN NEW;
END;
$function$;

-- Backfill existentes
UPDATE public.pessoas
   SET tipo_user_id = (SELECT id FROM public.tipos_user WHERE lower(nome) = 'equipa' LIMIT 1)
 WHERE tipo_user_id IS NULL
   AND email IS NOT NULL
   AND lower(email) LIKE '%@meeru.org'
   AND EXISTS (SELECT 1 FROM public.tipos_user WHERE lower(nome) = 'equipa');
