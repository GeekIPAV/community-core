
-- 1. Tabela pessoa_tipos
CREATE TABLE public.pessoa_tipos (
  pessoa_id uuid NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  tipo_user_id uuid NOT NULL REFERENCES public.tipos_user(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pessoa_id, tipo_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pessoa_tipos TO authenticated;
GRANT ALL ON public.pessoa_tipos TO service_role;

ALTER TABLE public.pessoa_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff gere pessoa_tipos"
  ON public.pessoa_tipos
  FOR ALL
  TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE POLICY "Utilizador vê os próprios tipos"
  ON public.pessoa_tipos
  FOR SELECT
  TO authenticated
  USING (pessoa_id = public.current_user_pessoa_id());

CREATE INDEX idx_pessoa_tipos_tipo ON public.pessoa_tipos(tipo_user_id);

-- 2. + 4. Actualizar get_estatisticas_publicas
CREATE OR REPLACE FUNCTION public.get_estatisticas_publicas()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
  v_atividades_total int;
  v_atividades_por_categoria jsonb;
  v_atividades_top jsonb;
  v_idades_detalhe jsonb;
BEGIN
  SELECT COUNT(*) INTO v_familias_total FROM public.familias;

  SELECT COUNT(*) INTO v_membros_familias_total
    FROM public.pessoas
   WHERE status = 'ativo' AND deleted_at IS NULL AND familia_id IS NOT NULL;

  SELECT COUNT(*) INTO v_projetos_total FROM public.acoes WHERE tipo = 'projeto';
  SELECT COUNT(*) INTO v_eventos_total  FROM public.acoes WHERE tipo = 'evento';

  SELECT COUNT(*) INTO v_participantes_projetos_total
    FROM public.inscricoes i JOIN public.acoes a ON a.id = i.acao_id
   WHERE a.tipo = 'projeto' AND i.status <> 'cancelada';

  SELECT COUNT(*) INTO v_participantes_eventos_total
    FROM public.inscricoes i JOIN public.acoes a ON a.id = i.acao_id
   WHERE a.tipo = 'evento' AND i.status <> 'cancelada';

  SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'participantes', participantes) ORDER BY participantes DESC), '[]'::jsonb)
    INTO v_projetos_detalhe
    FROM (SELECT a.nome, COUNT(i.id)::int AS participantes
            FROM public.acoes a
            LEFT JOIN public.inscricoes i ON i.acao_id = a.id AND i.status <> 'cancelada'
           WHERE a.tipo = 'projeto'
           GROUP BY a.id, a.nome) p;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nacionalidade, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_nacionalidades_detalhe
    FROM (SELECT nacionalidade, COUNT(*)::int AS c FROM public.pessoas
           WHERE status='ativo' AND deleted_at IS NULL AND nacionalidade IS NOT NULL AND length(trim(nacionalidade))>0
           GROUP BY nacionalidade) n;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', religiao, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_religioes_detalhe
    FROM (SELECT religiao, COUNT(*)::int AS c FROM public.pessoas
           WHERE status='ativo' AND deleted_at IS NULL AND religiao IS NOT NULL AND length(trim(religiao))>0
           GROUP BY religiao) r;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', genero, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_generos_detalhe
    FROM (SELECT genero, COUNT(*)::int AS c FROM public.pessoas
           WHERE status='ativo' AND deleted_at IS NULL AND genero IS NOT NULL AND length(trim(genero))>0
           GROUP BY genero) g;

  SELECT COUNT(*) INTO v_voluntarios_total
    FROM public.pessoas
   WHERE is_voluntario = true AND status='ativo' AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_atividades_total FROM public.familia_atividades;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_atividades_por_categoria
    FROM (SELECT COALESCE(NULLIF(trim(ac.categoria),''), '(Sem categoria)') AS nome, COUNT(*)::int AS c
            FROM public.familia_atividades fa
            JOIN public.atividades_catalogo ac ON ac.id = fa.atividade_id
           GROUP BY 1) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_atividades_top
    FROM (SELECT ac.nome, COUNT(*)::int AS c
            FROM public.familia_atividades fa
            JOIN public.atividades_catalogo ac ON ac.id = fa.atividade_id
           GROUP BY ac.nome
           ORDER BY COUNT(*) DESC
           LIMIT 10) t;

  -- Distribuição por faixa etária
  WITH faixas AS (
    SELECT faixa, ord FROM (VALUES
      ('< 18', 1),
      ('18–25', 2),
      ('26–35', 3),
      ('36–45', 4),
      ('46–60', 5),
      ('> 60', 6)
    ) AS f(faixa, ord)
  ),
  contagens AS (
    SELECT
      CASE
        WHEN idade < 18 THEN '< 18'
        WHEN idade BETWEEN 18 AND 25 THEN '18–25'
        WHEN idade BETWEEN 26 AND 35 THEN '26–35'
        WHEN idade BETWEEN 36 AND 45 THEN '36–45'
        WHEN idade BETWEEN 46 AND 60 THEN '46–60'
        ELSE '> 60'
      END AS faixa,
      COUNT(*)::int AS c
    FROM (
      SELECT EXTRACT(YEAR FROM age(data_nascimento))::int AS idade
        FROM public.pessoas
       WHERE status='ativo'
         AND deleted_at IS NULL
         AND data_nascimento IS NOT NULL
    ) s
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('faixa', f.faixa, 'count', COALESCE(c.c,0)) ORDER BY f.ord), '[]'::jsonb)
    INTO v_idades_detalhe
    FROM faixas f LEFT JOIN contagens c ON c.faixa = f.faixa;

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
    'voluntarios_total', v_voluntarios_total,
    'atividades_total', v_atividades_total,
    'atividades_por_categoria', v_atividades_por_categoria,
    'atividades_top', v_atividades_top,
    'idades_detalhe', v_idades_detalhe
  );
END;
$function$;
