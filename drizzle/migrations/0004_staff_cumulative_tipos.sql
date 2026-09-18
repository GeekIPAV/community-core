CREATE OR REPLACE FUNCTION public.is_current_user_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT p.is_admin
          OR EXISTS (
            SELECT 1 FROM public.tipos_user tu
             WHERE tu.id = p.tipo_user_id
               AND lower(tu.nome) = 'equipa'
          )
          OR EXISTS (
            SELECT 1
              FROM public.pessoa_tipos pt
              JOIN public.tipos_user tu2 ON tu2.id = pt.tipo_user_id
             WHERE pt.pessoa_id = p.id
               AND lower(tu2.nome) = 'equipa'
          )
        FROM public.pessoas p
       WHERE p.id = public.current_user_pessoa_id()
    ),
    false
  );
$function$;