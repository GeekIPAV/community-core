CREATE OR REPLACE FUNCTION public.fundir_perfis(principal uuid, duplicado uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF principal = duplicado THEN
    RAISE EXCEPTION 'O perfil principal e o duplicado não podem ser o mesmo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pessoas WHERE id = principal) THEN
    RAISE EXCEPTION 'Perfil principal não encontrado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pessoas WHERE id = duplicado) THEN
    RAISE EXCEPTION 'Perfil duplicado não encontrado';
  END IF;

  UPDATE public.inscricoes
     SET pessoa_id = principal
   WHERE pessoa_id = duplicado
     AND NOT EXISTS (
       SELECT 1 FROM public.inscricoes i2
       WHERE i2.pessoa_id = principal
         AND i2.acao_id = public.inscricoes.acao_id
         AND i2.status <> 'cancelada'
     );

  UPDATE public.inscricoes
     SET status = 'cancelada'
   WHERE pessoa_id = duplicado;

  UPDATE public.pessoas
     SET status = 'fundido',
         fundido_em = principal
   WHERE id = duplicado;

  -- Garante que o perfil principal deixa de ser sinalizado como suspeito
  UPDATE public.pessoas
     SET status = 'ativo',
         ignorar_duplicado = true
   WHERE id = principal
     AND status = 'suspeito_duplicado';
END;
$function$;