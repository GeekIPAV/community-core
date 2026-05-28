CREATE OR REPLACE FUNCTION public.get_agrupamento(p_tabela text, p_coluna text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- PESSOAS
  IF p_tabela = 'pessoas' THEN
    IF p_coluna = 'genero' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT COALESCE(NULLIF(trim(genero), ''), '(sem valor)') AS nome, COUNT(*)::int AS c
                FROM public.pessoas WHERE status = 'ativo' GROUP BY 1) t;
    ELSIF p_coluna = 'nacionalidade' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT COALESCE(NULLIF(trim(nacionalidade), ''), '(sem valor)') AS nome, COUNT(*)::int AS c
                FROM public.pessoas WHERE status = 'ativo' GROUP BY 1) t;
    ELSIF p_coluna = 'religiao' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT COALESCE(NULLIF(trim(religiao), ''), '(sem valor)') AS nome, COUNT(*)::int AS c
                FROM public.pessoas WHERE status = 'ativo' GROUP BY 1) t;
    ELSIF p_coluna = 'cidade_residencia' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT COALESCE(NULLIF(trim(cidade_residencia), ''), '(sem valor)') AS nome, COUNT(*)::int AS c
                FROM public.pessoas WHERE status = 'ativo' GROUP BY 1) t;
    ELSIF p_coluna = 'profissao' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT COALESCE(NULLIF(trim(profissao), ''), '(sem valor)') AS nome, COUNT(*)::int AS c
                FROM public.pessoas WHERE status = 'ativo' GROUP BY 1) t;
    ELSIF p_coluna = 'is_voluntario' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT CASE WHEN is_voluntario THEN 'Voluntário' ELSE 'Não voluntário' END AS nome, COUNT(*)::int AS c
                FROM public.pessoas WHERE status = 'ativo' GROUP BY 1) t;
    ELSIF p_coluna = 'status' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT status::text AS nome, COUNT(*)::int AS c FROM public.pessoas GROUP BY 1) t;
    ELSIF p_coluna = 'familia' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT COALESCE(f.nome, '(sem família)') AS nome, COUNT(*)::int AS c
                FROM public.pessoas p
                LEFT JOIN public.familias f ON f.id = p.familia_id
               WHERE p.status = 'ativo' GROUP BY 1) t;
    ELSIF p_coluna = 'tipo_user' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT COALESCE(tu.nome, '(sem tipo)') AS nome, COUNT(*)::int AS c
                FROM public.pessoas p
                LEFT JOIN public.tipos_user tu ON tu.id = p.tipo_user_id
               WHERE p.status = 'ativo' GROUP BY 1) t;
    ELSIF p_coluna = 'projetos' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT pr.nome AS nome, COUNT(*)::int AS c
                FROM public.pessoas p
                CROSS JOIN LATERAL unnest(p.projeto_ids) AS pid
                JOIN public.projetos pr ON pr.id = pid
               WHERE p.status = 'ativo' GROUP BY pr.nome) t;
    END IF;

  -- FAMILIAS
  ELSIF p_tabela = 'familias' THEN
    IF p_coluna = 'status' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT COALESCE(NULLIF(trim(status), ''), '(sem valor)') AS nome, COUNT(*)::int AS c
                FROM public.familias GROUP BY 1) t;
    END IF;

  -- ACOES
  ELSIF p_tabela = 'acoes' THEN
    IF p_coluna = 'tipo' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT tipo AS nome, COUNT(*)::int AS c FROM public.acoes GROUP BY 1) t;
    ELSIF p_coluna = 'status' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT status AS nome, COUNT(*)::int AS c FROM public.acoes GROUP BY 1) t;
    ELSIF p_coluna = 'inscricoes_abertas' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT CASE WHEN inscricoes_abertas THEN 'Abertas' ELSE 'Fechadas' END AS nome, COUNT(*)::int AS c
                FROM public.acoes GROUP BY 1) t;
    ELSIF p_coluna = 'local' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT COALESCE(NULLIF(trim(local), ''), '(sem local)') AS nome, COUNT(*)::int AS c
                FROM public.acoes GROUP BY 1) t;
    END IF;

  -- INSCRICOES
  ELSIF p_tabela = 'inscricoes' THEN
    IF p_coluna = 'status' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT status::text AS nome, COUNT(*)::int AS c FROM public.inscricoes GROUP BY 1) t;
    ELSIF p_coluna = 'acao' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT a.nome AS nome, COUNT(*)::int AS c
                FROM public.inscricoes i JOIN public.acoes a ON a.id = i.acao_id
               WHERE i.status <> 'cancelada' GROUP BY a.nome) t;
    ELSIF p_coluna = 'tipo_acao' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb) INTO v_result
        FROM (SELECT a.tipo AS nome, COUNT(*)::int AS c
                FROM public.inscricoes i JOIN public.acoes a ON a.id = i.acao_id
               WHERE i.status <> 'cancelada' GROUP BY a.tipo) t;
    END IF;
  END IF;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Combinação tabela/coluna não suportada: %.%', p_tabela, p_coluna;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agrupamento(text, text) TO anon, authenticated;