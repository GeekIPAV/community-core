ALTER TABLE public.pessoas ADD COLUMN IF NOT EXISTS ignorar_duplicado boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.detect_pessoa_duplicado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'ativo' AND COALESCE(NEW.ignorar_duplicado, false) = false THEN
    IF (
      NEW.email IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.pessoas
        WHERE status = 'ativo'
          AND id <> NEW.id
          AND email IS NOT NULL
          AND lower(email) = lower(NEW.email)
      )
    ) OR (
      NEW.data_nascimento IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.pessoas
        WHERE status = 'ativo'
          AND id <> NEW.id
          AND data_nascimento = NEW.data_nascimento
          AND split_part(lower(nome_completo), ' ', 1) = split_part(lower(NEW.nome_completo), ' ', 1)
      )
    ) THEN
      NEW.status := 'suspeito_duplicado';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;