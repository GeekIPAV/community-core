
-- ==========================================
-- ATIVIDADES CATÁLOGO
-- ==========================================
CREATE TABLE public.atividades_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  categoria text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividades_catalogo TO authenticated;
GRANT SELECT ON public.atividades_catalogo TO anon;
GRANT ALL ON public.atividades_catalogo TO service_role;

ALTER TABLE public.atividades_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY atividades_catalogo_select_all ON public.atividades_catalogo
  FOR SELECT TO anon, authenticated USING (true);

-- qualquer utilizador autenticado pode adicionar novas atividades ao catálogo
CREATE POLICY atividades_catalogo_auth_insert ON public.atividades_catalogo
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY atividades_catalogo_admin_update ON public.atividades_catalogo
  FOR UPDATE TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

CREATE POLICY atividades_catalogo_admin_delete ON public.atividades_catalogo
  FOR DELETE TO authenticated USING (is_current_user_admin());

CREATE TRIGGER atividades_catalogo_updated_at
  BEFORE UPDATE ON public.atividades_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==========================================
-- ATIVIDADES POR FAMÍLIA
-- ==========================================
CREATE TABLE public.familia_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
  atividade_id uuid NOT NULL REFERENCES public.atividades_catalogo(id) ON DELETE RESTRICT,
  data date,
  descricao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX familia_atividades_familia_idx ON public.familia_atividades(familia_id);
CREATE INDEX familia_atividades_atividade_idx ON public.familia_atividades(atividade_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.familia_atividades TO authenticated;
GRANT ALL ON public.familia_atividades TO service_role;

ALTER TABLE public.familia_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY familia_atividades_admin_all ON public.familia_atividades
  FOR ALL TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

CREATE POLICY familia_atividades_self_select ON public.familia_atividades
  FOR SELECT TO authenticated
  USING (familia_id = current_user_familia_id());

CREATE POLICY familia_atividades_self_insert ON public.familia_atividades
  FOR INSERT TO authenticated
  WITH CHECK (familia_id = current_user_familia_id());

CREATE POLICY familia_atividades_self_update ON public.familia_atividades
  FOR UPDATE TO authenticated
  USING (familia_id = current_user_familia_id())
  WITH CHECK (familia_id = current_user_familia_id());

CREATE POLICY familia_atividades_self_delete ON public.familia_atividades
  FOR DELETE TO authenticated
  USING (familia_id = current_user_familia_id());

CREATE TRIGGER familia_atividades_updated_at
  BEFORE UPDATE ON public.familia_atividades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==========================================
-- SEED DO CATÁLOGO
-- ==========================================
INSERT INTO public.atividades_catalogo (nome, categoria) VALUES
  ('Fomos a um evento típico', 'Cultural'),
  ('Fomos apresentados uns aos outros, no Magusto da MEERU', 'Relacional'),
  ('Acompanhamento a consulta', 'Económica Educacional e da Saúde'),
  ('Ida às urgências', 'Económica Educacional e da Saúde'),
  ('Fomos à praia', 'Relacional'),
  ('Apresentação das crianças na escola', 'Económica Educacional e da Saúde'),
  ('Assistimos ao nascimento do Saeed', 'Económica Educacional e da Saúde'),
  ('Fomos às urgências (promoção leve dois, pague um); ajudamos nos trabalhos de casa', 'Económica Educacional e da Saúde'),
  ('Urgência no hospital com um membro da família', 'Económica Educacional e da Saúde'),
  ('Realizar encontros casuais', NULL),
  ('Ajudar a família na procura de casa', NULL),
  ('Dar a conhecer à família a rede de transportes públicos - promoção da autonomia', NULL),
  ('Acompanhamento a Atividades Extra Curriculares', 'Económica Educacional e da Saúde'),
  ('Ajudar a família a tratar de assuntos relacionados com a vida escolar', 'Económica Educacional e da Saúde'),
  ('Participar em Eventos da Cidade com a família', 'Cultural'),
  ('Acompanhamento ao hospital/Centro de Saúde', 'Económica Educacional e da Saúde'),
  ('Participar em Eventos da Comunidade MEERU', 'Relacional'),
  ('Acompanhar a atendimento no IEFP', 'Económica Educacional e da Saúde'),
  ('Acompanhar a atendimento no IMT', 'Económica Educacional e da Saúde'),
  ('Divulgar curso de Português junto da Família', 'Mediação'),
  ('A pedido da família, comunicar à Equipa Técnica da MEERU questões relacionadas com o sistema escolar (professores, educadores)', 'Mediação'),
  ('A pedido da família, comunicar à Equipa Técnica da MEERU pedidos de ajuda com processo de acolhimento em Portugal de outros familiares', 'Mediação'),
  ('A pedido da família, comunicar à Equipa Técnica da MEERU questões legais/documentação (renovação de títulos de residência, passaportes, pedidos de abonos, mudanças de moradas fiscais)', 'Mediação'),
  ('A pedido da família, comunicar à Equipa Técnica da MEERU desafios profissionais', 'Mediação'),
  ('A pedido da família, comunicar à Equipa Técnica da MEERU necessidade de frequência de formações de português', 'Mediação'),
  ('A pedido da família, comunicar à Equipa Técnica da MEERU necessidade de frequência de formações profissionais/de obtenção de qualificações profissionais', 'Mediação'),
  ('A pedido da família, comunicar à Equipa Técnica da MEERU a necessidade de frequência de explicações', 'Mediação'),
  ('A pedido da família, comunicar à Equipa Técnica da MEERU necessidades habitacionais', 'Mediação'),
  ('A pedido da família, comunicar à Equipa Técnica da MEERU um problema de saúde', 'Mediação'),
  ('Praticar a língua portuguesa com a família', 'Económica Educacional e da Saúde'),
  ('Ensinar palavras novas em português', 'Económica Educacional e da Saúde'),
  ('Partilhar músicas portuguesas para escuta do português', 'Económica Educacional e da Saúde'),
  ('Ajudar na candidatura a um emprego', 'Económica Educacional e da Saúde'),
  ('Ajudar na preparação para uma entrevista de emprego', 'Económica Educacional e da Saúde'),
  ('Ajudar na elaboração do Curriculum Vitae', 'Económica Educacional e da Saúde'),
  ('Procurar oportunidades de trabalho', 'Económica Educacional e da Saúde'),
  ('Ajudar a estudar para testes e exames escolares', 'Económica Educacional e da Saúde'),
  ('Ajudar na realização dos trabalhos de casa', 'Económica Educacional e da Saúde'),
  ('Acompanhar Encarregado de Educação numa reunião escolar', 'Económica Educacional e da Saúde'),
  ('Procurar soluções a nível de saúde dentária, oftalmologia, etc.', 'Económica Educacional e da Saúde'),
  ('Acompanhar numa ida à farmácia', 'Económica Educacional e da Saúde'),
  ('Acompanhar numa consulta ou tratamentos médicos', 'Económica Educacional e da Saúde'),
  ('Ajudar na procura de habitação', 'Económica Educacional e da Saúde'),
  ('Ajudar na melhoria das condições habitacionais, por exemplo, em pequenas obras em casa.', 'Económica Educacional e da Saúde'),
  ('Ajudar no diálogo com o senhorio', 'Económica Educacional e da Saúde'),
  ('Acompanhar a atendimento nos Serviços Municipais', 'Económica Educacional e da Saúde'),
  ('Acompanhar a atendimento no Serviço de Finanças', 'Económica Educacional e da Saúde'),
  ('Acompanhar a atendimento na Segurança Social', 'Económica Educacional e da Saúde'),
  ('Acompanhar a atendimento no SEF', 'Económica Educacional e da Saúde'),
  ('Traduzir cartas e e-mails, por exemplo, da Segurança Social, Finanças, Banco, SEF, Escola, entre outros.', 'Económica Educacional e da Saúde'),
  ('Acompanhar um membro da família no trajeto casa - supermercado de transportes públicos', 'Económica Educacional e da Saúde'),
  ('Acompanhar um membro da família no trajeto casa - trabalho/escola de transportes públicos', 'Económica Educacional e da Saúde'),
  ('Ajudar a família a inscrever-se num grupos cultural ou desportivo.', 'Cultural'),
  ('Assistir a um jogo de futebol ou semelhante num estádio com a família.', 'Cultural'),
  ('Acompanhar a família a festas ou celebrações escolares.', 'Cultural'),
  ('Participar juntos em celebrações religiosas (celebrar o Natal, o Eid, a Páscoa, etc)', 'Cultural'),
  ('Participar juntos em celebrações culturais (festejar o Carnaval, Santos Populares, Magusto, etc)', 'Cultural'),
  ('Ir à praia, rio ou pisicina com a família', 'Cultural'),
  ('"Ser turista" com a família numa cidade portuguesa que a família ainda não conheça', 'Cultural'),
  ('Fazer uma visita guiada à cidade de residência da família', 'Cultural'),
  ('Visitar uma quinta pedagógica/zoo com a família', 'Cultural'),
  ('Aprender uma receita de um prato típico da cultura da família', 'Cultural'),
  ('Ensinar uma receita de um prato típico português à família', 'Cultural'),
  ('Passear no parque mais próximo da residência da família', 'Cultural'),
  ('Visitar um museu na cidade mais próxima da residência da família', 'Cultural'),
  ('Fazer um piquenique', 'Relacional'),
  ('Celebrar aniversários de voluntários e membros da família', 'Relacional'),
  ('Praticar desporto com a família (jogar basket, futebol, dançar, caminhar, correr, etc)', 'Relacional'),
  ('Tomar conta das crianças da família quando necessário', 'Relacional'),
  ('Conhecer um amigo de um membro da família', 'Relacional'),
  ('Apresentar um membro da família a familiares', 'Relacional'),
  ('Apresentar um membro da família a outros amigos', 'Relacional'),
  ('Ajudar a família a apresentar-se aos seus vizinhos.', 'Relacional'),
  ('Realizar encontros casuais em casa dos voluntários (partilha de refeições, cafés, conversas)', 'Relacional'),
  ('Realizar encontros casuais em casa da família (partilha de refeições, cafés, conversas)', 'Relacional')
ON CONFLICT (nome) DO NOTHING;

-- ==========================================
-- ATUALIZAR ESTATÍSTICAS PÚBLICAS
-- ==========================================
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
BEGIN
  SELECT COUNT(*) INTO v_familias_total FROM public.familias;

  SELECT COUNT(*) INTO v_membros_familias_total
    FROM public.pessoas
   WHERE status = 'ativo' AND familia_id IS NOT NULL;

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
           WHERE status='ativo' AND nacionalidade IS NOT NULL AND length(trim(nacionalidade))>0
           GROUP BY nacionalidade) n;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', religiao, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_religioes_detalhe
    FROM (SELECT religiao, COUNT(*)::int AS c FROM public.pessoas
           WHERE status='ativo' AND religiao IS NOT NULL AND length(trim(religiao))>0
           GROUP BY religiao) r;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', genero, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_generos_detalhe
    FROM (SELECT genero, COUNT(*)::int AS c FROM public.pessoas
           WHERE status='ativo' AND genero IS NOT NULL AND length(trim(genero))>0
           GROUP BY genero) g;

  SELECT COUNT(*) INTO v_voluntarios_total
    FROM public.pessoas WHERE status='ativo' AND is_voluntario = true;

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
    'atividades_top', v_atividades_top
  );
END;
$function$;
