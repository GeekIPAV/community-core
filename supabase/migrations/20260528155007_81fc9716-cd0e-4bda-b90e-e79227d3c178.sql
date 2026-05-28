CREATE OR REPLACE FUNCTION public.get_estatisticas_publicas()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_familias_total int;
  v_membros_familias_total int;
  v_projetos_total int;
  v_participantes_projetos_total int;
  v_projetos_detalhe jsonb;
  v_eventos_total int;
  v_participantes_eventos_total int;
  v_nacionalidades_detalhe jsonb;
  v_religioes_detalhe jsonb;
  v_generos_detalhe jsonb;
  v_voluntarios_total int;
BEGIN
  SELECT COUNT(*) INTO v_familias_total FROM public.familias;

  SELECT COUNT(*) INTO v_membros_familias_total
    FROM public.pessoas
   WHERE status = 'ativo' AND familia_id IS NOT NULL;

  SELECT COUNT(*) INTO v_projetos_total
    FROM public.acoes WHERE tipo = 'projeto';

  SELECT COUNT(*) INTO v_eventos_total
    FROM public.acoes WHERE tipo = 'evento';

  SELECT COUNT(*) INTO v_participantes_projetos_total
    FROM public.inscricoes i
    JOIN public.acoes a ON a.id = i.acao_id
   WHERE a.tipo = 'projeto' AND i.status <> 'cancelada';

  SELECT COUNT(*) INTO v_participantes_eventos_total
    FROM public.inscricoes i
    JOIN public.acoes a ON a.id = i.acao_id
   WHERE a.tipo = 'evento' AND i.status <> 'cancelada';

  SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'participantes', participantes) ORDER BY participantes DESC), '[]'::jsonb)
    INTO v_projetos_detalhe
    FROM (
      SELECT a.nome, COUNT(i.id)::int AS participantes
        FROM public.acoes a
        LEFT JOIN public.inscricoes i ON i.acao_id = a.id AND i.status <> 'cancelada'
       WHERE a.tipo = 'projeto'
       GROUP BY a.id, a.nome
    ) p;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nacionalidade, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_nacionalidades_detalhe
    FROM (
      SELECT nacionalidade, COUNT(*)::int AS c
        FROM public.pessoas
       WHERE status = 'ativo' AND nacionalidade IS NOT NULL AND length(trim(nacionalidade)) > 0
       GROUP BY nacionalidade
    ) n;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', religiao, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_religioes_detalhe
    FROM (
      SELECT religiao, COUNT(*)::int AS c
        FROM public.pessoas
       WHERE status = 'ativo' AND religiao IS NOT NULL AND length(trim(religiao)) > 0
       GROUP BY religiao
    ) r;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', genero, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_generos_detalhe
    FROM (
      SELECT genero, COUNT(*)::int AS c
        FROM public.pessoas
       WHERE status = 'ativo' AND genero IS NOT NULL AND length(trim(genero)) > 0
       GROUP BY genero
    ) g;

  SELECT COUNT(*) INTO v_voluntarios_total
    FROM public.pessoas
   WHERE status = 'ativo' AND is_voluntario = true;

  RETURN jsonb_build_object(
    'familias_total', v_familias_total,
    'membros_familias_total', v_membros_familias_total,
    'projetos_total', v_projetos_total,
    'participantes_projetos_total', v_participantes_projetos_total,
    'projetos_detalhe', v_projetos_detalhe,
    'eventos_total', v_eventos_total,
    'participantes_eventos_total', v_participantes_eventos_total,
    'nacionalidades_total', jsonb_array_length(v_nacionalidades_detalhe),
    'nacionalidades_detalhe', v_nacionalidades_detalhe,
    'religioes_total', jsonb_array_length(v_religioes_detalhe),
    'religioes_detalhe', v_religioes_detalhe,
    'generos_detalhe', v_generos_detalhe,
    'voluntarios_total', v_voluntarios_total
  );
END;
$function$;