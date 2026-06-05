CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := NEW.email;
  v_existing_id uuid;
  v_nome text;
BEGIN
  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RETURN NEW;
  END IF;

  -- Try to link to an existing active pessoa by email
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
           email = COALESCE(email, v_email)
     WHERE id = v_existing_id;
    RETURN NEW;
  END IF;

  -- Avoid creating duplicate if already linked
  IF EXISTS (SELECT 1 FROM public.pessoas WHERE auth_user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_nome := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(v_email, '@', 1)
  );

  INSERT INTO public.pessoas (nome_completo, email, auth_user_id, status, is_admin)
  VALUES (v_nome, v_email, NEW.id, 'ativo', false);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();